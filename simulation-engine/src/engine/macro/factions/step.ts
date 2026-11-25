import { DAYS_PER_MONTH } from "../../canon/calendar.js";
import { resolveCombat } from "../../combatEngine.js";
import type { Delta } from "../../deltas/types.js";
import { computeSiegeDefenseMultiplier, extractBurgCivicFlags } from "../../maps/civicFlags.js";
import {
  FACTION_ACTIONS,
  type FactionActionPlanContext,
  type FactionState,
  type PureFactionAction,
} from "./actions.js";

export interface FactionFinanceResult {
  grossIncome: number;
  pocketedGold: number;
  netRevenue: number;
  militaryUpkeep: number;
  totalUpkeep: number;
  newTreasury: number;
  effectiveCorruption: number;
  insolvent: boolean;
  deficit: number;
  totalPop: number;
  gdp: number;
  updatedFiscal: Record<string, any>;
}

export interface FactionDiplomacySnap {
  factionAId: number;
  factionBId: number;
  status: string;
  tension: number;
}

export interface FactionBorderSnap {
  factionA: number;
  factionB: number;
}

export interface FactionPlanningSnapshot {
  tick: number;
  loreDate: string;
  factions: any[];
  burgs: any[];
  units: any[];
  paragons: any[];
  diplomacy: FactionDiplomacySnap[];
  borders: FactionBorderSnap[];
  cellTagsByCell: Record<number, string[]>;
}

function getTraitsList(p: any): string[] {
  const list: string[] = [];
  if (!p || !p.traits) return list;
  try {
    const parsed = typeof p.traits === "string" ? JSON.parse(p.traits) : p.traits;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") list.push(item.toUpperCase());
        else if (item && item.name) list.push(String(item.name).toUpperCase());
      }
    }
  } catch {
    // Ignore malformed trait JSON
  }
  return list;
}

function parseJsonObj(raw: any, fallback: Record<string, any> = {}): Record<string, any> {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) || fallback;
    } catch {
      return fallback;
    }
  }
  return typeof raw === "object" ? { ...raw } : fallback;
}

/**
 * Pure deterministic fiscal evaluation from `sim_factions.fiscal_economy` + real burg pop/wealth + active regiments.
 */
export function evaluateFactionFinances(params: {
  treasury: number;
  fiscalRaw: any;
  myBurgs: any[];
  activeUnits: any[];
  activeWarCount: number;
  leaderCorruption: number;
}): FactionFinanceResult {
  const fiscal = parseJsonObj(params.fiscalRaw, {});
  const budget = parseJsonObj(fiscal.budget, {});
  const pollTax = Math.max(0, Number(fiscal.pollTax ?? 0.05) || 0);
  const salesTax = Math.max(0, Number(fiscal.salesTax ?? 0.08) || 0);
  const baseCollected = Math.max(0, Number(fiscal.collected ?? 0) || 0);
  const budgetCorr = Math.max(0, Number(budget.corruption ?? 15) || 0);
  const milBudget = Math.max(5, Number(budget.military ?? 30) || 0);
  const adminBudget = Math.max(
    10,
    (Number(budget.court ?? 30) || 0) + (Number(budget.administration ?? 25) || 0)
  );

  let totalPop = 0;
  let burgWealthSum = 0;
  for (const b of params.myBurgs) {
    totalPop += (Number(b.pop_null) || 0) + (Number(b.pop_attuned) || 0);
    burgWealthSum += Math.max(0, Number(b.wealth) || 0);
  }
  const gdp = Math.round(totalPop * 0.1 + burgWealthSum);

  const taxDisabled = pollTax === 0 && salesTax === 0 && baseCollected === 0;
  const grossIncome =
    params.myBurgs.length === 0 || taxDisabled
      ? 0
      : Math.max(
          12,
          Math.round(
            params.myBurgs.length * 10 +
              totalPop * pollTax * 0.008 +
              burgWealthSum * salesTax * 0.06 +
              baseCollected * 0.12
          )
        );

  const effectiveCorruption = Math.max(
    0,
    Math.min(0.75, (budgetCorr + Math.max(0, params.leaderCorruption) * 0.25) / 100)
  );
  const pocketedGold = Math.round(grossIncome * effectiveCorruption);
  const netRevenue = Math.max(0, grossIncome - pocketedGold);

  const milScale = Math.max(0.6, Math.min(1.6, milBudget / 30));
  let militaryUpkeep = 0;
  for (const u of params.activeUnits) {
    const cnt = Math.max(0, Number(u.count) || 0);
    if (cnt <= 0) continue;
    militaryUpkeep += Math.round(Math.max(4, Math.min(80, Math.ceil(cnt / 25))) * milScale);
  }
  const courtAdminUpkeep = Math.round(params.myBurgs.length * 5 * (adminBudget / 55));
  const warCampaignCost = params.activeWarCount * (35 + Math.min(60, params.myBurgs.length * 2));
  const totalUpkeep = militaryUpkeep + courtAdminUpkeep + warCampaignCost;

  const preBalance = Math.max(0, Number(params.treasury) || 0) + netRevenue;
  const insolvent = preBalance < totalUpkeep;
  const deficit = insolvent ? totalUpkeep - preBalance : 0;
  let newTreasury = Math.max(0, preBalance - totalUpkeep);
  if (newTreasury > 15000) {
    newTreasury -= Math.floor((newTreasury - 15000) * 0.02);
  }

  const prevSpent = parseJsonObj(fiscal.spent, {});
  const updatedFiscal: Record<string, any> = {
    ...fiscal,
    budget,
    total_pop: totalPop,
    gdp,
    collected: grossIncome,
    pocketed: pocketedGold,
    treasury: newTreasury,
    spent: {
      ...prevSpent,
      military: militaryUpkeep,
    },
  };

  return {
    grossIncome,
    pocketedGold,
    netRevenue,
    militaryUpkeep,
    totalUpkeep,
    newTreasury,
    effectiveCorruption,
    insolvent,
    deficit,
    totalPop,
    gdp,
    updatedFiscal,
  };
}

