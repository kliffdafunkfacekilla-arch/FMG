/**
 * Makes two sites of the same kind look different.
 *
 * The site generators (hamlet, farm, logging camp, mine, watchtower, shrine, den) each draw one of a few
 * fixed layouts, so every "Hilltop Beacon & Signal Spire" used to be a pixel copy of every other. After a
 * generator runs, this:
 *  1. re-stamps everything it drew, props and NPCs included, in one of 8 orientations (4 rotations x mirror)
 *     around the site centre;
 *  2. adds 2-5 dressing details from a pool for that kind of site (woodpiles, spoil heaps, haystacks,
 *     beehives, archery butts, gardens...), on free ground around it;
 *  3. lays a footpath from the site to the nearest road, if one is near.
 * All choices come from the cell's seed, so the same cell always rebuilds the same site.
 */
import { TILE } from "./TacticalTerrain.js";

const SIZE = 256;

type Prop = { id: string; name: string; pos: [number, number]; tags: string[]; hp: number; maxHp: number; description: string };
type Npc = { pos: [number, number] } & Record<string, any>;

export type SiteKind = "HAMLET" | "FARMLAND" | "LOGGING" | "MINE" | "SHRINE" | "WATCHTOWER" | "SMUGGLER_DEN" | "WILDERNESS";

export interface SiteVariationInput {
  grid: Uint8Array;
  /** The grid as it was before the site generator ran (terrain only). */
  before: Uint8Array;
  props: Prop[];
  npcs: Npc[];
  /** props/npcs added by the site generator start at these indexes. */
  propStart: number;
  npcStart: number;
  cx: number;
  cy: number;
  kind: SiteKind;
  rand: () => number;
  idBase: string;
}

/** Tiles that belong to something built or to a road; dressing never lands on these or on water. */
const BUILT = new Set<number>([TILE.DIRT, TILE.COBBLE, TILE.ROCK, TILE.CHAOS, TILE.ROOF, TILE.FIRE, TILE.MONOLITH, TILE.BRIDGE]);
const WET = new Set<number>([TILE.WATER, TILE.DEEP_WATER, TILE.MARSH]);

export function applySiteVariation(v: SiteVariationInput): void {
  const { grid, before, props, npcs, propStart, npcStart, cx, cy, kind, rand, idBase } = v;

  // 1. Orientation: 0-3 quarter turns, optionally mirrored. Wilderness landmarks are symmetric enough.
  const turns = Math.floor(rand() * 4);
  const mirror = rand() < 0.5;
  if (kind !== "WILDERNESS" && (turns !== 0 || mirror)) {
    const xf = (x: number, y: number): [number, number] => {
      let dx = x - cx, dy = y - cy;
      if (mirror) dx = -dx;
      for (let t = 0; t < turns; t++) [dx, dy] = [-dy, dx];
      return [cx + dx, cy + dy];
    };
    const drawn: Array<[number, number, number]> = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== before[i]) drawn.push([i % SIZE, (i / SIZE) | 0, grid[i]!]);
    }
    grid.set(before);
    for (const [x, y, t] of drawn) {
      const [nx, ny] = xf(x, y);
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) grid[ny * SIZE + nx] = t;
    }
    const clamp = (n: number) => Math.max(2, Math.min(SIZE - 3, n));
    for (let i = propStart; i < props.length; i++) {
      const [nx, ny] = xf(props[i]!.pos[0], props[i]!.pos[1]);
      props[i]!.pos = [clamp(nx), clamp(ny)];
    }
    for (let i = npcStart; i < npcs.length; i++) {
      const [nx, ny] = xf(npcs[i]!.pos[0], npcs[i]!.pos[1]);
      npcs[i]!.pos = [clamp(nx), clamp(ny)];
    }
  }

  // 2. Dressing details
  dressSite(grid, props, cx, cy, kind, rand, idBase);

  // 3. Footpath to the nearest road laid by the terrain painter (if within reach)
  if (kind !== "WILDERNESS") {
    let best: [number, number] | null = null, bestD = Infinity;
    for (let y = 0; y < SIZE; y += 2) for (let x = 0; x < SIZE; x += 2) {
      const t = before[y * SIZE + x]!;
      if (t !== TILE.DIRT && t !== TILE.BRIDGE) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > 28 && d < bestD) { bestD = d; best = [x, y]; }
    }
    if (best && bestD < 150) {
      const wob = rand() * 1000;
      for (let s = 0; s <= 300; s++) {
        const t = s / 300;
        const bend = Math.sin(t * Math.PI) * Math.sin(wob + t * 6) * 9;
        const len = bestD || 1;
        const nx = -(best[1] - cy) / len, ny = (best[0] - cx) / len;
        const x = Math.round(cx + (best[0] - cx) * t + nx * bend), y = Math.round(cy + (best[1] - cy) * t + ny * bend);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]] as const) {
          const px = x + ox, py = y + oy;
          if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
          const k = py * SIZE + px;
          const g = grid[k]!;
          if (g === TILE.ROOF || g === TILE.ROCK || g === TILE.FIRE || g === TILE.MONOLITH || g === TILE.COBBLE) continue;
          grid[k] = WET.has(g) ? TILE.BRIDGE : TILE.DIRT;
        }
      }
    }
  }
}

