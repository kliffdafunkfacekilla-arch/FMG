/**
 * One town tile as its own district map.
 *
 * A town covers many regional cells (code 4), each tagged with a ward (RESIDENTIAL, MARKET, ARTISAN,
 * CITADEL). The whole-town generator drew the entire town on every one of them, so all ~180 tiles of a
 * town were the same picture with a different title. This draws just the district on that tile:
 *  - streets head to every neighbouring town tile or road, meeting the neighbour's streets at a crossing
 *    point both tiles derive from the same edge seed, so districts join up;
 *  - the town wall runs along any side whose neighbour is outside town, with towers, and a gate where a
 *    street leaves; outside the wall the natural terrain stays;
 *  - lots are filled to the ward's character: packed cottages with gardens, a plaza ringed by shops and
 *    stalls, workshops with yards and forges, or the keep with towers and barracks;
 *  - water, groves and ground come from the regional neighbourhood (TacticalTerrain.ts).
 * Every choice is seeded by the tile, so a tile always rebuilds the same district.
 */
import zlib from "zlib";
import { paintTacticalTerrain, RegionalNeighborhood, TERRAIN_VERSION, TILE } from "./TacticalTerrain.js";
import type { SectorMapResult } from "./SectorMapGenerator";
import { dressSite, TownKind } from "./SiteVariation.js";

const SIZE = 256;
type Ward = "RESIDENTIAL" | "MARKET" | "ARTISAN" | "CITADEL";

