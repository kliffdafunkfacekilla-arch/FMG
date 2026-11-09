/**
 * FacilitySectorGenerators.ts
 * 
 * Procedural Tactical Map Generators for Outlying Regional Facilities:
 * - Logging Camps (4 Typologies: River Flume Sawmill, Felling Station, Charcoal Burner, Canopy Shingle Mill)
 * - Mines & Quarries (4 Typologies: Granite Quarry, Drift Adit Mine, Foundry Smelter, Alluvial Stream Panning)
 * - Watchtowers (4 Typologies: Curtain Gate Bastion, Hilltop Signal Spire, Palisade Redoubt, Moated Blockhouse)
 * 
 * Eliminates all duplicate, hardcoded identical layouts. Every facility is uniquely
 * tailored to its seed, terrain, and assigned demographic citizen master.
 */

import { SimplexNoise } from "../../regional/SimplexNoise";
import type { SectorMapResult } from "./SectorMapGenerator";

const SIZE = 256;

export interface FacilityGeneratorConfig {
  grid: Uint8Array;
  poiCX: number;
  poiCY: number;
  cellId: number;
  rx: number;
  ry: number;
  rand: () => number;
  biomeId?: number;
  biomeName?: string;
  parentName: string;
  facility: any;
  facilityMasterCitizen: any;
  props: SectorMapResult["props"];
  npcs: SectorMapResult["npcs"];
  pickCitizen: (prefProfessions?: string[]) => any;
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PROCEDURAL LOGGING CAMP GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export type LoggingTypology = "RIVER_FLUME_SAWMILL" | "FELLING_STATION" | "CHARCOAL_BURNER" | "CANOPY_SHINGLE_MILL";

export function getLoggingTypology(cellId: number, rx: number, ry: number, facility?: any): LoggingTypology {
  if (facility?.typology) return facility.typology;
  const name = String(facility?.name || "").toLowerCase();
  if (name.includes("flume") || name.includes("sawmill") || name.includes("river")) return "RIVER_FLUME_SAWMILL";
  if (name.includes("charcoal") || name.includes("kiln") || name.includes("burner")) return "CHARCOAL_BURNER";
  if (name.includes("shingle") || name.includes("shake") || name.includes("roof")) return "CANOPY_SHINGLE_MILL";
  const roll = Math.abs(cellId * 23 + rx * 41 + ry * 17) % 4;
  return roll === 0 ? "RIVER_FLUME_SAWMILL" : roll === 1 ? "FELLING_STATION" : roll === 2 ? "CHARCOAL_BURNER" : "CANOPY_SHINGLE_MILL";
}

export function generateProceduralLoggingSurface(cfg: FacilityGeneratorConfig): string {
  const { grid, poiCX, poiCY, cellId, rx, ry, rand, parentName, facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc } = cfg;
  const typology = getLoggingTypology(cellId, rx, ry, facility);
  const logNoise = new SimplexNoise(cellId * 2000 + rx * 71 + ry * 37);

  // Clear trees in organic felling clearcut
  const clearR = 24 + Math.floor(rand() * 10);
  for (let dy = -clearR - 4; dy <= clearR + 4; dy++) {
    for (let dx = -clearR - 4; dx <= clearR + 4; dx++) {
      const px = poiCX + dx, py = poiCY + dy;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        const d = Math.hypot(dx, dy);
        const noiseOffset = logNoise.noise2D(dx * 0.08, dy * 0.08) * 8;
        if (d <= clearR + noiseOffset) {
          const idx = py * SIZE + px;
          if (grid[idx] === 1) grid[idx] = 3; // Clear trees and turn to dirt / sawdust
        }
      }
    }
  }

  let sectorTitle = "";