/**
 * Adds 2-5 dressing details from the pool for `kind` on free ground 22-62 px from (cx, cy).
 * Town wards use their own pools (TOWN_RESIDENTIAL, TOWN_MARKET, TOWN_ARTISAN, TOWN_CITADEL), placed
 * anywhere free in the district (radius 10-110).
 */
export function dressSite(grid: Uint8Array, props: Prop[], cx: number, cy: number, kind: SiteKind | TownKind, rand: () => number, idBase: string): void {
  const pool = DRESSING[kind] ?? [];
  if (!pool.length) return;
  const town = kind.startsWith("TOWN_");
  const count = Math.min(pool.length, (town ? 3 : 2) + Math.floor(rand() * 4));
  const order = pool.map(d => ({ d, k: rand() })).sort((a, b) => a.k - b.k).map(o => o.d);
  let placed = 0;
  for (const d of order) {
    if (placed >= count) break;
    for (let attempt = 0; attempt < (town ? 120 : 40); attempt++) {
      const ang = rand() * Math.PI * 2;
      const r = town ? 10 + rand() * 100 : 22 + rand() * 40;
      const px = Math.round(cx + Math.cos(ang) * r), py = Math.round(cy + Math.sin(ang) * r);
      if (!fits(grid, px, py, d.w, d.h)) continue;
      d.stamp(grid, px, py, rand);
      props.push({ id: `prop_dress_${d.key}_${idBase}`, name: d.name, pos: [px, py], tags: d.tags, hp: 80, maxHp: 80, description: d.description });
      placed++;
      break;
    }
  }
}

export type TownKind = "TOWN_RESIDENTIAL" | "TOWN_MARKET" | "TOWN_ARTISAN" | "TOWN_CITADEL";

function fits(grid: Uint8Array, cx: number, cy: number, w: number, h: number): boolean {
  const hw = Math.ceil(w / 2) + 1, hh = Math.ceil(h / 2) + 1;
  if (cx - hw < 4 || cy - hh < 4 || cx + hw > SIZE - 5 || cy + hh > SIZE - 5) return false;
  for (let y = cy - hh; y <= cy + hh; y++) for (let x = cx - hw; x <= cx + hw; x++) {
    const t = grid[y * SIZE + x]!;
    if (BUILT.has(t) || WET.has(t)) return false;
  }
  return true;
}

// ── Dressing pool ───────────────────────────────────────────────────────────
interface Dressing {
  key: string; name: string; tags: string[]; description: string;
  w: number; h: number;
  stamp: (g: Uint8Array, x: number, y: number, rand: () => number) => void;
}

const put = (g: Uint8Array, x: number, y: number, t: number) => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y * SIZE + x] = t;
};
const rect = (g: Uint8Array, x: number, y: number, w: number, h: number, fill: number, edge?: number) => {
  const x0 = x - Math.floor(w / 2), y0 = y - Math.floor(h / 2);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const isEdge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
    put(g, x0 + dx, y0 + dy, edge !== undefined && isEdge ? edge : fill);
  }
};
const disc = (g: Uint8Array, x: number, y: number, r: number, t: number) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) put(g, x + dx, y + dy, t);
};
const scatter = (g: Uint8Array, x: number, y: number, r: number, n: number, t: number, rand: () => number) => {
  for (let i = 0; i < n; i++) { const a = rand() * 6.283, d = rand() * r; put(g, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), t); }
};