function seeded(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface WardDistrictInput {
  burg: any;
  factionName: string;
  cellId: number;
  rx: number;
  ry: number;
  ward: string;
  biomeId: number;
  hood?: RegionalNeighborhood | undefined;
  citizens?: any[];
  paragons?: any[];
}

export function generateWardDistrictMap(input: WardDistrictInput): SectorMapResult {
  const { burg, factionName, cellId, rx, ry, biomeId, hood } = input;
  const ward: Ward = (["RESIDENTIAL", "MARKET", "ARTISAN", "CITADEL"].includes(input.ward) ? input.ward : "RESIDENTIAL") as Ward;
  const rand = seeded(`ward_${cellId}_${rx}_${ry}`);
  const burgName = burg?.name || `Burg #${burg?.burg_id}`;
  const tier = Number(burg?.urban_tier) || 1;
  const streetTile = tier >= 2 ? TILE.COBBLE : TILE.DIRT;
  const grid = new Uint8Array(SIZE * SIZE);

  // Ground, water and groves from the region
  paintTacticalTerrain({ grid, cellId, rx, ry, biomeId, hood, terrainType: 4, infraMask: 1 });
  const isWater = (t: number) => t === TILE.WATER || t === TILE.DEEP_WATER;

  // Which sides open onto more town (or a road) and which face the countryside
  const nb = (dx: number, dy: number) => hood ? hood.terrain[dy + 1]![dx + 1]! : 4;
  const isTown = (t: number) => t === 4;
  const isRoadT = (t: number) => t === 5 || t === 6;
  const sides = [
    { key: "N", dx: 0, dy: -1 }, { key: "S", dx: 0, dy: 1 }, { key: "W", dx: -1, dy: 0 }, { key: "E", dx: 1, dy: 0 },
  ].map(s => ({ ...s, t: nb(s.dx, s.dy) }));

  // Inside the town everything that isn't water becomes yard ground; groves thin out to garden trees
  const yard = biomeId === 1 || biomeId === 2 ? TILE.SAND : biomeId === 10 || biomeId === 11 ? TILE.SNOW : TILE.BARE_EARTH;
  const WALL_IN = 12; // wall line distance from a countryside edge
  const insideTown = (x: number, y: number) =>
    !sides.some(s => !isTown(s.t) && (
      (s.key === "N" && y < WALL_IN) || (s.key === "S" && y > SIZE - 1 - WALL_IN) ||
      (s.key === "W" && x < WALL_IN) || (s.key === "E" && x > SIZE - 1 - WALL_IN)));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const k = y * SIZE + x;
    if (!insideTown(x, y) || isWater(grid[k]!)) continue;
    const t = grid[k]!;
    grid[k] = (t === TILE.TREES || t === TILE.CONIFER || t === TILE.JUNGLE) && rand() < 0.15 ? t : yard;
  }

  // Edge crossing points shared with the neighbouring tile (same seed from both sides)
  const crossing = (side: string): [number, number] => {
    const key = side === "E" ? `E_${cellId}_${rx}_${ry}` : side === "W" ? `E_${cellId}_${rx - 1}_${ry}`
      : side === "S" ? `S_${cellId}_${rx}_${ry}` : `S_${cellId}_${rx}_${ry - 1}`;
    const p = 48 + Math.floor(seeded(key)() * 160);
    return side === "N" ? [p, 0] : side === "S" ? [p, SIZE - 1] : side === "W" ? [0, p] : [SIZE - 1, p];
  };

  const hub: [number, number] = [96 + Math.floor(rand() * 64), 96 + Math.floor(rand() * 64)];
  const street = new Uint8Array(SIZE * SIZE); // 1 where a street runs
  const lay = (from: [number, number], to: [number, number], width: number, wobble: number) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    const nx = -(to[1] - from[1]) / len, ny = (to[0] - from[0]) / len;
    const phase = rand() * 10;
    const steps = Math.ceil(len * 1.5);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const bend = Math.sin(t * Math.PI) * Math.sin(phase + t * 5) * wobble;
      const cx = Math.round(from[0] + (to[0] - from[0]) * t + nx * bend);
      const cy = Math.round(from[1] + (to[1] - from[1]) * t + ny * bend);
      const r = Math.floor(width / 2);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
        const k = py * SIZE + px;
        grid[k] = isWater(grid[k]!) ? TILE.BRIDGE : streetTile;
        street[k] = 1;
      }
    }
  };

  // Main streets to neighbouring town tiles and roads
  for (const s of sides) if (isTown(s.t) || isRoadT(s.t)) lay(hub, crossing(s.key), ward === "CITADEL" ? 8 : 6, 10);
  // Side lanes and alleys: more in packed wards
  const lanes = ward === "RESIDENTIAL" ? 4 + Math.floor(rand() * 3) : ward === "ARTISAN" ? 3 + Math.floor(rand() * 2) : 2;
  for (let i = 0; i < lanes; i++) {
    const a = rand() * Math.PI * 2, d = 50 + rand() * 80;
    const from: [number, number] = i % 2 === 0 ? hub : [Math.round(hub[0] + Math.cos(a + 1) * 40), Math.round(hub[1] + Math.sin(a + 1) * 40)];
    lay(from, [Math.max(14, Math.min(SIZE - 15, Math.round(hub[0] + Math.cos(a) * d))), Math.max(14, Math.min(SIZE - 15, Math.round(hub[1] + Math.sin(a) * d)))], 3, 6);
  }

  // Town wall along countryside sides, towers every ~48px, a gate where a street crosses it
  for (const s of sides) {
    if (isTown(s.t)) continue;
    for (let i = 0; i < SIZE; i++) for (let w = 0; w < 4; w++) {
      const along = i, depth = WALL_IN - 2 + w;
      const [x, y] = s.key === "N" ? [along, depth] : s.key === "S" ? [along, SIZE - 1 - depth] : s.key === "W" ? [depth, along] : [SIZE - 1 - depth, along];
      const k = y * SIZE + x;
      if (street[k]) continue; // gate gap
      if (!isWater(grid[k]!)) grid[k] = TILE.ROCK;
    }
    for (let i = 24; i < SIZE - 10; i += 48) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const along = i + dx, depth = WALL_IN + dy;
        const [x, y] = s.key === "N" ? [along, depth] : s.key === "S" ? [along, SIZE - 1 - depth] : s.key === "W" ? [depth, along] : [SIZE - 1 - depth, along];
        if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && !street[y * SIZE + x]) grid[y * SIZE + x] = TILE.ROCK;
      }
    }
  }

  // Distance from the nearest street (BFS), so buildings front onto streets
  const dist = new Int16Array(SIZE * SIZE).fill(-1);
  const queue: number[] = [];
  for (let k = 0; k < street.length; k++) if (street[k]) { dist[k] = 0; queue.push(k); }
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi]!, x = k % SIZE, y = (k / SIZE) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const n = ny * SIZE + nx;
      if (dist[n] === -1 && dist[k]! < 60) { dist[n] = dist[k]! + 1; queue.push(n); }
    }
  }

  const free = (x0: number, y0: number, w: number, h: number, margin = 1) => {
    if (x0 < 2 || y0 < 2 || x0 + w > SIZE - 2 || y0 + h > SIZE - 2) return false;
    for (let y = y0 - margin; y < y0 + h + margin; y++) for (let x = x0 - margin; x < x0 + w + margin; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
      const k = y * SIZE + x, t = grid[k]!;
      if (street[k] || isWater(t) || t === TILE.ROCK || t === TILE.ROOF || t === TILE.FIRE || t === TILE.MONOLITH || t === TILE.BRIDGE) return false;
      if (!insideTown(x, y)) return false;
    }
    return true;
  };
  const near = (x0: number, y0: number, w: number, h: number, maxSetback: number) => {
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const d = dist[y * SIZE + x]!;
      if (d >= 0 && d <= maxSetback) return true;
    }
    return false;
  };
  const building = (x0: number, y0: number, w: number, h: number, inner: number = TILE.ROOF) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      grid[y * SIZE + x] = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1 ? TILE.ROCK : inner;
    }
  };
  const lots: Array<{ x: number; y: number; w: number; h: number; kind: string }> = [];
  const fill = (attempts: number, wMin: number, wMax: number, hMin: number, hMax: number, setback: number, kind: string, after?: (b: { x: number; y: number; w: number; h: number }) => void) => {
    for (let i = 0; i < attempts; i++) {
      const w = wMin + Math.floor(rand() * (wMax - wMin + 1)), h = hMin + Math.floor(rand() * (hMax - hMin + 1));
      const x = 4 + Math.floor(rand() * (SIZE - w - 8)), y = 4 + Math.floor(rand() * (SIZE - h - 8));
      if (!free(x, y, w, h) || !near(x, y, w, h, setback)) continue;
      building(x, y, w, h);
      const b = { x, y, w, h, kind };
      lots.push(b);
      after?.(b);
    }
  };

  const props: SectorMapResult["props"] = [];
  const addProp = (key: string, name: string, pos: [number, number], tags: string[], description: string, hp = 120) =>
    props.push({ id: `prop_${key}_${cellId}_${rx}_${ry}`, name, pos, tags, hp, maxHp: hp, description });

  let title = "";
  if (ward === "MARKET") {
    // Plaza at the hub, stalls in rows, shops ringing it
    const pr = 18 + Math.floor(rand() * 10);
    for (let dy = -pr; dy <= pr; dy++) for (let dx = -pr; dx <= pr; dx++) {
      const x = hub[0] + dx, y = hub[1] + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || Math.hypot(dx, dy) > pr) continue;
      const k = y * SIZE + x;
      if (!isWater(grid[k]!)) { grid[k] = TILE.COBBLE; street[k] = 1; }
    }
    for (let dy = -pr + 6; dy <= pr - 6; dy += 7) for (let dx = -pr + 6; dx <= pr - 6; dx += 6) {
      if (Math.hypot(dx, dy) > pr - 5 || rand() < 0.25) continue;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 3; sx++) grid[(hub[1] + dy + sy) * SIZE + hub[0] + dx + sx] = TILE.ROOF;
    }
    fill(700, 8, 13, 6, 9, 5, "shop");
    fill(300, 6, 9, 5, 7, 8, "house");
    addProp("market_cross", `${burgName} Market Cross`, hub, ["type:structure", "material:stone", "landmark", "meeting_point"], "A weathered stone cross where proclamations are read and debts are settled.");
    addProp("stalls", "Canopied Trade Stalls", [hub[0] + 6, hub[1] + 6], ["type:container", "material:wood", "material:cloth", "market", "commerce"], "Rows of canvas-roofed stalls heaped with produce, cloth, tools and gossip.");
    addProp("weighhouse", "Town Weigh-House & Scales", [hub[0] - pr + 4, hub[1]], ["type:structure", "material:iron", "commerce", "law"], "Iron beam scales under a tiled roof where the reeve's clerk checks every measure.");
    title = "Market Ward";
  } else if (ward === "ARTISAN") {
    fill(650, 9, 14, 7, 10, 7, "workshop", b => {
      if (rand() < 0.35) grid[(b.y + 2) * SIZE + b.x + 2] = TILE.FIRE; // forge or kiln glow
      const yx = b.x + b.w + 1, yw = 4 + Math.floor(rand() * 5);
      if (free(yx, b.y, yw, b.h, 0)) for (let y = b.y; y < b.y + b.h; y++) for (let x = yx; x < yx + yw; x++) grid[y * SIZE + x] = TILE.BARE_EARTH; // work yard
    });
    fill(250, 6, 8, 5, 7, 9, "house");
    const smithy = lots.find(l => l.kind === "workshop");
    addProp("anvil", "Smithy Anvil & Quench Trough", smithy ? [smithy.x + 3, smithy.y + 3] : hub, ["type:workstation", "material:iron", "fire", "crafting"], "A scarred anvil beside a sooty forge and a hissing quench trough.");
    addProp("vats", "Tanner's Soaking Vats", [hub[0] + 20, hub[1] - 14], ["type:hazard", "material:wood", "toxic", "smelly"], "Lime and bark vats stinking in the sun, hides draped over frames beside them.");
    addProp("kiln", "Potter's Kiln", [hub[0] - 18, hub[1] + 16], ["type:workstation", "material:clay", "fire", "crafting"], "A beehive brick kiln, still warm, stacked pots cooling beside it.");
    title = "Artisan Ward";
  } else if (ward === "CITADEL") {
    // Keep compound at the hub
    const ks = 30 + Math.floor(rand() * 12);
    const kx = Math.max(16, Math.min(SIZE - ks - 16, hub[0] - Math.floor(ks / 2))), ky = Math.max(16, Math.min(SIZE - ks - 16, hub[1] - Math.floor(ks / 2)));
    for (let y = ky - 8; y < ky + ks + 8; y++) for (let x = kx - 8; x < kx + ks + 8; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const k = y * SIZE + x;
      if (!isWater(grid[k]!)) { grid[k] = TILE.COBBLE; street[k] = 1; } // bailey
    }
    for (let y = ky; y < ky + ks; y++) for (let x = kx; x < kx + ks; x++) {
      const edge = x - kx < 3 || y - ky < 3 || kx + ks - 1 - x < 3 || ky + ks - 1 - y < 3;
      grid[y * SIZE + x] = edge ? TILE.ROCK : TILE.ROOF;
    }
    for (const [cx, cy] of [[kx, ky], [kx + ks - 1, ky], [kx, ky + ks - 1], [kx + ks - 1, ky + ks - 1]] as const) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) grid[(cy + dy) * SIZE + cx + dx] = TILE.ROCK;
    }
    grid[(ky + ks - 1) * SIZE + kx + Math.floor(ks / 2)] = TILE.COBBLE; // keep gate
    fill(300, 16, 22, 6, 8, 10, "barracks");
    fill(250, 7, 10, 6, 8, 8, "house");
    addProp("keep_gate", `${burgName} Keep Gate & Portcullis`, [kx + Math.floor(ks / 2), ky + ks], ["type:portal", "material:iron", "material:stone", "defensive", "openable"], "An iron-shod portcullis under a murder-hole arch, guards lounging in its shade.");
    addProp("armory", "Garrison Armory", [kx + 6, ky + 6], ["type:container", "material:iron", "weapons", "locked"], "Racks of spears, crossbows and dented helms behind a barred door.");
    const barracks = lots.find(l => l.kind === "barracks");
    if (barracks) addProp("barracks", "Garrison Barracks", [barracks.x + Math.floor(barracks.w / 2), barracks.y + barracks.h], ["type:structure", "material:wood", "military", "enterable"], "A long timber barracks smelling of boot grease and stew.");
    title = "Citadel Ward";
  } else {
    fill(1100, 6, 10, 5, 8, 9, "house", b => {
      if (rand() < 0.45) { // back garden
        const gy = b.y + b.h + 1, gh = 3 + Math.floor(rand() * 4);
        if (free(b.x, gy, b.w, gh, 0)) for (let y = gy; y < gy + gh; y++) for (let x = b.x; x < b.x + b.w; x++) grid[y * SIZE + x] = (y - gy) % 2 === 0 ? TILE.TALL_GRASS : TILE.BARE_EARTH;
      }
    });
    addProp("well", "Neighbourhood Well", [hub[0] + 3, hub[1] + 3], ["type:waterway", "material:stone", "water", "drinkable", "meeting_point"], "A shared well with a worn stone lip, where the street's news is traded.");
    addProp("shrine_niche", "Street-Corner Shrine Niche", [hub[0] - 10, hub[1] + 8], ["type:structure", "material:stone", "sacred"], "A candle-blackened niche with a small carved figure and fresh flowers.");
    title = "Residential Ward";
  }

  // Seeded street-life details, so two districts of the same ward don't carry the same props
  dressSite(grid, props, hub[0], hub[1], `TOWN_${ward}` as TownKind, rand, `${cellId}_${rx}_${ry}`);

  // A drain or cellar way down to the under-level
  addProp("drain", "Iron Drain Grate (Subterranean Entry)", [hub[0] - 4, hub[1] - 4], ["type:portal", "material:iron", "openable", "stairs_down"], "A rusted grate over a dripping culvert that leads under the streets.", 200);
  // A gate on the town wall, if this tile has one
  for (const s of sides) if (!isTown(s.t) && (isRoadT(s.t))) {
    const [ex, ey] = crossing(s.key);
    const gx = s.key === "W" ? WALL_IN : s.key === "E" ? SIZE - 1 - WALL_IN : ex, gy = s.key === "N" ? WALL_IN : s.key === "S" ? SIZE - 1 - WALL_IN : ey;
    addProp(`gate_${s.key}`, `${burgName} ${({ N: "North", S: "South", W: "West", E: "East" } as Record<string, string>)[s.key]} Gate`, [gx, gy], ["type:portal", "material:stone", "material:wood", "defensive", "openable"], "A gatehouse in the town wall, its doors open by day under the watch's eye.", 400);
  }

  // People: residents of this town, rotated through by tile so neighbouring districts show different faces
  const npcs: SectorMapResult["npcs"] = [];
  const citizens = input.citizens || [];
  const want = ward === "MARKET" ? 8 : ward === "CITADEL" ? 6 : 5;
  const offset = citizens.length ? (rx * 31 + ry * 17) % citizens.length : 0;
  const doors = lots.map(l => [l.x + Math.floor(l.w / 2), Math.min(SIZE - 3, l.y + l.h)] as [number, number]);
  for (let i = 0; i < Math.min(want, citizens.length); i++) {
    const c = citizens[(offset + i) % citizens.length];
    const pos = doors.length ? doors[Math.floor(rand() * doors.length)]! : [hub[0] + i * 3, hub[1]] as [number, number];
    const guard = ward === "CITADEL" && i < 3;
    npcs.push({
      id: `npc_ward_${c.citizen_id ?? `${cellId}_${rx}_${ry}_${i}`}`,
      name: c.name || `${burgName} resident`,
      role: guard ? "Citadel Guard" : c.profession || "Townsfolk",
      pos,
      tags: [
        `species:${String(c.species || "human").toLowerCase()}`, `temper:${String(c.temper || "steady").toLowerCase()}`,
        `spark:${String(c.spark_tier || "null").toLowerCase()}`, `profession:${String(c.profession || "townsfolk").toLowerCase().replace(/[\s-]+/g, "_")}`,
        `ward:${ward.toLowerCase()}`
      ],
      faction: factionName,
      hp: guard ? 30 : 22,
      maxHp: guard ? 30 : 22,
      disposition: 0,
      alive: true,
      equippedWeapon: guard ? "Spear & Shield" : "Belt Knife",
      memoryNotes: [`Lives and works in the ${title.toLowerCase()} of ${burgName}.`],
    });
  }

  // The burg's paragons keep office in their wards: the civic head in the market, the security head in
  // the citadel (titles tell them apart). Real records, so the narrative seeds can tag them.
  const isSecurity = (p: any) => /commander|marshal|warden|captain|sheriff|constable|watch/i.test(String(p.title || ""));
  const office = ward === "CITADEL" ? (input.paragons || []).find(isSecurity)
    : ward === "MARKET" ? (input.paragons || []).find(p => !isSecurity(p) && !p.outlaw_id) : undefined;
  if (office) {
    const seat = lots.find(l => l.kind === (ward === "CITADEL" ? "barracks" : "shop")) || lots[0];
    npcs.push({
      id: `npc_paragon_${office.id}`,
      name: office.name,
      role: office.title || "Paragon",
      pos: seat ? [seat.x + Math.floor(seat.w / 2), Math.min(SIZE - 3, seat.y + seat.h)] : hub,
      tags: ["paragon", "leader", `ward:${ward.toLowerCase()}`],
      faction: factionName,
      hp: 40,
      maxHp: 40,
      disposition: 0,
      alive: true,
      equippedWeapon: isSecurity(office) ? "Longsword" : "Signet Ring & Ledger",
      memoryNotes: [`${office.title || "Paragon"} of ${burgName}.`],
    });
  }

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: `WARD_${ward}`,
    name: `${burgName} - ${title} (Surface r[${rx}, ${ry}])`,
    features: {
      cellId, rx, ry, z: 0, ward, burgId: burg?.burg_id, urbanTier: tier, factionName,
      buildings: lots.length, terrainType: 4, terrainVersion: TERRAIN_VERSION,
    },
  };
}