  if (typology === "RIVER_FLUME_SAWMILL") {
    // Water flume cutting across the glade
    for (let y = poiCY - 30; y <= poiCY + 30; y++) {
      const flumeX = poiCX + Math.floor(Math.sin(y * 0.08) * 5);
      for (let w = -1; w <= 1; w++) {
        const px = flumeX + w;
        if (px >= 0 && px < SIZE && y >= 0 && y < SIZE) grid[y * SIZE + px] = 2; // Water flume
      }
    }
    // Timber sawmill shelter on west bank
    const bW = 10, bH = 7;
    const bX = poiCX - 16, bY = poiCY - 4;
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        grid[(bY + dy) * SIZE + (bX + dx)] = (dx === 0 || dx === bW - 1 || dy === 0 || dy === bH - 1) ? 7 : 8;
      }
    }
    grid[(bY + Math.floor(bH / 2)) * SIZE + (bX + bW - 1)] = 8; // East door facing flume

    props.push({
      id: `prop_water_sawframe_${cellId}_${rx}_${ry}`,
      name: "Water-Powered Gang Saw & Vertical Waterwheel",
      pos: [poiCX - 3, poiCY],
      tags: ["type:mechanism", "material:wood", "material:iron", "industrial", "waterwheel"],
      hp: 300,
      maxHp: 300,
      description: "A churning timber undershot waterwheel driving vertical iron saw blades through giant logs."
    });
    props.push({
      id: `prop_log_boom_${cellId}_${rx}_${ry}`,
      name: "Timber Raft Staging Pond & Booms",
      pos: [poiCX + 8, poiCY + 12],
      tags: ["type:structure", "material:wood", "water", "floating"],
      hp: 150,
      maxHp: 150,
      description: "Floating pine booms penning freshly felled timber rafts in the river pool ready for drifting."
    });
    props.push({
      id: `prop_flume_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Sawmill Axle Pit & Sluice Gate Hatch (Subterranean Entry)",
      pos: [bX + 4, bY + 2],
      tags: ["type:portal", "material:wood", "openable", "stairs_down"],
      hp: 180,
      maxHp: 180,
      description: "Heavy oak trapdoor descending into the damp machinery pit beneath the waterwheel axle."
    });

    sectorTitle = "River Flume Sawmill & Raft Basin";

  } else if (typology === "CHARCOAL_BURNER") {
    // 3 Domed Earthen Charcoal Clamps
    const clampOffsets: Array<[number, number]> = [[-12, -8], [12, -6], [0, 14]];
    for (const [ox, oy] of clampOffsets) {
      const ccx = poiCX + ox, ccy = poiCY + oy;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if (dx * dx + dy * dy <= 16) {
            grid[(ccy + dy) * SIZE + (ccx + dx)] = 3; // Compacted dark earth / ash
          }
        }
      }
      grid[ccy * SIZE + ccx] = 8; // Glowing center vent
    }

    // Charcoal burner's turf shelter
    const bW = 8, bH = 6;
    const bX = poiCX - 22, bY = poiCY - 16;
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        grid[(bY + dy) * SIZE + (bX + dx)] = (dx === 0 || dx === bW - 1 || dy === 0 || dy === bH - 1) ? 5 : 3;
      }
    }
    grid[(bY + bH - 1) * SIZE + (bX + Math.floor(bW / 2))] = 3;

    props.push({
      id: `prop_charcoal_clamps_${cellId}_${rx}_${ry}`,
      name: "Smoking Earthen Charcoal Clamps",
      pos: [poiCX, poiCY - 7],
      tags: ["type:hazard", "material:clay", "fire", "smoke"],
      hp: 200,
      maxHp: 200,
      description: "Turf-capped earthen mounds smoldering with starved oxygen, charring hardwood logs into lump charcoal."
    });
    props.push({
      id: `prop_charcoal_baskets_${cellId}_${rx}_${ry}`,
      name: "Willow Charcoal Hampers & Bagging Trestles",
      pos: [poiCX + 14, poiCY + 4],
      tags: ["type:container", "material:wood", "fuel"],
      hp: 80,
      maxHp: 80,
      description: "Woven willow baskets and burlap sacks filled with lightweight lump charcoal for blacksmith forges."
    });
    props.push({
      id: `prop_charcoal_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Charcoal Curing Vault Dugout (Subterranean Entry)",
      pos: [bX + 3, bY + 2],
      tags: ["type:portal", "material:wood", "openable", "stairs_down"],
      hp: 150,
      maxHp: 150,
      description: "Timber hatch opening down into the soot-stained dry charcoal bunker."
    });

    sectorTitle = "Hardwood Charcoal Burners' Hearth";

  } else if (typology === "CANOPY_SHINGLE_MILL") {
    // Shingle chopping blocks and cedar drying ricks
    const bW = 12, bH = 7;
    const bX = poiCX - 6, bY = poiCY - 14;
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        grid[(bY + dy) * SIZE + (bX + dx)] = (dx === 0 || dx === bW - 1 || dy === 0 || dy === bH - 1) ? 7 : 8;
      }
    }
    grid[(bY + bH - 1) * SIZE + (bX + 6)] = 8; // Door

    // Ricks of drying cedar shingles
    for (let x = poiCX - 18; x <= poiCX + 18; x += 8) {
      grid[(poiCY + 10) * SIZE + x] = 7;
      grid[(poiCY + 11) * SIZE + x] = 7;
    }

    props.push({
      id: `prop_shingle_froes_${cellId}_${rx}_${ry}`,
      name: "Cedar Shake Splitting Froes & Chopping Blocks",
      pos: [poiCX - 8, poiCY + 2],
      tags: ["type:workstation", "material:iron", "material:wood", "tool"],
      hp: 120,
      maxHp: 120,
      description: "Heavy steel froes and wooden mauls used to cleave straight-grained cedar bolts into roofing shakes."
    });
    props.push({
      id: `prop_shingle_ricks_${cellId}_${rx}_${ry}`,
      name: "Ventilated Shingle Drying Ricks",
      pos: [poiCX + 10, poiCY + 10],
      tags: ["type:structure", "material:wood", "flammable"],
      hp: 100,
      maxHp: 100,
      description: "Airy slatted timber ricks stacking thousands of tapering hand-split roofing shingles."
    });
    props.push({
      id: `prop_shingle_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Shingle Dugout Tool Cellar (Subterranean Entry)",
      pos: [bX + 2, bY + 2],
      tags: ["type:portal", "material:wood", "openable", "stairs_down"],
      hp: 140,
      maxHp: 140,
      description: "Log trapdoor descending into the equipment and gum storage cellar."
    });

    sectorTitle = "Cedar Shingle & Shake Mill";

  } else {
    // FELLING_STATION: Clearcut woodland skidway with draft ox paddock
    const bW = 11, bH = 8;
    const bX = poiCX - 18, bY = poiCY - 12;
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        grid[(bY + dy) * SIZE + (bX + dx)] = (dx === 0 || dx === bW - 1 || dy === 0 || dy === bH - 1) ? 7 : 8;
      }
    }
    grid[(bY + bH - 1) * SIZE + (bX + 5)] = 8;

    // Log skidway dirt trench
    for (let x = poiCX - 10; x <= poiCX + 35; x++) {
      for (let w = -2; w <= 2; w++) {
        grid[(poiCY + 12 + w) * SIZE + x] = 3;
      }
    }

    props.push({
      id: `prop_felling_pyramid_${cellId}_${rx}_${ry}`,
      name: "Branded Hardwood Log Pyramid Stack",
      pos: [poiCX + 12, poiCY + 2],
      tags: ["type:structure", "material:wood", "heavy", "raw_material"],
      hp: 300,
      maxHp: 300,
      description: "Massive felled oak and pine trunks stacked in chocked pyramid ricks bearing sovereign forestry stamps."
    });
    props.push({
      id: `prop_ox_skids_${cellId}_${rx}_${ry}`,
      name: "Draft Ox Hitching Paddock & Skid Harnesses",
      pos: [poiCX + 20, poiCY - 10],
      tags: ["type:structure", "material:wood", "material:leather"],
      hp: 160,
      maxHp: 160,
      description: "Heavy timber ox hitching rails with yoke collars and iron dragging chains used for hauling felling timbers."
    });
    props.push({
      id: `prop_bunkhouse_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Timber Dugout Tool Vault (Subterranean Entry)",
      pos: [bX + 3, bY + 3],
      tags: ["type:portal", "material:wood", "openable", "stairs_down"],
      hp: 150,
      maxHp: 150,
      description: "Heavy oak trapdoor descending into the root cellar and pitch storage trench."
    });

    sectorTitle = "Clearcut Timber Felling Station";
  }

  // Station primary demographic citizen
  const leadCitizen = facilityMasterCitizen || pickCitizen(["Lumberjack", "Woodcutter", "Sawyer", "Carpenter", "Forester"]);
  if (leadCitizen) {
    npcs.push(makeDemographicNpc(
      leadCitizen,
      [poiCX - 2, poiCY - 2],
      facilityMasterCitizen ? (facility?.citizenProfession || "Timber Foreman") : "Logging Camp Overseer",
      "Two-Handed Felling Axe"
    ));
  }

  const cit2 = pickCitizen(["Laborer", "Woodcutter", "Sawyer"]);
  if (cit2) {
    npcs.push(makeDemographicNpc(cit2, [poiCX + 6, poiCY + 4], "Camp Sawyer", "Crosscut Hand Saw"));
  }

  return facility?.name ? `${facility.name} (r[${rx}, ${ry}])` : `${parentName} Timberlands: ${sectorTitle} (r[${rx}, ${ry}])`;
}

