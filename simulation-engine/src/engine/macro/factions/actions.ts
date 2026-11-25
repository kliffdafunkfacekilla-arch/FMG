import type { Delta } from "../../deltas/types.js";

export interface FactionState {
  id: number;
  name: string;
  treasury: number;
  avgUnrest: number;
  avgHealth: number;
  avgCrime: number;
  aggression: number;
  economy: number;
  magic: number;
  perceivedEconomy: number;
  perceivedDefense: number;
  myBurgs: any[];
  myUnits: any[];
  validNeighbors: number[];
  activeWars: number[];
  leaderName: string;
  leaderTitle: string;
  leaderTraits: string[];
  leaderCorruption: number;
  macroTags: string[];
  tick: number;
  loreDate: string;
}

export interface FactionActionPlanContext {
  factionNames: Record<number, string>;
  burgsByFaction: Record<number, number[]>;
  getDiplomacy: (a: number, b: number) => { status: string; tension: number } | null;
  getDiplomacyRowsBetween: (
    a: number,
    b: number
  ) => Array<{ factionAId: number; factionBId: number; status: string; tension: number }>;
  random: () => number;
}

export interface FactionActionPlanResult {
  deltas: Delta[];
  message: string | null;
  treasuryDelta?: number;
  diploWrites?: Array<{ factionAId: number; factionBId: number; status: string; tension: number }>;
}

export interface PureFactionAction {
  id: string;
  name: string;
  evaluate: (state: FactionState) => { score: number; reasoning: string };
  plan: (state: FactionState, ctx: FactionActionPlanContext, reasoning: string) => FactionActionPlanResult;
}

