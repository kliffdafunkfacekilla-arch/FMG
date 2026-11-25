import type { Delta } from "../../deltas/types.js";
import { stepGildedCompass, stepLegion, stepSkyBarons } from "./commerceCartels.js";
import {
  stepLairOperationsAndMilitiaBusts,
  stepSyndicateUpkeepAndCrackdown,
} from "./lairsAndUpkeep.js";
import {
  type CartelRunContext,
  type CartelsSnapshot,
  type CartelStepResult,
  type WorkingCartel,
} from "./types.js";
import { stepObsidianCartel, stepOtters, stepSilkSovereign } from "./underworldCartels.js";
import {
  stepGhostspring,
  stepGhostwind,
  stepGrindCanyonCorps,
  stepHedgeWizards,
} from "./wildCartels.js";

/**
 * Pure Phase 2.3 #10 cartel step: runs each syndicate according to its lore module,
 * updates lair heat / militia watch raids, applies every-10-tick upkeep & sovereign crackdowns,
 * and emits converged deltas.
 */
export function stepCartels(
  snap: CartelsSnapshot,
  opts: { random?: () => number } = {}
): CartelStepResult {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  const workingById = new Map<number, WorkingCartel>();
  for (const c of snap.cartels) {
    workingById.set(c.id, {
      id: c.id,
      name: c.name || "Outlaw Syndicate",
      type: c.type || "CARTEL",
      originCellId: c.originCellId,
      originBurgId: c.originBurgId,
      initialWealth: c.wealth,
      initialManpower: c.manpower,
      initialHeat: c.heat,
      wealth: c.wealth,
      manpower: c.manpower,
      heat: c.heat,
    });
  }

  const lairCountByFaction = new Map<number, number>();
  const lairKeys = new Set<string>();
  for (const l of snap.lairs) {
    lairCountByFaction.set(l.factionId, (lairCountByFaction.get(l.factionId) || 0) + 1);
    if (l.burgId) lairKeys.add(`${l.factionId}:${l.burgId}`);
  }

  const ctx: CartelRunContext = {
    snap,
    random,
    deltas,
    workingById,
    lairCountByFaction,
    lairKeys,
    newLairsNeedingResidents: [],
    emitTagBurg: (burgId, tags, temper, motivation, professionFilter, limit) => {
      deltas.push({
        kind: "citizen.tagBurg",
        burgId,
        tags,
        temper,
        motivation,
        professionFilter,
        limit,
        randomSeed: random(),
      });
    },
  };

  for (const rawCartel of snap.cartels) {
    const cartel = workingById.get(rawCartel.id)!;
    const id = cartel.id;
    const name = cartel.name;

    if (id === 1 || name.includes("Compass")) {
      stepGildedCompass(cartel, ctx);
    } else if (id === 2 || name.includes("Sky-Barons") || name.includes("Sky Baron")) {
      stepSkyBarons(cartel, ctx);
    } else if (id === 3 || name.includes("Legion") || name.includes("Devil")) {
      stepLegion(cartel, ctx);
    } else if (id === 5 || name.includes("Ghostwind")) {
      stepGhostwind(cartel, ctx);
    } else if (id === 6 || name.includes("Obsidian")) {
      stepObsidianCartel(cartel, ctx);
    } else if (id === 10 || name.includes("Hedge Wizards") || name.includes("Hedge Wizard")) {
      stepHedgeWizards(cartel, ctx);
    } else if (id === 7 || name.includes("Otter") || name.includes("Canal Krewe")) {
      stepOtters(cartel, ctx);
    } else if (id === 9 || name.includes("Grind Canyon")) {
      stepGrindCanyonCorps(cartel, ctx);
    } else if (id === 4 || name.includes("Silk-Sovereign") || name.includes("Silk Sovereign")) {
      stepSilkSovereign(cartel, ctx);
    } else if (id === 8 || name.includes("Ghostspring")) {
      stepGhostspring(cartel, ctx);
    }
  }

  stepLairOperationsAndMilitiaBusts(snap, ctx);
  stepSyndicateUpkeepAndCrackdown(snap, ctx);

  for (const id of Array.from(workingById.keys()).sort((a, b) => a - b)) {
    const w = workingById.get(id)!;
    const wealthDelta = w.wealth - w.initialWealth;
    const manpowerDelta = w.manpower - w.initialManpower;
    const heatDelta = w.heat - w.initialHeat;
    if (wealthDelta !== 0 || manpowerDelta !== 0 || heatDelta !== 0) {
      deltas.push({
        kind: "outlawFaction.adjust",
        outlawId: w.id,
        ...(wealthDelta !== 0 ? { wealthDelta } : {}),
        ...(manpowerDelta !== 0 ? { manpowerDelta } : {}),
        ...(heatDelta !== 0 ? { heatDelta } : {}),
      });
    }
  }

  return {
    deltas,
    newLairsNeedingResidents: ctx.newLairsNeedingResidents,
  };
}
