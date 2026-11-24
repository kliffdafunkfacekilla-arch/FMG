import { DAYS_PER_WEEK } from "../../canon/calendar.js";
import { hashSeed } from "../../rng.js";
import type { Delta } from "../../deltas/types.js";
import type { EcologyBurgRow, EcologyCellRow, EcologySnapshot } from "./load.js";

export interface EcologyStepContext {
  random: () => number;
  skipCellIds?: ReadonlySet<number> | undefined;
}

const DOMAIN_FLORA_TAGS: Record<string, { tags: string[]; name: string; desc: string }> = {
  Flux: {
    tags: ["#ChimericFlora", "#VolatileAetherRoot", "#BioluminescentSpore"],
    name: "Luminescent Chimera-Moss",
    desc: "strange iridescent spores and shifting biomantic roots glowing under the crimson sky",
  },
  Vita: {
    tags: ["#BloodThornOvergrowth", "#CarnivorousBriar", "#PrimevalHyperbloom"],
    name: "Feral Blood-Briars",
    desc: "carnivorous thorny vines that bleed sap and choke ancient timberlines",
  },
  Ordo: {
    tags: ["#StasisFrostFern", "#CrystallineLichen", "#ChronoPetals"],
    name: "Stasis-Lattice Ferns",
    desc: "geometric crystal foliage humming in perpetual frozen stasis",
  },
  Mass: {
    tags: ["#IronBarkTimber", "#BasaltCapMushroom", "#HeavyRootFungus"],
    name: "Basalt-Cap Fungi",
    desc: "dense, heavy timber and petrified fungal caps weighing down the undergrowth",
  },
  Motus: {
    tags: ["#GaleWarpedWillow", "#KineticReeds", "#WhistlingThicket"],
    name: "Kinetic Gale-Reeds",
    desc: "wind-warped bamboo and reeds whipping frantically even in still air",
  },
  Anumis: {
    tags: ["#SoulAshMycelium", "#GraveMistWeed", "#NecroticLichen"],
    name: "Soul-Ash Mycelium",
    desc: "pale ghost-lichen feeding on ancestral soil, exhaling chill mist",
  },
  Lux: {
    tags: ["#PhosphorSunLotus", "#RadiantFireLily", "#BlindingSpores"],
    name: "Phosphor Sun-Lotus",
    desc: "dazzling radiant blooms that combust with blinding solar sparks",
  },
  Nexus: {
    tags: ["#PhaseShiftingBramble", "#MiragePetals", "#FoldedLeaflet"],
    name: "Phase-Shifting Brambles",
    desc: "spectral blossoms flickering between spatial folds and optical mirages",
  },
  Lex: {
    tags: ["#IronrootMandragora", "#RunicBramble", "#DecreeThorn"],
    name: "Runic Iron-Mandragora",
    desc: "rigid runic root-plants with metallic leaves binding the topsoil",
  },
  Ratio: {
    tags: ["#ClockworkFern", "#HarmonicFungus", "#GeometricShrub"],
    name: "Clockwork Geometric Ferns",
    desc: "mathematically precise fractal leaves ticking softly with harmonic pulses",
  },
  Omen: {
    tags: ["#EclipseBlackthorn", "#ShadowOmenIvy", "#VoidPetals"],
    name: "Eclipse Blackthorn",
    desc: "inky black thorns absorbing surrounding light and whispering dire auguries",
  },
  Aura: {
    tags: ["#PhantasmVioletOrchid", "#MindEchoSpore", "#DreamMistWeed"],
    name: "Phantasmagoric Orchids",
    desc: "violet dream-spores releasing waking visions and psychic echoes",
  },
};