export const FACTION_ACTIONS: PureFactionAction[] = [
  // ── 1. MILITARY MOBILIZATION & GARRISON RECRUITMENT ─────────────────────
  {
    id: "MUSTER_MILITARY_FORCES",
    name: "Muster Military Forces",
    evaluate: (s) => {
      const isAtWar = s.activeWars.length > 0;
      const isDefVulnerable = s.perceivedDefense < 40;
      const isConqueror = s.leaderTraits.some(
        (t) => t.includes("BLOODTHIRSTY") || t.includes("CONQUEROR") || t.includes("MARTIAL") || t.includes("AGGRESSIVE")
      );
      const isPacifist = s.leaderTraits.some((t) => t.includes("PACIFIST") || t.includes("COMPASSIONATE"));

      if (s.treasury < 600) return { score: 0, reasoning: "" };

      let score = 30;
      if (isAtWar) score += 55;
      if (isDefVulnerable) score += 35;
      if (isConqueror) score += 25;
      if (isPacifist) score -= 30;
      if (s.macroTags.some((t) => t.includes("War") || t.includes("Skirmish"))) score += 20;

      const reasoning = isAtWar
        ? "urgent wartime conscription to repel active enemy incursions"
        : isConqueror
          ? "militaristic ambition to build an overwhelming standing army"
          : "reinforcing vulnerable border garrisons";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const targetBurg = s.myBurgs[Math.floor(ctx.random() * s.myBurgs.length)];
      if (!targetBurg) {
        return { deltas: [], message: null, treasuryDelta: -600 };
      }
      return {
        treasuryDelta: -600,
        deltas: [
          {
            kind: "burg.set",
            burgId: Number(targetBurg.burg_id),
            fields: { military_forces: '{"footmen": 12, "archers": 6, "cavalry": 4}' },
          },
          {
            kind: "burg.adjust",
            burgId: Number(targetBurg.burg_id),
            wealth: -20,
          },
        ],
        message: `🛡️ IMPERIAL MOBILIZATION: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} mustered 22 combat detachments (armored footmen, archers, cavalry) to fortify the garrison at ${targetBurg.name || `Burg #${targetBurg.burg_id}`}!`,
      };
    },
  },

  // ── 2. BORDER SKIRMISH & TENSION ESCALATION ─────────────────────────────
  {
    id: "BORDER_SKIRMISH",
    name: "Border Skirmish",
    evaluate: (s) => {
      if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
      const isAggressive = s.leaderTraits.some(
        (t) => t.includes("AGGRESSIVE") || t.includes("BLOODTHIRSTY") || t.includes("VENGEFUL") || t.includes("BITTER")
      );
      const isPacifist = s.leaderTraits.some((t) => t.includes("PACIFIST") || t.includes("DIPLOMAT"));

      let score = 25 + s.aggression * 4;
      if (isAggressive) score += 35;
      if (isPacifist) score -= 45;
      if (s.macroTags.some((t) => t.includes("Tension") || t.includes("Dispute"))) score += 20;

      const reasoning = isAggressive
        ? "belligerent posturing to intimidate neighboring sovereigns"
        : "contested border claims and territorial patrols";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const enemyId = Number(s.validNeighbors[Math.floor(ctx.random() * s.validNeighbors.length)] ?? s.id);
      const enemyName = ctx.factionNames[enemyId] || `Faction ${enemyId}`;
      const fA = Math.min(s.id, enemyId);
      const fB = Math.max(s.id, enemyId);
      const cur = ctx.getDiplomacy(fA, fB);
      const nextTension = cur ? Math.min(100, cur.tension + 20) : 75;
      const nextStatus = cur ? (cur.tension + 20 >= 100 ? "WAR" : cur.status) : "COLD_WAR";

      return {
        deltas: [],
        diploWrites: fA !== fB ? [{ factionAId: fA, factionBId: fB, status: nextStatus, tension: nextTension }] : [],
        message: `⚔️ BORDER SKIRMISH: Prompted by ${reasoning}, frontier outriders of ${s.name} clashed with border patrols of ${enemyName} along contested boundary markers, escalating tensions!`,
      };
    },
  },

  // ── 3. FORMAL ALL-OUT WAR DECLARATION ────────────────────────────────────
  {
    id: "DECLARE_WAR",
    name: "Declare War",
    evaluate: (s) => {
      if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
      if (s.treasury < 1200 || s.perceivedDefense < 25) return { score: 0, reasoning: "" };

      const isConqueror = s.leaderTraits.some(
        (t) => t.includes("CONQUEROR") || t.includes("BLOODTHIRSTY") || t.includes("IMPERIALIST")
      );
      const isPacifist = s.leaderTraits.some(
        (t) => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COWARDLY")
      );

      let score = 30 + s.aggression * 5;
      if (isConqueror) score += 45;
      if (isPacifist) score -= 60;
      if (s.treasury > 5000) score += 15;

      const reasoning = isConqueror
        ? "unquenchable conquest ambition and martial superiority"
        : "decisive military action to break a hostile geopolitical stalemate";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const enemyId = Number(s.validNeighbors[Math.floor(ctx.random() * s.validNeighbors.length)] ?? s.id);
      const enemyName = ctx.factionNames[enemyId] || `Faction ${enemyId}`;
      const fA = Math.min(s.id, enemyId);
      const fB = Math.max(s.id, enemyId);

      return {
        deltas: [],
        diploWrites: fA !== fB ? [{ factionAId: fA, factionBId: fB, status: "WAR", tension: 100 }] : [],
        message: `🚩 ALL-OUT WAR DECLARED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} declared ALL-OUT WAR against ${enemyName}, mobilizing vanguard legions toward the front!`,
      };
    },
  },

  // ── 4. MUTUAL DEFENSE ALLIANCE PACT ──────────────────────────────────────
  {
    id: "FORM_ALLIANCE",
    name: "Sign Alliance Treaty",
    evaluate: (s) => {
      if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
      const isDiplomat = s.leaderTraits.some(
        (t) => t.includes("DIPLOMAT") || t.includes("PACIFIST") || t.includes("PRAGMATIC") || t.includes("CALCULATED")
      );
      const isBloodthirsty = s.leaderTraits.some((t) => t.includes("BLOODTHIRSTY") || t.includes("ISOLATIONIST"));

      let score = 30 + s.economy * 3;
      if (isDiplomat) score += 40;
      if (isBloodthirsty) score -= 40;

      const reasoning = isDiplomat
        ? "diplomatic wisdom prioritizing regional stability and mutual protection"
        : "pragmatic balance of power against foreign expansion";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const allyId = Number(s.validNeighbors[Math.floor(ctx.random() * s.validNeighbors.length)] ?? s.id);
      const allyName = ctx.factionNames[allyId] || `Faction ${allyId}`;

      return {
        deltas: [],
        diploWrites: allyId !== s.id ? [{ factionAId: s.id, factionBId: allyId, status: "ALLIANCE", tension: 0 }] : [],
        message: `🤝 DIPLOMATIC ALLIANCE: Guided by ${reasoning}, ${s.name} and ${allyName} ratified a Mutual Defense Treaty, pledging joint military assistance!`,
      };
    },
  },

  // ── 5. TRADE EMBARGO & ECONOMIC BLOCKADE ─────────────────────────────────
  {
    id: "TRADE_EMBARGO",
    name: "Trade Embargo",
    evaluate: (s) => {
      if (s.validNeighbors.length === 0) return { score: 0, reasoning: "" };
      const isGreedy = s.leaderTraits.some(
        (t) => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("MERCANTILE")
      );
      const isVengeful = s.leaderTraits.some((t) => t.includes("VENGEFUL") || t.includes("BITTER"));

      let score = 25 + s.economy * 4;
      if (isGreedy) score += 35;
      if (isVengeful) score += 30;

      const reasoning = isGreedy
        ? "mercantile avarice to crush foreign competition and monopolize regional trade"
        : "retaliatory economic sanctions against a rival border power";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const enemyId = Number(s.validNeighbors[Math.floor(ctx.random() * s.validNeighbors.length)] ?? s.id);
      const enemyName = ctx.factionNames[enemyId] || `Faction ${enemyId}`;
      const enemyBurgs = ctx.burgsByFaction[enemyId] || [];

      return {
        deltas: enemyBurgs.map((bid) => ({ kind: "burg.adjust", burgId: bid, wealth: -50 })),
        message: `🚫 TRADE EMBARGO ENACTED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} imposed an iron trade embargo on ${enemyName}, shutting trade corridors and impounding foreign caravans!`,
      };
    },
  },

  // ── 6. COVERT SABOTAGE & INFILTRATION ────────────────────────────────────
  {
    id: "COVERT_SABOTAGE",
    name: "Covert Sabotage",
    evaluate: (s) => {
      if (s.validNeighbors.length === 0 || s.treasury < 800) return { score: 0, reasoning: "" };
      const isSpymaster = s.leaderTraits.some(
        (t) => t.includes("SPYMASTER") || t.includes("PARANOID") || t.includes("CUNNING") || t.includes("ELUSIVE")
      );

      let score = 20 + s.aggression * 3;
      if (isSpymaster) score += 40;

      const reasoning = isSpymaster
        ? "covert doctrine to cripple rival logistical arteries in the shadows"
        : "clandestine sabotage against enemy supply lines";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const enemyId = Number(s.validNeighbors[Math.floor(ctx.random() * s.validNeighbors.length)] ?? s.id);
      const enemyName = ctx.factionNames[enemyId] || `Faction ${enemyId}`;

      return {
        treasuryDelta: -400,
        deltas: [],
        message: `🕵️ COVERT SABOTAGE: Guided by ${reasoning}, ${s.name} shadow operatives slipped across the border of ${enemyName}, setting fire to forward granaries and cutting signal tower cables!`,
      };
    },
  },

  // ── 7. SUE FOR PEACE & NEGOTIATE ARMISTICE ──────────────────────────────
  {
    id: "SUE_FOR_PEACE",
    name: "Sue for Peace",
    evaluate: (s) => {
      if (s.activeWars.length === 0) return { score: 0, reasoning: "" };

      const hasStarvingBurgs = s.myBurgs.some((b) => (b.food || 0) < 100);
      const highUnrest = s.avgUnrest > 25;
      const severeUnrest = s.avgUnrest > 45;
      const depletedGarrisons = s.perceivedDefense < 35;
      const severelyCrushed = s.perceivedDefense < 15;
      const multiFrontWar = s.activeWars.length >= 2;
      const criticalMultiFront = s.activeWars.length >= 3;
      const lowTreasury = s.treasury < 8000;
      const bankrupt = s.treasury < 2000;
      const hasRefugeesOrRuins = s.macroTags.some(
        (t) => t.includes("Refugee") || t.includes("Conquered") || t.includes("Burned") || t.includes("Famine")
      );

      const isVengeful = s.leaderTraits.some(
        (t) => t.includes("VENGEFUL") || t.includes("BITTER") || t.includes("FANATICAL")
      );
      const isAggressive = s.leaderTraits.some(
        (t) =>
          t.includes("AGGRESSIVE") ||
          t.includes("CONQUEROR") ||
          t.includes("BLOODTHIRSTY") ||
          t.includes("RUTHLESS") ||
          t.includes("WARLORD")
      );
      const isPragmatic = s.leaderTraits.some(
        (t) =>
          t.includes("CALCULATED") ||
          t.includes("CALCULATING") ||
          t.includes("GREEDY") ||
          t.includes("MARKET_MANIPULATOR") ||
          t.includes("OLIGARCH_ALLIED") ||
          t.includes("PRAGMATIC")
      );
      const isCompassionate = s.leaderTraits.some(
        (t) =>
          t.includes("COMPASSIONATE") ||
          t.includes("DEVOUT") ||
          t.includes("PACIFIST") ||
          t.includes("BENEVOLENT") ||
          t.includes("PATERNAL")
      );
      const isFearful = s.leaderTraits.some(
        (t) =>
          t.includes("FEARFUL") ||
          t.includes("DESPERATE") ||
          t.includes("WARY") ||
          t.includes("PARANOID") ||
          t.includes("COWARDLY")
      );
      const isScholarly = s.leaderTraits.some(
        (t) => t.includes("SCHOLARLY") || t.includes("CURIOUS") || t.includes("CUNNING")
      );
      const isStoic = s.leaderTraits.some(
        (t) => t.includes("STOIC") || t.includes("IRON_DISCIPLINE") || t.includes("DRILLMASTER")
      );

      let score = 25;
      let reasoning = "seeking to bring a close to active warfare";

      if (criticalMultiFront) score += 50;
      else if (multiFrontWar) score += 25;

      if (isCompassionate) {
        if (hasStarvingBurgs) score += 45;
        if (highUnrest || severeUnrest) score += 35;
        if (hasRefugeesOrRuins) score += 30;
        reasoning = "deep grief over provincial starvation and the mounting suffering of common subjects";
      } else if (isPragmatic) {
        if (lowTreasury) score += 35;
        if (bankrupt) score += 55;
        if (multiFrontWar) score += 30;
        reasoning = "pragmatic calculation that prolonged warfare is draining royal coffers and strangling commerce";
      } else if (isFearful) {
        if (depletedGarrisons) score += 45;
        if (severelyCrushed) score += 75;
        if (multiFrontWar) score += 35;
        reasoning = "alarm as crumbling border garrisons and hostile vanguard banners threaten the realm";
      } else if (isScholarly) {
        if (multiFrontWar || lowTreasury) score += 40;
        if (depletedGarrisons) score += 25;
        reasoning = "calculated strategic assessment that a multi-front campaign is mathematically unsustainable";
      } else if (isStoic) {
        if (severelyCrushed && (bankrupt || hasStarvingBurgs)) {
          score += 40;
          reasoning = "stoic recognition that martial duty requires preserving the surviving legions to rebuild";
        } else {
          score -= 15;
        }
      }
      if (isVengeful) {
        score -= 60;
        if (severelyCrushed && bankrupt) {
          score += 30;
          reasoning =
            "burning fury over fallen strongholds forced into a bitter armistice only because weapons and grain reserves are utterly exhausted";
        } else {
          reasoning = "burning vengeance demanding retribution for fallen territory";
        }
      }
      if (isAggressive) {
        score -= 40;
        if (multiFrontWar && severelyCrushed) {
          score += 30;
          reasoning = "tactical pause to avoid total collapse against overwhelming multi-front pressure";
        }
      }

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, ctx, reasoning) => {
      const enemyId = Number(s.activeWars[0]!);
      const enemyName = ctx.factionNames[enemyId] || `Faction ${enemyId}`;
      const existingRows = ctx.getDiplomacyRowsBetween(s.id, enemyId);
      const myOwnBurgs = ctx.burgsByFaction[s.id] || [];

      return {
        deltas: myOwnBurgs.map((bid) => ({ kind: "burg.adjust", burgId: bid, unrest: -12 })),
        diploWrites: existingRows.map((row) => ({
          factionAId: row.factionAId,
          factionBId: row.factionBId,
          status: "PEACE",
          tension: 20,
        })),
        message: `🕊️ PEACE ACCORD RATIFIED: Prompted by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} ratified a formal peace accord with ${enemyName}, halting active warfare and reopening closed trade borders!`,
      };
    },
  },

  // ── 8. FORTIFY BORDER CITADEL ────────────────────────────────────────────
  {
    id: "FORTIFY_BORDER_CITADEL",
    name: "Fortify Border Citadel",
    evaluate: (s) => {
      if (s.treasury < 1000) return { score: 0, reasoning: "" };
      const isIsolationist = s.leaderTraits.some(
        (t) => t.includes("ISOLATIONIST") || t.includes("PARANOID") || t.includes("DEFENSIVE") || t.includes("STOIC")
      );

      let score = 25;
      if (isIsolationist) score += 45;
      if (s.perceivedDefense < 50) score += 20;

      const reasoning = isIsolationist
        ? "isolationist paranoia and fortified border doctrine"
        : "strengthening defensive citadels against frontier incursions";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, _ctx, reasoning) => ({
      treasuryDelta: -700,
      deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), crime: -8 })),
      message: `🏰 CITADEL FORTIFICATION: Guided by ${reasoning}, ${s.leaderTitle} ${s.leaderName} financed heavy stone bastions and ballista redoubts along the frontier borders of ${s.name}.`,
    }),
  },

  // ── 9. COMMISSION ALCHEMICAL STOCKPILE ────────────────────────────────────
  {
    id: "COMMISSION_ALCHEMICAL_STOCKPILE",
    name: "Commission Alchemical Stockpile",
    evaluate: (s) => {
      if (s.treasury < 800) return { score: 0, reasoning: "" };
      const isAlchemist = s.leaderTraits.some(
        (t) => t.includes("ALCHEMIST") || t.includes("SUPERSTITIOUS") || t.includes("SCHOLARLY") || t.includes("WILD_SPARK")
      );

      let score = 20 + s.magic * 4;
      if (isAlchemist) score += 35;
      if (s.avgHealth < 80) score += 25;

      const reasoning = isAlchemist
        ? "devotion to alchemical science and weaponized pitch reserves"
        : "stockpiling curative draughts and defensive pyrotechnics";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, _ctx, reasoning) => ({
      treasuryDelta: -500,
      deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), health: 6 })),
      message: `🧪 ALCHEMICAL STOCKPILE: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} directed court alchemists across ${s.name} to distill emergency reserves of dragon-fire pitch and curative draughts (+6 Health).`,
    }),
  },

  // ── 10. HOLD GRAND TOURNEY & JOUST ───────────────────────────────────────
  {
    id: "HOLD_CORONATION_JOUST",
    name: "Hold Grand Tourney and Joust",
    evaluate: (s) => {
      if (s.treasury < 1500 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
      const isHedonist = s.leaderTraits.some(
        (t) => t.includes("HEDONIST") || t.includes("DECADENT") || t.includes("CHIVALRIC") || t.includes("CONVIVIAL")
      );

      let score = 20;
      if (isHedonist) score += 45;
      if (s.avgUnrest > 25) score += 25;

      const reasoning = isHedonist
        ? "decadent love of chivalric spectacle and grand pageantry"
        : "inspiring knightly loyalty and cheering restless provincial crowds";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, _ctx, reasoning) => ({
      treasuryDelta: -600,
      deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), unrest: -10 })),
      message: `🏆 CHIVALRIC TOURNEY: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} proclaimed an imperial chivalric tournament across ${s.name}, soothing public unrest through feasts and martial pageantry (-10 Unrest).`,
    }),
  },

  // ── 11. IMPERIAL PROVINCIAL GRAIN RELIEF ─────────────────────────────────
  {
    id: "IMPERIAL_GRAIN_RELIEF",
    name: "Imperial Provincial Grain Relief",
    evaluate: (s) => {
      const hasStarvingBurg = s.myBurgs.some((b) => (b.food || 0) < (b.pop_null || 100) * 2);
      if (!hasStarvingBurg || s.treasury < 600) return { score: 0, reasoning: "" };

      const isCompassionate = s.leaderTraits.some(
        (t) => t.includes("COMPASSIONATE") || t.includes("BENEVOLENT") || t.includes("PATERNAL") || t.includes("AGRARIAN")
      );
      const isGreedy = s.leaderTraits.some((t) => t.includes("GREEDY") || t.includes("USURIOUS"));

      let score = 40;
      if (isCompassionate) score += 50;
      if (isGreedy) score -= 45;

      const reasoning = isCompassionate
        ? "imperial benevolence ensuring provincial subjects do not perish of hunger"
        : "preventing widespread starvation riots across the provinces";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, _ctx, reasoning) => ({
      treasuryDelta: -500,
      deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), food: 300, unrest: -8 })),
      message: `🌾 IMPERIAL GRAIN RELIEF: Guided by ${reasoning}, ${s.leaderTitle} ${s.leaderName} dispatched imperial food convoys to alleviate provincial shortages across ${s.name} (+300 Food).`,
    }),
  },

  // ── 12. IMPERIAL SPECIAL TAX LEVY ────────────────────────────────────────
  {
    id: "IMPERIAL_TAX_EXTRACTION",
    name: "Imperial Special Tax Levy",
    evaluate: (s) => {
      const isGreedy = s.leaderTraits.some(
        (t) => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("AVARICE")
      );
      const isTreasuryLow = s.treasury < 1000;

      let score = isTreasuryLow ? 40 : 15;
      if (isGreedy) score += 45;

      const reasoning = isGreedy
        ? "rapacious imperial avarice to amass sovereign bullion"
        : "urgently replenishing depleted sovereign coffers";

      return { score: Math.max(0, score), reasoning };
    },
    plan: (s, _ctx, reasoning) => {
      const totalExtracted = s.myBurgs.length * 40;
      return {
        treasuryDelta: totalExtracted,
        deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), wealth: -40, unrest: 6 })),
        message: `💰 IMPERIAL TAX EXTRACTION: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} enacted a special crown levy across ${s.name}, extracting +${totalExtracted} Gold while provoking public grumbling (+6 Unrest).`,
      };
    },
  },

  // ── 13. COMMISSION WORLD WONDER ──────────────────────────────────────────
  {
    id: "COMMISSION_WORLD_WONDER",
    name: "Commission World Wonder",
    evaluate: (s) => {
      if (s.treasury < 60000 || s.activeWars.length > 0 || s.myBurgs.length < 3 || s.tick < 200) {
        return { score: 0, reasoning: "" };
      }
      const isAmbitious = s.leaderTraits.some(
        (t) => t.includes("AMBITIOUS") || t.includes("VAINGLORIOUS") || t.includes("MAGNIFICENT")
      );
      if (!isAmbitious) return { score: 0, reasoning: "" };

      if (s.tick % 150 !== 0) return { score: 0, reasoning: "" };

      const score = 35;
      const reasoning =
        "vainglorious ambition to etch their sovereign dynasty into eternity with an epochal World Wonder";
      return { score, reasoning };
    },
    plan: (s, _ctx, reasoning) => ({
      treasuryDelta: -40000,
      deltas: s.myBurgs.map((b) => ({ kind: "burg.adjust", burgId: Number(b.burg_id), unrest: -15 })),
      message: `🏛️ WORLD WONDER ERECTED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} completed an awe-inspiring World Wonder, permanently immortalizing their reign!`,
    }),
  },
];