/**
 * Pure Phase 2.3 #11 faction planning step: evaluates fiscal economies, weekly border tensions,
 * monthly sovereign utility AI actions, and weekly active war clashes.
 */
export function stepFactionPlanning(
  snap: FactionPlanningSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  const events: Array<{
    tick: number;
    type: string;
    message: string;
    tier: "MINOR" | "MAJOR" | "CRITICAL";
    faction_id?: number;
    burg_id?: number | null;
    lore_date: string;
  }> = [];

  const factionStates = new Map<number, FactionState>();
  const factionNames: Record<number, string> = {};
  const burgsByFaction: Record<number, number[]> = {};
  const liveTreasury = new Map<number, number>();
  const fiscalByFaction = new Map<number, Record<string, any>>();
  const burgFiscalDeltas = new Map<number, { du: number; dc: number }>();

  for (const f of snap.factions) {
    factionNames[Number(f.id)] = String(f.name || `Faction ${f.id}`);
  }
  for (const b of snap.burgs) {
    const fid = Number(b.faction_id || 0);
    if (fid <= 0) continue;
    if (!burgsByFaction[fid]) burgsByFaction[fid] = [];
    burgsByFaction[fid]!.push(Number(b.burg_id));
  }

  // Working diplomacy map reflecting sequential Phase 1B -> Phase 2 -> Phase 3 upserts
  const diploMap = new Map<string, FactionDiplomacySnap>();
  for (const d of snap.diplomacy) {
    diploMap.set(`${d.factionAId}:${d.factionBId}`, { ...d });
  }
  const setDiplo = (w: FactionDiplomacySnap) => {
    diploMap.set(`${w.factionAId}:${w.factionBId}`, { ...w });
    deltas.push({
      kind: "diplomacy.upsert",
      factionAId: w.factionAId,
      factionBId: w.factionBId,
      status: w.status,
      tension: w.tension,
    });
  };

  // --- PHASE 1: BUILD FACTION STATES & FISCAL EVALUATION ---
  for (const f of snap.factions) {
    const fId = Number(f.id);
    const myBurgs = snap.burgs.filter((b) => Number(b.faction_id) === fId);
    const myUnits = snap.units.filter(
      (u) => Number(u.faction_id) === fId && u.status !== "DISBANDED" && Number(u.count) > 0
    );

    let avgUnrest = 0;
    let avgHealth = 0;
    let avgCrime = 0;
    const macroTagsSet = new Set<string>();

    for (const b of myBurgs) {
      avgUnrest += b.unrest || 0;
      avgHealth += b.health || 100;
      avgCrime += b.crime_rate || 0;
      const tags = snap.cellTagsByCell[Number(b.cell_id)] || [];
      for (const t of tags) macroTagsSet.add(t);
    }

    if (myBurgs.length > 0) {
      avgUnrest /= myBurgs.length;
      avgHealth /= myBurgs.length;
      avgCrime /= myBurgs.length;
    }

    const myCounselors = snap.paragons.filter((p) => Number(p.faction_id) === fId && p.is_counselor);
    let avgSurv = 1.0;
    let avgProt = 1.0;
    if (myCounselors.length > 0) {
      avgSurv =
        myCounselors.reduce((sum: number, c: any) => sum + (c.survival_mult || 1.0), 0) / myCounselors.length;
      avgProt =
        myCounselors.reduce((sum: number, c: any) => sum + (c.protection_mult || 1.0), 0) / myCounselors.length;
    }

    const leader =
      snap.paragons.find(
        (p) =>
          Number(p.faction_id) === fId &&
          [
            "EMPEROR",
            "EMPRESS",
            "HIGH_MATRIARCH",
            "ARCH-DUKE",
            "GRAND_CHIEFTAIN",
            "LORD_PROTECTOR",
            "HIGH_CHANCELLOR",
            "WARLORD",
          ].includes(String(p.title || "").toUpperCase())
      ) || snap.paragons.find((p) => Number(p.faction_id) === fId && !p.is_counselor);

    const leaderTraits = getTraitsList(leader);
    const leaderName = leader ? String(leader.name) : `Sovereign of ${f.name}`;
    const leaderTitle = leader ? String(leader.title) : "High Sovereign";
    const leaderCorruption = Number(leader?.corruption_score || 0);

    const activeWarsList = snap.diplomacy.filter(
      (d) => d.status === "WAR" && (d.factionAId === fId || d.factionBId === fId)
    );
    const finance = evaluateFactionFinances({
      treasury: Number(f.treasury) || 0,
      fiscalRaw: f.fiscal_economy,
      myBurgs,
      activeUnits: myUnits,
      activeWarCount: activeWarsList.length,
      leaderCorruption,
    });
    const newTreasury = finance.newTreasury;
    const netIncome = finance.netRevenue - finance.totalUpkeep;

    if (finance.insolvent && myUnits.length > 0) {
      const desertRate = Math.min(0.5, 0.15 + finance.deficit / Math.max(100, finance.totalUpkeep * 2));
      let troopsDeserted = 0;
      let unitsDisbanded = 0;
      for (const u of myUnits) {
        const curCnt = Math.max(0, Number(u.count) || 0);
        const loss = Math.max(12, Math.ceil(curCnt * desertRate));
        const nextCnt = Math.max(0, curCnt - loss);
        const actualLoss = curCnt - nextCnt;
        const nextStatus = nextCnt <= 0 ? "DISBANDED" : String(u.status || "ACTIVE");
        troopsDeserted += actualLoss;
        if (nextStatus === "DISBANDED") unitsDisbanded++;
        deltas.push({
          kind: "factionUnit.update",
          unitId: Number(u.id),
          count: nextCnt,
          status: nextStatus,
        });
      }
      if (troopsDeserted > 0) {
        events.push({
          tick: snap.tick,
          type: "FACTION_TROOP_DESERTION",
          message: `💸 PAYROLL COLLAPSE: ${f.name} defaulted on military upkeep (${finance.deficit} gold short). ${troopsDeserted} soldiers deserted (${unitsDisbanded} units disbanded)!`,
          tier: "MAJOR",
          faction_id: fId,
          burg_id: myBurgs[0]?.burg_id || null,
          lore_date: snap.loreDate,
        });
      }
      for (const b of myBurgs) {
        const cur = burgFiscalDeltas.get(Number(b.burg_id)) || { du: 0, dc: 0 };
        cur.du += 3;
        burgFiscalDeltas.set(Number(b.burg_id), cur);
      }
    }

    if (finance.effectiveCorruption >= 0.30 && myBurgs.length > 0) {
      const excess = finance.effectiveCorruption - 0.25;
      const du = Math.max(1, Math.round(excess * 10));
      const dc = Math.round(excess * 8 * 10) / 10;
      for (const b of myBurgs) {
        const cur = burgFiscalDeltas.get(Number(b.burg_id)) || { du: 0, dc: 0 };
        cur.du += du;
        cur.dc += dc;
        burgFiscalDeltas.set(Number(b.burg_id), cur);
      }
      if (finance.effectiveCorruption >= 0.35) {
        events.push({
          tick: snap.tick,
          type: "FACTION_CORRUPTION_UNREST",
          message: `⚖️ TREASURY SKIMMING: Officials in ${f.name} pocketed ${finance.pocketedGold} gold (${Math.round(finance.effectiveCorruption * 100)}% graft), stoking provincial unrest and syndicate crime.`,
          tier: "MINOR",
          faction_id: fId,
          burg_id: myBurgs[0]?.burg_id || null,
          lore_date: snap.loreDate,
        });
      }
    }

    let totalCombatSquads = 0;
    for (const b of myBurgs) {
      let forces: any = {};
      try {
        if (typeof b.military_forces === "string") forces = JSON.parse(b.military_forces || "{}");
        else if (b.military_forces) forces = b.military_forces;
      } catch {
        // Ignore malformed JSON
      }
      let squads = 0;
      for (const count of Object.values(forces)) {
        squads += Number(count) || 0;
      }
      squads += Math.max(2, Math.floor((b.pop_null || 1000) / 1000));
      const fortMult = computeSiegeDefenseMultiplier(extractBurgCivicFlags(b));
      totalCombatSquads += Math.round(squads * fortMult);
    }

    const perceivedEconomy = netIncome * avgSurv;
    const perceivedDefense = Math.max(15, Math.floor(totalCombatSquads * avgProt));

    let aggression = f.trait_aggression || 5;
    const economy = f.trait_economy || 5;
    let magic = f.trait_magic || 5;

    if (leaderTraits.some((t) => t.includes("BLOODTHIRSTY") || t.includes("CONQUEROR") || t.includes("AGGRESSIVE"))) {
      aggression += 4;
    }
    if (leaderTraits.some((t) => t.includes("PACIFIST") || t.includes("DIPLOMAT"))) aggression -= 4;
    // Matches original agent behavior: `economy` adjusted only in local if needed, wait keep original:
    let effEconomy = economy;
    if (leaderTraits.some((t) => t.includes("GREEDY") || t.includes("USURIOUS"))) effEconomy += 4;
    if (leaderTraits.some((t) => t.includes("SUPERSTITIOUS") || t.includes("ALCHEMIST"))) magic += 4;
    if (leaderTraits.some((t) => t.includes("PARANOID"))) aggression += 2;

    const validNeighbors: number[] = Array.from(
      new Set<number>(
        snap.borders
          .filter((b) => b.factionA === fId || b.factionB === fId)
          .map((b) => Number(b.factionA === fId ? b.factionB : b.factionA))
          .filter((id) => id !== fId && id > 0)
      )
    );
    const activeWars = snap.diplomacy
      .filter((d) => d.status === "WAR" && (d.factionAId === fId || d.factionBId === fId))
      .map((d) => (d.factionAId === fId ? d.factionBId : d.factionAId));

    factionStates.set(fId, {
      id: fId,
      name: String(f.name || `Faction ${fId}`),
      treasury: newTreasury,
      avgUnrest,
      avgHealth,
      avgCrime,
      aggression,
      economy: effEconomy,
      magic,
      perceivedEconomy,
      perceivedDefense,
      myBurgs,
      myUnits,
      validNeighbors,
      activeWars,
      leaderName,
      leaderTitle,
      leaderTraits,
      leaderCorruption,
      macroTags: Array.from(macroTagsSet),
      tick: snap.tick,
      loreDate: snap.loreDate,
    });

    liveTreasury.set(fId, newTreasury);
    fiscalByFaction.set(fId, finance.updatedFiscal);
  }

  for (const bid of Array.from(burgFiscalDeltas.keys()).sort((a, b) => a - b)) {
    const fd = burgFiscalDeltas.get(bid)!;
    if (fd.du !== 0 || fd.dc !== 0) {
      deltas.push({
        kind: "burg.adjust",
        burgId: bid,
        unrest: fd.du || undefined,
        crime: fd.dc || undefined,
      });
    }
  }

  // --- PHASE 1B: ORGANIC BORDER FRICTION & NATURAL TENSION ESCALATION ---
  if (snap.tick % 7 === 0) {
    const uniqueBorderPairs = new Set<string>();
    for (const b of snap.borders) {
      const fA = Math.min(b.factionA, b.factionB);
      const fB = Math.max(b.factionA, b.factionB);
      if (fA > 0 && fB > 0 && fA !== fB) {
        uniqueBorderPairs.add(`${fA}:${fB}`);
      }
    }

    for (const pair of uniqueBorderPairs) {
      const parts = pair.split(":").map(Number);
      const idA = parts[0];
      const idB = parts[1];
      if (!idA || !idB) continue;
      const stateA = factionStates.get(idA);
      const stateB = factionStates.get(idB);
      if (!stateA || !stateB) continue;

      const existingDiplo = snap.diplomacy.find(
        (d) => (d.factionAId === idA && d.factionBId === idB) || (d.factionAId === idB && d.factionBId === idA)
      );

      const curTension = existingDiplo?.tension ?? 10;
      const curStatus = existingDiplo?.status ?? "PEACE";
      let tensionDelta = curStatus === "PEACE" ? -1 : 0;

      const isAggA = stateA.leaderTraits.some(
        (t) => t.includes("CONQUEROR") || t.includes("WARLORD") || t.includes("BLOODTHIRSTY") || t.includes("AGGRESSIVE")
      );
      const isAggB = stateB.leaderTraits.some(
        (t) => t.includes("CONQUEROR") || t.includes("WARLORD") || t.includes("BLOODTHIRSTY") || t.includes("AGGRESSIVE")
      );
      if (isAggA && stateA.perceivedDefense > 30 && stateA.treasury > 2000) tensionDelta += 3;
      if (isAggB && stateB.perceivedDefense > 30 && stateB.treasury > 2000) tensionDelta += 3;

      if (stateA.perceivedEconomy < 0 || stateB.perceivedEconomy < 0) tensionDelta += 3;

      const isPacA = stateA.leaderTraits.some(
        (t) => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COMPASSIONATE")
      );
      const isPacB = stateB.leaderTraits.some(
        (t) => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COMPASSIONATE")
      );
      if (isPacA) tensionDelta -= 3;
      if (isPacB) tensionDelta -= 3;

      const newTension = Math.max(0, Math.min(100, curTension + tensionDelta));
      let newStatus = curStatus;

      if (curStatus === "PEACE" && newTension >= 65) {
        newStatus = "COLD_WAR";
        events.push({
          tick: snap.tick,
          type: "COLD_WAR_CHILL",
          message: `❄️ BORDER CHILL: Frontier friction between ${stateA.name} and ${stateB.name} chilled into a Cold War as border posts tightened inspections and trade cooled.`,
          tier: "MINOR",
          faction_id: idA,
          lore_date: snap.loreDate,
        });
      } else if (curStatus === "COLD_WAR" && newTension <= 25) {
        newStatus = "PEACE";
        events.push({
          tick: snap.tick,
          type: "BORDER_THAW",
          message: `🌱 BORDER THAW: Peaceful relations and quiet borders between ${stateA.name} and ${stateB.name} dissolved old suspicions, restoring open peace.`,
          tier: "MINOR",
          faction_id: idA,
          lore_date: snap.loreDate,
        });
      } else if (newTension >= 95 && curStatus !== "WAR") {
        if (random() < 0.20) {
          events.push({
            tick: snap.tick,
            type: "BORDER_CRISIS",
            message: `⚔️ FRONTIER BOILING POINT: Border friction between ${stateA.name} and ${stateB.name} reached maximum tension (95+)! Both royal courts face urgent decisions on mobilization or de-escalation.`,
            tier: "MINOR",
            faction_id: idA,
            lore_date: snap.loreDate,
          });
        }
      }

      setDiplo({ factionAId: idA, factionBId: idB, status: newStatus, tension: newTension });
    }
  }

  // --- PHASE 2: UTILITY AI ACTION EVALUATION ---
  const actionCtx: FactionActionPlanContext = {
    factionNames,
    burgsByFaction,
    getDiplomacy: (a, b) => diploMap.get(`${a}:${b}`) || null,
    getDiplomacyRowsBetween: (a, b) => {
      const out: FactionDiplomacySnap[] = [];
      const ab = diploMap.get(`${a}:${b}`);
      if (ab) out.push(ab);
      const ba = diploMap.get(`${b}:${a}`);
      if (ba && a !== b) out.push(ba);
      return out;
    },
    random,
  };

  for (const f of snap.factions) {
    const fId = Number(f.id);
    if ((snap.tick + fId * 7) % DAYS_PER_MONTH !== 0) continue;

    const state = factionStates.get(fId);
    if (!state || state.myBurgs.length === 0) continue;

    const scoredActions: { action: PureFactionAction; score: number; reasoning: string }[] = [];
    for (const action of FACTION_ACTIONS) {
      const evalResult = action.evaluate(state);
      if (evalResult.score > 0) {
        scoredActions.push({
          action,
          score: evalResult.score + random() * 8,
          reasoning: evalResult.reasoning,
        });
      }
    }

    if (scoredActions.length > 0) {
      scoredActions.sort((a, b) => b.score - a.score);
      const chosen = scoredActions[0]!;
      const res = chosen.action.plan(state, actionCtx, chosen.reasoning);

      if (res.treasuryDelta) {
        const curT = liveTreasury.get(fId) ?? 0;
        liveTreasury.set(fId, Math.max(0, curT + res.treasuryDelta));
      }
      if (res.diploWrites) {
        for (const w of res.diploWrites) setDiplo(w);
      }
      for (const d of res.deltas) deltas.push(d);

      if (res.message) {
        const tier: "MINOR" | "MAJOR" = [
          "DECLARE_WAR",
          "BORDER_SKIRMISH",
          "MUSTER_MILITARY_FORCES",
          "FORM_ALLIANCE",
          "TRADE_EMBARGO",
          "COVERT_SABOTAGE",
          "COMMISSION_WORLD_WONDER",
        ].includes(chosen.action.id)
          ? "MAJOR"
          : "MINOR";
        events.push({
          tick: snap.tick,
          type: chosen.action.id,
          message: res.message,
          tier,
          faction_id: fId,
          burg_id: state.myBurgs[0]?.burg_id || null,
          lore_date: snap.loreDate,
        });
      }
    }
  }

  // --- PHASE 3: ACTIVE WAR RESOLUTION (Combat Engine) ---
  if (snap.tick % 7 === 0) {
    const activeWars = snap.diplomacy.filter((d) => d.status === "WAR");
    for (const war of activeWars) {
      if (random() > 0.4) continue;

      const aggressorId = random() > 0.5 ? war.factionAId : war.factionBId;
      const defenderId = aggressorId === war.factionAId ? war.factionBId : war.factionAId;

      const aggState = factionStates.get(aggressorId);
      const defState = factionStates.get(defenderId);
      if (!aggState || !defState || aggState.myBurgs.length === 0 || defState.myBurgs.length === 0) continue;

      const launchBurg = aggState.myBurgs[Math.floor(random() * aggState.myBurgs.length)]!;
      const targetBurg = defState.myBurgs[Math.floor(random() * defState.myBurgs.length)]!;

      let attackerForces: Record<string, number> = {};
      let defenderForces: Record<string, number> = {};
      try {
        if (typeof launchBurg.military_forces === "string") attackerForces = JSON.parse(launchBurg.military_forces);
        else if (launchBurg.military_forces) attackerForces = { ...launchBurg.military_forces };
      } catch {
        // Ignore malformed JSON
      }
      try {
        if (typeof targetBurg.military_forces === "string") defenderForces = JSON.parse(targetBurg.military_forces);
        else if (targetBurg.military_forces) defenderForces = { ...targetBurg.military_forces };
      } catch {
        // Ignore malformed JSON
      }

      const strikeForce: Record<string, number> = {};
      const launchRemaining: Record<string, number> = {};
      let totalStrikeSquads = 0;
      for (const type of Object.keys(attackerForces)) {
        const count = Number(attackerForces[type] || 0);
        strikeForce[type] = count * 0.5;
        launchRemaining[type] = count - strikeForce[type]!;
        totalStrikeSquads += strikeForce[type]!;
      }

      if (totalStrikeSquads < 6) continue;

      deltas.push({
        kind: "burg.adjust",
        burgId: Number(launchBurg.burg_id),
        food: -25,
        wealth: -15,
        unrest: 2,
      });

      const result = resolveCombat(strikeForce, defenderForces, {
        attackerName: aggState.name,
        defenderName: defState.name,
        tick: snap.tick,
        defenderFortifications: extractBurgCivicFlags(targetBurg),
        random,
      });

      if ((result as any).evadedClash) {
        const siphonW = (result as any).siphonWealth || 100;
        const siphonF = (result as any).siphonFood || 100;
        deltas.push({ kind: "burg.adjust", burgId: Number(targetBurg.burg_id), wealth: -siphonW, food: -siphonF });
        deltas.push({ kind: "burg.adjust", burgId: Number(launchBurg.burg_id), wealth: siphonW, food: siphonF });
        events.push({
          tick: snap.tick,
          type: "DESERT_SAND_AMBUSH",
          message: `💨 SUPPLY AMBUSH: Outriders of ${aggState.name} slipped past border battle lines of ${defState.name}, siphoning ${siphonW} gold and ${siphonF} bushels from the supply trains of ${targetBurg.name}!`,
          tier: "MAJOR",
          faction_id: aggressorId,
          burg_id: Number(targetBurg.burg_id),
          lore_date: snap.loreDate,
        });
        continue;
      }

      if ((result as any).scorchedEarth) {
        deltas.push({ kind: "burg.adjust", burgId: Number(targetBurg.burg_id), food: -150 });
        events.push({
          tick: snap.tick,
          type: "SCORCHED_EARTH",
          message: `🔥 SCORCHED EARTH: Retiring forces of ${defState.name} put their granaries to the torch in ${targetBurg.name} to deny provisions to the conquerors!`,
          tier: "MAJOR",
          burg_id: Number(targetBurg.burg_id),
          lore_date: snap.loreDate,
        });
      }

      if ((result as any).sumpKinTerror) {
        deltas.push({ kind: "burg.adjust", burgId: Number(targetBurg.burg_id), unrest: 25 });
      }

      for (const type of Object.keys(result.attackerForces)) {
        launchRemaining[type] = (launchRemaining[type] || 0) + (result.attackerForces[type] || 0);
      }

      deltas.push({
        kind: "burg.set",
        burgId: Number(launchBurg.burg_id),
        fields: { military_forces: JSON.stringify(launchRemaining) },
      });
      deltas.push({
        kind: "burg.set",
        burgId: Number(targetBurg.burg_id),
        fields: { military_forces: JSON.stringify(result.defenderForces) },
      });

      let defRemaining = 0;
      for (const count of Object.values(result.defenderForces)) defRemaining += Number(count) || 0;

      if (defRemaining <= 0) {
        const lootedGold = Math.floor((targetBurg.wealth || 0) * 0.50);
        const occForces = { infantry: Math.max(12, Math.floor((launchRemaining.infantry || 24) * 0.4)) };

        deltas.push({
          kind: "cell.setFaction",
          cellId: Number(targetBurg.cell_id),
          factionId: aggressorId,
        });
        deltas.push({
          kind: "burg.set",
          burgId: Number(targetBurg.burg_id),
          fields: {
            occupier_faction_id: aggressorId,
            occupation_ticks: 0,
            resistance_strength: 50,
            military_forces: JSON.stringify(occForces),
          },
        });
        deltas.push({
          kind: "burg.adjust",
          burgId: Number(targetBurg.burg_id),
          wealth: -lootedGold,
          unrest: 40,
        });
        liveTreasury.set(aggressorId, (liveTreasury.get(aggressorId) ?? 0) + lootedGold);

        deltas.push({
          kind: "citizen.tagBurg",
          burgId: Number(targetBurg.burg_id),
          tags: ["#ConqueredCitizen", "#WarRefugee"],
          temper: "FEARFUL",
          motivation: `Surviving the military conquest of ${targetBurg.name || "the settlement"} by ${aggState.name}.`,
          professionFilter: "%laborer%",
          limit: 4,
          randomSeed: random(),
        });

        events.push({
          tick: snap.tick,
          type: "SIEGE_WON",
          message: `🚩 CONQUEST: The vanguard of ${aggState.name} stormed and conquered ${targetBurg.name || `Burg #${targetBurg.burg_id}`} from ${defState.name}! Plundered ${lootedGold} gold into royal war coffers.`,
          tier: "CRITICAL",
          faction_id: aggressorId,
          burg_id: Number(targetBurg.burg_id),
          lore_date: snap.loreDate,
        });

        const targetArch = String(targetBurg.architecture_type || "WOOD").toUpperCase();
        if (targetArch === "WOOD" || targetArch.includes("TIMBER") || targetArch === "HALF_TIMBERED") {
          events.push({
            tick: snap.tick,
            type: "TOWN_BURNED",
            message: `🔥 INFERNO: As ${targetBurg.name || `Burg #${targetBurg.burg_id}`} fell, torch fire ignited the wooden ramparts and lofts! Because the settlement was built of wood, flames swept uncontrolled across the districts, burning workshops to ash!`,
            tier: "CRITICAL",
            faction_id: aggressorId,
            burg_id: Number(targetBurg.burg_id),
            lore_date: snap.loreDate,
          });
          deltas.push({
            kind: "citizen.tagBurg",
            burgId: Number(targetBurg.burg_id),
            tags: ["#BurnedOutRefugee", "#AshRuinsSurvivor"],
            temper: "TERRIFIED",
            motivation: `Lost home and workshop to the blaze that incinerated wooden districts of ${targetBurg.name}.`,
            professionFilter: null,
            limit: 4,
            randomSeed: random(),
          });
        }
      } else {
        events.push({
          tick: snap.tick,
          type: "BATTLE",
          message: `⚔️ FRONTIER CLASH: Forces of ${aggState.name} attacked ${targetBurg.name || `Burg #${targetBurg.burg_id}`}(${defState.name}).Result: ${result.winner} victory(Combat roll: ${result.attackerTotal} vs ${result.defenderTotal}, diff: ${result.difference.toFixed(0)}).`,
          tier: "MAJOR",
          faction_id: aggressorId,
          burg_id: Number(targetBurg.burg_id),
          lore_date: snap.loreDate,
        });
      }

      if ((aggState.treasury < 300 && aggState.avgUnrest > 50) || (defState.treasury < 300 && defState.avgUnrest > 50)) {
        const fA = Math.min(aggressorId, defenderId);
        const fB = Math.max(aggressorId, defenderId);
        if (diploMap.has(`${fA}:${fB}`)) {
          setDiplo({ factionAId: fA, factionBId: fB, status: "PEACE", tension: 30 });
        }
        events.push({
          tick: snap.tick,
          type: "PEACE_TREATY",
          message: `🕊️ ARMISTICE SIGNED: Devastated by military casualties, war debt, and civil unrest, diplomats of ${aggState.name} and ${defState.name} ratified an emergency peace treaty!`,
          tier: "MAJOR",
          faction_id: aggressorId,
          lore_date: snap.loreDate,
        });
      }
    }
  }

  // Emit single converged faction.update per faction in sorted ID order
  for (const fId of Array.from(liveTreasury.keys()).sort((a, b) => a - b)) {
    deltas.push({
      kind: "faction.update",
      factionId: fId,
      treasurySet: liveTreasury.get(fId)!,
      fiscalEconomy: fiscalByFaction.get(fId),
    });
  }

  for (const ev of events) {
    deltas.push({
      kind: "event.log",
      tick: ev.tick,
      type: ev.type,
      message: ev.message,
      tier: ev.tier,
      factionId: ev.faction_id && ev.faction_id > 0 ? ev.faction_id : undefined,
      burgId: ev.burg_id && ev.burg_id > 0 ? ev.burg_id : undefined,
      loreDate: ev.lore_date,
    });
  }

  return deltas;
}
