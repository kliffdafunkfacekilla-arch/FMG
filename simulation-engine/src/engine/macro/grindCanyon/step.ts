import { CANON_DRAGON_PRISONS } from "../../canon/dragonPrisons.js";
import type { Delta } from "../../deltas/types.js";
import type { GrindBurgCoord, GrindCanyonSnapshot } from "./load.js";

// Dragonstone by Power. Dragon names and Powers come from the canon table (engine/canon/dragonPrisons.ts).
const DRAGONSTONE_BY_POWER: Record<string, string> = {
  Mass: "Gravitic Basalt Dragonstone",
  Nexus: "Astral Weave Dragonstone",
  Ordo: "Geometric Glass Dragonstone",
  Lex: "Adamantine Law Dragonstone",
  Motus: "Kinetic Gale Dragonstone",
  Flux: "Molten Pyre Dragonstone",
  Vita: "Verdant Marrow Dragonstone",
  Ratio: "Harmonic Prismatic Dragonstone",
  Lux: "Solar Flare Dragonstone",
  Omen: "Void Shadow Dragonstone",
  Aura: "Resonant Aether Dragonstone",
  Anumis: "Spirit Spark Dragonstone",
};

export const DRAGON_DOMAINS = CANON_DRAGON_PRISONS.map((p) => {
  const stone = DRAGONSTONE_BY_POWER[p.power];
  if (!stone) throw new Error(`No dragonstone for Power ${p.power}`);
  return { name: p.dragon, domain: p.power, stone };
});

function findNearestBurg(burgs: GrindBurgCoord[], x: number, y: number): GrindBurgCoord | null {
  let best: GrindBurgCoord | null = null;
  let bestDist2 = Infinity;
  for (const b of burgs) {
    const dx = b.x - x;
    const dy = b.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2 || (d2 === bestDist2 && best && b.burgId < best.burgId)) {
      bestDist2 = d2;
      best = b;
    }
  }
  return best;
}

/**
 * Pure Grind Canyon step: extracts dragonstone, decays stability, collapses/seals exhausted chasms,
 * and occasionally opens new canyons in highland wilderness (strictly <= 3 active).
 */
