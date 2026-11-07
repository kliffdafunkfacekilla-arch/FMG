import { SimplexNoise } from "./SimplexNoise";

export interface CellNeighbor {
  id: number;
  biome: number;
  elevation: number;
  center_x: number;
  center_y: number;
  angle: number; // in radians: -Math.PI to +Math.PI
}

export interface RegionAgent {
  id: number;
  type: string;
  speciesName: string;
  category: string;
  color: string;
  speed: number;
  disposition: number;
  rx: number;
  ry: number;
  targetRx: number;
  targetRy: number;
  // Legacy alias compatibility
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface RegionalFacility {
  type: "FARM" | "LOGGING_CAMP" | "MINE" | "WATCHTOWER";
  name: string;
  rx: number;
  ry: number;
}

export class RegionalInstance {
  public cellId: number;
  public globalData: any;
  
  public mapData: Uint8Array;
  public biomeMap: Uint8Array;
  public elevationMap: Float32Array;
  public vegetationMap: Float32Array;
  public chaosMap: Float32Array;
  public infraMap: Uint8Array;
  
  public facilities: RegionalFacility[] = [];
  public agents: Array<RegionAgent> = [];
  public w = 100;
  public h = 100;
  
  private agentIdCounter = 0;

  constructor(cellId: number, globalData: any) {
    this.cellId = cellId;
    this.globalData = globalData;
    const numCells = this.w * this.h;
    
    this.mapData = new Uint8Array(numCells);
    this.biomeMap = new Uint8Array(numCells);
    this.elevationMap = new Float32Array(numCells);
    this.vegetationMap = new Float32Array(numCells);
    this.chaosMap = new Float32Array(numCells);
    this.infraMap = new Uint8Array(numCells);
    
    this.generate();
    this.spawnAgents();
  }

