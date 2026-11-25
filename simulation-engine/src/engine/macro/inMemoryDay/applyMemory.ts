import type { Delta } from "../../deltas/types.js";
import type { CohortKey } from "../../entities/population.js";
import type { PromoteBatchSpec } from "../../lod/promote.js";
import type {
  InMemoryBurg,
  InMemoryCitizen,
  InMemoryCohort,
  WorldSnapshot,
} from "./types.js";

// Re-declare cleanly if imported by type
export type { WorldSnapshot };

interface NumAcc {
  hasSet: boolean;
  setVal: number;
  delta: number;
}
const zeroAcc = (): NumAcc => ({ hasSet: false, setVal: 0, delta: 0 });
const applyNumAdjust = (acc: NumAcc, delta: number | undefined) => {
  if (delta !== undefined && delta !== 0) acc.delta += delta;
};
const applyNumSet = (acc: NumAcc, val: number | undefined) => {
  if (val !== undefined) {
    acc.hasSet = true;
    acc.setVal = val;
    acc.delta = 0;
  }
};
const numActive = (acc: NumAcc): boolean => acc.hasSet || acc.delta !== 0;

function resolveNumInt(acc: NumAcc, cur: number, min: number, max?: number): number {
  if (!numActive(acc)) return cur;
  const raw = acc.hasSet ? acc.setVal + acc.delta : cur + acc.delta;
  const rounded = Math.round(raw);
  const clampedMin = Math.max(min, rounded);
  return max !== undefined ? Math.min(max, clampedMin) : clampedMin;
}

function resolveNumFloat(acc: NumAcc, cur: number, min: number, max?: number): number {
  if (!numActive(acc)) return cur;
  const raw = acc.hasSet ? acc.setVal + acc.delta : cur + acc.delta;
  const clampedMin = Math.max(min, raw);
  return max !== undefined ? Math.min(max, clampedMin) : clampedMin;
}

export function cohortKeyStr(k: CohortKey): string {
  return `${k.burgId}\0${k.species}\0${k.profession}\0${k.ageBand}\0${k.sparkTier}\0${k.isNull ? 1 : 0}\0${k.allegiance}`;
}

function bumpCohortCrewCount(world: WorldSnapshot, burgId: number, profession: string, delta: number): void {
  const existing = world.mutable.cohortCrewCounts.find(
    (c) => c.burgId === burgId && c.profession === profession
  );
  if (existing) {
    existing.count = Math.max(0, existing.count + delta);
  } else if (delta > 0) {
    world.mutable.cohortCrewCounts.push({ burgId, profession, count: delta });
  }
}

const LOGISTICS_PROFS = new Set([
  "Merchant Factor",
  "Merchant Trader",
  "Caravan Drover",
  "Caravan Guard",
  "Sailor",
  "Aether-Crew",
]);

export function computeWorkforceForBurgInMemory(
  world: WorldSnapshot,
  burgId: number
): Record<string, { records: number; people: number }> {
  const res: Record<string, { records: number; people: number }> = {};
  for (const c of world.mutable.citizens.values()) {
    if (c.settlementId === burgId && c.allegianceStatus === "CIVILIAN") {
      const entry = res[c.profession] || { records: 0, people: 0 };
      entry.records += 1;
      entry.people += Math.max(1, c.unitSize);
      res[c.profession] = entry;
    }
  }
  for (const coh of world.mutable.cohorts.values()) {
    if (coh.burgId === burgId && coh.allegiance === "CIVILIAN" && coh.count > 0) {
      const entry = res[coh.profession] || { records: 0, people: 0 };
      entry.records += Math.max(1, Math.round(coh.count / 12));
      entry.people += coh.count;
      res[coh.profession] = entry;
    }
  }
  return res;
}

export function ageCohortsYearlyInMemory(
  world: WorldSnapshot,
  adultTradeMap: Record<string, string>
): void {
  for (const c of world.mutable.citizens.values()) {
    if (c.allegianceStatus !== "DECEASED" && c.allegianceStatus !== "DEPARTED") {
      c.age += 1;
    }
  }

  const eligible: InMemoryCohort[] = [];
  for (const coh of world.mutable.cohorts.values()) {
    if (coh.allegiance !== "CIVILIAN") continue;
    if (
      (coh.ageBand === "CHILD" && coh.count >= 16) ||
      (coh.ageBand === "ADULT" && coh.count >= 40) ||
      (coh.ageBand === "ELDER" && coh.count >= 20)
    ) {
      eligible.push({ ...coh });
    }
  }
  eligible.sort((a, b) => a.burgId - b.burgId || a.profession.localeCompare(b.profession));

  const ops: Array<CohortKey & { delta: number }> = [];
  for (const base of eligible) {
    if (base.ageBand === "CHILD") {
      const grad = Math.floor(base.count / 16);
      if (grad > 0) {
        ops.push({ ...base, delta: -grad });
        ops.push({
          ...base,
          ageBand: "ADULT",
          profession: adultTradeMap[base.profession] || "Laborer",
          delta: grad,
        });
      }
    } else if (base.ageBand === "ADULT") {
      const aged = Math.floor(base.count / 40);
      if (aged > 0) {
        ops.push({ ...base, delta: -aged });
        ops.push({ ...base, ageBand: "ELDER", delta: aged });
      }
    } else if (base.ageBand === "ELDER") {
      const died = Math.floor(base.count / 20);
      if (died > 0) ops.push({ ...base, delta: -died });
    }
  }
  applyCohortOpsInMemory(world, ops);
}

export function applyCohortOpsInMemory(
  world: WorldSnapshot,
  ops: Array<CohortKey & { delta: number }>
): void {
  for (const op of ops) {
    const d = Math.round(op.delta);
    if (!Number.isFinite(d) || d === 0) continue;
    const key = cohortKeyStr(op);
    const cur = world.mutable.cohorts.get(key);
    if (cur) {
      const nextCount = Math.max(0, cur.count + d);
      const diff = nextCount - cur.count;
      cur.count = nextCount;
      if (diff !== 0 && op.ageBand === "ADULT" && op.allegiance === "CIVILIAN" && LOGISTICS_PROFS.has(op.profession)) {
        bumpCohortCrewCount(world, op.burgId, op.profession, diff);
      }
    } else if (d > 0) {
      world.mutable.cohorts.set(key, { ...op, count: d });
      if (op.ageBand === "ADULT" && op.allegiance === "CIVILIAN" && LOGISTICS_PROFS.has(op.profession)) {
        bumpCohortCrewCount(world, op.burgId, op.profession, d);
      }
    }
  }
}