export function stepGrindCanyon(snap: GrindCanyonSnapshot, random: () => number = Math.random): Delta[] {
  const deltas: Delta[] = [];
  let remainingActive = 0;

  for (const canyon of snap.activeCanyons) {
    const stability = canyon.stabilityTicksRemaining - 1;

    if (canyon.status === "OPEN") {
      const extractedStone = Math.min(canyon.dragonstoneRichness, 12 + Math.floor(random() * 8));
      const extractedGold = extractedStone * 25;
      const expeditionOverhead = Math.floor(extractedGold * 0.50);
      const netMiningProfit = extractedGold - expeditionOverhead;

      deltas.push({
        kind: "grindCanyon.update",
        canyonId: canyon.id,
        richnessDelta: -extractedStone,
        stabilityTicksRemaining: stability,
        ...(stability === 1 ? { status: "COLLAPSING" as const } : {}),
      });

      if (canyon.localBurgId !== null) {
        deltas.push({
          kind: "burg.adjust",
          burgId: canyon.localBurgId,
          wealth: expeditionOverhead,
          rawMaterials: 15,
        });
      }

      if (snap.hasCorpoOutlaw) {
        deltas.push({
          kind: "outlawFaction.adjust",
          outlawId: 9,
          wealthDelta: netMiningProfit,
        });
      }

      if (stability === 1) {
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "GRIND_CANYON_COLLAPSING",
          tier: "MAJOR",
          loreDate: snap.loreDate,
          message: `⚠️ GRIND CANYON COLLAPSE IMMINENT: Catastrophic tremors rock Cell ${canyon.cellId}! The abyssal walls of ${canyon.name} are grinding shut! ${canyon.minerCrewName} dive teams are frantically hauling up remaining dragonstone before the bedrock slams closed!`,
        });
      }
      remainingActive++;
    } else if (canyon.status === "COLLAPSING") {
      deltas.push({
        kind: "grindCanyon.update",
        canyonId: canyon.id,
        status: "SEALED",
        stabilityTicksRemaining: 0,
        closedTick: snap.tick,
      });

      if (snap.hasCorpoOutlaw) {
        deltas.push({
          kind: "fringeLair.mutate",
          action: "deleteByFactionCell",
          factionId: 9,
          cellId: canyon.cellId,
        });
      }

      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "GRIND_CANYON_SEALED",
        tier: "MAJOR",
        loreDate: snap.loreDate,
        message: `💥 GRIND CANYON SEALED: ${canyon.name} at Cell ${canyon.cellId} has ground shut with a deafening tectonic roar! The chasm, pre-Cruor ruins, and unmined dragonstone veins are crushed and sealed beneath solid bedrock.`,
      });

      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "GRIND_CORE_CARAVAN_DEPARTURE",
        tier: "MAJOR",
        loreDate: snap.loreDate,
        message: `🐎 GRIND CORE CARAVAN DEPARTURE: With ${canyon.name} ground shut beneath solid stone at Cell ${canyon.cellId}, the Grind Canyon Corps packed up their heavy winches, forge-wagons, and caravans to roam the wilderness until the next chasm tears open!`,
      });
    }
  }

  if (remainingActive < 3 && random() < 0.25 && snap.wildCells.length > 0) {
    const cell = snap.wildCells[Math.floor(random() * snap.wildCells.length)]!;
    const dragonPick = DRAGON_DOMAINS[Math.floor(random() * DRAGON_DOMAINS.length)]!;
    const canyonName = `The Jagged Chasm of ${dragonPick.name} (${dragonPick.domain})`;
    const depth = 200 + Math.floor(random() * 350);
    const richness = 100 + Math.floor(random() * 150);
    const artifacts = 2 + Math.floor(random() * 4);
    const duration = 6 + Math.floor(random() * 6);
    const crewNum = Math.floor(random() * 20) + 1;
    const crewName = `Grind Canyon Corps - Sledge Dive Crew #${crewNum}`;

    deltas.push({
      kind: "grindCanyon.create",
      name: canyonName,
      cellId: cell.id,
      sectorX: 112,
      sectorY: 112,
      dragonName: dragonPick.name,
      dragonDomain: dragonPick.domain,
      depthMeters: depth,
      dragonstoneRichness: richness,
      artifactsRemaining: artifacts,
      stabilityTicksRemaining: duration,
      totalDurationTicks: duration,
      status: "OPEN",
      minerCrewName: crewName,
      activeMiners: 14,
      openedTick: snap.tick,
    });

    const nearestBurg = findNearestBurg(snap.burgs, cell.x, cell.y);

    if (snap.hasCorpoOutlaw) {
      deltas.push({
        kind: "fringeLair.mutate",
        action: "upsert",
        factionId: 9,
        cellId: cell.id,
        burgId: nearestBurg ? nearestBurg.burgId : null,
        lairType: "CHASM_DIVE_CAMP",
        manpower: 35,
        heat: 20,
      });
    }

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "GRIND_CANYON_OPENED",
      tier: "CRITICAL",
      loreDate: snap.loreDate,
      message: `⚡ GRIND CANYON OPENED: A colossal tectonic fissure has torn open at Cell ${cell.id}! ${canyonName} plunges ${depth}m into the earth, exposing pre-Cruor ruins and veins of ${dragonPick.stone}. ${crewName} has anchored heavy descent winches to strip treasure before the chasm grinds shut!`,
    });

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "GRIND_CORE_CARAVAN_ARRIVED",
      tier: "CRITICAL",
      loreDate: snap.loreDate,
      message: `⛺ CHASM CARAVAN ARRIVAL: The nomadic wagon-trains of the Grind Canyon Corps have arrived at Cell ${cell.id}! Setting up heavy descent winches and mobile forge-tents above ${canyonName}, the self-populating caravan community has established camp to strip dragonstone before the bedrock slams shut! Nearby ${nearestBurg?.name || "settlements"} brace for the influx of wild crews.`,
    });
  }

  return deltas;
}