export function generateProceduralLoggingSubterranean(
  grid: Uint8Array,
  cavernCX: number,
  cavernCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(6); // Solid bedrock
  const typology = getLoggingTypology(cellId, rx, ry);

  // Dugout vault dimensions
  const vW = 14 + Math.floor(rand() * 6);
  const vH = 12 + Math.floor(rand() * 4);
  const halfW = Math.floor(vW / 2);
  const halfH = Math.floor(vH / 2);

  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 3; // Compacted dirt floor
    }
  }

  // Timber shoring log posts along walls
  for (let x = cavernCX - halfW + 2; x <= cavernCX + halfW - 2; x += 5) {
    grid[(cavernCY - halfH) * SIZE + x] = 7;
    grid[(cavernCY + halfH) * SIZE + x] = 7;
  }

  props.push({
    id: `prop_sub_ladder_${cellId}_${rx}_${ry}`,
    name: "Hardwood Ladder Ascending to Sawmill Glade",
    pos: [cavernCX - halfW + 2, cavernCY - halfH + 2],
    tags: ["wood", "portal", "climbable", "ladder_up"],
    hp: 300,
    maxHp: 300,
    description: "Heavy log ladder ascending to the surface tool shed trapdoor."
  });

  if (typology === "CHARCOAL_BURNER") {
    props.push({
      id: `prop_sub_charcoal_bunker_${cellId}_${rx}_${ry}`,
      name: "Dry Ashlar Brick Charcoal Vault",
      pos: [cavernCX + 3, cavernCY],
      tags: ["type:container", "material:brick", "fuel"],
      hp: 200,
      maxHp: 200,
      description: "Dry brick bunker protecting lump charcoal reserves from ground moisture."
    });
  } else if (typology === "RIVER_FLUME_SAWMILL") {
    props.push({
      id: `prop_sub_sluice_gate_${cellId}_${rx}_${ry}`,
      name: "Iron-Banded Sluice Control Winch & Flume Culvert",
      pos: [cavernCX + 4, cavernCY],
      tags: ["type:mechanism", "material:iron", "water"],
      hp: 250,
      maxHp: 250,
      description: "Heavy geared windlass adjusting the water intake flow driving the overhead waterwheel."
    });
  } else {
    props.push({
      id: `prop_sub_pitch_barrels_${cellId}_${rx}_${ry}`,
      name: "Pine Pitch Barrels & Saw Lubricant",
      pos: [cavernCX + 3, cavernCY],
      tags: ["type:container", "material:wood", "flammable", "liquid"],
      hp: 80,
      maxHp: 80,
      description: "Iron-hooped barrels of resinous pine pitch and tallow blade wax."
    });
  }

  const cit = facilityMasterCitizen || pickCitizen(["Sawyer", "Woodcutter", "Carpenter", "Laborer"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [cavernCX, cavernCY + 2], facilityMasterCitizen ? "Timber Dugout Foreman" : "Timber Yard Toolkeeper", "Two-Handed Felling Axe"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Timber Dugout & Tool Trench (r[${rx}, ${ry}] Z=-1)`
    : `${parentName} Timberlands: Dugout Pitch Cellar (r[${rx}, ${ry}] Z=-1)`;
}

export function generateProceduralLoggingUpper(
  grid: Uint8Array,
  platCX: number,
  platCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(0); // Open sky
  const pRad = 8 + Math.floor(rand() * 4);

  for (let dy = -pRad; dy <= pRad; dy++) {
    for (let dx = -pRad; dx <= pRad; dx++) {
      if (Math.hypot(dx, dy) <= pRad) {
        grid[(platCY + dy) * SIZE + (platCX + dx)] = 8; // Timber planking
      }
    }
  }

  props.push({
    id: `prop_upper_ladder_${cellId}_${rx}_${ry}`,
    name: "Knotted Hemp Rope Ladder Descending to Glade",
    pos: [platCX - 2, platCY - 2],
    tags: ["wood", "portal", "climbable", "ladder_down"],
    hp: 200,
    maxHp: 200,
    description: "Sturdy woven hemp rope ladder descending down to the forest ground floor."
  });
  props.push({
    id: `prop_upper_crane_${cellId}_${rx}_${ry}`,
    name: "Timber Swing Hoist & Pulley Block",
    pos: [platCX + 3, platCY + 2],
    tags: ["type:mechanism", "material:wood", "material:iron"],
    hp: 180,
    maxHp: 180,
    description: "Heavy swinging timber derrick hoist for raising and stacking lumber beams onto wagons."
  });

  const cit = pickCitizen(["Scout", "Woodcutter", "Hunter"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [platCX + 1, platCY + 1], "Canopy Crane Operator", "Hunting Bow"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Lumber Crane Loft (r[${rx}, ${ry}] Z=+1)`
    : `${parentName} Timberlands: Canopy Crane Loft (r[${rx}, ${ry}] Z=+1)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROCEDURAL MINES & QUARRIES GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export type MiningTypology = "GRANITE_QUARRY" | "DRIFT_ADIT_MINE" | "FOUNDRY_SMELTER" | "ALLUVIAL_STREAM_PANNING";

export function getMiningTypology(cellId: number, rx: number, ry: number, facility?: any): MiningTypology {
  if (facility?.typology) return facility.typology;
  const name = String(facility?.name || "").toLowerCase();
  if (name.includes("quarry") || name.includes("stone") || name.includes("granite")) return "GRANITE_QUARRY";
  if (name.includes("smelter") || name.includes("foundry") || name.includes("blast")) return "FOUNDRY_SMELTER";
  if (name.includes("alluvial") || name.includes("pan") || name.includes("wash") || name.includes("placer")) return "ALLUVIAL_STREAM_PANNING";
  const roll = Math.abs(cellId * 31 + rx * 19 + ry * 59) % 4;
  return roll === 0 ? "GRANITE_QUARRY" : roll === 1 ? "DRIFT_ADIT_MINE" : roll === 2 ? "FOUNDRY_SMELTER" : "ALLUVIAL_STREAM_PANNING";
}

export function generateProceduralMiningSurface(cfg: FacilityGeneratorConfig): string {
  const { grid, poiCX, poiCY, cellId, rx, ry, rand, parentName, facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc } = cfg;
  const typology = getMiningTypology(cellId, rx, ry, facility);
  const qNoise = new SimplexNoise(cellId * 3000 + rx * 89 + ry * 41);

  let sectorTitle = "";

  if (typology === "GRANITE_QUARRY") {
    // Stepped open-cast rock extraction pit
    const pitR = 24 + Math.floor(rand() * 8);
    for (let dy = -pitR - 4; dy <= pitR + 4; dy++) {
      for (let dx = -pitR - 4; dx <= pitR + 4; dx++) {
        const px = poiCX + dx, py = poiCY + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          const d = Math.hypot(dx, dy);
          const noiseOffset = qNoise.noise2D(dx * 0.07, dy * 0.07) * 7;
          if (d <= pitR + noiseOffset) {
            grid[py * SIZE + px] = d > (pitR * 0.65) ? 5 : 4; // Stone wall bench or stone gravel floor
          }
        }
      }
    }

    // Ashlar stone dressing shed
    const bW = 10, bH = 6;
    const bX = poiCX - 22, bY = poiCY - 8;
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        grid[(bY + dy) * SIZE + (bX + dx)] = (dx === 0 || dx === bW - 1 || dy === 0 || dy === bH - 1) ? 5 : 4;
      }
    }
    grid[(bY + Math.floor(bH / 2)) * SIZE + (bX + bW - 1)] = 4;

    props.push({
      id: `prop_derrick_crane_${cellId}_${rx}_${ry}`,
      name: "Timber Guy Derrick Crane & Winch Drum",
      pos: [poiCX, poiCY],
      tags: ["type:mechanism", "material:wood", "material:iron", "heavy"],
      hp: 350,
      maxHp: 350,
      description: "A colossal guyed timber mast with swing boom and iron chain tackles for hoisting multi-ton granite blocks."
    });
    props.push({
      id: `prop_ashlar_pile_${cellId}_${rx}_${ry}`,
      name: "Dressed Ashlar Masonry Blocks",
      pos: [poiCX + 12, poiCY + 6],
      tags: ["type:structure", "material:stone", "heavy"],
      hp: 400,
      maxHp: 400,
      description: "Stacked squared granite ashlar blocks chiseled to architectural standards for city walls and bridges."
    });
    props.push({
      id: `prop_quarry_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Quarry Drainage Sump Adit (Subterranean Entry)",
      pos: [bX + 3, bY + 2],
      tags: ["type:portal", "material:stone", "openable", "stairs_down"],
      hp: 400,
      maxHp: 400,
      description: "Deep rock-cut tunnel descending into the quarry drainage adit and pump galleries."
    });

    sectorTitle = "Open-Cast Granite Quarry";

  } else if (typology === "FOUNDRY_SMELTER") {
    // Stone blast bloomery furnace & casting sand bed
    for (let dy = -16; dy <= 16; dy++) {
      for (let dx = -18; dx <= 18; dx++) {
        const px = poiCX + dx, py = poiCY + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          grid[py * SIZE + px] = 4; // Slag & stone paved yard
        }
      }
    }

    // Massive Stone Bloomery Furnace Stack
    const fX = poiCX - 6, fY = poiCY - 6;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        grid[(fY + dy) * SIZE + (fX + dx)] = 5; // Stone furnace structure
      }
    }
    grid[fY * SIZE + fX] = 8; // Roaring blast core

    // Pig-iron sand bed
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = 4; dx <= 12; dx++) {
        grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 3; // Sand mould bed
      }
    }

    props.push({
      id: `prop_smelter_furnace_${cellId}_${rx}_${ry}`,
      name: "Stone Blast Bloomery Smelting Furnace",
      pos: [fX, fY],
      tags: ["type:structure", "material:stone", "fire", "heat", "industrial"],
      hp: 500,
      maxHp: 500,
      description: "A monumental tapered stone blast furnace roaring with charcoal-stoked fire smelting raw iron ore into bloom."
    });
    props.push({
      id: `prop_slag_mound_${cellId}_${rx}_${ry}`,
      name: "Vitrified Black Slag Heap",
      pos: [poiCX + 14, poiCY - 8],
      tags: ["type:structure", "material:stone", "debris"],
      hp: 200,
      maxHp: 200,
      description: "Heaped mound of glassy obsidian-like smelter slag skimmed from molten iron runs."
    });
    props.push({
      id: `prop_foundry_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Tuyere Air Blast Flue Vault (Subterranean Entry)",
      pos: [poiCX - 12, poiCY + 6],
      tags: ["type:portal", "material:iron", "openable", "stairs_down"],
      hp: 300,
      maxHp: 300,
      description: "Cast-iron floor grating opening into the subterranean blower flues and cold ore cellars."
    });

    sectorTitle = "Iron Ore Bloomery & Smelting Works";

  } else if (typology === "ALLUVIAL_STREAM_PANNING") {
    // Gravel wash stream & wooden rocker boxes
    for (let y = poiCY - 30; y <= poiCY + 30; y++) {
      const rx = poiCX + Math.floor(Math.sin(y * 0.1) * 6);
      for (let w = -2; w <= 2; w++) {
        const px = rx + w;
        if (px >= 0 && px < SIZE && y >= 0 && y < SIZE) grid[y * SIZE + px] = Math.abs(w) === 2 ? 4 : 2; // Water bordered by gravel
      }
    }

    // Prospector canvas tents and timber sluice line
    props.push({
      id: `prop_rocker_sluice_${cellId}_${rx}_${ry}`,
      name: "Timber Rocker Sluice & Riffle Line",
      pos: [poiCX + 3, poiCY],
      tags: ["type:workstation", "material:wood", "water", "industrial"],
      hp: 150,
      maxHp: 150,
      description: "Notched timber flume lined with corduroy blankets and riffle bars catching dense heavy minerals from washed gravel."
    });
    props.push({
      id: `prop_gravel_screens_${cellId}_${rx}_${ry}`,
      name: "Gravel Riddle Sieves & Panning Kettles",
      pos: [poiCX - 8, poiCY + 6],
      tags: ["type:container", "material:iron", "tool"],
      hp: 100,
      maxHp: 100,
      description: "Perforated iron screens and wide cone pans used to separate coarse stones from mineral sand."
    });
    props.push({
      id: `prop_alluvial_adit_poe_${cellId}_${rx}_${ry}`,
      name: "Bedrock Gravel Deep Pocket Excavation (Subterranean Entry)",
      pos: [poiCX - 12, poiCY - 8],
      tags: ["type:portal", "material:stone", "openable", "stairs_down"],
      hp: 350,
      maxHp: 350,
      description: "Timber-framed shaft burrowing into an ancient dry paleochannel gravel seam."
    });

    sectorTitle = "Alluvial Stream Panning & Sluice Wash";

  } else {
    // DRIFT_ADIT_MINE: Hillside portal entering solid rock cliff
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -14; dx <= 14; dx++) {
        grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 4; // Stone-paved yard
      }
    }
    // Solid rock cliff wall to the North
    for (let x = poiCX - 18; x <= poiCX + 18; x++) {
      for (let dy = -16; dy <= -6; dy++) {
        grid[(poiCY + dy) * SIZE + x] = 5; // Rock face
      }
    }
    // Mine Portal opening in cliff face
    for (let dy = -8; dy <= -6; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 4; // Adit opening
      }
    }

    props.push({
      id: `prop_drift_portal_${cellId}_${rx}_${ry}`,
      name: "Timber-Shored Hillside Drift Portal",
      pos: [poiCX, poiCY - 7],
      tags: ["type:structure", "material:wood_oak", "portal", "tunnel"],
      hp: 500,
      maxHp: 500,
      description: "Massive square-hewn oak timber portal set with wedges tunneling deep into rich subterranean ore veins."
    });
    props.push({
      id: `prop_mine_cart_line_${cellId}_${rx}_${ry}`,
      name: "Iron Trackway & Wheeled Ore Carts",
      pos: [poiCX, poiCY + 4],
      tags: ["type:container", "material:iron", "heavy"],
      hp: 200,
      maxHp: 200,
      description: "Wooden rails capped with strap iron running laden ore tubs from the adit to the surface slag piles."
    });
    props.push({
      id: `prop_drift_mine_poe_${cellId}_${rx}_${ry}`,
      name: "Adit Deep Drift Gallery (Subterranean Entry)",
      pos: [poiCX, poiCY - 6],
      tags: ["type:portal", "material:stone", "stairs_down", "climbable"],
      hp: 600,
      maxHp: 600,
      description: "Dark timber-shored tunnel descending directly into the subterranean mineral veins."
    });

    sectorTitle = "Deep Mineral Adit & Drift Mine";
  }

  const leadCitizen = facilityMasterCitizen || pickCitizen(["Miner", "Quarryman", "Smelter", "Stonecutter", "Blacksmith"]);
  if (leadCitizen) {
    npcs.push(makeDemographicNpc(
      leadCitizen,
      [poiCX + 2, poiCY + 2],
      facilityMasterCitizen ? (facility?.citizenProfession || "Quarry Overseer") : "Mine Overseer",
      "Heavy Mining Pick"
    ));
  }

  const cit2 = pickCitizen(["Miner", "Laborer", "Foundry"]);
  if (cit2) {
    npcs.push(makeDemographicNpc(cit2, [poiCX - 6, poiCY + 4], "Deep Drift Delver", "Sledgehammer & Chisel"));
  }

  return facility?.name ? `${facility.name} (r[${rx}, ${ry}])` : `${parentName} Mineral Works: ${sectorTitle} (r[${rx}, ${ry}])`;
}

export function generateProceduralMiningSubterranean(
  grid: Uint8Array,
  cavernCX: number,
  cavernCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(6); // Solid bedrock
  const typology = getMiningTypology(cellId, rx, ry);

  // Gallery main shaft
  const shaftW = 28 + Math.floor(rand() * 12);
  const shaftH = 8 + Math.floor(rand() * 4);
  for (let dy = -Math.floor(shaftH / 2); dy <= Math.floor(shaftH / 2); dy++) {
    for (let dx = -Math.floor(shaftW / 2); dx <= Math.floor(shaftW / 2); dx++) {
      grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1; // Rock floor
    }
  }

  // Cross-cut gallery
  for (let dy = -16; dy <= 16; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1;
    }
  }

  props.push({
    id: `prop_sub_shaft_hoist_${cellId}_${rx}_${ry}`,
    name: "Headframe Winch Shaft & Iron Ore Bucket",
    pos: [cavernCX, cavernCY],
    tags: ["iron", "portal", "climbable", "ladder_up"],
    hp: 600,
    maxHp: 600,
    description: "Counterweighted timber winch hoist and safety cage ascending to the daylight surface."
  });
  props.push({
    id: `prop_sub_shoring_posts_${cellId}_${rx}_${ry}`,
    name: "Heavy Square-Set Oak Shoring Posts",
    pos: [cavernCX - 12, cavernCY],
    tags: ["type:structure", "material:wood_oak", "structural"],
    hp: 300,
    maxHp: 300,
    description: "Massive interlocking oak timber posts preventing rockbursts along the stope vein."
  });
  props.push({
    id: `prop_sub_ore_cart_${cellId}_${rx}_${ry}`,
    name: "Iron Wheeled Ore Tub on Wood Rails",
    pos: [cavernCX + 14, cavernCY],
    tags: ["type:container", "material:iron", "heavy"],
    hp: 180,
    maxHp: 180,
    description: "Low steel ore car filled with high-grade chalcopyrite and silver-bearing galena."
  });

  const cit = facilityMasterCitizen || pickCitizen(["Miner", "Quarry", "Laborer"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [cavernCX + 4, cavernCY - 2], facilityMasterCitizen ? "Deep Stope Overseer" : "Subterranean Drift Delver", "Heavy Mining Pick"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Deep Adit & Mineral Gallery (r[${rx}, ${ry}] Z=-1)`
    : `${parentName} Mineral Works: Deep Adit Gallery (r[${rx}, ${ry}] Z=-1)`;
}

export function generateProceduralMiningUpper(
  grid: Uint8Array,
  platCX: number,
  platCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(0); // Open sky
  const pRad = 9 + Math.floor(rand() * 4);

  for (let dy = -pRad; dy <= pRad; dy++) {
    for (let dx = -pRad; dx <= pRad; dx++) {
      if (Math.hypot(dx, dy) <= pRad) {
        grid[(platCY + dy) * SIZE + (platCX + dx)] = 4; // Stone platform walkway
      }
    }
  }

  props.push({
    id: `prop_upper_hoist_drum_${cellId}_${rx}_${ry}`,
    name: "Headframe Cable Drum & Turnstile Winch",
    pos: [platCX, platCY],
    tags: ["type:mechanism", "material:iron", "material:wood"],
    hp: 350,
    maxHp: 350,
    description: "Massive wound cable drum hoisting mineral tubs from the subterranean depths."
  });

  const cit = pickCitizen(["Miner", "Laborer"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [platCX + 2, platCY + 2], "Headframe Winch Tender", "Heavy Hammer"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Headframe Platform (r[${rx}, ${ry}] Z=+1)`
    : `${parentName} Quarry: Headframe Hoist Platform (r[${rx}, ${ry}] Z=+1)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROCEDURAL WATCHTOWER & GARRISON GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export type WatchtowerTypology = "CURTAIN_GATE_BASTION" | "HILLTOP_SIGNAL_SPIRE" | "PALISADE_REDOUBT" | "MOATED_BLOCKHOUSE";

export function getWatchtowerTypology(cellId: number, rx: number, ry: number, facility?: any): WatchtowerTypology {
  if (facility?.typology) return facility.typology;
  const name = String(facility?.name || "").toLowerCase();
  if (name.includes("gate") || name.includes("bastion") || name.includes("curtain")) return "CURTAIN_GATE_BASTION";
  if (name.includes("spire") || name.includes("signal") || name.includes("beacon")) return "HILLTOP_SIGNAL_SPIRE";
  if (name.includes("redoubt") || name.includes("palisade") || name.includes("stockade")) return "PALISADE_REDOUBT";
  const roll = Math.abs(cellId * 13 + rx * 47 + ry * 29) % 4;
  return roll === 0 ? "CURTAIN_GATE_BASTION" : roll === 1 ? "HILLTOP_SIGNAL_SPIRE" : roll === 2 ? "PALISADE_REDOUBT" : "MOATED_BLOCKHOUSE";
}

export function generateProceduralWatchtowerSurface(cfg: FacilityGeneratorConfig): string {
  const { grid, poiCX, poiCY, cellId, rx, ry, rand, parentName, facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc } = cfg;
  const typology = getWatchtowerTypology(cellId, rx, ry, facility);

  let sectorTitle = "";

  if (typology === "HILLTOP_SIGNAL_SPIRE") {
    // Octagonal stone spire tower core
    const sRad = 7;
    for (let dy = -sRad; dy <= sRad; dy++) {
      for (let dx = -sRad; dx <= sRad; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= sRad) {
          grid[(poiCY + dy) * SIZE + (poiCX + dx)] = d >= sRad - 1 ? 5 : 4;
        }
      }
    }
    grid[poiCY * SIZE + poiCX] = 8; // Hearth / fire

    props.push({
      id: `prop_spire_structure_${cellId}_${rx}_${ry}`,
      name: "High Granite Signal Spire Tower",
      pos: [poiCX, poiCY],
      tags: ["type:structure", "material:granite", "tower", "military"],
      hp: 800,
      maxHp: 800,
      description: "A monumental tapered granite spire built atop the highest ridgeline for long-range frontier watch."
    });
    props.push({
      id: `prop_signal_cannon_${cellId}_${rx}_${ry}`,
      name: "Frontier Signal Horn & Flare Mortar",
      pos: [poiCX + 10, poiCY],
      tags: ["type:mechanism", "material:bronze", "signal"],
      hp: 200,
      maxHp: 200,
      description: "Bronze signal mortar and great brass alarm horn for alerting the provincial capital of void raids."
    });
    props.push({
      id: `prop_spire_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Signal Spire Powder & Supply Vault (Subterranean Entry)",
      pos: [poiCX - 3, poiCY - 3],
      tags: ["type:portal", "material:stone", "openable", "stairs_down"],
      hp: 400,
      maxHp: 400,
      description: "Chiseled granite stairs descending through the tower footing into the cool powder vaults."
    });

    sectorTitle = "Hilltop Beacon & Signal Spire";

  } else if (typology === "MOATED_BLOCKHOUSE") {
    // Water moat encircling stone-faced blockhouse
    const moatOuterR = 18;
    const moatInnerR = 12;
    for (let dy = -moatOuterR; dy <= moatOuterR; dy++) {
      for (let dx = -moatOuterR; dx <= moatOuterR; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= moatOuterR && d >= moatInnerR) {
          // Drawbridge gap to the South
          if (!(Math.abs(dx) <= 2 && dy > 0)) {
            grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 2; // Water moat
          } else {
            grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 8; // Timber drawbridge
          }
        } else if (d < moatInnerR) {
          grid[(poiCY + dy) * SIZE + (poiCX + dx)] = d >= moatInnerR - 2 ? 5 : 4;
        }
      }
    }

    props.push({
      id: `prop_moated_blockhouse_${cellId}_${rx}_${ry}`,
      name: "Moated Water Blockhouse",
      pos: [poiCX, poiCY],
      tags: ["type:structure", "material:stone", "defensive", "fortified"],
      hp: 700,
      maxHp: 700,
      description: "A compact rectangular stone keep surrounded by a deep water ditch with crenellated machicolations."
    });
    props.push({
      id: `prop_drawbridge_winch_${cellId}_${rx}_${ry}`,
      name: "Iron Drawbridge Windlass & Chains",
      pos: [poiCX, poiCY + 10],
      tags: ["type:mechanism", "material:iron", "drawbridge"],
      hp: 250,
      maxHp: 250,
      description: "Counterbalanced iron windlass raising the timber bridge over the water moat."
    });
    props.push({
      id: `prop_moat_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Moated Sluice Vault & Cistern (Subterranean Entry)",
      pos: [poiCX - 3, poiCY - 2],
      tags: ["type:portal", "material:iron", "openable", "stairs_down"],
      hp: 350,
      maxHp: 350,
      description: "Iron-strapped hatch descending to the moat sluice valves and subterranean cistern."
    });

    sectorTitle = "Moated Frontier Blockhouse";

  } else if (typology === "PALISADE_REDOUBT") {
    // Sharpened timber log stockade & ditch
    const stockadeW = 16, stockadeH = 14;
    for (let dy = -stockadeH; dy <= stockadeH; dy++) {
      for (let dx = -stockadeW; dx <= stockadeW; dx++) {
        if (Math.abs(dx) === stockadeW || Math.abs(dy) === stockadeH) {
          // Gate gap on South wall
          if (!(Math.abs(dx) <= 2 && dy === stockadeH)) {
            grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 7; // Heavy timber log palisade
          } else {
            grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 3; // Gate portal
          }
        } else {
          grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 3; // Dirt bailey
        }
      }
    }

    // Central log blockhouse
    const bhW = 8, bhH = 6;
    for (let dy = -bhH; dy <= bhH; dy++) {
      for (let dx = -bhW; dx <= bhW; dx++) {
        grid[(poiCY + dy) * SIZE + (poiCX + dx)] = (Math.abs(dx) === bhW || Math.abs(dy) === bhH) ? 7 : 8;
      }
    }

    props.push({
      id: `prop_palisade_gate_${cellId}_${rx}_${ry}`,
      name: "Sharpened Oak Palisade & Crossbeam Gate",
      pos: [poiCX, poiCY + stockadeH],
      tags: ["type:portal", "material:wood_oak", "fortified", "defensive"],
      hp: 400,
      maxHp: 400,
      description: "Double-thick pine logs with fire-hardened pointed tips bound by iron studs."
    });
    props.push({
      id: `prop_archer_hoardings_${cellId}_${rx}_${ry}`,
      name: "Timber Archer Catwalk & Firing Steps",
      pos: [poiCX - stockadeW + 2, poiCY],
      tags: ["type:structure", "material:wood", "defense"],
      hp: 200,
      maxHp: 200,
      description: "Elevated firing platform granting archers vantage along the perimeter logs."
    });
    props.push({
      id: `prop_redoubt_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Subterranean Redoubt Escape Flue (Subterranean Entry)",
      pos: [poiCX - 2, poiCY - 2],
      tags: ["type:portal", "material:wood", "openable", "stairs_down"],
      hp: 250,
      maxHp: 250,
      description: "Concealed timber trapdoor leading to subterranean dugout bunkers and escape culverts."
    });

    sectorTitle = "Timber Stockade & Palisade Redoubt";

  } else {
    // CURTAIN_GATE_BASTION: Square ashlar stone gatehouse & curtain wall
    const gSize = 10;
    for (let dy = -gSize; dy <= gSize; dy++) {
      for (let dx = -gSize; dx <= gSize; dx++) {
        if (Math.abs(dx) === gSize || Math.abs(dy) === gSize) {
          grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 5; // Ashlar wall
        } else {
          grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 4; // Stone pavers
        }
      }
    }
    // Cardinal gateway
    grid[(poiCY + gSize) * SIZE + poiCX] = 4;
    grid[(poiCY - gSize) * SIZE + poiCX] = 4;

    props.push({
      id: `prop_portcullis_${cellId}_${rx}_${ry}`,
      name: "Iron-Toothed Portcullis & Murder Holes",
      pos: [poiCX, poiCY + gSize],
      tags: ["type:portal", "material:iron", "portcullis", "secure"],
      hp: 600,
      maxHp: 600,
      description: "Forged iron portcullis with heavy chisel-pointed tines suspended from overhead winches."
    });
    props.push({
      id: `prop_guard_muster_${cellId}_${rx}_${ry}`,
      name: "Sentry Muster Benches & Weapon Lockers",
      pos: [poiCX + 4, poiCY],
      tags: ["type:furniture", "material:wood", "material:iron"],
      hp: 150,
      maxHp: 150,
      description: "Heavy oak muster tables with weapon grease, dice cups, and spear racks."
    });
    props.push({
      id: `prop_bastion_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Bastion Dungeon & Armory Grate (Subterranean Entry)",
      pos: [poiCX - 4, poiCY - 4],
      tags: ["type:portal", "material:iron", "openable", "stairs_down"],
      hp: 400,
      maxHp: 400,
      description: "Forged iron trapdoor descending into the subterranean armory and lockup cells."
    });

    sectorTitle = "Curtain Wall Gate Bastion";
  }

  const leadCitizen = facilityMasterCitizen || pickCitizen(["Watchman", "Guard", "Sentry", "Soldier"]);
  if (leadCitizen) {
    npcs.push(makeDemographicNpc(
      leadCitizen,
      [poiCX + 2, poiCY + 2],
      facilityMasterCitizen ? (facility?.citizenProfession || "Frontier Commander") : "Frontier Sentry Commander",
      "Broadsword & Shield"
    ));
  }

  const cit2 = pickCitizen(["Scout", "Watchman", "Guard", "Archer"]);
  if (cit2) {
    npcs.push(makeDemographicNpc(cit2, [poiCX - 3, poiCY + 3], "Frontier Archer", "Composite Shortbow"));
  }

  return facility?.name ? `${facility.name} (r[${rx}, ${ry}])` : `${parentName} Frontier: ${sectorTitle} (r[${rx}, ${ry}])`;
}

export function generateProceduralWatchtowerSubterranean(
  grid: Uint8Array,
  cavernCX: number,
  cavernCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(6); // Solid bedrock
  const typology = getWatchtowerTypology(cellId, rx, ry);

  for (let dy = -14; dy <= 14; dy++) {
    for (let dx = -14; dx <= 14; dx++) {
      grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 4; // Stone pavers
    }
  }
  // Iron cell partition wall
  for (let dy = -14; dy <= 14; dy++) {
    grid[(cavernCY + dy) * SIZE + (cavernCX - 4)] = 5;
  }

  props.push({
    id: `prop_sub_spiral_stairs_${cellId}_${rx}_${ry}`,
    name: "Spiral Stone Stairs Ascending to Sentry Post",
    pos: [cavernCX + 8, cavernCY + 8],
    tags: ["stone", "portal", "climbable", "stairs_up"],
    hp: 600,
    maxHp: 600,
    description: "Chiseled spiral stone stairway rising through the solid masonry foundation of the watchtower."
  });
  props.push({
    id: `prop_sub_armory_chest_${cellId}_${rx}_${ry}`,
    name: "Sovereign Armory Ironfoot Lockbox",
    pos: [cavernCX + 6, cavernCY - 6],
    tags: ["type:container", "material:iron", "weapon", "secure"],
    hp: 250,
    maxHp: 250,
    description: "Reinforced iron chest holding backup crossbow bolts, spare spearheads, and horn lanterns."
  });
  props.push({
    id: `prop_sub_iron_cells_${cellId}_${rx}_${ry}`,
    name: "Wrought Iron Cell Bars & Wall Shackles",
    pos: [cavernCX - 8, cavernCY],
    tags: ["type:structure", "material:iron", "restraint"],
    hp: 300,
    maxHp: 300,
    description: "Heavy iron holding cells for detaining captured spies, smugglers, and poachers."
  });

  const cit = facilityMasterCitizen || pickCitizen(["Watch", "Guard", "Soldier"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [cavernCX + 2, cavernCY], facilityMasterCitizen ? "Armory Turnkey Guard" : "Sentry Turnkey Guard", "Broadsword & Shield"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Armory & Subterranean Lockup (r[${rx}, ${ry}] Z=-1)`
    : `${parentName} Frontier: Sentry Armory & Dungeon (r[${rx}, ${ry}] Z=-1)`;
}

export function generateProceduralWatchtowerUpper(
  grid: Uint8Array,
  platCX: number,
  platCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(0); // Open sky
  const pRad = 9 + Math.floor(rand() * 3);

  for (let dy = -pRad; dy <= pRad; dy++) {
    for (let dx = -pRad; dx <= pRad; dx++) {
      if (Math.hypot(dx, dy) <= pRad) {
        grid[(platCY + dy) * SIZE + (platCX + dx)] = Math.hypot(dx, dy) >= pRad - 1 ? 5 : 4; // Parapets and stone walkway
      }
    }
  }
  grid[platCY * SIZE + platCX] = 8; // Blazing signal brazier

  props.push({
    id: `prop_upper_stairs_${cellId}_${rx}_${ry}`,
    name: "Stone Stairs Descending to Guardroom",
    pos: [platCX - 5, platCY - 5],
    tags: ["stone", "portal", "climbable", "ladder_down"],
    hp: 400,
    maxHp: 400,
    description: "Stone staircase descending into the interior guardroom of the watchtower."
  });
  props.push({
    id: `prop_upper_beacon_${cellId}_${rx}_${ry}`,
    name: "Pitch-Charged Frontier Signal Beacon",
    pos: [platCX, platCY],
    tags: ["type:hazard", "material:iron", "fire", "signal"],
    hp: 200,
    maxHp: 200,
    description: "Heavy iron signal brazier charged with oil and pine pitch ready to signal alarms."
  });

  const cit = facilityMasterCitizen || pickCitizen(["Watch", "Guard", "Archer", "Sentry"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [platCX + 3, platCY + 2], "Frontier Watch Sentry", "Composite Bow & Broadsword"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Watchtower Ramparts (r[${rx}, ${ry}] Z=+1)`
    : `${parentName} Frontier: Watchtower Ramparts (r[${rx}, ${ry}] Z=+1)`;
}
