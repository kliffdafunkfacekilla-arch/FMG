import { hashSeed, mulberry32 } from "../rng.js";
import type { Db } from "../deltas/types.js";
import { mapNpcIdToEntityRef, parseEntityRef } from "../entities/refs.js";
import { markEntitiesDeadBatch, syncLayerEntities, upsertEntitiesBatch, type UpsertEntityInput } from "../entities/registry.js";
import { ensureBurgMicroCast } from "../lod/promote.js";
import { applyMapOverlays, loadTileOverlays } from "./overlays.js";
import { isNotableEconomicProp, makeObjectEntityRef } from "./propEconomy.js";

export interface ResyncMapCastResult {
  npcs: any[];
  props: any[];
  changed: boolean;
  removedRefs: string[];
  addedRefs: string[];
}

function buildMissingResidentNpc(
  citizen: any,
  cellId: number,
  rx: number,
  ry: number
): any {
  const rng = mulberry32(hashSeed(`resync:${cellId}:${rx}:${ry}:${citizen.citizen_id}`));
  const px = Math.round(92 + rng() * 72);
  const py = Math.round(92 + rng() * 72);
  const profession = String(citizen.profession || "Commoner");
  return {
    id: `npc_citizen_${citizen.citizen_id}`,
    entity_ref: `citizen:${citizen.citizen_id}`,
    name: `${citizen.name} (${profession})`,
    role: profession,
    pos: [px, py],
    tags: [
      String(citizen.species || "human").toLowerCase(),
      "civilian",
      citizen.workplace_type ? String(citizen.workplace_type).toLowerCase() : "trade",
      citizen.temper ? String(citizen.temper).toLowerCase() : "sanguine",
      citizen.instinct ? String(citizen.instinct).toLowerCase() : "fight",
      citizen.allegiance_status ? String(citizen.allegiance_status).toLowerCase() : "civilian",
      citizen.spark_tier && citizen.spark_tier !== "NONE" ? `spark:${String(citizen.spark_tier).toLowerCase()}` : "spark:null",
    ],
    want: citizen.want || undefined,
    flaw: citizen.flaw || undefined,
    lineWontCross: citizen.line_wont_cross || undefined,
    faction: "Provincial Sovereignty",
    hp: 25,
    maxHp: 25,
    disposition: 1,
    alive: true,
    equippedWeapon: profession.includes("Guard") ? "City Watch Spear" : "Carved Wooden Cudgel",
    equippedArmor: profession.includes("Guard") ? "Studded Leather Cuirass" : "Woven Wool Tunic",
    statAffinity: "vitality",
    memoryNotes: [
      citizen.workplace_name ? `Employed at ${citizen.workplace_name}.` : `Residing in Cell #${cellId}.`,
    ],
  };
}

/**
 * Re-syncs a cached sector layer cast against live PostgreSQL truth when loaded outside an active encounter.
 * Removes citizens/paragons/agents killed or departed in macro, adds newly settled town residents up to
 * capacity, preserves NPCs with party memory, and replays tile overlays onto props.
 */
