import type { Delta } from "../../deltas/types.js";

export interface CultureReligionResult {
  cultureConversions: number;
  heresyConversions: number;
  templeReconversions: number;
}

export interface CultureMeta {
  id: number;
  name: string;
}

export interface ReligionMeta {
  id: number;
  name: string;
  type: string;
}

export interface CultureFrontierCandidate {
  cellId: number;
  oldCultureId: number;
  targetCultureId: number;
  factionName: string;
  burgId: number | null;
  burgName: string | null;
}

export interface TempleCleanseCandidate {
  burgId: number;
  burgName: string;
  orthoReligionId: number;
  orthoReligionName: string;
  targetCellId: number;
  oldReligionId: number;
}

export interface HeresyCandidate {
  srcId: number;
  srcReligionId: number;
  targetCellId: number;
  oldReligionId: number;
  tx: number;
  ty: number;
  burgId: number | null;
  burgName: string | null;
}

export interface CultureReligionSnapshot {
  tick: number;
  loreDate: string;
  cultures: CultureMeta[];
  religions: ReligionMeta[];
  templeProtectedCenters: Array<{ cx: number; cy: number }>;
  chaosByCell: Array<{ cellId: number; intensity: number }>;
  cultFrontierRows: CultureFrontierCandidate[];
  cleanseRows: TempleCleanseCandidate[];
  heresyRows: HeresyCandidate[];
}