  private generate() {
    const eleNoise = new SimplexNoise(this.cellId);
    const vegNoise = new SimplexNoise(this.cellId + 100);
    const chaosNoise = new SimplexNoise(this.cellId + 200);
    const blendNoise = new SimplexNoise(this.cellId + 300);

    const terrain = this.globalData.terrain || {};
    const centerEle = Number(terrain.elevation) || 50;
    const centerBiome = Number(terrain.biome) || 4;
    const neighbors: CellNeighbor[] = this.globalData.neighbors || [];

    // Precalculate virtual neighbor positions on the overland grid periphery
    // (50, 50) is the center of the 100x100 mesh.
    // Neighbors are projected at radius 65 (just beyond the 50x50 perimeter)
    const neighborProjections = neighbors.map((n, idx) => ({
      ...n,
      vx: 50 + Math.cos(n.angle) * 65,
      vy: 50 + Math.sin(n.angle) * 65,
      noiseOffset: (idx + 1) * 37
    }));

    const isWaterBiome = (b: number) => [0, 13, 14, 15, 16, 17, 19].includes(b);
    const isGlobalWater = centerEle < 20 || isWaterBiome(centerBiome);

    const features = this.globalData.features || {};
    const routes: string[] = features.routes || [];
    const hasRiver = routes.some((r: string) => 
      r.toLowerCase().includes("river") || r.toLowerCase().includes("waterway")
    );

    // River channel coordinates across Y = 0..99 (ONLY when the global cell actually has an authentic river route)
    const riverCoords: Set<number> = new Set();
    if (hasRiver && !isWaterBiome(centerBiome) && centerEle >= 20) {
      for (let y = 0; y < this.h; y++) {
        const rX = Math.floor(50 + Math.sin(y * 0.08) * 14 + Math.cos(y * 0.03) * 6);
        for (let w = -1; w <= 1; w++) {
          const cx = rX + w;
          if (cx >= 0 && cx < this.w) {
            riverCoords.add(y * this.w + cx);
          }
        }
      }
    }

    // 1. Generate base overland terrain with organic edge biome & elevation blending
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        const nx = x / 50; 
        const ny = y / 50;
        
        const ele = eleNoise.noise2D(nx, ny);
        const veg = vegNoise.noise2D(nx * 2, ny * 2);
        const cha = chaosNoise.noise2D(nx * 0.5, ny * 0.5);

        const distCenter = Math.hypot(x - 50, y - 50);

        // Biome competition: center weight dominates interior (distCenter < 25)
        // blendNoise adds organic, interlocking peninsulas along boundaries
        const centerNoiseVal = blendNoise.noise2D(x / 16, y / 16) * 14;
        let maxBiomeWeight = Math.max(0, 50 - distCenter + centerNoiseVal);
        let winningBiome = centerBiome;

        // Elevation weighted average
        let totalEleWeight = Math.max(0.1, 55 - distCenter);
        let sumEle = centerEle * totalEleWeight;

        for (const np of neighborProjections) {
          const distN = Math.hypot(x - np.vx, y - np.vy);

          // Neighbor biome weight
          const nNoiseVal = blendNoise.noise2D((x + np.noiseOffset) / 16, (y + np.noiseOffset) / 16) * 14;
          const nBiomeWeight = Math.max(0, 50 - distN + nNoiseVal);
          if (nBiomeWeight > maxBiomeWeight) {
            maxBiomeWeight = nBiomeWeight;
            winningBiome = np.biome;
          }

          // Neighbor elevation weight
          const nEleWeight = Math.max(0, 55 - distN);
          if (nEleWeight > 0) {
            sumEle += np.elevation * nEleWeight;
            totalEleWeight += nEleWeight;
          }
        }

        const baseEle = sumEle / totalEleWeight;
        this.biomeMap[idx] = winningBiome;

        // NO PHANTOM WATER RULE:
        // Land cells never spawn random water blotches from noise dips.
        // Water ONLY appears if winning biome is ocean/water, or macro base elevation slopes below 20 into ocean.
        const hasWaterInfluence = isWaterBiome(centerBiome) || isWaterBiome(winningBiome) || centerEle < 20;
        if (!hasWaterInfluence && baseEle >= 20) {
          this.elevationMap[idx] = Math.max(20.5, Math.min(100, baseEle + ele * 10));
        } else {
          this.elevationMap[idx] = Math.max(0, Math.min(100, baseEle + ele * 10));
        }

        this.vegetationMap[idx] = (veg + 1) / 2;
        this.chaosMap[idx] = (cha + 1) / 2;

        const cellIsOcean = this.elevationMap[idx] < 20 || isWaterBiome(winningBiome);

        if (cellIsOcean) {
          // Authentic ocean water cell
          this.mapData[idx] = 3; 
        } else if (riverCoords.has(idx)) {
          // Authentic river channel traversing the cell
          this.mapData[idx] = 3;
          this.infraMap[idx] = 32;
        } else {
          // Authentic land cell matching the blended local biome
          const localEle = this.elevationMap[idx];
          if (localEle > 78) {
            this.mapData[idx] = 8; // High mountain rocky crags
          } else if (veg > 0.60) {
            this.mapData[idx] = 2; // Dense forest canopy / thickets
          } else if (veg > 0.30) {
            this.mapData[idx] = 1; // Light vegetation / copses
          } else {
            this.mapData[idx] = 0; // Open ground of this biome
          }
        }
      }
    }

