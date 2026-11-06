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

export class RegionalInstance {
  public cellId: number;
  public globalData: any;
  
  public mapData: Uint8Array;
  public biomeMap: Uint8Array;
  public elevationMap: Float32Array;
  public vegetationMap: Float32Array;
  public chaosMap: Float32Array;
  public infraMap: Uint8Array;
  
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

    // 2. Burg Settlements: Centered at (50, 50)
    const burg = this.globalData.burg;
    if (burg && !isGlobalWater) {
      const tier = burg.urban_tier || 1;
      const radius = tier >= 3 ? 14 : tier === 2 ? 10 : 6;
      const cx = Math.floor(this.w / 2);
      const cy = Math.floor(this.h / 2);

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
