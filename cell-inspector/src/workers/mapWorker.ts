// Simple 2D Simplex Noise implementation
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

class SimplexNoise {
  private p: Uint8Array;
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  constructor(seed = 1) {
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    // In a real scenario, use a seeded PRNG. For now, Math.random is fine since we just want it to work.
    // Better yet, use a fast LCG based on the seed.
    let lcg = seed;
    const next = () => { lcg = (lcg * 1664525 + 1013904223) | 0; return (lcg >>> 0) / 4294967296; };
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(next() * 256);

    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = (this.perm[i] % 12);
    }
  }

  noise2D(xin: number, yin: number) {
    let n0, n1, n2; 
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t; 
    const Y0 = j - t; 
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.grad(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.grad(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.grad(gi2, x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  grad(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }
}

// Global scope for the worker
let mapData: Uint8Array;
let elevationMap: Float32Array;
let vegetationMap: Float32Array;
let chaosMap: Float32Array;
let infraMap: Uint8Array;
let agents: Array<any> = [];
let globalCellData: any = {};
let w = 225;
let h = 225;

self.onmessage = (e) => {
  if (e.data.type === "REQUEST_MANIFEST") {
    // Generate the Level 3 Manifest for a specific coordinate
    const { rx, ry } = e.data;
    const idx = ry * w + rx;
    
    const cellAgents = agents.filter(a => Math.abs(a.x - rx) < 2 && Math.abs(a.y - ry) < 2);
    
    const manifest = {
      level_3_seed: `${globalCellData.cellId}-${rx}-${ry}`,
      global_context: {
        biome_id: globalCellData.biomeId,
        crime_rate: globalCellData.burg ? globalCellData.burg.crime_rate : "Wilderness",
        faction_owner: globalCellData.burg ? globalCellData.burg.faction_id : "Unclaimed"
      },
      environment: {
        base_terrain: mapData[idx],
        elevation: parseFloat(elevationMap[idx].toFixed(3)),
        vegetation_density: parseFloat(vegetationMap[idx].toFixed(3)),
        chaos_radiation: parseFloat(chaosMap[idx].toFixed(3)),
        infrastructure_mask: infraMap[idx]
      },
      entities_present: cellAgents.map(a => ({
        type: a.type,
        state: "ROAMING",
        story_hook: `A ${a.type} navigating the local terrain.`
      }))
    };
    
    self.postMessage({ type: "MANIFEST_READY", manifest });
    return;
  }

  // Initial Generation
  globalCellData = e.data;
  const { cellId, biomeId, neighborBiomes, burg, gridWidth, gridHeight, features } = e.data;
  w = gridWidth;
  h = gridHeight;
  const numCells = w * h;
  
  // Parallel Data Layers
  mapData = new Uint8Array(numCells);
  elevationMap = new Float32Array(numCells);
  vegetationMap = new Float32Array(numCells);
  chaosMap = new Float32Array(numCells);
  infraMap = new Uint8Array(numCells);
  
  const eleNoise = new SimplexNoise(cellId || 1);
  const vegNoise = new SimplexNoise((cellId || 1) + 100);
  const chaosNoise = new SimplexNoise((cellId || 1) + 200);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const nx = x / 50; 
      const ny = y / 50;
      
      const ele = eleNoise.noise2D(nx, ny);
      const veg = vegNoise.noise2D(nx * 2, ny * 2);
      const cha = chaosNoise.noise2D(nx * 0.5, ny * 0.5);

      elevationMap[idx] = (ele + 1) / 2; // Normalize 0 to 1
      vegetationMap[idx] = (veg + 1) / 2;
      chaosMap[idx] = (cha + 1) / 2;

      // Base classification
      if (ele < -0.3) mapData[idx] = 3; // Water
      else if (veg > 0.6) mapData[idx] = 2; // Dense Feature
      else if (veg > 0.3) mapData[idx] = 1; // Feature
      else mapData[idx] = 0; // Base
    }
  }

  // If there's a burg, let's carve out an urban center
  if (burg) {
    const population = burg.pop_null !== undefined ? burg.pop_null : 0;
    
    if (population > 0) {
      // Calculate groups of 12
      const groupsOf12 = Math.floor(population / 12);
      // Simple placeholder: place urban tiles in the center based on size
      const cx = Math.floor(gridWidth / 2);
      const cy = Math.floor(gridHeight / 2);
      const radius = Math.min(Math.sqrt(groupsOf12), gridWidth / 3);

      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            // Inner core is pure urban, edges are scattered
            if (dist < radius * 0.5 || Math.random() < 0.5) {
              const idx = y * gridWidth + x;
              mapData[idx] = 4; // Urban
            }
          }
        }
      }
    }
  }

  // Read features from the payload
  const features = e.data.features || {};
  const routes = features.routes || [];
  const poi = features.poi;

  // Draw Imperial Highway
  if (routes.includes("Imperial Highway")) {
    const cx = Math.floor(gridWidth / 2);
    // Draw a thick road across the local map (simplified as a straight 10-pixel wide vertical/horizontal band)
    for (let y = 0; y < gridHeight; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        mapData[y * gridWidth + x] = 5; // Road
      }
    }
  }

  // Draw Smuggler Route
  if (routes.includes("Smuggler Route")) {
    // Draw a thin, winding invisible/dirt path
    for (let y = 0; y < gridHeight; y++) {
      const wiggle = Math.floor(Math.sin(y * 0.1) * 10);
      const px = Math.floor(gridWidth / 3) + wiggle;
      mapData[y * gridWidth + px] = 6; // Smuggler dirt path
      mapData[y * gridWidth + px + 1] = 6;
    }
  }

  // ----------------------------------------------------
  // MICRO-AGENT SIMULATION SETUP
  // ----------------------------------------------------
  const agents: Array<{ id: number, type: string, x: number, y: number, tx: number, ty: number, color: string, speed: number }> = [];
  let agentIdCounter = 0;

  const spawnAgent = (type: string, color: string, speed: number, count: number) => {
    for (let i = 0; i < count; i++) {
      agents.push({
        id: ++agentIdCounter,
        type,
        color,
        speed,
        x: Math.random() * gridWidth,
        y: Math.random() * gridHeight,
        tx: Math.random() * gridWidth,
        ty: Math.random() * gridHeight
      });
    }
  };

  // 1. Ecology (Animals)
  // Assuming a baseline of 5 prey and 1 predator for wilderness
  spawnAgent("Prey", "#a3e635", 0.5, 5); // Green-ish fast prey
  spawnAgent("Predator", "#dc2626", 0.7, 2); // Red fast predators

  // 2. Transients (Refugees / Deserters / Nomads)
  // If no burg, maybe there are people hiding in the wild
  if (!burg || burg.pop_null === 0) {
    if (Math.random() < 0.3) spawnAgent("Refugees", "#9ca3af", 0.3, 3); // Grey, slow
    if (Math.random() < 0.2) spawnAgent("Hermit", "#d97706", 0.2, 1);
  }

  // 3. Fringes & Traffic
  if (routes.includes("Smuggler Route")) {
    spawnAgent("Smuggler", "#000000", 0.6, 2); // Black, stealthy
  }
  if (routes.includes("Imperial Highway")) {
    spawnAgent("Merchant", "#fbbf24", 0.4, 1); // Gold, on roads
    spawnAgent("Patrol", "#1d4ed8", 0.5, 2); // Blue, guarding
  }

  // 4. Magical Anomalies
  // Even a 10% chance for weird wild magic to manifest as a roaming anomaly
  if (Math.random() < 0.15) {
    spawnAgent("Anomaly", "#c026d3", 0.1, 1); // Purple, slow floating
  }

  // Send the static map first
  self.postMessage({ type: "MAP_READY", mapData, gridWidth, gridHeight });

  // ----------------------------------------------------
  // THE TICK LOOP (Runs inside the worker)
  // ----------------------------------------------------
  if (self.simInterval) clearInterval(self.simInterval);
  self.simInterval = setInterval(() => {
    for (let a of agents) {
      // Very basic movement logic towards target (tx, ty)
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 1) {
        // Pick new target
        a.tx = Math.max(0, Math.min(gridWidth - 1, a.x + (Math.random() - 0.5) * 40));
        a.ty = Math.max(0, Math.min(gridHeight - 1, a.y + (Math.random() - 0.5) * 40));
      } else {
        a.x += (dx / dist) * a.speed;
        a.y += (dy / dist) * a.speed;
      }

      // Predators chase prey (simplified distance check)
      if (a.type === "Predator") {
        let nearestPrey = null;
        let pDist = 15; // vision radius
        for (let p of agents) {
          if (p.type === "Prey") {
            const d = Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
            if (d < pDist) { pDist = d; nearestPrey = p; }
          }
        }
        if (nearestPrey) {
          a.tx = nearestPrey.x;
          a.ty = nearestPrey.y;
        }
      }
    }
    
    // Send updated agent positions to the UI for rendering
    self.postMessage({ type: "AGENTS_UPDATE", agents });
  }, 100); // 10 ticks a second
};