    // 2. Burg Municipal Territory: Centered at (50, 50) with surrounding outposts
    const burg = this.globalData.burg;
    if (burg && !isGlobalWater) {
      const tier = burg.urban_tier || 1;
      const radius = tier >= 3 ? 14 : tier === 2 ? 10 : 6;
      const cx = Math.floor(this.w / 2);
      const cy = Math.floor(this.h / 2);

      // Core burg settlement
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist <= radius) {
            const idx = y * this.w + x;
            if (!riverCoords.has(idx)) {
              this.mapData[idx] = 4; // Burg Core Settlement
              this.infraMap[idx] = 1;
            }
          }
        }
      }

      // Paved Highways (2 cells wide) connecting burg center to borders
      for (let y = 0; y < this.h; y++) {
        for (let x = cx - 1; x <= cx; x++) {
          const idx = y * this.w + x;
          if (this.mapData[idx] !== 4 && !riverCoords.has(idx)) {
            this.mapData[idx] = 5;
            this.infraMap[idx] = 2;
          }
        }
      }
      for (let x = 0; x < this.w; x++) {
        for (let y = cy - 1; y <= cy; y++) {
          const idx = y * this.w + x;
          if (this.mapData[idx] !== 4 && !riverCoords.has(idx)) {
            this.mapData[idx] = 5;
            this.infraMap[idx] = 2;
          }
        }
      }

      // Perimeter Fortified Watchtowers & Outposts along highway approaches
      const outpostOffsets = [
        { rx: cx, ry: cy - 32, name: `${burg.name || "Burg"} North Sentry Outpost` },
        { rx: cx, ry: cy + 32, name: `${burg.name || "Burg"} South Sentry Outpost` },
        { rx: cx - 32, ry: cy, name: `${burg.name || "Burg"} West Sentry Outpost` },
        { rx: cx + 32, ry: cy, name: `${burg.name || "Burg"} East Sentry Outpost` }
      ];
      for (const op of outpostOffsets) {
        if (op.rx >= 2 && op.rx < this.w - 2 && op.ry >= 2 && op.ry < this.h - 2) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const idx = (op.ry + dy) * this.w + (op.rx + dx);
              if (!riverCoords.has(idx)) {
                this.mapData[idx] = 12; // Watchtower Outpost
                this.infraMap[idx] = 6;
              }
            }
          }
          this.facilities.push({ type: "WATCHTOWER", name: op.name, rx: op.rx, ry: op.ry });
        }
      }

      // Scattered Farmsteads & Croplands (matching 6/12 Food workforce)
      const farmCount = tier >= 3 ? 8 : tier === 2 ? 6 : 4;
      const farmAngles = [0.45, 1.15, 1.95, 2.65, 3.55, 4.25, 5.05, 5.75];
      for (let f = 0; f < farmCount; f++) {
        const ang = farmAngles[f] ?? (f * 0.8);
        const dist = 18 + (f % 3) * 6;
        const fx = Math.round(cx + Math.cos(ang) * dist);
        const fy = Math.round(cy + Math.sin(ang) * dist);

        if (fx >= 4 && fx < this.w - 4 && fy >= 4 && fy < this.h - 4) {
          const fIdx = fy * this.w + fx;
          if ((this.elevationMap[fIdx] ?? 0) >= 20 && !riverCoords.has(fIdx)) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const cIdx = (fy + dy) * this.w + (fx + dx);
                if (this.mapData[cIdx] !== 4 && this.mapData[cIdx] !== 5 && !riverCoords.has(cIdx)) {
                  this.mapData[cIdx] = 9; // Farmstead / Cropland
                  this.infraMap[cIdx] = 48;
                }
              }
            }
            let currX = fx;
            let currY = fy;
            while (Math.abs(currX - cx) > 1 && Math.abs(currY - cy) > 1) {
              if (Math.abs(currX - cx) < Math.abs(currY - cy)) {
                currX += Math.sign(cx - currX);
              } else {
                currY += Math.sign(cy - currY);
              }
              const pIdx = currY * this.w + currX;
              if (this.mapData[pIdx] === 0 || this.mapData[pIdx] === 1 || this.mapData[pIdx] === 2) {
                this.mapData[pIdx] = 5;
                this.infraMap[pIdx] = 2;
              }
            }

            this.facilities.push({
              type: "FARM",
              name: `${burg.name || "Burg"} Farmstead #${f + 1}`,
              rx: fx,
              ry: fy
            });
          }
        }
      }

      // Timber Logging Camps (Resource workforce)
      let loggingCount = 0;
      const targetLogging = tier >= 3 ? 3 : 2;
      for (let r = 20; r <= 42 && loggingCount < targetLogging; r += 7) {
        for (let a = 0; a < Math.PI * 2 && loggingCount < targetLogging; a += 0.9) {
          const lx = Math.round(cx + Math.cos(a) * r);
          const ly = Math.round(cy + Math.sin(a) * r);
          if (lx >= 4 && lx < this.w - 4 && ly >= 4 && ly < this.h - 4) {
            const lIdx = ly * this.w + lx;
            if ((this.vegetationMap[lIdx] ?? 0) > 0.50 && this.mapData[lIdx] === 2 && !riverCoords.has(lIdx)) {
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const idx = (ly + dy) * this.w + (lx + dx);
                  this.mapData[idx] = 10; // Timber Logging Camp
                  this.infraMap[idx] = 24;
                }
              }
              this.facilities.push({
                type: "LOGGING_CAMP",
                name: `${burg.name || "Burg"} Logging Camp #${loggingCount + 1}`,
                rx: lx,
                ry: ly
              });
              loggingCount++;
            }
          }
        }
      }

      // Mountain Mines & Stone Quarries (Resource workforce)
      let mineCount = 0;
      const targetMines = tier >= 3 ? 2 : 1;
      for (let r = 22; r <= 44 && mineCount < targetMines; r += 7) {
        for (let a = 0.5; a < Math.PI * 2 && mineCount < targetMines; a += 1.1) {
          const mx = Math.round(cx + Math.cos(a) * r);
          const my = Math.round(cy + Math.sin(a) * r);
          if (mx >= 4 && mx < this.w - 4 && my >= 4 && my < this.h - 4) {
            const mIdx = my * this.w + mx;
            if (((this.elevationMap[mIdx] ?? 0) > 60 || this.mapData[mIdx] === 8) && !riverCoords.has(mIdx)) {
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const idx = (my + dy) * this.w + (mx + dx);
                  this.mapData[idx] = 11; // Mine / Quarry
                  this.infraMap[idx] = 12;
                }
              }
              this.facilities.push({
                type: "MINE",
                name: `${burg.name || "Burg"} Mineral Quarry #${mineCount + 1}`,
                rx: mx,
                ry: my
              });
              mineCount++;
            }
          }
        }
      }
    }

        // 3. Highways for non-burg transit cells
    const hasHighway = routes.some((r: string) => 
      r.includes("Highway") || r.includes("Road") || r.includes("Artery") || 
      r.includes("Way") || (r.includes("Route") && !r.includes("Smuggler"))
    );
    if (!burg && hasHighway && !isGlobalWater) {
      const cx = Math.floor(this.w / 2);
      for (let y = 0; y < this.h; y++) {
        for (let x = cx - 1; x <= cx; x++) {
          const idx = y * this.w + x;
          if (!riverCoords.has(idx)) {
            this.mapData[idx] = 5;
            this.infraMap[idx] = 2;
          }
        }
      }
    }

    // 4. Smuggler Routes: 1-cell covert winding trail
    if (routes.includes("Smuggler Route") && !isGlobalWater) {
      for (let y = 0; y < this.h; y++) {
        const wiggle = Math.floor(Math.sin(y * 0.12) * 8);
        const px = Math.floor(this.w / 4) + wiggle;
        if (px >= 0 && px < this.w) {
          const idx = y * this.w + px;
          if (this.mapData[idx] === 0 || this.mapData[idx] === 1) {
            this.mapData[idx] = 6;
            this.infraMap[idx] = 4;
          }
        }
      }
    }

    // 5. POI / Sacred Temple
    if (features.poi && !isGlobalWater) {
      const cx = Math.floor(this.w / 2);
      const cy = Math.floor(this.h / 2);
      this.infraMap[cy * this.w + cx] = 8;
      this.mapData[cy * this.w + cx] = 7;
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if (x === cx && y === cy) continue;
          if (Math.hypot(x - cx, y - cy) <= 4) {
            const idx = y * this.w + x;
            this.infraMap[idx] = 16;
            this.mapData[idx] = 7;
          }
        }
      }
    }
  }

  public getBiomeLabel(bId?: number): string {
    const id = bId !== undefined ? bId : (Number(this.globalData.terrain?.biome) || 4);
    const names: Record<number, string> = {
      0: "Marine Ocean",
      1: "Hot Desert",
      2: "Cold Desert",
      3: "Savanna",
      4: "Grassland",
      5: "Tropical Seasonal Forest",
      6: "Temperate Deciduous Forest",
      7: "Tropical Rainforest",
      8: "Temperate Rainforest",
      9: "Taiga",
      10: "Tundra",
      11: "Glacier",
      12: "Wetland",
      13: "Shallow Reef",
      14: "Kelp Forest",
      15: "Pelagic Ocean",
      16: "Abyssal Plain",
      17: "Oceanic Trench",
      18: "Chaos Land",
      19: "Chaos Water"
    };
    return names[id] || "Wilderness";
  }

  private spawnAgents() {
    const bId = String(this.globalData.terrain?.biome || 4);
    const ecologyTable: Record<string, { predators: string[]; prey: string[]; flora: string[] }> = {
      "1": { predators: ["Dune Scythe-Beetle", "Sun-Stalker Vulture"], prey: ["Sand Gazelle", "Spiny Horn-Lizard"], flora: ["Spire Cactus", "Sun-Root"] },
      "2": { predators: ["Grave Skink", "Frost-Fang Jackal"], prey: ["Scree Marmot", "Barren Hare"], flora: ["Brittle Scrub", "Salt Lichen"] },
      "3": { predators: ["Plains Hyena", "Prideland Lion"], prey: ["Savanna Zebra", "Steppe Antelope"], flora: ["Golden Baobab", "Tuft Grass"] },
      "4": { predators: ["Steppe Wolf", "Prairie Falcon"], prey: ["Great Prairie Elk", "Field Hare"], flora: ["Sweet Clover", "Wild Rye"] },
      "5": { predators: ["Emerald Stalker", "Venom Adder"], prey: ["Canopy Macaw", "Tree Glider"], flora: ["Orchid Pod", "Liana Vine"] },
      "6": { predators: ["Shadow Timber-Wolf", "Grizzled Briar Bear"], prey: ["Great Antler Stag", "Spotted Doe"], flora: ["Silverleaf Fern", "Ironwood Nut"] },
      "7": { predators: ["Jaguar", "Emerald Stalker"], prey: ["Capybara", "Tree Glider"], flora: ["Liana Vine", "Fern Tree"] },
      "8": { predators: ["Shadow Timber-Wolf", "Briar Bear"], prey: ["Great Antler Stag", "Spotted Doe"], flora: ["Silverleaf Fern", "Ironwood Nut"] },
      "9": { predators: ["Ice-Mane Worg", "Frost Lynx"], prey: ["Northern Caribou", "Snowshoe Hare"], flora: ["Pine-Sap Lichen", "Bog Cranberry"] },
      "10": { predators: ["Glacial Bear", "White-Fang Fox"], prey: ["Tundra Reindeer", "Lichen Grouse"], flora: ["Cotton Grass", "Frost Moss"] },
      "11": { predators: ["Frost Wyrmling", "Crag Stalker"], prey: ["Snow Beaver", "Ice Gull"], flora: ["Cryo-Spore", "Deep Ice Fern"] },
      "12": { predators: ["Bog Stalker", "Mire Crocodile"], prey: ["Crested Marsh Elk", "Reed Heron"], flora: ["Fluorescent Bog Lichen", "Sweet-Water Reed"] },
      "18": { predators: ["Chaos Hound", "Void Stalker"], prey: ["Twisted Elk", "Blight Hare"], flora: ["Warp Lichen", "Aether Tendril"] }
    };
    const eco = ecologyTable[bId] || ecologyTable["4"] || {
      predators: ["Steppe Wolf", "Prairie Falcon"],
      prey: ["Great Prairie Elk", "Field Hare"],
      flora: ["Sweet Clover", "Wild Rye"]
    };

    const spawn = (type: string, speciesName: string, category: string, color: string, speedCells: number, count: number, disposition: number) => {
      for (let i = 0; i < count; i++) {
        const rx = Math.floor(Math.random() * 88) + 6;
        const ry = Math.floor(Math.random() * 88) + 6;
        const targetRx = Math.floor(Math.random() * 88) + 6;
        const targetRy = Math.floor(Math.random() * 88) + 6;

        this.agents.push({
          id: ++this.agentIdCounter,
          type,
          speciesName,
          category,
          color,
          speed: speedCells, // Discrete cells per day/tick
          disposition,
          rx,
          ry,
          targetRx,
          targetRy,
          x: rx,
          y: ry,
          tx: targetRx,
          ty: targetRy
        });
      }
    };

    // Trophic Fauna: Biome-specific grazing wild game and predators
    for (const preyName of eco.prey) {
      spawn("Prey", preyName, "Wild Fauna", "#22c55e", 1, 3, 0);
    }
    for (const predName of eco.predators) {
      spawn("Predator", predName, "Apex Predator", "#ef4444", 2, 2, -2);
    }
    
    const burg = this.globalData.burg;
    const faction = this.globalData.factionName || "Frontier Sovereignty";

    if (!burg || burg.pop_null === 0) {
      if (Math.random() < 0.3) spawn("Refugees", "Displaced Wanderers", "Wayfarer", "#94a3b8", 1, 2, 1);
      if (Math.random() < 0.2) spawn("Hermit", "Frontier Hermit", "Wayfarer", "#d97706", 1, 1, 0);
      if (Math.random() < 0.3) spawn("Trapper", "Wilderness Trapper", "Hunter", "#854d0e", 1, 2, 0);
    }

    const features = this.globalData.features || {};
    const routes: string[] = features.routes || [];
    const hasHighway = routes.some((r: string) => 
      r.includes("Highway") || r.includes("Road") || r.includes("Artery") || 
      r.includes("Way") || (r.includes("Route") && !r.includes("Smuggler"))
    );

    if (routes.includes("Smuggler Route")) {
      spawn("Smuggler", "Shadow Courier", "Outlaw", "#a855f7", 2, 2, -1);
    }
    if (hasHighway || burg) {
      spawn("Merchant", "Caravan Master", "Trader", "#f59e0b", 1, 1, 1);
      spawn("DraftBeast", "Caravan Pack-Beast", "Trader", "#d97706", 1, 1, 0);
      spawn("Patrol", `${faction} Vanguard`, "Sovereign Guard", "#3b82f6", 1, 2, 0);
      if (Math.random() < 0.35) spawn("Pilgrim", "Monastic Wayfarer", "Devotee", "#38bdf8", 1, 2, 1);
      if (Math.random() < 0.25) spawn("Scholar", "Wandering Naturalist", "Scholar", "#6366f1", 1, 1, 1);
    }
    if (Math.random() < 0.15) spawn("Anomaly", "Eldritch Rift-Entity", "Anomaly", "#ec4899", 1, 1, -2);
    
    // Cultists guard the POI temple
    if (features.poi) {
      spawn("Cultist", "Dragon-Seal Zealot", "Cultist", "#c026d3", 1, 3, -2);
      const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
      this.agents.forEach(a => {
        if (a.type === 'Cultist') {
          a.rx = Math.max(5, Math.min(95, cx + (Math.floor(Math.random() * 9) - 4)));
          a.ry = Math.max(5, Math.min(95, cy + (Math.floor(Math.random() * 9) - 4)));
          a.x = a.rx; a.y = a.ry;
        }
      });
    }

    if (this.globalData.isWarzone) {
      spawn("Refugee", "War Refugee", "Refugee", "#94a3b8", 1, 4, 1);
      spawn("Bandit", "Desperate Raider", "Outlaw", "#e11d48", 2, 3, -2);
    }

    if (this.globalData.isFamine) {
      spawn("Cannibal", "Famine Marauder", "Outlaw", "#991b1b", 2, 3, -2);
    }

    // Spawn authentic workers stationed at the burg regional facilities
    if (burg && this.facilities.length > 0) {
      for (const fac of this.facilities) {
        if (fac.type === "FARM") {
          spawn("Farmer", fac.name, "Food Producer", "#eab308", 1, 1, 1);
          const ag = this.agents[this.agents.length - 1];
          if (ag) {
            ag.rx = fac.rx; ag.ry = fac.ry;
            ag.x = fac.rx; ag.y = fac.ry;
            ag.targetRx = fac.rx + (Math.random() < 0.5 ? 1 : -1);
            ag.targetRy = fac.ry + (Math.random() < 0.5 ? 1 : -1);
          }
        } else if (fac.type === "LOGGING_CAMP") {
          spawn("Woodsman", fac.name, "Resource Worker", "#854d0e", 1, 1, 0);
          const ag = this.agents[this.agents.length - 1];
          if (ag) {
            ag.rx = fac.rx; ag.ry = fac.ry;
            ag.x = fac.rx; ag.y = fac.ry;
            ag.targetRx = fac.rx; ag.targetRy = fac.ry;
          }
        } else if (fac.type === "MINE") {
          spawn("Miner", fac.name, "Resource Worker", "#64748b", 1, 1, 0);
          const ag = this.agents[this.agents.length - 1];
          if (ag) {
            ag.rx = fac.rx; ag.ry = fac.ry;
            ag.x = fac.rx; ag.y = fac.ry;
            ag.targetRx = fac.rx; ag.targetRy = fac.ry;
          }
        } else if (fac.type === "WATCHTOWER") {
          spawn("WatchGuard", fac.name, "Defense Guard", "#3b82f6", 1, 1, 1);
          const ag = this.agents[this.agents.length - 1];
          if (ag) {
            ag.rx = fac.rx; ag.ry = fac.ry;
            ag.x = fac.rx; ag.y = fac.ry;
            ag.targetRx = fac.rx; ag.targetRy = fac.ry;
          }
        }
      }
    }
  }

  /**
   * Discrete Simulation Step: Moves agents cell-by-cell in exact lockstep with master ticks (1 Tick = 1 Day).
   */
  public stepTick(currentTick: number) {
    for (const a of this.agents) {
      const dx = a.targetRx - a.rx;
      const dy = a.targetRy - a.ry;
      const dist = Math.hypot(dx, dy);

      if (dist <= 1.5) {
        // Destination cell reached: pick new target cell based on role
        if (a.type === 'Merchant' || a.type === 'DraftBeast') {
          // Travel north/south along highway (center 50)
          a.targetRx = 50 + (Math.floor(Math.random() * 3) - 1);
          a.targetRy = a.ry < 50 ? 92 : 8;
        } else if (a.type === 'Patrol') {
          // Patrol perimeter around burg
          const cx = 50, cy = 50;
          const angle = Math.random() * Math.PI * 2;
          const radius = 12 + Math.floor(Math.random() * 6);
          a.targetRx = Math.max(5, Math.min(95, Math.round(cx + Math.cos(angle) * radius)));
          a.targetRy = Math.max(5, Math.min(95, Math.round(cy + Math.sin(angle) * radius)));
        } else if (a.type === 'Predator') {
          // Stalk nearest prey within hunting range (25 cells)
          let nearestPrey: RegionAgent | null = null;
          let pDist = 25;
          for (const p of this.agents) {
            if (p.type === 'Prey') {
              const d = Math.hypot(p.rx - a.rx, p.ry - a.ry);
              if (d < pDist) { pDist = d; nearestPrey = p; }
            }
          }
          if (nearestPrey) {
            a.targetRx = nearestPrey.rx;
            a.targetRy = nearestPrey.ry;
          } else {
            a.targetRx = Math.max(5, Math.min(95, a.rx + Math.floor(Math.random() * 21 - 10)));
            a.targetRy = Math.max(5, Math.min(95, a.ry + Math.floor(Math.random() * 21 - 10)));
          }
        } else if (a.type === 'Prey') {
          // Flee if predator within 8 cells, otherwise graze nearby
          let threateningPred: RegionAgent | null = null;
          for (const pred of this.agents) {
            if (pred.type === 'Predator') {
              const d = Math.hypot(pred.rx - a.rx, pred.ry - a.ry);
              if (d < 8) { threateningPred = pred; break; }
            }
          }
          if (threateningPred) {
            // Flee away from predator
            const fX = a.rx - (threateningPred.rx - a.rx);
            const fY = a.ry - (threateningPred.ry - a.ry);
            a.targetRx = Math.max(5, Math.min(95, fX));
            a.targetRy = Math.max(5, Math.min(95, fY));
          } else {
            // Graze in local grazing pocket
            a.targetRx = Math.max(5, Math.min(95, a.rx + Math.floor(Math.random() * 11 - 5)));
            a.targetRy = Math.max(5, Math.min(95, a.ry + Math.floor(Math.random() * 11 - 5)));
          }
        } else if (a.type === "Farmer") {
          // Wander within 2 cells of farmstead tending crops
          a.targetRx = Math.max(2, Math.min(97, a.rx + Math.floor(Math.random() * 5 - 2)));
          a.targetRy = Math.max(2, Math.min(97, a.ry + Math.floor(Math.random() * 5 - 2)));
        } else if (a.type === "Woodsman") {
          // Wander within 2 cells of logging camp
          a.targetRx = Math.max(2, Math.min(97, a.rx + Math.floor(Math.random() * 5 - 2)));
          a.targetRy = Math.max(2, Math.min(97, a.ry + Math.floor(Math.random() * 5 - 2)));
        } else if (a.type === "Miner") {
          // Wander within 2 cells of quarry
          a.targetRx = Math.max(2, Math.min(97, a.rx + Math.floor(Math.random() * 5 - 2)));
          a.targetRy = Math.max(2, Math.min(97, a.ry + Math.floor(Math.random() * 5 - 2)));
        } else if (a.type === "WatchGuard") {
          // Sentry patrol between watchtower and road gate
          a.targetRx = Math.max(2, Math.min(97, a.rx + Math.floor(Math.random() * 7 - 3)));
          a.targetRy = Math.max(2, Math.min(97, a.ry + Math.floor(Math.random() * 7 - 3)));
        } else {
          a.targetRx = Math.max(5, Math.min(95, a.rx + Math.floor(Math.random() * 17 - 8)));
          a.targetRy = Math.max(5, Math.min(95, a.ry + Math.floor(Math.random() * 17 - 8)));
        }
      } else {
        // Step discrete cells toward target
        const stepDist = Math.max(1, Math.min(2, Math.round(a.speed)));
        const stepX = Math.sign(dx) * (Math.abs(dx) >= stepDist ? stepDist : Math.abs(dx));
        const stepY = Math.sign(dy) * (Math.abs(dy) >= stepDist ? stepDist : Math.abs(dy));
        a.rx = Math.max(0, Math.min(99, a.rx + stepX));
        a.ry = Math.max(0, Math.min(99, a.ry + stepY));
      }

      // Keep legacy alias coordinates synchronized
      a.x = a.rx;
      a.y = a.ry;
      a.tx = a.targetRx;
      a.ty = a.targetRy;
    }
  }

  public getManifest(rx: number, ry: number) {
    const idx = ry * this.w + rx;
    const localBiomeId = this.biomeMap ? this.biomeMap[idx] : (Number(this.globalData.terrain?.biome) || 4);
    const localBiomeName = this.getBiomeLabel(localBiomeId);
    
    // Sort all agents by distance to current sector coordinate, take top 8 closest
    const nearbyAgents = this.agents
      .map(a => ({ agent: a, dist: Math.hypot(a.rx - rx, a.ry - ry) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8)
      .map(item => item.agent);
    
    return {
      level_3_seed: `${this.cellId}-${rx}-${ry}`,
      global_context: {
        biome_id: localBiomeId,
        biome_name: localBiomeName,
        crime_rate: this.globalData.burg ? this.globalData.burg.crime_rate : "Wilderness",
        faction_owner: this.globalData.burg ? (this.globalData.burg.occupier_faction_id || this.globalData.burg.faction_id) : "Unclaimed",
        isWarzone: this.globalData.isWarzone || false,
        isFamine: this.globalData.isFamine || false,
        burg: this.globalData.burg ? {
          burg_id: this.globalData.burg.burg_id,
          name: this.globalData.burg.name || `Burg #${this.globalData.burg.burg_id}`,
          urban_tier: this.globalData.burg.urban_tier || 1,
          food: this.globalData.burg.food,
          wealth: this.globalData.burg.wealth,
          unrest: this.globalData.burg.unrest,
          crime_rate: this.globalData.burg.crime_rate
        } : null
      },
      environment: {
        base_terrain: this.mapData[idx] || 0,
        elevation: parseFloat((this.elevationMap[idx] || 0).toFixed(3)),
        vegetation_density: parseFloat((this.vegetationMap[idx] || 0).toFixed(3)),
        chaos_radiation: parseFloat((this.chaosMap[idx] || 0).toFixed(3)),
        infrastructure_mask: this.infraMap[idx] || 0
      },
      entities_present: nearbyAgents.map(a => ({
        id: a.id,
        type: a.speciesName || a.type,
        category: a.category || a.type,
        state: "ROAMING",
        disposition: a.disposition,
        story_hook: `A ${a.speciesName || a.type} roaming the ${localBiomeName} wilds.`
      }))
    };
  }

  public destroy() {
    // No timer resources to clean up; discrete tick-based
  }
}
