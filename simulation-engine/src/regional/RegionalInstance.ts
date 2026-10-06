import { SimplexNoise } from "./SimplexNoise";

export class RegionalInstance {
  public cellId: number;
  public globalData: any;
  
  public mapData: Uint8Array;
  public elevationMap: Float32Array;
  public vegetationMap: Float32Array;
  public chaosMap: Float32Array;
  public infraMap: Uint8Array;
  
  public agents: Array<any> = [];
  public w = 225;
  public h = 225;
  
  private simInterval: NodeJS.Timeout | null = null;
  private agentIdCounter = 0;

  constructor(cellId: number, globalData: any) {
    this.cellId = cellId;
    this.globalData = globalData;
    const numCells = this.w * this.h;
    
    this.mapData = new Uint8Array(numCells);
    this.elevationMap = new Float32Array(numCells);
    this.vegetationMap = new Float32Array(numCells);
    this.chaosMap = new Float32Array(numCells);
    this.infraMap = new Uint8Array(numCells);
    
    this.generate();
    this.spawnAgents();
    this.startSimulation();
  }

  private generate() {
    const eleNoise = new SimplexNoise(this.cellId);
    const vegNoise = new SimplexNoise(this.cellId + 100);
    const chaosNoise = new SimplexNoise(this.cellId + 200);
    
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        const nx = x / 50; 
        const ny = y / 50;
        
        const ele = eleNoise.noise2D(nx, ny);
        const veg = vegNoise.noise2D(nx * 2, ny * 2);
        const cha = chaosNoise.noise2D(nx * 0.5, ny * 0.5);

        this.elevationMap[idx] = (ele + 1) / 2; 
        this.vegetationMap[idx] = (veg + 1) / 2;
        this.chaosMap[idx] = (cha + 1) / 2;

        if (ele < -0.3) this.mapData[idx] = 3; 
        else if (veg > 0.6) this.mapData[idx] = 2; 
        else if (veg > 0.3) this.mapData[idx] = 1; 
        else this.mapData[idx] = 0; 
      }
    }

    const burg = this.globalData.burg;
    if (burg) {
      const pop = burg.pop_null || 0;
      if (pop > 0) {
        const groupsOf12 = Math.floor(pop / 12);
        const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
        const radius = Math.min(Math.sqrt(groupsOf12), this.w / 3);

        for (let y = 0; y < this.h; y++) {
          for (let x = 0; x < this.w; x++) {
            const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
            if (dist < radius && (dist < radius * 0.5 || Math.random() < 0.5)) {
              const idx = y * this.w + x;
              this.mapData[idx] = 4;
              this.infraMap[idx] = 1; 
            }
          }
        }
      }
    }

    const features = this.globalData.features || {};
    const routes = features.routes || [];
    if (routes.includes("Imperial Highway")) {
      const cx = Math.floor(this.w / 2);
      for (let y = 0; y < this.h; y++) {
        for (let x = cx - 5; x <= cx + 5; x++) {
          const idx = y * this.w + x;
          this.mapData[idx] = 5; 
          this.infraMap[idx] = 2; 
        }
      }
    }

    if (routes.includes("Smuggler Route")) {
      for (let y = 0; y < this.h; y++) {
        const wiggle = Math.floor(Math.sin(y * 0.1) * 10);
        const px = Math.floor(this.w / 3) + wiggle;
        const idx = y * this.w + px;
        this.mapData[idx] = 6;
        this.mapData[idx + 1] = 6;
        this.infraMap[idx] = 4; 
      }
    }

    if (features.poi) {
      const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
      
      // 1. Center Cell: The Main Temple (infra = 8)
      this.infraMap[cy * this.w + cx] = 8;
      this.mapData[cy * this.w + cx] = 7;
      
      // 2. Surrounding cells (radius 1 to 5): Ruined Outskirts / Activity (infra = 16)
      for (let y = cy - 5; y <= cy + 5; y++) {
        for (let x = cx - 5; x <= cx + 5; x++) {
          if (x === cx && y === cy) continue; // skip center
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= 5) {
            const idx = y * this.w + x;
            this.infraMap[idx] = 16; 
            this.mapData[idx] = 7; // POI terrain
          }
        }
      }

      // 3. Pilgrimage / Ruined Path leading south
      for (let y = cy + 6; y < this.h; y++) {
        // Wiggle the path slightly
        const px = cx + Math.floor(Math.sin(y / 5) * 3);
        const idx = y * this.w + px;
        this.infraMap[idx] = 4; // Smuggler/Dirt path
        // Chaos radiation bleeds down the path
        this.chaosMap[idx] = Math.max((this.chaosMap[idx] || 0), 0.5);
      }

      // 4. Chaos Radiation gradient around the temple
      for (let y = cy - 20; y <= cy + 20; y++) {
        for (let x = cx - 20; x <= cx + 20; x++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= 20 && y >= 0 && y < this.h && x >= 0 && x < this.w) {
            const idx = y * this.w + x;
            this.chaosMap[idx] = Math.min(1.0, (this.chaosMap[idx] || 0) + (20 - dist) / 20);
          }
        }
      }
    }

    // War Zone Generation (Battlefields and Refugee Camps)
    if (this.globalData.isWarzone) {
      // Battlefield in the center-ish
      const bx = Math.floor(this.w / 2) + Math.floor(Math.random() * 20 - 10);
      const by = Math.floor(this.h / 2) + Math.floor(Math.random() * 20 - 10);
      for (let y = by - 8; y <= by + 8; y++) {
        for (let x = bx - 8; x <= bx + 8; x++) {
          if (Math.random() < 0.8 && y >= 0 && y < this.h && x >= 0 && x < this.w) {
            this.infraMap[y * this.w + x] = 128; // Battlefield footprint
            this.mapData[y * this.w + x] = 0; // Destroy vegetation
          }
        }
      }
      
      // Refugee camp near the edge
      const rcy = this.h - 15;
      const rcx = Math.floor(this.w / 2) + Math.floor(Math.random() * 30 - 15);
      for (let y = rcy - 5; y <= rcy + 5; y++) {
        for (let x = rcx - 5; x <= rcx + 5; x++) {
          if (y >= 0 && y < this.h && x >= 0 && x < this.w) {
            this.infraMap[y * this.w + x] = 64; // Refugee Camp
          }
        }
      }
    }

    // Famine Generation (Macabre Cannibal Camps)
    if (this.globalData.isFamine) {
      // Scatter a few macabre camps in dense vegetation areas
      for (let i = 0; i < 3; i++) {
        const mx = Math.floor(Math.random() * (this.w - 20)) + 10;
        const my = Math.floor(Math.random() * (this.h - 20)) + 10;
        for (let y = my - 3; y <= my + 3; y++) {
          for (let x = mx - 3; x <= mx + 3; x++) {
            this.infraMap[y * this.w + x] = 32; // Macabre Camp
          }
        }
      }
    }
  }

  private spawnAgents() {
    const spawn = (type: string, color: string, speed: number, count: number) => {
      for (let i = 0; i < count; i++) {
        this.agents.push({
          id: ++this.agentIdCounter, type, color, speed,
          x: Math.random() * this.w, y: Math.random() * this.h,
          tx: Math.random() * this.w, ty: Math.random() * this.h
        });
      }
    };

    spawn("Prey", "#a3e635", 0.5, 5); 
    spawn("Predator", "#dc2626", 0.7, 2); 
    
    const burg = this.globalData.burg;
    if (!burg || burg.pop_null === 0) {
      if (Math.random() < 0.3) spawn("Refugees", "#9ca3af", 0.3, 3);
      if (Math.random() < 0.2) spawn("Hermit", "#d97706", 0.2, 1);
    }

    const features = this.globalData.features || {};
    const routes = features.routes || [];
    if (routes.includes("Smuggler Route")) spawn("Smuggler", "#000000", 0.6, 2);
    if (routes.includes("Imperial Highway")) {
      spawn("Merchant", "#fbbf24", 0.4, 1);
      spawn("Patrol", "#1d4ed8", 0.5, 2);
    }
    if (Math.random() < 0.15) spawn("Anomaly", "#c026d3", 0.1, 1);
    
    // Cultists guard the POI temple
    if (features.poi) {
      spawn("Cultist", "#7e22ce", 0.3, 4);
      // Ensure they spawn right near the temple (the center)
      const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
      this.agents.forEach(a => {
        if (a.type === 'Cultist') {
          a.x = cx + (Math.random() * 10 - 5);
          a.y = cy + (Math.random() * 10 - 5);
        }
      });
    }

    if (this.globalData.isWarzone) {
      spawn("Refugee", "#d1d5db", 0.3, 8); // Lots of slow moving refugees
      spawn("Bandit", "#1f2937", 0.7, 4);  // Fast bandits hunting them
      
      // Cluster refugees near the south edge (fleeing)
      this.agents.forEach(a => {
        if (a.type === 'Refugee') {
          a.y = this.h - Math.floor(Math.random() * 20);
        }
      });
    }

    if (this.globalData.isFamine) {
      spawn("Cannibal", "#991b1b", 0.8, 5); // Aggressive fast cannibals
    }
  }

  private startSimulation() {
    this.simInterval = setInterval(() => {
      for (let a of this.agents) {
        const dx = a.tx - a.x, dy = a.ty - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 1) {
          a.tx = Math.max(0, Math.min(this.w - 1, a.x + (Math.random() - 0.5) * 40));
          a.ty = Math.max(0, Math.min(this.h - 1, a.y + (Math.random() - 0.5) * 40));
        } else {
          a.x += (dx / dist) * a.speed; a.y += (dy / dist) * a.speed;
        }
        if (a.type === "Predator") {
          let nearestPrey = null, pDist = 15;
          for (let p of this.agents) {
            if (p.type === "Prey") {
              const d = Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
              if (d < pDist) { pDist = d; nearestPrey = p; }
            }
          }
          if (nearestPrey) { a.tx = nearestPrey.x; a.ty = nearestPrey.y; }
        }
      }
    }, 100);
  }

  public getManifest(rx: number, ry: number) {
    const idx = ry * this.w + rx;
    const cellAgents = this.agents.filter(a => Math.abs(a.x - rx) < 2 && Math.abs(a.y - ry) < 2);
    
    return {
      level_3_seed: `${this.cellId}-${rx}-${ry}`,
      global_context: {
        biome_id: this.globalData.terrain?.biome || 0,
        crime_rate: this.globalData.burg ? this.globalData.burg.crime_rate : "Wilderness",
        faction_owner: this.globalData.burg ? (this.globalData.burg.occupier_faction_id || this.globalData.burg.faction_id) : "Unclaimed",
        isWarzone: this.globalData.isWarzone || false,
        isFamine: this.globalData.isFamine || false
      },
      environment: {
        base_terrain: this.mapData[idx] || 0,
        elevation: parseFloat((this.elevationMap[idx] || 0).toFixed(3)),
        vegetation_density: parseFloat((this.vegetationMap[idx] || 0).toFixed(3)),
        chaos_radiation: parseFloat((this.chaosMap[idx] || 0).toFixed(3)),
        infrastructure_mask: this.infraMap[idx] || 0
      },
      entities_present: cellAgents.map(a => ({
        type: a.type,
        state: "ROAMING",
        story_hook: `A ${a.type} navigating the local terrain.`
      }))
    };
  }

  public destroy() {
    if (this.simInterval) clearInterval(this.simInterval);
  }
}