const D: Record<string, Dressing> = {
  woodpile: { key: "woodpile", name: "Stacked Cordwood Pile", tags: ["type:container", "material:wood", "fuel", "flammable"], description: "Split logs stacked chest-high under a bark lean-to.", w: 6, h: 3, stamp: (g, x, y) => rect(g, x, y, 6, 3, TILE.ROOF) },
  sawpit: { key: "sawpit", name: "Two-Man Saw Pit", tags: ["type:workstation", "material:wood", "hazard:fall"], description: "A timber-lined pit with a log across it, where one sawyer works below and one above.", w: 7, h: 4, stamp: (g, x, y) => rect(g, x, y, 7, 4, TILE.BARE_EARTH, TILE.ROOF) },
  stumps: { key: "stumps", name: "Fresh Stump Field", tags: ["type:terrain", "material:wood", "difficult_terrain"], description: "Rows of raw stumps still weeping sap, the ground churned by skids.", w: 12, h: 12, stamp: (g, x, y, r) => { disc(g, x, y, 6, TILE.BARE_EARTH); scatter(g, x, y, 6, 14, TILE.ROOF, r); } },
  toolshed: { key: "toolshed", name: "Lean-to Tool Shed", tags: ["type:container", "material:wood", "tools", "searchable"], description: "A plank lean-to hung with spare axe heads, wedges, rope and a grindstone.", w: 5, h: 4, stamp: (g, x, y) => rect(g, x, y, 5, 4, TILE.ROOF, TILE.ROCK) },
  spoil: { key: "spoil", name: "Spoil Heap", tags: ["type:terrain", "material:stone", "climbable", "difficult_terrain"], description: "A slumping heap of waste rock and broken shale from the workings.", w: 11, h: 11, stamp: (g, x, y) => { disc(g, x, y, 5, TILE.SCREE); disc(g, x, y, 2, TILE.ROCK); } },
  tailings: { key: "tailings", name: "Silted Tailings Pond", tags: ["type:hazard", "material:water", "toxic", "difficult_terrain"], description: "A murky settling pond grey with rock flour, its banks crusted with mineral stains.", w: 10, h: 10, stamp: (g, x, y) => { disc(g, x, y, 5, TILE.BARE_EARTH); disc(g, x, y, 3, TILE.WATER); } },
  props: { key: "pitprops", name: "Pit-Prop Timber Stack", tags: ["type:container", "material:wood", "raw_material"], description: "Peeled pine props cut to length for shoring the galleries.", w: 7, h: 3, stamp: (g, x, y) => rect(g, x, y, 7, 3, TILE.ROOF) },
  haystacks: { key: "haystacks", name: "Haystacks", tags: ["type:container", "material:straw", "flammable", "hiding"], description: "Round stacks of cured hay, thatched against the rain.", w: 12, h: 5, stamp: (g, x, y) => { disc(g, x - 4, y, 2, TILE.DRY_GRASS); disc(g, x + 1, y + 1, 2, TILE.DRY_GRASS); disc(g, x + 5, y - 1, 2, TILE.DRY_GRASS); } },
  orchard: { key: "orchard", name: "Small Orchard", tags: ["type:terrain", "material:wood", "food", "cover"], description: "A few rows of gnarled fruit trees, windfalls rotting in the grass.", w: 14, h: 10, stamp: (g, x, y) => { for (let dy = -4; dy <= 4; dy += 3) for (let dx = -6; dx <= 6; dx += 3) put(g, x + dx, y + dy, TILE.TREES); } },
  beehives: { key: "beehives", name: "Straw Beehive Skeps", tags: ["type:hazard", "material:straw", "food", "swarm"], description: "A row of woven straw skeps on a plank bench, humming loudly.", w: 7, h: 2, stamp: (g, x, y) => { for (let dx = -3; dx <= 3; dx += 2) put(g, x + dx, y, TILE.DRY_GRASS); } },
  pigpen: { key: "pigpen", name: "Wattle Pig Pen", tags: ["type:structure", "material:wood", "livestock"], description: "A muddy wattle-fenced pen with a sow and her litter rooting in the slops.", w: 8, h: 6, stamp: (g, x, y) => rect(g, x, y, 8, 6, TILE.BARE_EARTH, TILE.ROOF) },
  garden: { key: "garden", name: "Kitchen Garden Plots", tags: ["type:terrain", "food", "herbs"], description: "Raised beds of kale, onions and herbs behind a hurdle fence.", w: 9, h: 7, stamp: (g, x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) put(g, x + dx, y + dy, dy % 2 === 0 ? TILE.BARE_EARTH : TILE.TALL_GRASS); } },
  well: { key: "well", name: "Stone-Ringed Well", tags: ["type:waterway", "material:stone", "water", "drinkable"], description: "A drystone well head with a windlass, bucket and frayed rope.", w: 3, h: 3, stamp: (g, x, y) => { rect(g, x, y, 3, 3, TILE.COBBLE); put(g, x, y, TILE.WATER); } },
  coop: { key: "coop", name: "Chicken Coop", tags: ["type:structure", "material:wood", "livestock", "noisy"], description: "A raised plank coop and a scratched-bare run full of hens.", w: 6, h: 5, stamp: (g, x, y) => { rect(g, x, y, 6, 5, TILE.BARE_EARTH); rect(g, x, y - 1, 3, 2, TILE.ROOF); } },
  butts: { key: "butts", name: "Archery Butts", tags: ["type:structure", "material:straw", "training"], description: "Turf-backed straw targets at the end of a trampled shooting lane.", w: 14, h: 4, stamp: (g, x, y) => { for (let dx = -6; dx <= 6; dx++) put(g, x + dx, y + 1, TILE.BARE_EARTH); for (const dx of [-5, 0, 5]) put(g, x + dx, y - 1, TILE.DRY_GRASS); } },
  pickets: { key: "pickets", name: "Horse Picket Line", tags: ["type:structure", "material:rope", "livestock", "mounts"], description: "A rope line between two posts with a few shaggy horses hobbled along it.", w: 12, h: 4, stamp: (g, x, y) => { for (let dx = -5; dx <= 5; dx++) put(g, x + dx, y, TILE.ROOF); rect(g, x, y + 1, 12, 2, TILE.BARE_EARTH); } },
  stakes: { key: "stakes", name: "Sharpened Stake Line", tags: ["type:hazard", "material:wood", "defensive", "difficult_terrain"], description: "A row of fire-hardened stakes angled outward to break a charge.", w: 14, h: 3, stamp: (g, x, y) => { for (let dx = -6; dx <= 6; dx += 2) put(g, x + dx, y + (dx % 4 === 0 ? 0 : 1), TILE.ROOF); } },
  graves: { key: "graves", name: "Weathered Grave Markers", tags: ["type:structure", "material:stone", "sacred", "undead_lore"], description: "A handful of leaning grave stones, names worn away, wildflowers on the mounds.", w: 10, h: 6, stamp: (g, x, y) => { for (let dx = -4; dx <= 4; dx += 2) for (const dy of [-2, 1]) put(g, x + dx, y + dy, TILE.MONOLITH); } },
  offerings: { key: "offerings", name: "Offering Cairn", tags: ["type:structure", "material:stone", "sacred", "searchable"], description: "A knee-high cairn heaped with coins, ribbons and small carved figures.", w: 5, h: 5, stamp: (g, x, y) => { disc(g, x, y, 2, TILE.SCREE); put(g, x, y, TILE.MONOLITH); } },
  crates: { key: "crates", name: "Brush-Covered Crate Cache", tags: ["type:container", "material:wood", "hidden", "contraband"], description: "Unmarked crates under cut brush and a muddy tarp.", w: 6, h: 4, stamp: (g, x, y) => { rect(g, x, y, 6, 4, TILE.SHRUB); rect(g, x, y, 3, 2, TILE.ROOF); } },
  lookout: { key: "lookout", name: "Hidden Lookout Perch", tags: ["type:structure", "material:wood", "hidden", "vantage"], description: "A plank platform wedged high in brush with a clear view of the trail.", w: 4, h: 4, stamp: (g, x, y) => { disc(g, x, y, 2, TILE.SHRUB); put(g, x, y, TILE.ROOF); } },
};