export async function resyncMapCast(
  db: Db,
  opts: {
    cellId: number;
    rx: number;
    ry: number;
    z: number;
    npcs: any[];
    props: any[];
    burgId?: number | null | undefined;
    encounterActive?: boolean | undefined;
    persistLayer?: boolean | undefined;
  }
): Promise<ResyncMapCastResult> {
  const { cellId, rx, ry, z } = opts;
  const origNpcs = Array.isArray(opts.npcs) ? opts.npcs : [];
  const origProps = Array.isArray(opts.props) ? opts.props : [];

  if (opts.encounterActive) {
    return {
      npcs: origNpcs,
      props: origProps,
      changed: false,
      removedRefs: [],
      addedRefs: [],
    };
  }

  const refs: string[] = [];
  const citizenIds: number[] = [];
  const paragonIds: number[] = [];
  const agentIds: number[] = [];

  for (const n of origNpcs) {
    if (!n || !n.id) continue;
    const ref = n.entity_ref || mapNpcIdToEntityRef(String(n.id), { cellId, rx, ry });
    n.entity_ref = ref;
    refs.push(ref);
    const p = parseEntityRef(ref);
    if (p.prefix === "citizen" && p.numericId) citizenIds.push(p.numericId);
    else if (p.prefix === "paragon" && p.numericId) paragonIds.push(p.numericId);
    else if (p.prefix === "agent" && p.numericId) agentIds.push(p.numericId);
  }

  const deadRefs = new Set<string>();
  if (refs.length > 0) {
    const entRes = await db.query(
      `SELECT ref, alive FROM entities WHERE ref = ANY($1::text[]) AND alive = false`,
      [Array.from(new Set(refs))]
    );
    for (const r of entRes.rows) deadRefs.add(String(r.ref));
  }

  const staleRegistryRefs: string[] = [];
  if (citizenIds.length > 0) {
    const uniq = Array.from(new Set(citizenIds));
    const res = await db.query(
      `SELECT citizen_id, allegiance_status FROM population_demographics WHERE citizen_id = ANY($1::int[])`,
      [uniq]
    );
    const live = new Map<number, string>();
    for (const r of res.rows) live.set(Number(r.citizen_id), String(r.allegiance_status || "").toUpperCase());
    for (const cid of uniq) {
      const st = live.get(cid);
      if (!st || st === "DECEASED" || st === "DEPARTED") {
        const ref = `citizen:${cid}`;
        deadRefs.add(ref);
        if (st === "DECEASED") staleRegistryRefs.push(ref);
      }
    }
  }

  if (paragonIds.length > 0) {
    const uniq = Array.from(new Set(paragonIds));
    const res = await db.query(`SELECT id FROM sim_paragons WHERE id = ANY($1::int[])`, [uniq]);
    const live = new Set(res.rows.map((r: any) => Number(r.id)));
    for (const pid of uniq) {
      if (!live.has(pid)) {
        const ref = `paragon:${pid}`;
        deadRefs.add(ref);
        staleRegistryRefs.push(ref);
      }
    }
  }

  if (agentIds.length > 0) {
    const uniq = Array.from(new Set(agentIds));
    const res = await db.query(`SELECT id FROM sim_agents WHERE id = ANY($1::int[])`, [uniq]);
    const live = new Set(res.rows.map((r: any) => Number(r.id)));
    for (const aid of uniq) {
      if (!live.has(aid)) {
        const ref = `agent:${aid}`;
        deadRefs.add(ref);
        staleRegistryRefs.push(ref);
      }
    }
  }

  if (staleRegistryRefs.length > 0) {
    await markEntitiesDeadBatch(db, staleRegistryRefs, 0);
  }

  const removedRefs: string[] = [];
  const keptNpcs: any[] = [];
  const presentRefs = new Set<string>();

  for (const n of origNpcs) {
    const ref = String(n?.entity_ref || "");
    if (ref && deadRefs.has(ref)) {
      removedRefs.push(ref);
      continue;
    }
    if (n?.alive === false) {
      if (ref) removedRefs.push(ref);
      continue;
    }
    keptNpcs.push(n);
    if (ref) presentRefs.add(ref);
  }

  const addedRefs: string[] = [];
  const targetBurgId = opts.burgId ?? null;
  if (z === 0 && targetBurgId && targetBurgId > 0 && keptNpcs.length < 40) {
    let citRows = (await db.query(
      `SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation,
              want, flaw, line_wont_cross, workplace_type, workplace_name, allegiance_status
       FROM population_demographics
       WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')
       ORDER BY citizen_id ASC
       LIMIT 40`,
      [targetBurgId]
    )).rows;
    const unseated = citRows.filter((c: any) => !presentRefs.has(`citizen:${c.citizen_id}`) && !deadRefs.has(`citizen:${c.citizen_id}`));
    if (keptNpcs.length < 12 && unseated.length < 5) {
      citRows = await ensureBurgMicroCast(db, targetBurgId, cellId, Math.min(40, keptNpcs.length + 12), `cast:${cellId}:${rx}:${ry}`, 1);
    }
    let added = 0;
    for (const c of citRows) {
      if (added >= 5 || keptNpcs.length >= 40) break;
      const ref = `citizen:${c.citizen_id}`;
      if (presentRefs.has(ref) || deadRefs.has(ref)) continue;
      const npc = buildMissingResidentNpc(c, cellId, rx, ry);
      keptNpcs.push(npc);
      presentRefs.add(ref);
      addedRefs.push(ref);
      added++;
    }
    if (addedRefs.length > 0) {
      await syncLayerEntities(db, cellId, rx, ry, z, keptNpcs);
    }
  }

  const overlays = await loadTileOverlays(db, cellId, rx, ry, z);
  const resyncedProps = applyMapOverlays(origProps, overlays);

  // Sync economically/story-relevant objects into the unified entities registry (Phase 12.1)
  const notableObjectEntries: UpsertEntityInput[] = [];
  for (const p of resyncedProps) {
    if (!p || !p.id) continue;
    const pTags = Array.isArray(p.tags) ? p.tags.map(String) : [];
    if (!isNotableEconomicProp(String(p.name || ""), pTags)) continue;
    const objRef = p.entity_ref || makeObjectEntityRef(cellId, rx, ry, z, String(p.id));
    p.entity_ref = objRef;
    notableObjectEntries.push({
      ref: objRef,
      kind: "object",
      name: String(p.name || p.id),
      alive: !p.isDestroyed && !pTags.includes("burnt") && !pTags.includes("destroyed"),
      lod: "micro",
      cellId,
      rx,
      ry,
      z,
      x: Array.isArray(p.pos) && Number.isFinite(Number(p.pos[0])) ? Math.round(Number(p.pos[0])) : null,
      y: Array.isArray(p.pos) && Number.isFinite(Number(p.pos[1])) ? Math.round(Number(p.pos[1])) : null,
      sourceTable: "sim_sector_layers",
      sourceId: String(p.id),
    });
  }
  if (notableObjectEntries.length > 0) {
    await upsertEntitiesBatch(db, notableObjectEntries);
  }

  const castChanged = removedRefs.length > 0 || addedRefs.length > 0 || notableObjectEntries.length > 0;

  if (castChanged && opts.persistLayer) {
    await db.query(
      `UPDATE sim_sector_layers SET npcs = $1::jsonb
       WHERE cell_id = $2 AND rx = $3 AND ry = $4 AND z_layer = $5`,
      [JSON.stringify(keptNpcs), cellId, rx, ry, z]
    );
  }

  return {
    npcs: keptNpcs,
    props: resyncedProps,
    changed: castChanged || overlays.length > 0,
    removedRefs,
    addedRefs,
  };
}
