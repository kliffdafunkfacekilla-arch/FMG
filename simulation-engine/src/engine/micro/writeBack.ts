import { readWorldClock } from "../clock/clock.js";
import { flushStepDeltas } from "../deltas/index.js";
import type { Db, Delta, OverlayChange } from "../deltas/types.js";
import { mapNpcIdToEntityRef, parseEntityRef } from "../entities/refs.js";
import { ensureEntity, getEntityByRef } from "../entities/registry.js";
import { hasObjectOverlay } from "./overlays.js";
import {
  isNotableEconomicProp,
  makeObjectEntityRef,
  resolvePropEconomicImpact,
} from "./propEconomy.js";

export interface MicroNpcInput {
  id: string;
  entity_ref?: string | undefined;
  name: string;
  pos?: [number, number] | undefined;
  inventory?: string[] | undefined;
}

export interface MicroPropInput {
  id: string;
  entity_ref?: string | undefined;
  name: string;
  pos?: [number, number] | undefined;
  tags?: Iterable<string> | undefined;
}

export interface WriteBackResult {
  applied: boolean;
  ref?: string | undefined;
  deltasApplied: number;
}

async function resolveClockPosition(
  db: Db,
  tick?: number,
  minute?: number
): Promise<{ tick: number; minute: number }> {
  if (tick !== undefined && minute !== undefined) {
    return { tick, minute };
  }
  const clk = await readWorldClock(db);
  return {
    tick: tick ?? clk.tick,
    minute: minute ?? clk.minute_of_day,
  };
}

async function lookupCellBurgId(db: Db, cellId: number): Promise<number | null> {
  if (!cellId || cellId <= 0) return null;
  const res = await db.query(`SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`, [cellId]);
  return res.rows[0]?.burg_id !== undefined ? Number(res.rows[0].burg_id) : null;
}

/**
 * Emits idempotent macro + entity + corpse-overlay deltas when an NPC dies on a tactical map.
 */
export async function writeBackNpcDeath(
  db: Db,
  opts: {
    npc: MicroNpcInput;
    cellId: number;
    rx: number;
    ry: number;
    z: number;
    tick?: number | undefined;
    minute?: number | undefined;
    cause?: string | undefined;
    source?: string | undefined;
  }
): Promise<WriteBackResult> {
  const { npc, cellId, rx, ry, z } = opts;
  const ref = npc.entity_ref || mapNpcIdToEntityRef(String(npc.id), { cellId, rx, ry });
  const parsed = parseEntityRef(ref);
  const { tick, minute } = await resolveClockPosition(db, opts.tick, opts.minute);
  const source = opts.source || "micro:BrutalGM";
  const cause = opts.cause || "Slain in tactical encounter";
  const posX = Array.isArray(npc.pos) && Number.isFinite(Number(npc.pos[0])) ? Math.round(Number(npc.pos[0])) : null;
  const posY = Array.isArray(npc.pos) && Number.isFinite(Number(npc.pos[1])) ? Math.round(Number(npc.pos[1])) : null;

  let entity = await getEntityByRef(db, ref);
  if (!entity) {
    entity = await ensureEntity(db, ref, {
      name: String(npc.name || npc.id),
      kind: parsed.prefix === "creature" ? "creature" : parsed.prefix === "squad" ? "group" : "person",
      lod: "micro",
      cellId,
      rx,
      ry,
      z,
      x: posX,
      y: posY,
      createdTick: tick,
    });
  }

  // Idempotency: skip if the entity is already dead or this tile already recorded their corpse overlay.
  if (entity && !entity.alive) {
    return { applied: false, ref, deltasApplied: 0 };
  }
  if (await hasObjectOverlay(db, cellId, rx, ry, z, ref, "placed")) {
    return { applied: false, ref, deltasApplied: 0 };
  }

  const burgId = await lookupCellBurgId(db, cellId);
  const deltas: Delta[] = [];

  if (parsed.prefix === "citizen" && parsed.numericId) {
    deltas.push({
      kind: "citizen.killOne",
      citizenId: parsed.numericId,
      cause,
      diedTick: tick,
    });
    deltas.push({
      kind: "event.log",
      tick,
      type: "MICRO_NPC_SLAIN",
      message: `${npc.name} (${cause}) perished in tactical sector ${cellId} (${rx},${ry}).`,
      tier: "MINOR",
      cellId,
      ...(burgId ? { burgId } : {}),
    });
  } else if (parsed.prefix === "paragon" && parsed.numericId) {
    deltas.push({
      kind: "paragon.die",
      paragonId: parsed.numericId,
      diedTick: tick,
      cause,
    });
    deltas.push({
      kind: "event.log",
      tick,
      type: "PARAGON_SLAIN",
      message: `${npc.name} fell in sector ${cellId} (${cause}).`,
      tier: "MAJOR",
      cellId,
      ...(burgId ? { burgId } : {}),
    });
  } else if (parsed.prefix === "squad") {
    const parts = parsed.rawId.split(":");
    const sqBurgId = Number(parts[0]) || burgId || 0;
    const unitType = parts.length >= 3 ? parts.slice(1, -1).join(":") : parts[1] || "INFANTRY";
    if (sqBurgId > 0) {
      deltas.push({
        kind: "burg.militaryAdjust",
        burgId: sqBurgId,
        unitType,
        delta: -1,
      });
    }
    deltas.push({ kind: "entity.die", ref, diedTick: tick });
    deltas.push({
      kind: "event.log",
      tick,
      type: "SQUAD_SLAIN",
      message: `${npc.name} was wiped out in sector ${cellId} (${cause}).`,
      tier: "MINOR",
      cellId,
      ...(sqBurgId > 0 ? { burgId: sqBurgId } : {}),
    });
  } else if (parsed.prefix === "agent" && parsed.numericId) {
    deltas.push({ kind: "agent.remove", agentId: parsed.numericId, reason: cause });
    deltas.push({ kind: "entity.die", ref, diedTick: tick });
    deltas.push({
      kind: "event.log",
      tick,
      type: "AGENT_SLAIN",
      message: `${npc.name} was slain in sector ${cellId} (${cause}).`,
      tier: "MAJOR",
      cellId,
      ...(burgId ? { burgId } : {}),
    });
  } else {
    deltas.push({ kind: "entity.die", ref, diedTick: tick });
  }

  deltas.push({
    kind: "overlay.add",
    cellId,
    rx,
    ry,
    z,
    x: posX,
    y: posY,
    objectRef: ref,
    change: "placed",
    payload: {
      corpseOf: ref,
      prop: {
        id: `prop_corpse_${npc.id}`,
        name: `${npc.name}'s Remains`,
        pos: npc.pos || [128, 128],
        tags: ["corpse", "carcass", "remains", "organic", "lootable"],
        hp: 10,
        maxHp: 10,
        inventory: Array.isArray(npc.inventory) ? [...npc.inventory] : [],
      },
    },
    tick,
    minute,
    source,
  });

  const out = await flushStepDeltas(db, source, tick, deltas, minute);
  const deltasApplied = Object.values(out.counts).reduce((sum, n) => sum + Number(n || 0), 0);
  return { applied: deltasApplied > 0, ref, deltasApplied };
}