export function retireCohortsInMemory(
  world: WorldSnapshot,
  requests: Array<{ burgId: number; people: number }>
): void {
  const byBurg = new Map<number, number>();
  for (const r of requests) {
    const p = Math.round(r.people);
    if (p > 0) byBurg.set(r.burgId, (byBurg.get(r.burgId) || 0) + p);
  }
  if (byBurg.size === 0) return;

  const ops: Array<CohortKey & { delta: number }> = [];
  for (const [bid, wanted] of byBurg) {
    const rows: InMemoryCohort[] = [];
    for (const c of world.mutable.cohorts.values()) {
      if (c.burgId === bid && c.allegiance === "CIVILIAN" && c.count > 0) rows.push(c);
    }
    rows.sort(
      (a, b) =>
        b.count - a.count ||
        a.profession.localeCompare(b.profession) ||
        a.species.localeCompare(b.species) ||
        a.ageBand.localeCompare(b.ageBand) ||
        a.sparkTier.localeCompare(b.sparkTier) ||
        (a.isNull === b.isNull ? 0 : a.isNull ? -1 : 1)
    );
    const avail = rows.reduce((s, r) => s + r.count, 0);
    if (avail <= 0 || wanted <= 0) continue;

    let remaining = Math.min(wanted, avail);
    const taken = new Array<number>(rows.length).fill(0);
    for (let i = 0; i < rows.length && remaining > 0; i++) {
      const share = Math.min(rows[i]!.count, Math.floor((wanted * rows[i]!.count) / avail));
      if (share > 0) {
        taken[i] = (taken[i] ?? 0) + share;
        remaining -= share;
      }
    }
    while (remaining > 0) {
      let progressed = false;
      for (let i = 0; i < rows.length && remaining > 0; i++) {
        if (taken[i]! < rows[i]!.count) {
          taken[i]! += 1;
          remaining -= 1;
          progressed = true;
        }
      }
      if (!progressed) break;
    }
    for (let i = 0; i < rows.length; i++) {
      if (taken[i]! > 0) ops.push({ ...rows[i]!, delta: -taken[i]! });
    }
  }
  applyCohortOpsInMemory(world, ops);
}

export function zeroBurgsCohortsInMemory(
  world: WorldSnapshot,
  burgIds: number[],
  allegianceStatus: "DECEASED" | "DEPARTED",
  cause: string
): void {
  if (burgIds.length === 0) return;
  const set = new Set(burgIds);
  for (const c of world.mutable.citizens.values()) {
    if (set.has(c.settlementId) && c.allegianceStatus === "CIVILIAN") {
      c.allegianceStatus = allegianceStatus;
      if (allegianceStatus === "DECEASED") c.causeOfDeath = cause;
    }
  }
  for (const coh of world.mutable.cohorts.values()) {
    if (set.has(coh.burgId) && coh.allegiance === "CIVILIAN" && coh.count > 0) {
      if (coh.ageBand === "ADULT" && LOGISTICS_PROFS.has(coh.profession)) {
        bumpCohortCrewCount(world, coh.burgId, coh.profession, -coh.count);
      }
      coh.count = 0;
    }
  }
}

export function promoteFromCohortInMemory(
  world: WorldSnapshot,
  spec: PromoteBatchSpec
): number | null {
  const candidates: InMemoryCohort[] = [];
  for (const coh of world.mutable.cohorts.values()) {
    if (coh.burgId !== spec.burgId || coh.count <= 0) continue;
    if (spec.filter.ageBand && coh.ageBand !== spec.filter.ageBand) continue;
    if (spec.filter.allegiance && coh.allegiance !== spec.filter.allegiance) continue;
    if (spec.filter.isNull !== undefined && coh.isNull !== spec.filter.isNull) continue;
    candidates.push(coh);
  }
  if (candidates.length === 0) return null;

  const pref = spec.filter.preferredProfessions || [];
  candidates.sort((a, b) => {
    const ap = pref.indexOf(a.profession);
    const bp = pref.indexOf(b.profession);
    const ar = ap >= 0 ? ap : pref.length;
    const br = bp >= 0 ? bp : pref.length;
    if (ar !== br) return ar - br;
    return (
      b.count - a.count ||
      a.profession.localeCompare(b.profession) ||
      a.species.localeCompare(b.species)
    );
  });

  const chosen = candidates[0]!;
  applyCohortOpsInMemory(world, [{ ...chosen, delta: -1 }]);

  const citizenId = world.mutable.nextCitizenId++;
  const burg = world.mutable.burgs.get(spec.burgId);
  const newCit: InMemoryCitizen = {
    citizenId,
    settlementId: spec.burgId,
    homeCellId: burg?.cellId || 0,
    name: `${chosen.profession} #${citizenId}`,
    profession: chosen.profession,
    species: chosen.species,
    sparkTier: chosen.sparkTier,
    isNull: chosen.isNull,
    lifeStage: chosen.ageBand,
    age: chosen.ageBand === "CHILD" ? 10 : chosen.ageBand === "ELDER" ? 60 : 28,
    temper: "STOIC",
    instinct: "WARY",
    motivation: spec.motivationOverride || `Resident of ${burg?.name || `Burg #${spec.burgId}`}`,
    allegianceStatus: chosen.allegiance,
    unitSize: 1,
    traits: [],
    causeOfDeath: null,
  };
  world.mutable.citizens.set(citizenId, newCit);
  if (world.mutable.pendingPromotions) {
    world.mutable.pendingPromotions.push({ syntheticCitizenId: citizenId, spec });
  }
  return citizenId;
}

/**
 * Pure in-memory equivalent of `engine/deltas/apply.ts`: applies any `Delta[]` batch cleanly to
 * `world.mutable` with matching merge order, bounds clamping, and zero DB mutations.
 */