/** Deterministic per-(cell, tick) [0, 1) hash so diffusion never perturbs downstream Math.random() streams. */
export function seededFraction(cellId: number, tick: number, salt: number): number {
  let h = (Math.imul(cellId ^ salt, 2654435761) ^ Math.imul(tick + 17, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * Pure Culture & Religion diffusion step: evaluates sovereign frontier cultural assimilation,
 * temple orthodoxy cleansing, and cult/chaos-assisted heresy spread into validated deltas.
 */
export function stepCultureReligion(
  snap: CultureReligionSnapshot
): { result: CultureReligionResult; deltas: Delta[] } {
  const deltas: Delta[] = [];
  let cultureConversions = 0;
  let heresyConversions = 0;
  let templeReconversions = 0;

  const cultureNameById = new Map<number, string>();
  for (const c of snap.cultures) cultureNameById.set(c.id, c.name);

  const relNameById = new Map<number, string>();
  const cultReligions: Array<{ id: number; name: string }> = [];
  const cultRelIdSet = new Set<number>();
  for (const r of snap.religions) {
    relNameById.set(r.id, r.name);
    if (r.type === "Cult") {
      cultRelIdSet.add(r.id);
      cultReligions.push({ id: r.id, name: r.name });
    }
  }

  const cultureUpdates = new Map<number, { cellId: number; oldId: number; newId: number }>();
  const religionUpdates = new Map<number, { cellId: number; oldId: number; newId: number }>();
  const burgUnrestDeltas = new Map<number, number>();
  let eventsCount = 0;

  // 1. Cultural Assimilation: sovereign land cells with an adjacent same-culture neighbor
  for (const row of snap.cultFrontierRows) {
    if (cultureConversions >= 4) break;
    const cid = row.cellId;
    if (seededFraction(cid, snap.tick, 0x51a1) < 0.55) {
      const oldC = row.oldCultureId || 0;
      const newC = row.targetCultureId;
      if (newC <= 0 || oldC === newC) continue;
      cultureUpdates.set(cid, { cellId: cid, oldId: oldC, newId: newC });
      cultureConversions++;
      if (eventsCount < 2) {
        const cultName = cultureNameById.get(newC) || `Culture #${newC}`;
        const oldName = cultureNameById.get(oldC) || "Frontier Folk";
        const place = row.burgName ? `${row.burgName} (Cell #${cid})` : `Cell #${cid}`;
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "CULTURAL_CONVERSION",
          message: `🏛️ CULTURAL ASSIMILATION: Borderlands around ${place} adopted ${cultName} customs under ${row.factionName}, displacing ${oldName} traditions.`,
          tier: "MINOR",
          burgId: row.burgId ?? undefined,
          cellId: cid,
          loreDate: snap.loreDate,
        });
        eventsCount++;
      }
    }
  }

  // 2. Temple Orthodoxy Pushback (`temple = true` burgs cleanse nearby Cult cells)
  if (cultReligions.length > 0) {
    for (const row of snap.cleanseRows) {
      const cid = row.targetCellId;
      if (religionUpdates.has(cid)) continue;
      const oldR = row.oldReligionId || 0;
      const newR = row.orthoReligionId;
      if (newR <= 0 || oldR === newR) continue;
      religionUpdates.set(cid, { cellId: cid, oldId: oldR, newId: newR });
      burgUnrestDeltas.set(row.burgId, (burgUnrestDeltas.get(row.burgId) || 0) - 1);
      templeReconversions++;
      if (eventsCount < 4) {
        const oldName = relNameById.get(oldR) || "heretical sect";
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "TEMPLE_RECONVERSION",
          message: `🕯️ SANCTUARY RECLAMATION: Clergy from ${row.burgName}'s temple reconciled Cell #${cid} to ${row.orthoReligionName}, uprooting cells of ${oldName}.`,
          tier: "MINOR",
          burgId: row.burgId,
          cellId: cid,
          loreDate: snap.loreDate,
        });
        eventsCount++;
      }
    }
  }

  // 3. Heresy & Cult Diffusion (cell-to-cell from Cult cells and Chaos Zones)
  if (cultReligions.length > 0) {
    const chaosMap = new Map<number, number>();
    for (const ch of snap.chaosByCell) chaosMap.set(ch.cellId, ch.intensity);

    for (const row of snap.heresyRows) {
      if (heresyConversions >= 4) break;
      const cid = row.targetCellId;
      if (religionUpdates.has(cid)) continue;

      const protectedByTemple = snap.templeProtectedCenters.some(
        (t) => (row.tx - t.cx) ** 2 + (row.ty - t.cy) ** 2 <= 400
      );
      if (protectedByTemple) continue;

      const chaosIntensity = chaosMap.get(row.srcId) || 0;
      const spreadChance = chaosIntensity >= 35 ? 0.80 : 0.35;
      if (seededFraction(cid, snap.tick, 0x73e2) < spreadChance) {
        const srcRel = row.srcReligionId || 0;
        const targetCult = cultRelIdSet.has(srcRel)
          ? srcRel
          : cultReligions[(row.srcId + snap.tick) % cultReligions.length]!.id;
        const oldR = row.oldReligionId || 0;
        if (oldR === targetCult) continue;

        religionUpdates.set(cid, { cellId: cid, oldId: oldR, newId: targetCult });
        if (row.burgId) {
          burgUnrestDeltas.set(row.burgId, (burgUnrestDeltas.get(row.burgId) || 0) + 2);
        }
        heresyConversions++;
        if (eventsCount < 6) {
          const sectName = relNameById.get(targetCult) || `Cult #${targetCult}`;
          const place = row.burgName ? `${row.burgName} (Cell #${cid})` : `Cell #${cid}`;
          deltas.push({
            kind: "event.log",
            tick: snap.tick,
            type: "HERESY_SPREAD",
            message: `🌑 HERESY DIFFUSION: whispered rites of ${sectName} took root across ${place}${chaosIntensity >= 35 ? " beside active chaos blight" : ""}.`,
            tier: "MINOR",
            burgId: row.burgId ?? undefined,
            cellId: cid,
            loreDate: snap.loreDate,
          });
          eventsCount++;
        }
      }
    }
  }

  // Emit batched cell & counter adjustments deterministically
  if (cultureUpdates.size > 0) {
    const entries = Array.from(cultureUpdates.values()).sort((a, b) => a.cellId - b.cellId);
    const cultCellDeltas = new Map<number, number>();
    for (const e of entries) {
      deltas.push({ kind: "cell.set", cellId: e.cellId, fields: { culture_id: e.newId } });
      if (e.oldId > 0) cultCellDeltas.set(e.oldId, (cultCellDeltas.get(e.oldId) || 0) - 1);
      if (e.newId > 0) cultCellDeltas.set(e.newId, (cultCellDeltas.get(e.newId) || 0) + 1);
    }
    for (const cId of Array.from(cultCellDeltas.keys()).sort((a, b) => a - b)) {
      const delta = cultCellDeltas.get(cId)!;
      if (delta !== 0) deltas.push({ kind: "culture.adjustCells", cultureId: cId, delta });
    }
  }

  if (religionUpdates.size > 0) {
    const entries = Array.from(religionUpdates.values()).sort((a, b) => a.cellId - b.cellId);
    const relCellDeltas = new Map<number, number>();
    for (const e of entries) {
      deltas.push({ kind: "cell.set", cellId: e.cellId, fields: { religion_id: e.newId } });
      relCellDeltas.set(e.oldId, (relCellDeltas.get(e.oldId) || 0) - 1);
      relCellDeltas.set(e.newId, (relCellDeltas.get(e.newId) || 0) + 1);
    }
    for (const rId of Array.from(relCellDeltas.keys()).sort((a, b) => a - b)) {
      const delta = relCellDeltas.get(rId)!;
      if (delta !== 0) deltas.push({ kind: "religion.adjustCells", religionId: rId, delta });
    }
  }

  for (const bId of Array.from(burgUnrestDeltas.keys()).sort((a, b) => a - b)) {
    const delta = burgUnrestDeltas.get(bId)!;
    if (delta !== 0) deltas.push({ kind: "burg.adjust", burgId: bId, unrest: delta });
  }

  return {
    result: { cultureConversions, heresyConversions, templeReconversions },
    deltas,
  };
}