/**
 * Emits an idempotent overlay delta plus any economic damage to the parent burg/infrastructure.
 */
export async function writeBackPropChange(
  db: Db,
  opts: {
    prop: MicroPropInput;
    change: OverlayChange;
    cellId: number;
    rx: number;
    ry: number;
    z: number;
    burgId?: number | null | undefined;
    tick?: number | undefined;
    minute?: number | undefined;
    source?: string | undefined;
    payload?: Record<string, any> | undefined;
  }
): Promise<WriteBackResult> {
  const { prop, change, cellId, rx, ry, z } = opts;
  const objectRef = String(prop.id || prop.entity_ref || "");
  if (!objectRef) return { applied: false, deltasApplied: 0 };

  if (await hasObjectOverlay(db, cellId, rx, ry, z, objectRef, change)) {
    return { applied: false, ref: objectRef, deltasApplied: 0 };
  }

  const { tick, minute } = await resolveClockPosition(db, opts.tick, opts.minute);
  const source = opts.source || "micro:BrutalGM";
  const burgId = opts.burgId !== undefined ? opts.burgId : await lookupCellBurgId(db, cellId);
  const propTags = prop.tags ? Array.from(prop.tags) : [];
  const econDeltas = resolvePropEconomicImpact(prop.name, propTags, change, burgId);

  const posX = Array.isArray(prop.pos) && Number.isFinite(Number(prop.pos[0])) ? Math.round(Number(prop.pos[0])) : null;
  const posY = Array.isArray(prop.pos) && Number.isFinite(Number(prop.pos[1])) ? Math.round(Number(prop.pos[1])) : null;

  const entityDeltas: Delta[] = [];
  let entityRefOut = objectRef;
  if (isNotableEconomicProp(prop.name, propTags)) {
    const objEntityRef =
      prop.entity_ref ||
      (String(prop.id || "").startsWith("object:")
        ? String(prop.id)
        : makeObjectEntityRef(cellId, rx, ry, z, String(prop.id)));
    prop.entity_ref = objEntityRef;
    entityRefOut = objEntityRef;
    const isDestructive = change === "burnt" || change === "destroyed";
    entityDeltas.push({
      kind: "entity.create",
      ref: objEntityRef,
      entityKind: "object",
      name: String(prop.name || prop.id),
      alive: !isDestructive,
      lod: "micro",
      cellId,
      rx,
      ry,
      z,
      x: posX,
      y: posY,
      sourceTable: "sim_sector_layers",
      sourceId: String(prop.id),
      createdTick: tick,
    });
    if (isDestructive) {
      entityDeltas.push({ kind: "entity.die", ref: objEntityRef, diedTick: tick });
    }
  }

  const deltas: Delta[] = [
    ...entityDeltas,
    ...econDeltas,
    {
      kind: "overlay.add",
      cellId,
      rx,
      ry,
      z,
      x: posX,
      y: posY,
      objectRef,
      change,
      payload: opts.payload ?? { name: prop.name, tags: propTags, entity_ref: entityRefOut !== objectRef ? entityRefOut : undefined },
      tick,
      minute,
      source,
    },
  ];

  const out = await flushStepDeltas(db, source, tick, deltas, minute);
  const deltasApplied = Object.values(out.counts).reduce((sum, n) => sum + Number(n || 0), 0);
  return { applied: deltasApplied > 0, ref: objectRef, deltasApplied };
}