// Town-only details
Object.assign(D, {
  washlines: { key: "washlines", name: "Washing Lines Across the Yard", tags: ["type:structure", "material:cloth", "cover", "flammable"], description: "Sheets and shirts flapping on lines strung between two houses.", w: 8, h: 3, stamp: (g: Uint8Array, x: number, y: number) => { for (let dx = -3; dx <= 3; dx++) put(g, x + dx, y, TILE.FROST); } },
  rainbarrels: { key: "rainbarrels", name: "Rain Barrels & Water Butts", tags: ["type:container", "material:wood", "water"], description: "A cluster of rain barrels under a downpipe, one cracked and leaking.", w: 4, h: 3, stamp: (g: Uint8Array, x: number, y: number) => { put(g, x - 1, y, TILE.WATER); put(g, x + 1, y, TILE.WATER); } },
  carts: { key: "carts", name: "Parked Handcarts", tags: ["type:structure", "material:wood", "cover", "movable"], description: "Two handcarts with their shafts propped on blocks, one loaded with sacks.", w: 6, h: 3, stamp: (g: Uint8Array, x: number, y: number) => rect(g, x, y, 5, 2, TILE.ROOF) },
  trough: { key: "trough", name: "Horse Trough & Hitching Rail", tags: ["type:structure", "material:stone", "water", "mounts"], description: "A long stone trough with a hitching rail, two mules dozing at it.", w: 7, h: 3, stamp: (g: Uint8Array, x: number, y: number) => { rect(g, x, y, 6, 1, TILE.WATER); rect(g, x, y + 1, 6, 1, TILE.ROOF); } },
  crier: { key: "crier", name: "Town Crier's Post", tags: ["type:structure", "material:wood", "notices", "meeting_point"], description: "A post pasted with notices, bounties and a fresh proclamation in red ink.", w: 3, h: 3, stamp: (g: Uint8Array, x: number, y: number) => put(g, x, y, TILE.ROOF) },
  stocks: { key: "stocks", name: "Pillory & Stocks", tags: ["type:structure", "material:wood", "law", "humiliation"], description: "Weathered stocks on a low platform, rotten vegetables trodden into the boards.", w: 4, h: 3, stamp: (g: Uint8Array, x: number, y: number) => rect(g, x, y, 4, 2, TILE.ROOF) },
  slagheap: { key: "slagheap", name: "Slag & Clinker Heap", tags: ["type:terrain", "material:stone", "difficult_terrain"], description: "A glassy heap of furnace slag and broken crucibles behind the workshops.", w: 7, h: 7, stamp: (g: Uint8Array, x: number, y: number) => { disc(g, x, y, 3, TILE.SCREE); disc(g, x, y, 1, TILE.BASALT); } },
  drillyard: { key: "drillyard", name: "Drill Yard", tags: ["type:terrain", "military", "open_ground"], description: "A beaten-earth yard where the garrison drills with pikes at dawn.", w: 16, h: 10, stamp: (g: Uint8Array, x: number, y: number) => rect(g, x, y, 16, 10, TILE.BARE_EARTH) },
} satisfies Record<string, Dressing>);

