// Very simple seeded PRNG
function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

function hashString(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return h;
}

// Simple smooth noise for organic generation
function smoothNoise(x: number, y: number, rand: () => number) {
  return rand(); // Placeholder, we will do cellular automata smoothing
}

export function generateLevel3Map(manifest: any) {
  const SIZE = 256;
  const grid = new Uint8Array(SIZE * SIZE);
  
  // Seed the PRNG
  const seed = hashString(manifest.level_3_seed);
  const rand = sfc32(seed, seed ^ 0xDEADBEEF, seed ^ 0xCAFEBABE, seed ^ 0x12345678);

  const { elevation, vegetation_density, base_terrain, infrastructure_mask, chaos_radiation } = manifest.environment;
  
  // 1. Base Layer & Organic Clusters (Cellular Automata)
  for (let i = 0; i < SIZE * SIZE; i++) {
    grid[i] = rand() < vegetation_density ? 1 : 0;
  }
  
  // Smooth it out 3 times to make organic forests and glades
  for(let pass = 0; pass < 3; pass++) {
    const newGrid = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let neighbors = 0;
        for(let dy=-1; dy<=1; dy++){
          for(let dx=-1; dx<=1; dx++){
            const nx = x+dx, ny = y+dy;
            if(nx>=0 && nx<SIZE && ny>=0 && ny<SIZE) {
              if(grid[ny*SIZE+nx] === 1) neighbors++;
            }
          }
        }
        newGrid[y*SIZE+x] = neighbors >= 5 ? 1 : 0;
      }
    }
    grid.set(newGrid);
  }

  // 2. Add Water (Ponds / Rivers) if elevation is low or base is water
  if (base_terrain === 3 || elevation < 0.2) {
    let wx = Math.floor(SIZE / 2);
    let wy = Math.floor(SIZE / 2);
    const wSize = base_terrain === 3 ? 120 : 30; // Massive lake if water, small pond if low elevation
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (Math.pow(x - wx, 2) + Math.pow(y - wy, 2) < Math.pow(wSize + rand()*10, 2)) {
          grid[y * SIZE + x] = 2; // Water
        }
      }
    }
  }

  // 3. Draw infrastructure (Roads / Smuggler Paths)
  if (infrastructure_mask === 2 || infrastructure_mask === 4) {
    let px = Math.floor(SIZE / 2) - 20;
    for (let py = 0; py < SIZE; py++) {
      if (rand() < 0.1) px += (rand() > 0.5 ? 1 : -1);
      const width = infrastructure_mask === 2 ? 4 : 2; // Highway is wide, Smuggler is narrow
      for (let dx = -width; dx <= width; dx++) {
        const x = px + dx;
        if (x >= 0 && x < SIZE) grid[py * SIZE + x] = 3; 
      }
    }
  }

  // 4. City Generation (If Urban cell)
  if (base_terrain === 4) {
    // Carve a grid of streets and blocky buildings
    for (let y = 20; y < SIZE - 20; y++) {
      for (let x = 20; x < SIZE - 20; x++) {
        if (x % 30 < 6 || y % 30 < 6) {
          grid[y * SIZE + x] = 3; // Cobblestone Street
        } else if (rand() < 0.8) {
          grid[y * SIZE + x] = 4; // Building Wall/Roof
        } else {
          grid[y * SIZE + x] = 0; // Courtyard
        }
      }
    }
  }

  // 5. Unique POI / Ruins (If POI mask is present)
  if (infrastructure_mask === 8) {
    const cx = Math.floor(SIZE/2);
    const cy = Math.floor(SIZE/2);
    // Draw a mysterious geometric temple/ruin
    for (let y = cy - 25; y <= cy + 25; y++) {
      for (let x = cx - 25; x <= cx + 25; x++) {
        if (Math.abs(x - cx) === 25 || Math.abs(y - cy) === 25) {
          grid[y*SIZE+x] = 5; // Ruin Walls
        } else if (x % 5 === 0 && y % 5 === 0) {
          grid[y*SIZE+x] = 5; // Pillars
        } else {
          grid[y*SIZE+x] = 3; // Stone floor
        }
      }
    }
    // Chaos altar in middle
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) grid[y*SIZE+x] = 6; // Chaos core
    }
  }

  // 6. Ruined Outskirts / Cultist Camps (If infra === 16)
  if (infrastructure_mask === 16) {
    // Scatter ruined pillars, rubble, and campfires
    for (let i = 0; i < 200; i++) {
      const rx = Math.floor(rand() * SIZE);
      const ry = Math.floor(rand() * SIZE);
      grid[ry*SIZE + rx] = 5; // Rubble
    }
    // A few small tents/campfires
    for (let i = 0; i < 5; i++) {
      const cx = 20 + Math.floor(rand() * (SIZE - 40));
      const cy = 20 + Math.floor(rand() * (SIZE - 40));
      for (let y = cy - 2; y <= cy + 2; y++) {
        for (let x = cx - 2; x <= cx + 2; x++) grid[y*SIZE+x] = 7; 
      }
      grid[cy*SIZE+cx] = 8; // Campfire
    }
  }

  // 7. Famine Macabre Camps (If infra === 32)
  if (infrastructure_mask === 32) {
    // Blood-stained earth and bone totems
    for (let i = 0; i < 300; i++) {
      const rx = Math.floor(rand() * SIZE);
      const ry = Math.floor(rand() * SIZE);
      grid[ry*SIZE + rx] = 9; // Blood/Gore
    }
    for (let i = 0; i < 15; i++) {
      const cx = 10 + Math.floor(rand() * (SIZE - 20));
      const cy = 10 + Math.floor(rand() * (SIZE - 20));
      grid[cy*SIZE+cx] = 10; // Bone Totem
    }
  }

  // 8. Refugee Camps (If infra === 64)
  if (infrastructure_mask === 64) {
    // Massive cluster of dirty tents and mud paths
    for (let i = 0; i < 40; i++) {
      const cx = Math.floor(rand() * SIZE);
      const cy = Math.floor(rand() * SIZE);
      // Mud patch
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y*SIZE+x] = 11; // Mud
        }
      }
      // Tents
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
           if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y*SIZE+x] = 7; // Tent
        }
      }
      if (rand() > 0.5) grid[cy*SIZE+cx] = 8; // Occasional Campfire
    }
  }

  // 9. Battlefield (If infra === 128)
  if (infrastructure_mask === 128) {
    // Craters, scorched earth, broken weapons
    for (let i = 0; i < 500; i++) {
      const rx = Math.floor(rand() * SIZE);
      const ry = Math.floor(rand() * SIZE);
      if (rand() > 0.5) grid[ry*SIZE + rx] = 12; // Scorched earth / Crater
      else grid[ry*SIZE + rx] = 5; // Rubble
    }
  }

  return { grid, size: SIZE };
}