function pickBySeed<T>(items: T[], getKey: (x: T) => number, limit: number, rnd: () => number): T[] {
  const salt = Math.floor(rnd() * 2147483647);
  if (items.length <= limit) {
    return [...items].sort((a, b) => hashSeed(`${getKey(a)}:${salt}`) - hashSeed(`${getKey(b)}:${salt}`));
  }
  return [...items]
    .map((item) => ({ item, rank: hashSeed(`${getKey(item)}:${salt}`) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.item);
}

function findNearbyBurg(
  cell: EcologyCellRow,
  burgs: EcologyBurgRow[],
  cellMap: Map<number, EcologyCellRow>,
  maxDist2: number
): EcologyBurgRow | undefined {
  for (const b of burgs) {
    if (b.cell_id === null) continue;
    if (b.cell_id === cell.id) return b;
    const bc = cellMap.get(b.cell_id);
    if (!bc) continue;
    const d2 = (cell.center_x - bc.center_x) ** 2 + (cell.center_y - bc.center_y) ** 2;
    if (d2 <= maxDist2) return b;
  }
  return undefined;
}

/**
 * Pure continental trophic carrying-capacity, mutagenesis, raids, grove blight, and foraging step.
 */
export function stepEcology(snap: EcologySnapshot, ctx: EcologyStepContext): Delta[] {
  if (!snap.active) return [];

  const deltas: Delta[] = [];
  const rnd = ctx.random;
  const { tick, season, loreDate, dragonDomain, dragonName, moonPhase, isPeakChaos } = snap;
  const intervalDays = DAYS_PER_WEEK;

  const skip = ctx.skipCellIds;
  const cells: EcologyCellRow[] = snap.cells
    .filter((c) => !skip || !skip.has(c.id))
    .map((c) => ({ ...c }));
  const cellMap = new Map<number, EcologyCellRow>();
  for (const c of cells) cellMap.set(c.id, c);
  const dirtyCells = new Set<number>();

  const burgByCell = new Map<number, EcologyBurgRow[]>();
  for (const b of snap.burgs) {
    if (b.cell_id === null) continue;
    let arr = burgByCell.get(b.cell_id);
    if (!arr) { arr = []; burgByCell.set(b.cell_id, arr); }
    arr.push(b);
  }

  // ── 1. SEASONAL FLORA DYNAMICS ───────────────────────────────────────────
  let plantGrowthDelta = 1.0;
  switch (season) {
    case "Greenspan": plantGrowthDelta = 2.5; break;
    case "Thawrise": plantGrowthDelta = 1.6; break;
    case "Shadowburn":
    case "Dimburn": plantGrowthDelta = 1.2; break;
    case "Dryspell": plantGrowthDelta = -0.6; break;
    case "Cropfade": plantGrowthDelta = -0.9; break;
    case "Frostin": plantGrowthDelta = -1.0; break;
    case "Dimfreeze": plantGrowthDelta = -1.8; break;
    default: plantGrowthDelta = 1.0;
  }
  const scaledGrowth = plantGrowthDelta * intervalDays;
  const blightDecay = 1.2 * intervalDays;

  for (const c of cells) {
    const prevPlants = c.eco_plants;
    const prevPrey = c.eco_prey;
    const prevPred = c.eco_predators;

    const nextPlants =
      c.eco_blight < 40.0
        ? Math.min(c.eco_max, Math.max(2.0, c.eco_plants + scaledGrowth))
        : Math.max(1.0, c.eco_plants - blightDecay);

    // Note: in the single SQL UPDATE, CASE expressions read the old row values of eco_plants/eco_prey.
    const nextPrey =
      prevPlants >= 40.0
        ? Math.min(100.0, prevPrey + 0.8)
        : prevPlants < 25.0
          ? Math.max(2.0, prevPrey - 0.9)
          : prevPrey;

    const nextPred =
      prevPrey >= 35.0
        ? Math.min(60.0, prevPred + 0.5)
        : prevPred;

    c.eco_plants = nextPlants;
    c.eco_prey = nextPrey;
    c.eco_predators = nextPred;

    if (nextPlants !== prevPlants || nextPrey !== prevPrey || nextPred !== prevPred) {
      dirtyCells.add(c.id);
    }
  }

  // ── 2. FLORA MUTAGENESIS UNDER SURGING CHAOS LEYS ────────────────────────
  if (isPeakChaos || tick % 6 === 0) {
    const floraDef = DOMAIN_FLORA_TAGS[dragonDomain] || DOMAIN_FLORA_TAGS["Flux"]!;
    const candidates: EcologyCellRow[] = [];
    const seen = new Set<number>();
    for (const z of snap.chaosZones) {
      if (z.intensity >= 30 && !seen.has(z.cell_id)) {
        const c = cellMap.get(z.cell_id);
        if (c) { seen.add(z.cell_id); candidates.push(c); }
      }
    }
    for (const cell of pickBySeed(candidates, (x) => x.id, 3, rnd)) {
      deltas.push({ kind: "tags.add", target: { kind: "cell", cellId: cell.id, zLayer: 0 }, tags: floraDef.tags });
      const adjBurg = findNearbyBurg(cell, snap.burgs, cellMap, 3600);
      if (adjBurg && rnd() < 0.35) {
        deltas.push({
          kind: "event.log",
          tick,
          type: "FLORA_MUTAGENESIS",
          message: `🌿 BOTANICAL MUTAGENESIS: Surging ${dragonDomain} leys of ${dragonName} under ${moonPhase} caused ${floraDef.name} to bloom across the wilderness near ${adjBurg.name}! Foragers report ${floraDef.desc}.`,
          tier: "MINOR",
          burgId: adjBurg.burg_id,
          loreDate,
        });
        deltas.push({
          kind: "citizen.tagBurg",
          burgId: adjBurg.burg_id,
          tags: ["#AetherHerbHarvester", "#DragonstoneGatherer"],
          temper: "CURIOUS",
          motivation: `Harvesting rare ${floraDef.name} blooming along the chaos leyline perimeter.`,
          professionFilter: "%herbalist%",
          limit: 2,
          randomSeed: rnd(),
        });
      }
    }
  }

  // ── 3. PREY POPULATION DYNAMICS & CROP RAIDS ─────────────────────────────
  if (tick % 7 === 0) {
    const overgrazed: Array<{ cell: EcologyCellRow; burg: EcologyBurgRow }> = [];
    for (const c of cells) {
      if (c.eco_prey >= 75.0 && c.eco_predators < 20.0) {
        const atCell = burgByCell.get(c.id);
        if (atCell) {
          for (const b of atCell) overgrazed.push({ cell: c, burg: b });
        }
      }
    }
    for (const row of pickBySeed(overgrazed, (r) => r.cell.id, 2, rnd)) {
      const foodLost = Math.max(15, Math.floor((row.burg.pop_null || 100) * 0.2));
      deltas.push({ kind: "burg.adjust", burgId: row.burg.burg_id, food: -foodLost, unrest: 1 });
      deltas.push({
        kind: "tags.add",
        target: { kind: "cell", cellId: row.cell.id, zLayer: 0 },
        tags: ["#CropRaidedByBeasts", "#OvergrazedBrush"],
      });
      deltas.push({
        kind: "event.log",
        tick,
        type: "HERBIVORE_CROP_RAID",
        message: `🐗 CROP RAID: Massive herds of wild grazers and crop-raiding beasts emerged from the brush, devouring ${foodLost} units of grain around ${row.burg.name}!`,
        tier: "MINOR",
        burgId: row.burg.burg_id,
        loreDate,
      });
      deltas.push({
        kind: "citizen.tagBurg",
        burgId: row.burg.burg_id,
        tags: ["#CropDefender", "#BitterHarvester"],
        temper: "BITTER",
        motivation: `Guarding the grain fields of ${row.burg.name} from marauding wild animal herds.`,
        professionFilter: "%farmer%",
        limit: 2,
        randomSeed: rnd(),
      });
    }
  }

  // ── 4. PREDATOR-PREY BALANCE & STARVING PREDATOR MIGRATION ────────────────
  const starvingCandidates = cells.filter(
    (c) => (c.eco_predators > c.eco_prey * 1.25 || c.eco_prey < 18.0) && c.eco_predators >= 15.0
  );
  for (const cell of pickBySeed(starvingCandidates, (c) => c.id, 4, rnd)) {
    const nextPred = Math.max(2.0, cell.eco_predators - 1.5);
    if (nextPred !== cell.eco_predators) {
      cell.eco_predators = nextPred;
      dirtyCells.add(cell.id);
    }
    deltas.push({
      kind: "tags.add",
      target: { kind: "cell", cellId: cell.id, zLayer: 0 },
      tags: ["#PredatorProwlZone", "#DireBeastAmbush"],
    });
    const nearbyBurg = findNearbyBurg(cell, snap.burgs, cellMap, 3600);
    if (nearbyBurg) {
      deltas.push({ kind: "burg.adjust", burgId: nearbyBurg.burg_id, unrest: 2, food: -30 });
      if (rnd() < 0.40) {
        deltas.push({
          kind: "event.log",
          tick,
          type: "STARVING_PREDATOR_MIGRATION",
          message: `🐺 STARVING PREDATORS: Depleted prey forced desperate dire packs and wild beasts out of the hills to prowl the caravan roads and livestock pens around ${nearbyBurg.name}!`,
          tier: "MINOR",
          burgId: nearbyBurg.burg_id,
          loreDate,
        });
        deltas.push({
          kind: "citizen.tagBurg",
          burgId: nearbyBurg.burg_id,
          tags: ["#BeastHunter", "#TraumatizedSurvivor"],
          temper: "WARY",
          motivation: `Patrolling the fences of ${nearbyBurg.name} after livestock were mauled by starving predator packs.`,
          professionFilter: "%watch%",
          limit: 2,
          randomSeed: rnd(),
        });
      }
    }
  }

  // ── 6. CHAOS BEAST MUTAGENESIS ───────────────────────────────────────────
  if (isPeakChaos || tick % 5 === 0) {
    const warpedCandidates: EcologyCellRow[] = [];
    const seen = new Set<number>();
    for (const z of snap.chaosZones) {
      if (z.intensity >= 45 && !seen.has(z.cell_id)) {
        const c = cellMap.get(z.cell_id);
        if (c) { seen.add(z.cell_id); warpedCandidates.push(c); }
      }
    }
    for (const cell of pickBySeed(warpedCandidates, (c) => c.id, 2, rnd)) {
      const nextApex = Math.min(100.0, cell.eco_apex + 2.0);
      if (nextApex !== cell.eco_apex) {
        cell.eco_apex = nextApex;
        dirtyCells.add(cell.id);
      }
      deltas.push({
        kind: "tags.add",
        target: { kind: "cell", cellId: cell.id, zLayer: 0 },
        tags: ["#ChimericMonsters", "#ChaosTouchedWildlife", `#Warped_${dragonDomain}`],
      });
      const nearbyBurg = findNearbyBurg(cell, snap.burgs, cellMap, 4900);
      if (nearbyBurg && rnd() < 0.35) {
        deltas.push({
          kind: "event.log",
          tick,
          type: "CHAOS_BEAST_MUTATION",
          message: `🐉 PRIMORDIAL CHIMERA: Aetheric ley-floods of ${dragonDomain} in Sector ${cell.id} have mutated apex predators into grotesque ${dragonDomain} chimeras! Hunting parties from ${nearbyBurg.name} report beasts with iridescent scales and volatile breath.`,
          tier: "MAJOR",
          burgId: nearbyBurg.burg_id,
          loreDate,
        });
        deltas.push({
          kind: "citizen.tagBurg",
          burgId: nearbyBurg.burg_id,
          tags: ["#MonsterSlayer", "#BlightedBeastSurvivor"],
          temper: "AGGRESSIVE",
          motivation: `Tracking horrific ${dragonDomain} chimeric predators prowling outside ${nearbyBurg.name}.`,
          professionFilter: "%soldier%",
          limit: 2,
          randomSeed: rnd(),
        });
      }
    }
  }

  // ── 7. BLIGHT & SACRED DRAGON GROVE STABILIZATION ────────────────────────
  for (const g of snap.groves) {
    const c = cellMap.get(g.cell_id);
    if (!c) continue;
    if (g.seal_strength < 30) {
      const nextBlight = Math.min(100.0, c.eco_blight + 0.8);
      if (nextBlight !== c.eco_blight) {
        c.eco_blight = nextBlight;
        dirtyCells.add(c.id);
      }
    } else if (g.seal_strength >= 75) {
      const nextBlight = Math.max(0.0, c.eco_blight - 1.2);
      if (nextBlight !== c.eco_blight) {
        c.eco_blight = nextBlight;
        dirtyCells.add(c.id);
      }
    }
  }

  // ── 8. AGRICULTURAL & FORAGING FEEDBACK TO BURGS ─────────────────────────
  if (tick % 4 === 0) {
    for (const b of snap.burgs) {
      if (b.cell_id === null) continue;
      const c = cellMap.get(b.cell_id);
      if (!c) continue;
      if (c.eco_plants >= 75.0 && c.eco_blight < 15.0) {
        deltas.push({ kind: "burg.adjust", burgId: b.burg_id, food: 25, wealth: 10 });
      }
      if (c.eco_plants < 20.0 || c.eco_blight >= 50.0) {
        deltas.push({ kind: "burg.adjust", burgId: b.burg_id, food: -20 });
      }
    }
  }

  // Emit consolidated cell.set per mutated cell
  for (const cellId of Array.from(dirtyCells).sort((a, b) => a - b)) {
    const c = cellMap.get(cellId)!;
    deltas.push({
      kind: "cell.set",
      cellId,
      fields: {
        eco_plants: c.eco_plants,
        eco_prey: c.eco_prey,
        eco_predators: c.eco_predators,
        eco_apex: c.eco_apex,
        eco_blight: c.eco_blight,
      },
    });
  }

  return deltas;
}