export function applyDeltasInMemory(world: WorldSnapshot, deltas: Delta[]): Record<string, number> {
  const counts: Record<string, number> = {};
  if (deltas.length === 0) return counts;

  const m = world.mutable;
  const cellIdxMap = world.static.cellIndexById;

  const burgAcc = new Map<
    number,
    {
      food: NumAcc;
      wealth: NumAcc;
      unrest: NumAcc;
      health: NumAcc;
      crimeRate: NumAcc;
      rawMaterials: NumAcc;
      refinedGoods: NumAcc;
      popNull: NumAcc;
      popAttuned: NumAcc;
      urbanTierSet?: number;
      occSet?: boolean;
      occVal?: number | null;
      nameSet?: string;
      milSet?: string;
      occTicksSet?: number;
      resSet?: number;
      archSet?: string;
      demoSet?: string;
      gpSet?: number;
      dpSet?: number;
      wfClr?: boolean;
      wfEmpty?: boolean;
      ruSet?: number;
    }
  >();

  const cellAcc = new Map<
    number,
    {
      ecoHealth: NumAcc;
      ecoMax: NumAcc;
      ecoPlants: NumAcc;
      ecoPrey: NumAcc;
      ecoPredators: NumAcc;
      ecoApex: NumAcc;
      ecoBlight: NumAcc;
      currentTemp: NumAcc;
      cultureSet?: number;
      religionSet?: number;
    }
  >();

  const getBurgAcc = (id: number) => {
    let a = burgAcc.get(id);
    if (!a) {
      a = {
        food: zeroAcc(),
        wealth: zeroAcc(),
        unrest: zeroAcc(),
        health: zeroAcc(),
        crimeRate: zeroAcc(),
        rawMaterials: zeroAcc(),
        refinedGoods: zeroAcc(),
        popNull: zeroAcc(),
        popAttuned: zeroAcc(),
      };
      burgAcc.set(id, a);
    }
    return a;
  };

  const getCellAcc = (id: number) => {
    let a = cellAcc.get(id);
    if (!a) {
      a = {
        ecoHealth: zeroAcc(),
        ecoMax: zeroAcc(),
        ecoPlants: zeroAcc(),
        ecoPrey: zeroAcc(),
        ecoPredators: zeroAcc(),
        ecoApex: zeroAcc(),
        ecoBlight: zeroAcc(),
        currentTemp: zeroAcc(),
      };
      cellAcc.set(id, a);
    }
    return a;
  };

  for (const d of deltas) {
    switch (d.kind) {
      case "burg.adjust": {
        const a = getBurgAcc(d.burgId);
        applyNumAdjust(a.food, d.food);
        applyNumAdjust(a.wealth, d.wealth);
        applyNumAdjust(a.unrest, d.unrest);
        applyNumAdjust(a.health, d.health);
        applyNumAdjust(a.crimeRate, d.crime);
        applyNumAdjust(a.rawMaterials, d.rawMaterials);
        applyNumAdjust(a.refinedGoods, d.refinedGoods);
        applyNumAdjust(a.popNull, d.popNull);
        applyNumAdjust(a.popAttuned, d.popAttuned);
        break;
      }
      case "burg.set": {
        const a = getBurgAcc(d.burgId);
        const f = d.fields;
        applyNumSet(a.food, f.food);
        applyNumSet(a.wealth, f.wealth);
        applyNumSet(a.unrest, f.unrest);
        applyNumSet(a.health, f.health);
        applyNumSet(a.crimeRate, f.crime_rate);
        applyNumSet(a.rawMaterials, f.raw_materials);
        applyNumSet(a.refinedGoods, f.refined_goods);
        applyNumSet(a.popNull, f.pop_null);
        applyNumSet(a.popAttuned, f.pop_attuned);
        if (f.urban_tier !== undefined) a.urbanTierSet = Math.max(0, Math.round(f.urban_tier));
        if (f.occupier_faction_id !== undefined) {
          a.occSet = true;
          a.occVal = f.occupier_faction_id;
        }
        if (f.name !== undefined) a.nameSet = f.name;
        if (f.military_forces !== undefined) a.milSet = f.military_forces;
        if (f.occupation_ticks !== undefined) a.occTicksSet = Math.max(0, Math.round(f.occupation_ticks));
        if (f.resistance_strength !== undefined) a.resSet = Math.max(0, Math.round(f.resistance_strength));
        if (f.architecture_type !== undefined) a.archSet = f.architecture_type;
        if (f.demographics !== undefined) a.demoSet = f.demographics;
        if (f.pop_growth_pool !== undefined) a.gpSet = f.pop_growth_pool;
        if (f.pop_departure_pool !== undefined) a.dpSet = f.pop_departure_pool;
        if (f.clear_workforce) {
          a.wfClr = true;
          a.wfEmpty = false;
        }
        if (f.workforce_empty) {
          a.wfEmpty = true;
          a.wfClr = false;
        }
        if (f.record_unit !== undefined) a.ruSet = Math.min(40, Math.max(3, Math.round(f.record_unit)));
        break;
      }
      case "cell.adjust": {
        const a = getCellAcc(d.cellId);
        applyNumAdjust(a.ecoHealth, d.ecoHealth);
        applyNumAdjust(a.ecoMax, d.ecoMax);
        applyNumAdjust(a.ecoPlants, d.ecoPlants);
        applyNumAdjust(a.ecoPrey, d.ecoPrey);
        applyNumAdjust(a.ecoPredators, d.ecoPredators);
        applyNumAdjust(a.ecoApex, d.ecoApex);
        applyNumAdjust(a.ecoBlight, d.ecoBlight);
        applyNumAdjust(a.currentTemp, d.currentTemp);
        break;
      }
      case "cell.set": {
        const a = getCellAcc(d.cellId);
        const f = d.fields;
        applyNumSet(a.ecoHealth, f.eco_health);
        applyNumSet(a.ecoMax, f.eco_max);
        applyNumSet(a.ecoPlants, f.eco_plants);
        applyNumSet(a.ecoPrey, f.eco_prey);
        applyNumSet(a.ecoPredators, f.eco_predators);
        applyNumSet(a.ecoApex, f.eco_apex);
        applyNumSet(a.ecoBlight, f.eco_blight);
        applyNumSet(a.currentTemp, f.current_temp);
        if (f.culture_id !== undefined) a.cultureSet = f.culture_id;
        if (f.religion_id !== undefined) a.religionSet = f.religion_id;
        break;
      }
      case "cell.setFaction": {
        const idx = cellIdxMap.get(d.cellId);
        if (idx !== undefined) {
          m.factionId[idx] = d.factionId && d.factionId > 0 ? d.factionId : 0;
          counts.sim_cells = (counts.sim_cells || 0) + 1;
        }
        break;
      }
      case "diplomacy.endWars": {
        for (const dip of m.diplomacy.values()) {
          if (dip.status === "WAR" && (dip.factionAId === d.factionId || dip.factionBId === d.factionId)) {
            dip.status = "PEACE";
            dip.tension = 0;
            counts.sim_diplomacy = (counts.sim_diplomacy || 0) + 1;
          }
        }
        break;
      }
      case "citizen.status": {
        const c = m.citizens.get(d.citizenId);
        if (c) {
          c.allegianceStatus = d.status;
          if (d.cause !== undefined) c.causeOfDeath = d.cause;
          if (d.motivation !== undefined) c.motivation = d.motivation;
          counts.population_demographics = (counts.population_demographics || 0) + 1;
        }
        break;
      }
      case "citizen.move": {
        const c = m.citizens.get(d.citizenId);
        if (c) {
          c.settlementId = d.settlementId;
          c.homeCellId = d.homeCellId;
          counts.population_demographics = (counts.population_demographics || 0) + 1;
        }
        break;
      }
      case "citizen.tagBurg": {
        const matching: InMemoryCitizen[] = [];
        for (const c of m.citizens.values()) {
          if (
            c.settlementId === d.burgId &&
            c.allegianceStatus === "CIVILIAN" &&
            (!d.professionFilter ||
              c.profession.toLowerCase().includes(d.professionFilter.replace(/%/g, "").toLowerCase()))
          ) {
            matching.push(c);
          }
        }
        if (matching.length > 0) {
          matching.sort((a, b) => a.citizenId - b.citizenId);
          const lo = matching[0]!.citizenId;
          const hi = matching[matching.length - 1]!.citizenId;
          const at = lo + Math.floor((hi - lo + 1) * d.randomSeed);
          const firstHalf = matching.filter((c) => c.citizenId >= at);
          const wrapHalf = matching.filter((c) => c.citizenId < at);
          const picks = [...firstHalf, ...wrapHalf].slice(0, d.limit ?? 4);
          for (const p of picks) {
            for (const tag of d.tags) {
              if (!p.traits.includes(tag)) p.traits.push(tag);
            }
            if (d.temper) p.temper = d.temper;
            if (d.motivation) p.motivation = d.motivation;
          }
          counts.population_demographics = (counts.population_demographics || 0) + picks.length;
        }
        break;
      }
      case "citizen.killOne": {
        const c = m.citizens.get(d.citizenId);
        if (c && c.allegianceStatus !== "DECEASED") {
          if (c.unitSize > 1) {
            c.unitSize -= 1;
          } else {
            c.allegianceStatus = "DECEASED";
            c.causeOfDeath = d.cause;
          }
          if (c.settlementId > 0) {
            const b = m.burgs.get(c.settlementId);
            if (b) {
              if (c.isNull) b.popNull = Math.max(0, b.popNull - 1);
              else b.popAttuned = Math.max(0, b.popAttuned - 1);
            }
          }
          counts.population_demographics = (counts.population_demographics || 0) + 1;
        }
        break;
      }
      case "agent.create": {
        const id = m.nextAgentId++;
        m.agents.set(id, {
          id,
          name: d.name,
          role: d.role,
          subRole: d.subRole ?? null,
          citizenName: d.citizenName ?? null,
          profession: d.profession ?? null,
          species: d.species ?? null,
          sparkTier: d.sparkTier ?? null,
          personalityTemper: d.personalityTemper ?? null,
          personalityInstinct: d.personalityInstinct ?? null,
          motivation: d.motivation ?? null,
          locationCellId: d.locationCellId,
          targetCellId: d.targetCellId ?? null,
          targetGroveId: d.targetGroveId ?? null,
          homeBurgId: d.homeBurgId ?? null,
          factionId: d.factionId ?? null,
          state: d.state,
          corruption: Math.min(100, Math.max(0, Math.round(d.corruption ?? 0))),
          drainedPower: d.drainedPower ?? 0,
          ageTicks: Math.round(d.ageTicks ?? 0),
          activePlot: d.activePlot ?? null,
        });
        counts.sim_agents = (counts.sim_agents || 0) + 1;
        break;
      }
      case "agent.update": {
        const ag = m.agents.get(d.agentId);
        if (ag) {
          const f = d.fields;
          if (f.location_cell_id !== undefined) ag.locationCellId = f.location_cell_id;
          if (f.target_cell_id !== undefined) ag.targetCellId = f.target_cell_id;
          if (f.target_grove_id !== undefined) ag.targetGroveId = f.target_grove_id;
          if (f.state !== undefined) ag.state = f.state;
          if (f.sub_role !== undefined) ag.subRole = f.sub_role;
          if (f.spark_tier !== undefined) ag.sparkTier = f.spark_tier;
          if (f.corruption !== undefined) ag.corruption = Math.min(100, Math.max(0, Math.round(f.corruption)));
          if (f.drained_power !== undefined) ag.drainedPower = f.drained_power;
          if (f.active_plot !== undefined) ag.activePlot = f.active_plot;
          if (f.age_ticks !== undefined) ag.ageTicks = Math.round(f.age_ticks);
          if (f.name !== undefined) ag.name = f.name;
          if (f.citizen_name !== undefined) ag.citizenName = f.citizen_name;
          if (f.profession !== undefined) ag.profession = f.profession;
          if (f.species !== undefined) ag.species = f.species;
          if (f.personality_temper !== undefined) ag.personalityTemper = f.personality_temper;
          if (f.personality_instinct !== undefined) ag.personalityInstinct = f.personality_instinct;
          if (f.motivation !== undefined) ag.motivation = f.motivation;
          counts.sim_agents = (counts.sim_agents || 0) + 1;
        }
        break;
      }
      case "agent.remove": {
        if (m.agents.delete(d.agentId)) {
          counts.sim_agents = (counts.sim_agents || 0) + 1;
        }
        break;
      }
      case "tags.add": {
        if (d.target.kind === "cell" && (d.target.zLayer ?? 0) === 0) {
          let set = m.cellTags.get(d.target.cellId);
          if (!set) {
            set = new Set<string>();
            m.cellTags.set(d.target.cellId, set);
          }
          for (const t of d.tags) set.add(t);
          counts.sim_cell_tags = (counts.sim_cell_tags || 0) + 1;
        } else if (d.target.kind === "citizen") {
          const cit = m.citizens.get(d.target.citizenId);
          if (cit) {
            for (const t of d.tags) {
              if (!cit.traits.includes(t)) cit.traits.push(t);
            }
            if (d.target.temper) cit.temper = d.target.temper;
            if (d.target.motivation) cit.motivation = d.target.motivation;
            counts.population_demographics = (counts.population_demographics || 0) + 1;
          }
        }
        break;
      }
      case "tags.remove": {
        if (d.target.kind === "cell" && (d.target.zLayer ?? 0) === 0) {
          const set = m.cellTags.get(d.target.cellId);
          if (set) {
            for (const t of d.tags) set.delete(t);
            if (set.size === 0) m.cellTags.delete(d.target.cellId);
          }
          counts.sim_cell_tags = (counts.sim_cell_tags || 0) + 1;
        }
        break;
      }
      case "event.log": {
        m.events.push({
          id: m.nextEventId++,
          tick: d.tick,
          type: d.type,
          message: d.message,
          tier: d.tier,
          loreDate: d.loreDate ?? null,
          burgId: d.burgId ?? null,
          cellId: d.cellId ?? null,
          factionId: d.factionId ?? null,
          outlawId: d.outlawId ?? null,
        });
        counts.sim_events = (counts.sim_events || 0) + 1;
        break;
      }
      case "thread.open": {
        const id = m.nextStorylineId++;
        m.storylines.set(id, {
          id,
          scale: "thread",
          state: "open",
          cellId: d.spec.cell_id,
          rx: d.spec.rx ?? 50,
          ry: d.spec.ry ?? 50,
          z: 0,
          ruleId: d.spec.rule_id ?? null,
          question: d.spec.question,
          stakes: d.spec.stakes,
          actorIds: [...(d.spec.actor_ids || [])],
          hook: {},
          clock: 0,
          clockMax: d.spec.clock_max ?? 6,
        });
        counts.sim_threads = (counts.sim_threads || 0) + 1;
        break;
      }
      case "scheduled.add": {
        m.scheduledEvents.push({
          id: m.nextScheduledId++,
          dueTick: d.at.tick,
          dueMinute: d.at.minute ?? 0,
          kind: d.event.kind,
          payload: d.event.payload ?? {},
          createdTick: d.at.tick,
          firedTick: null,
        });
        counts.scheduled_events = (counts.scheduled_events || 0) + 1;
        break;
      }
      case "weatherFront.create": {
        const id = m.nextFrontId++;
        m.weatherFronts.set(id, {
          id,
          type: d.type,
          x: d.x,
          y: d.y,
          dx: d.dx,
          dy: d.dy,
          radius: d.radius,
          lifetime: d.lifetime,
        });
        counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + 1;
        break;
      }
      case "weatherFront.update": {
        const f = m.weatherFronts.get(d.frontId);
        if (f) {
          f.x = d.x;
          f.y = d.y;
          f.lifetime = d.lifetime;
          counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + 1;
        }
        break;
      }
      case "weatherFront.remove": {
        if (m.weatherFronts.delete(d.frontId)) {
          counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + 1;
        }
        break;
      }
      case "chaosZone.upsert": {
        const k = `${d.cellId}|${d.type}`;
        const existing = m.chaosZones.get(k);
        const intensity = Math.min(100, Math.max(0, d.intensity));
        if (!existing) {
          m.chaosZones.set(k, {
            id: m.nextChaosZoneId++,
            cellId: d.cellId,
            intensity,
            type: d.type,
          });
        } else if (d.updateOnConflict) {
          existing.intensity = intensity;
        }
        counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + 1;
        break;
      }
      case "chaosZone.adjust": {
        const delKeys: string[] = [];
        for (const [k, z] of m.chaosZones) {
          if (d.cellId !== undefined && z.cellId !== d.cellId) continue;
          z.intensity = Math.min(100, Math.max(0, z.intensity + d.intensityDelta));
          if (d.deleteAtOrBelowZero && z.intensity <= 0) delKeys.push(k);
        }
        for (const k of delKeys) m.chaosZones.delete(k);
        counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + 1;
        break;
      }
      case "chaosZone.remove": {
        if (m.chaosZones.delete(`${d.cellId}|${d.type}`)) {
          counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + 1;
        }
        break;
      }
      case "chaosFlow.update": {
        const prev = m.chaosFlows.get(d.flowId);
        if (prev) {
          prev.currentSurge = d.currentSurge;
          prev.currentWidth = d.currentWidth;
          prev.waypoints = (d.waypoints as any[]) || [];
          prev.narrowSpots = (d.narrowSpots as any[]) || [];
          counts.sim_chaos_flows = (counts.sim_chaos_flows || 0) + 1;
        }
        break;
      }
      case "calendar.set": {
        m.calendar = {
          id: d.id ?? m.calendar.id,
          tick: d.tick,
          year: d.year,
          month: d.month,
          monthName: d.monthName,
          dayOfMonth: d.dayOfMonth,
          dayOfYear: d.dayOfYear,
          season: d.season,
          moonPhase: d.moonPhase,
          activeFlow: d.activeFlow,
          dragonDomain: d.dragonDomain,
          isShadowWeek: d.isShadowWeek,
        };
        counts.sim_calendar = 1;
        break;
      }
      case "paragon.die": {
        if (m.paragons.delete(d.paragonId)) {
          counts.sim_paragons = (counts.sim_paragons || 0) + 1;
        }
        break;
      }
      case "paragon.setCorruption": {
        const p = m.paragons.get(d.paragonId);
        if (p) {
          p.corruptionScore = Math.min(100, Math.max(0, Math.round(d.corruptionScore)));
          counts.sim_paragons = (counts.sim_paragons || 0) + 1;
        }
        break;
      }
      case "burg.militaryAdjust": {
        const b = m.burgs.get(d.burgId);
        if (b && d.delta !== 0) {
          let mil: Record<string, number> = {};
          try {
            mil = typeof b.militaryForces === "string"
              ? JSON.parse(b.militaryForces || "{}")
              : b.militaryForces && typeof b.militaryForces === "object"
                ? { ...(b.militaryForces as Record<string, number>) }
                : {};
          } catch {
            mil = {};
          }
          mil[d.unitType] = Math.max(0, Math.round((Number(mil[d.unitType]) || 0) + d.delta));
          b.militaryForces = JSON.stringify(mil);
          counts.sim_burg_economy = (counts.sim_burg_economy || 0) + 1;
        }
        break;
      }
      case "infrastructure.adjust": {
        const key = `${d.burgId}:${d.upsert ? d.infraType : d.infraType.toUpperCase()}`;
        if (d.upsert && d.cellId) {
          const existing = m.infrastructure.get(key);
          if (existing) existing.level += Math.round(d.levelDelta ?? 0);
          else {
            m.infrastructure.set(key, {
              burgId: d.burgId,
              cellId: d.cellId,
              type: d.infraType,
              level: Math.round(d.levelDelta ?? 1),
              status: "ACTIVE",
            });
          }
        } else {
          for (const inf of m.infrastructure.values()) {
            if (inf.burgId === d.burgId && inf.type.toUpperCase() === d.infraType.toUpperCase()) {
              inf.level = Math.max(0, inf.level + Math.round(d.levelDelta ?? 0));
              if (d.status !== undefined) inf.status = d.status;
              else if (inf.level === 0) inf.status = "DAMAGED";
            }
          }
        }
        counts.sim_infrastructure = (counts.sim_infrastructure || 0) + 1;
        break;
      }
      case "overlay.add": {
        m.overlays.push(d);
        counts.map_overlays = (counts.map_overlays || 0) + 1;
        break;
      }
      case "standing.adjust": {
        const k = `${d.subjectRef}\0${d.partyRef}`;
        const cur = m.standing.get(k);
        const delta = Math.round(d.delta);
        if (cur) {
          cur.value = Math.min(100, Math.max(-100, cur.value + delta));
          cur.reasons.push({ tick: d.tick ?? 0, delta, reason: d.reason });
          if (cur.reasons.length > 20) cur.reasons = cur.reasons.slice(-20);
        } else {
          m.standing.set(k, {
            subjectRef: d.subjectRef,
            partyRef: d.partyRef,
            value: Math.min(100, Math.max(-100, delta)),
            reasons: [{ tick: d.tick ?? 0, delta, reason: d.reason }],
          });
        }
        counts.standing = (counts.standing || 0) + 1;
        break;
      }
      case "market.setGoods": {
        const mk = m.markets.get(d.marketId);
        if (mk) {
          mk.goods = JSON.parse(JSON.stringify(d.goods));
          counts.sim_markets = (counts.sim_markets || 0) + 1;
        }
        break;
      }
      case "commodity.set": {
        const cp = m.commodityPrices.get(d.commodity);
        if (cp) {
          cp.currentPrice = Math.max(0, d.currentPrice);
          cp.globalSupply = Math.round(d.globalSupply);
          cp.globalDemand = Math.round(d.globalDemand);
          cp.lastUpdatedTick = Math.round(d.lastUpdatedTick);
          counts.sim_commodity_prices = (counts.sim_commodity_prices || 0) + 1;
        }
        break;
      }
      case "grindCanyon.update": {
        const cg = m.grindCanyons.get(d.canyonId);
        if (cg) {
          if (d.richnessDelta !== undefined) cg.dragonstoneRichness = Math.max(0, cg.dragonstoneRichness + Math.round(d.richnessDelta));
          if (d.stabilityTicksRemaining !== undefined) cg.stabilityTicksRemaining = Math.round(d.stabilityTicksRemaining);
          if (d.status !== undefined) cg.status = d.status;
          if (d.closedTick !== undefined) cg.closedTick = Math.round(d.closedTick);
          counts.sim_grind_canyons = (counts.sim_grind_canyons || 0) + 1;
        }
        break;
      }
      case "grindCanyon.create": {
        const id = m.nextCanyonId++;
        m.grindCanyons.set(id, {
          id,
          name: d.name,
          cellId: d.cellId,
          dragonName: d.dragonName,
          dragonDomain: d.dragonDomain,
          dragonstoneRichness: Math.round(d.dragonstoneRichness),
          stabilityTicksRemaining: Math.round(d.stabilityTicksRemaining),
          status: d.status,
          minerCrewName: d.minerCrewName,
          closedTick: null,
        });
        counts.sim_grind_canyons = (counts.sim_grind_canyons || 0) + 1;
        break;
      }
      case "outlawFaction.adjust": {
        const of = m.outlaws.get(d.outlawId);
        if (of) {
          if (d.wealthDelta !== undefined) of.wealth = Math.max(0, of.wealth + Math.round(d.wealthDelta));
          if (d.manpowerDelta !== undefined) of.manpower = Math.max(0, of.manpower + Math.round(d.manpowerDelta));
          if (d.heatDelta !== undefined) of.heat = Math.min(100, Math.max(0, of.heat + Math.round(d.heatDelta)));
          counts.sim_outlaw_factions = (counts.sim_outlaw_factions || 0) + 1;
        }
        break;
      }
      case "fringeLair.mutate": {
        if (d.action === "deleteByFactionCell") {
          for (const [lid, l] of m.lairs) {
            if (l.factionId === d.factionId && l.cellId === d.cellId) {
              m.lairs.delete(lid);
              counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + 1;
            }
          }
        } else {
          const id = m.nextLairId++;
          m.lairs.set(id, {
            id,
            factionId: d.factionId,
            cellId: d.cellId,
            burgId: d.burgId ?? null,
            lairType: d.lairType || "HIDEOUT",
            manpower: Math.round(d.manpower ?? 10),
            heat: Math.round(d.heat ?? 10),
            inventory: {},
          });
          counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + 1;
        }
        break;
      }
      case "fringeLair.addRations": {
        const amt = Math.round(d.rations);
        if (amt > 0) {
          const b = m.burgs.get(d.burgId);
          for (const l of m.lairs.values()) {
            if (l.burgId === d.burgId || (b && l.cellId === b.cellId)) {
              l.inventory.stolen_rations = (Number(l.inventory.stolen_rations) || 0) + amt;
              counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + 1;
            }
          }
        }
        break;
      }
      case "fringeLair.update": {
        const l = m.lairs.get(d.lairId);
        if (l) {
          if (d.heat !== undefined) l.heat = Math.min(100, Math.max(0, d.heat));
          if (d.cellId !== undefined) l.cellId = d.cellId;
          if (d.burgId !== undefined) l.burgId = d.burgId;
          if (d.inventory !== undefined) l.inventory = { ...d.inventory };
          counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + 1;
        }
        break;
      }
      case "fringeLair.delete": {
        if (m.lairs.delete(d.lairId)) counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + 1;
        break;
      }
      case "culture.adjustCells": {
        m.cultureCellCounts.set(d.cultureId, Math.max(0, (m.cultureCellCounts.get(d.cultureId) || 0) + Math.round(d.delta)));
        counts.sim_cultures = (counts.sim_cultures || 0) + 1;
        break;
      }
      case "religion.adjustCells": {
        m.religionCellCounts.set(d.religionId, Math.max(0, (m.religionCellCounts.get(d.religionId) || 0) + Math.round(d.delta)));
        counts.sim_religions = (counts.sim_religions || 0) + 1;
        break;
      }
      case "npcInstance.update": {
        const npc = m.npcInstances.get(d.npcId);
        if (npc) {
          if (d.needs !== undefined) npc.needs = { ...d.needs };
          if (d.mood !== undefined) npc.mood = { ...d.mood };
          if (d.beliefs !== undefined) npc.beliefs = [...d.beliefs];
          if (d.disposition !== undefined) npc.disposition = Math.round(d.disposition);
          if (d.tradePriceMult !== undefined) npc.tradePriceMult = d.tradePriceMult;
          if (d.processedForEconomy !== undefined) npc.processedForEconomy = d.processedForEconomy;
          counts.sim_npc_instances = (counts.sim_npc_instances || 0) + 1;
        }
        break;
      }
      case "sectorLayer.update": {
        const key = `${d.cellId}:${Math.round(d.rx)}:${Math.round(d.ry)}:${Math.round(d.zLayer)}`;
        const sl = m.sectorLayers.get(key);
        if (sl) {
          sl.npcs = d.npcs as any[];
          sl.props = d.props as any[];
          sl.features = d.features;
          counts.sim_sector_layers = (counts.sim_sector_layers || 0) + 1;
        }
        break;
      }
      case "grove.adjust": {
        const g = m.groves.get(d.groveId);
        if (g && d.sealDelta !== 0) {
          g.sealStrength = Math.min(100, Math.max(0, g.sealStrength + Math.round(d.sealDelta)));
          counts.sim_sacred_groves = (counts.sim_sacred_groves || 0) + 1;
        }
        break;
      }
      case "ancientWard.recharge": {
        const t = Math.round(d.tick);
        for (const w of m.ancientWards.values()) {
          if (!w.isCharged && t - w.lastTriggeredTick >= w.rechargeTicks) {
            w.isCharged = true;
            counts.sim_ancient_path_wards = (counts.sim_ancient_path_wards || 0) + 1;
          }
        }
        break;
      }
      case "ancientWard.discharge": {
        const w = m.ancientWards.get(d.wardId);
        if (w) {
          w.isCharged = false;
          w.lastTriggeredTick = Math.round(d.tick);
          counts.sim_ancient_path_wards = (counts.sim_ancient_path_wards || 0) + 1;
        }
        break;
      }
      case "burg.createSatellite": {
        if (!m.burgs.has(d.burgId)) {
          const sat: InMemoryBurg = {
            burgId: d.burgId,
            cellId: d.cellId,
            name: d.name,
            parentBurgId: d.parentBurgId,
            upstreamBurgId: null,
            settlementType: d.settlementType,
            isCapital: false,
            port: false,
            citadel: false,
            walls: false,
            plaza: false,
            temple: false,
            shanty: false,
            occupierFactionId: null,
            occupationTicks: 0,
            resistanceStrength: 0,
            food: Math.max(0, Math.round(d.food)),
            wealth: Math.max(0, Math.round(d.wealth)),
            health: 85,
            unrest: 0,
            crimeRate: 0,
            rawMaterials: 0,
            refinedGoods: 0,
            urbanTier: 1,
            biome: null,
            architectureType: null,
            popNull: Math.max(0, Math.round(d.popNull)),
            popAttuned: Math.max(0, Math.round(d.popAttuned)),
            recordUnit: null,
            popGrowthPool: 0,
            popDeparturePool: 0,
            speciesDemographics: "{}",
            demographics: "{}",
            militaryForces: '{"militia":6}',
            resourceProfile: null,
            production: null,
            workforce: null,
          };
          m.burgs.set(d.burgId, sat);
          if (!m.stockpiles.has(d.burgId)) m.stockpiles.set(d.burgId, {});
          counts.sim_burg_economy = (counts.sim_burg_economy || 0) + 1;
        }
        break;
      }
      case "faction.update": {
        const f = m.factions.get(d.factionId);
        if (f) {
          if (d.treasurySet !== undefined) f.treasury = Math.max(0, Math.round(d.treasurySet));
          if (d.treasuryDelta !== undefined) f.treasury = Math.max(0, Math.round(f.treasury + d.treasuryDelta));
          if (d.fiscalEconomy !== undefined) f.fiscalEconomy = d.fiscalEconomy;
          counts.sim_factions = (counts.sim_factions || 0) + 1;
        }
        break;
      }
      case "factionUnit.update": {
        const u = m.factionUnits.get(d.unitId);
        if (u) {
          u.count = Math.max(0, Math.round(d.count));
          u.status = d.status;
          counts.sim_faction_units = (counts.sim_faction_units || 0) + 1;
        }
        break;
      }
      case "diplomacy.upsert": {
        const key = `${d.factionAId}:${d.factionBId}`;
        m.diplomacy.set(key, {
          factionAId: d.factionAId,
          factionBId: d.factionBId,
          status: d.status,
          tension: Math.min(100, Math.max(0, Math.round(d.tension))),
        });
        counts.sim_diplomacy = (counts.sim_diplomacy || 0) + 1;
        break;
      }
      case "ghostwindDrop.create": {
        const id = m.nextDropId++;
        m.ghostwindDrops.set(id, {
          id,
          createdTick: Math.round(d.createdTick),
          executedTick: null,
          status: "PENDING",
          clientFactionId: d.clientFactionId,
          targetFactionId: d.targetFactionId,
          targetBurgId: d.targetBurgId,
          bountyGold: Math.max(0, Math.round(d.bountyGold)),
        });
        counts.sim_ghostwind_dead_drops = (counts.sim_ghostwind_dead_drops || 0) + 1;
        break;
      }
      case "ghostwindDrop.execute": {
        const gd = m.ghostwindDrops.get(d.dropId);
        if (gd) {
          gd.status = "EXECUTED";
          gd.executedTick = Math.round(d.executedTick);
          counts.sim_ghostwind_dead_drops = (counts.sim_ghostwind_dead_drops || 0) + 1;
        }
        break;
      }
      case "burgStockpile.setInventory": {
        m.stockpiles.set(d.burgId, { ...d.inventory });
        counts.sim_industrial_stockpiles = (counts.sim_industrial_stockpiles || 0) + 1;
        break;
      }
      case "tradeShipment.update": {
        const sh = m.tradeShipments.get(d.shipmentId);
        if (sh) {
          sh.status = d.status;
          sh.pathIndex = Math.max(0, Math.round(d.pathIndex));
          sh.currentCellId = Math.max(0, Math.round(d.currentCellId));
          sh.etaTicks = Math.max(0, Math.round(d.etaTicks));
          sh.resolvedTick = d.resolvedTick !== null ? Math.round(d.resolvedTick) : null;
          if (d.pathCells !== undefined) sh.pathCells = [...d.pathCells];
          counts.sim_trade_shipments = (counts.sim_trade_shipments || 0) + 1;
        }
        break;
      }
      case "tradeShipment.create": {
        const id = m.nextShipmentId++;
        m.tradeShipments.set(id, {
          id,
          sourceBurgId: d.sourceBurgId,
          destBurgId: d.destBurgId,
          sourceFactionId: d.sourceFactionId,
          destFactionId: d.destFactionId,
          transportMode: d.transportMode,
          goodId: d.goodId,
          goodKey: d.goodKey,
          goodName: d.goodName,
          quantity: Math.max(1, Math.round(d.quantity)),
          unitPrice: d.unitPrice,
          totalGold: Math.max(0, Math.round(d.totalGold)),
          tariffGold: Math.max(0, Math.round(d.tariffGold)),
          carriageWeight: d.carriageWeight,
          merchantCitizenId: d.merchantCitizenId,
          crewCitizenIds: [...d.crewCitizenIds],
          guardCount: Math.max(0, Math.round(d.guardCount)),
          pathCells: [...d.pathCells],
          pathIndex: 0,
          currentCellId: d.startCellId,
          status: "IN_TRANSIT",
          dispatchedTick: Math.round(d.dispatchedTick),
          etaTicks: Math.max(1, Math.round(d.etaTicks)),
          resolvedTick: null,
        });
        counts.sim_trade_shipments = (counts.sim_trade_shipments || 0) + 1;
        break;
      }
      case "activeProject.advanceAll": {
        for (const p of m.activeProjects) p.ticksRemaining -= 1;
        m.activeProjects = m.activeProjects.filter((p) => p.ticksRemaining > 0);
        counts.sim_active_projects = (counts.sim_active_projects || 0) + 1;
        break;
      }
      case "activeProject.create": {
        m.activeProjects.push({
          id: m.nextProjectId++,
          burgId: d.burgId,
          projectType: d.projectType,
          targetTier: Math.max(1, Math.round(d.targetTier)),
          ticksRemaining: Math.max(1, Math.round(d.ticksRemaining)),
        });
        counts.sim_active_projects = (counts.sim_active_projects || 0) + 1;
        break;
      }
      case "burg.stripRuin": {
        for (const k of Array.from(m.infrastructure.keys())) {
          if (m.infrastructure.get(k)!.burgId === d.burgId) m.infrastructure.delete(k);
        }
        for (const [lid, l] of Array.from(m.lairs.entries())) {
          if (l.burgId === d.burgId) m.lairs.delete(lid);
        }
        m.stockpiles.delete(d.burgId);
        break;
      }
      default:
        break;
    }
  }

  for (const [bid, a] of burgAcc) {
    const b = m.burgs.get(bid);
    if (!b) continue;
    b.food = resolveNumInt(a.food, b.food, 0);
    b.wealth = resolveNumInt(a.wealth, b.wealth, 0);
    b.unrest = resolveNumInt(a.unrest, b.unrest, 0, 100);
    b.health = resolveNumInt(a.health, b.health, 0, 100);
    b.crimeRate = resolveNumFloat(a.crimeRate, b.crimeRate, 0, 100);
    b.rawMaterials = resolveNumInt(a.rawMaterials, b.rawMaterials, 0);
    b.refinedGoods = resolveNumInt(a.refinedGoods, b.refinedGoods, 0);
    b.popNull = resolveNumInt(a.popNull, b.popNull, 0);
    b.popAttuned = resolveNumInt(a.popAttuned, b.popAttuned, 0);
    if (a.urbanTierSet !== undefined) b.urbanTier = a.urbanTierSet;
    if (a.occSet) b.occupierFactionId = a.occVal ?? null;
    if (a.nameSet !== undefined) b.name = a.nameSet;
    if (a.milSet !== undefined) b.militaryForces = a.milSet;
    if (a.occTicksSet !== undefined) b.occupationTicks = a.occTicksSet;
    if (a.resSet !== undefined) b.resistanceStrength = a.resSet;
    if (a.archSet !== undefined) b.architectureType = a.archSet;
    if (a.demoSet !== undefined) b.demographics = a.demoSet;
    if (a.gpSet !== undefined) b.popGrowthPool = a.gpSet;
    if (a.dpSet !== undefined) b.popDeparturePool = a.dpSet;
    if (a.wfClr) b.workforce = null;
    else if (a.wfEmpty) b.workforce = {};
    if (a.ruSet !== undefined) b.recordUnit = a.ruSet;
    counts.sim_burg_economy = (counts.sim_burg_economy || 0) + 1;
  }

  for (const [cid, a] of cellAcc) {
    const idx = cellIdxMap.get(cid);
    if (idx === undefined) continue;
    const nextMax = resolveNumFloat(a.ecoMax, m.ecoMax[idx]!, 10);
    m.ecoMax[idx] = nextMax;
    m.ecoHealth[idx] = resolveNumFloat(a.ecoHealth, m.ecoHealth[idx]!, 0, nextMax);
    m.ecoPlants[idx] = resolveNumFloat(a.ecoPlants, m.ecoPlants[idx]!, 0, 200);
    m.ecoPrey[idx] = resolveNumFloat(a.ecoPrey, m.ecoPrey[idx]!, 0, 100);
    m.ecoPredators[idx] = resolveNumFloat(a.ecoPredators, m.ecoPredators[idx]!, 0, 60);
    m.ecoApex[idx] = resolveNumFloat(a.ecoApex, m.ecoApex[idx]!, 0, 100);
    m.ecoBlight[idx] = resolveNumFloat(a.ecoBlight, m.ecoBlight[idx]!, 0, 100);
    m.currentTemp[idx] = resolveNumFloat(a.currentTemp, m.currentTemp[idx]!, -100, 120);
    if (a.cultureSet !== undefined) m.cultureId[idx] = a.cultureSet;
    if (a.religionSet !== undefined) m.religionId[idx] = a.religionSet;
    counts.sim_cells = (counts.sim_cells || 0) + 1;
  }

  return counts;
}