const DRESSING: Partial<Record<SiteKind | TownKind, Dressing[]>> = {
  TOWN_RESIDENTIAL: [D.washlines!, D.rainbarrels!, D.coop!, D.garden!, D.crier!, D.carts!, D.well!],
  TOWN_MARKET: [D.carts!, D.trough!, D.crier!, D.stocks!, D.rainbarrels!, D.well!],
  TOWN_ARTISAN: [D.woodpile!, D.slagheap!, D.carts!, D.rainbarrels!, D.toolshed!, D.trough!],
  TOWN_CITADEL: [D.drillyard!, D.butts!, D.pickets!, D.stocks!, D.woodpile!],
  LOGGING: [D.woodpile!, D.sawpit!, D.stumps!, D.toolshed!, D.pickets!],
  MINE: [D.spoil!, D.tailings!, D.props!, D.toolshed!, D.woodpile!],
  FARMLAND: [D.haystacks!, D.orchard!, D.beehives!, D.pigpen!, D.garden!, D.well!],
  WATCHTOWER: [D.butts!, D.pickets!, D.stakes!, D.woodpile!, D.graves!],
  HAMLET: [D.garden!, D.well!, D.coop!, D.pigpen!, D.beehives!, D.haystacks!, D.orchard!],
  SHRINE: [D.graves!, D.offerings!, D.garden!],
  SMUGGLER_DEN: [D.crates!, D.lookout!, D.woodpile!],
};
