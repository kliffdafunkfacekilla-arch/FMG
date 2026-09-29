import { createNoise2D } from 'simplex-noise';

// Simple seeded PRNG (Mulberry32)
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export async function fetchGlobalContext(client: any, cell_id: number) {
  // Get Target Cell
  const cellRes = await client.query('SELECT * FROM sim_cells WHERE id = $1', [cell_id]);
  if (cellRes.rows.length === 0) throw new Error("Cell not found");
  const cell = cellRes.rows[0];

  // Get Burgs in this cell
  const burgsRes = await client.query('SELECT * FROM sim_burg_economy WHERE cell_id = $1', [cell_id]);
  const burgs = burgsRes.rows;

  // Get Infrastructure for those burgs
  const infraMap = new Map<number, string[]>();
  if (burgs.length > 0) {
    const burgIds = burgs.map((b: any) => b.burg_id);
    const placeholders = burgIds.map((_: any, i: number) => `$${i+1}`).join(',');
    const infraRes = await client.query(`SELECT * FROM sim_infrastructure WHERE burg_id IN (${placeholders})`, burgIds);
    for (const r of infraRes.rows) {
      if (!infraMap.has(r.burg_id)) infraMap.set(r.burg_id, []);
      infraMap.get(r.burg_id)!.push(r.type);
    }
  }

  // Get Neighbors (6 closest)
  const neighborsRes = await client.query(`
    SELECT * FROM sim_cells 
    WHERE id != $1 
    ORDER BY POWER(center_x - $2, 2) + POWER(center_y - $3, 2) ASC 
    LIMIT 6
  `, [cell_id, cell.center_x, cell.center_y]);

  // Get nearest Burg globally to calculate Civilization Score
  const nearestBurgRes = await client.query(`
    SELECT b.*, c.center_x as burg_x, c.center_y as burg_y,
           POWER(c.center_x - $1, 2) + POWER(c.center_y - $2, 2) as dist_sq,
           c.faction_id, f.name as faction_name
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    LEFT JOIN sim_factions f ON c.faction_id = f.id
    ORDER BY dist_sq ASC
    LIMIT 1
  `, [cell.center_x, cell.center_y]);

  return {
    cell,
    neighbors: neighborsRes.rows,
    burgs: burgs.map((b: any) => ({ ...b, infrastructure: infraMap.get(b.burg_id) || [] })),
    nearestBurg: nearestBurgRes.rows[0] || null,
  };
}

const FIRST_NAMES = ["Kael", "Vane", "Jor", "Tav", "Elrin", "Thal", "Ryn", "Bram", "Cael", "Dorn", "Garr", "Hald", "Ily", "Kira", "Lyra", "Mael", "Nyx", "Orin", "Phane", "Quin"];
const LAST_NAMES = ["Iron", "Storm", "Void", "Ash", "Weaver", "Gale", "Stone", "Vane", "Black", "Dawn", "Frost", "Pyre", "Tide"];
const TRAITS = ["Pragmatic", "Zealous", "Paranoid", "Cruel", "Generous", "Cowardly", "Ambitious", "Vengeful", "Stoic", "Erratic", "Loyal", "Deceitful", "Superstitious", "Brilliant"];
const MOTIVES = [
   "Paying off a massive debt to the Gilded Compass.",
   "Hiding from the Ghostwind Raiders.",
   "Secretly worshipping one of the 13 Cults.",
   "Trying to amass enough wealth to move to the capital.",
   "Seeking revenge against a rival faction.",
   "Desperately trying to protect their family from the wilderness.",
   "Waiting for a sign from the Wardens.",
   "Plotting a minor rebellion against local taxes.",
   "Smuggling artifacts out of the Chaos Zones.",
   "Protecting a terrible secret buried beneath the floorboards."
];

function generateNPC(prng: () => number, role: string, faction: string) {
   const first = FIRST_NAMES[Math.floor(prng() * FIRST_NAMES.length)];
   const last = LAST_NAMES[Math.floor(prng() * LAST_NAMES.length)];
   const trait1 = TRAITS[Math.floor(prng() * TRAITS.length)];
   let trait2 = TRAITS[Math.floor(prng() * TRAITS.length)];
   while(trait1 === trait2) trait2 = TRAITS[Math.floor(prng() * TRAITS.length)];
   const motive = MOTIVES[Math.floor(prng() * MOTIVES.length)];
   
   return {
      id: `meso_npc_${Math.floor(prng() * 999999999)}`,
      name: `${first} ${last}`,
      role: role,
      traits: [trait1, trait2],
      motive: motive,
      status: "UNREALIZED"
   };
}

export function generateRegionGrid(context: any) {
  const SIZE = 200;
  const grid = new Array(SIZE);
  
  // Seed the generator deterministically based on the cell ID
  // This guarantees PERSISTENCE! The terrain will always be exactly the same for this cell.
  const prng = mulberry32(context.cell.id * 1234567);
  const noise2D = createNoise2D(prng);
  const blendNoise2D = createNoise2D(() => prng() + 0.1); // Shifted seed for edge blending

  // Calculate angles for neighbors
  const neighborsWithAngles = context.neighbors.map((n: any) => {
    const dx = n.center_x - context.cell.center_x;
    const dy = n.center_y - context.cell.center_y;
    return {
      ...n,
      angle: Math.atan2(dy, dx)
    };
  });

  const centerBiome = context.cell.biome;

  // Generate Base Terrain
  for (let y = 0; y < SIZE; y++) {
    grid[y] = new Array(SIZE);
    for (let x = 0; x < SIZE; x++) {
      const nx = x / 40;
      const ny = y / 40;
      
      // Organic Voronoi Blending Math for Biomes and Elevation
      const MAX_DIST = SIZE / 2;
      const cx = x - MAX_DIST;
      const cy = y - MAX_DIST;
      const distFromCenter = Math.sqrt(cx*cx + cy*cy);
      
      // Macro-Elevation Interpolation
      let baseElevation = parseFloat(context.cell.elevation || 0);
      let weightSum = 1.0 / (distFromCenter + 1);
      baseElevation *= weightSum;

      for (let i = 0; i < neighborsWithAngles.length; i++) {
         const n = neighborsWithAngles[i];
         const vx = MAX_DIST + Math.cos(n.angle) * (MAX_DIST * 1.5);
         const vy = MAX_DIST + Math.sin(n.angle) * (MAX_DIST * 1.5);
         const dx = x - vx;
         const dy = y - vy;
         const distToNeighbor = Math.sqrt(dx*dx + dy*dy);
         const weight = 1.0 / (distToNeighbor + 1);
         baseElevation += parseFloat(n.elevation || 0) * weight;
         weightSum += weight;
      }
      baseElevation /= weightSum;
      
      // Normalize Azgaar 0-100 height to -1.0 to 1.0
      let normalizedElevation = 0;
      if (baseElevation >= 20) {
        normalizedElevation = (baseElevation - 20) / 80.0; // 20->0, 100->1
      } else {
        normalizedElevation = (baseElevation - 20) / 20.0; // 20->0, 0->-1
      }
      
      // Add Micro-Noise
      const microNoise = noise2D(nx, ny) * 0.2; // +/- 0.2 bumpiness
      const elevation = Math.max(-1.0, Math.min(1.0, normalizedElevation + microNoise));

      let finalBiome = centerBiome;
      
      // We calculate a competitive "weight" for the center vs all 6 neighbors.
      // Base weight relies on distance, while heavy noise creates organic peninsulas.
      const centerNoise = blendNoise2D(x / 25, y / 25) * 25;
      let maxWeight = (MAX_DIST * 1.2) - distFromCenter + centerNoise;
      
      for (let i = 0; i < neighborsWithAngles.length; i++) {
         const n = neighborsWithAngles[i];
         // Project virtual neighbor coordinates off the edge of the grid
         const vx = MAX_DIST + Math.cos(n.angle) * (MAX_DIST * 1.15);
         const vy = MAX_DIST + Math.sin(n.angle) * (MAX_DIST * 1.15);
         
         const dx = x - vx;
         const dy = y - vy;
         const distToNeighbor = Math.sqrt(dx*dx + dy*dy);
         
         // Offset the noise slightly per neighbor so boundaries interlock
         const nNoise = blendNoise2D((x + i*100) / 25, (y + i*100) / 25) * 25;
         const nWeight = MAX_DIST - distToNeighbor + nNoise;
         
         if (nWeight > maxWeight) {
             maxWeight = nWeight;
             finalBiome = n.biome;
         }
      }

      grid[y][x] = {
        elevation: parseFloat(elevation.toFixed(2)),
        biome: finalBiome,
        type: 'WILDERNESS'
      };
    }
  }

  // Place Burgs (POIs)
  const burgPois = [];
  if (context.burgs.length > 0) {
    const burg = context.burgs[0]; 
    const pop = burg.pop_null || 0;
    
    // Map pop to radius. e.g. 5000 pop = radius 7 (~140m across)
    const cityRadius = Math.max(3, Math.min(15, Math.floor(Math.sqrt(pop) / 10)));
    
    // We can use the seeded PRNG to place the city slightly off-center if we wanted, 
    // but center is fine for now.
    const cityX = SIZE / 2;
    const cityY = SIZE / 2;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.sqrt(Math.pow(x - cityX, 2) + Math.pow(y - cityY, 2));
        if (d <= cityRadius) {
          grid[y][x].type = 'CITY';
        } else if (d <= cityRadius + 2 && prng() > 0.4) {
          grid[y][x].type = 'SUBURB';
        }
      }
    }

    // Organic Winding Roads
    // Instead of straight lines, we use noise to wobble the road path.
    const drawWobblyRoad = (startX: number, startY: number, dx: number, dy: number) => {
      let curX = startX;
      let curY = startY;
      for (let step = 0; step < SIZE / 2; step++) {
        curX += dx;
        curY += dy;
        // Add a wobble perpendicular to the direction
        const wobble = Math.round(noise2D(curX / 30, curY / 30) * 1.5);
        
        let roadX = curX + (dy !== 0 ? wobble : 0);
        let roadY = curY + (dx !== 0 ? wobble : 0);
        
        if (roadX >= 0 && roadX < SIZE && roadY >= 0 && roadY < SIZE) {
          grid[roadY][roadX].type = 'ROAD';
          // Make road 2 pixels wide to prevent gaps from wobble
          if (roadX + 1 < SIZE) grid[roadY][roadX + 1].type = 'ROAD';
        }
      }
    };

    drawWobblyRoad(cityX, cityY, 0, -1); // North
    drawWobblyRoad(cityX, cityY, 0, 1);  // South
    drawWobblyRoad(cityX, cityY, -1, 0); // West
    drawWobblyRoad(cityX, cityY, 1, 0);  // East

    burgPois.push({
      x: cityX,
      y: cityY,
      type: 'BURG',
      data: burg
    });
  }

  // Civilization Score logic
  // dist_sq of 0 is center. dist_sq of 100 is 10 units away. 
  // Let's define civScore from 0.0 to 1.0 based on distance
  const distSq = context.nearestBurg ? context.nearestBurg.dist_sq : 999999;
  const maxCivDistSq = 2500; // e.g. 50 units away
  const civScore = Math.max(0, 1.0 - Math.min(1.0, distSq / maxCivDistSq));

  const pois: any[] = [];
  
  // Scatter POIs across the map using the PRNG
  const numPois = 5 + Math.floor(prng() * 15);
  for (let i = 0; i < numPois; i++) {
     const px = Math.floor(prng() * SIZE);
     const py = Math.floor(prng() * SIZE);
     const cellAt = grid[py][px];
     
     if (cellAt.type === 'WILDERNESS') {
         let poiType = "UNKNOWN";
         let label = "";
         let color = "";
         const roll = prng();
         let population: any = {};
         const rFaction = context.nearestBurg ? (context.nearestBurg.faction_name || "Independent") : "Independent";
         
         if (civScore > 0.6) {
             let leaderRole = "Elder";
             if (roll < 0.4) { 
                 poiType = "HAMLET"; label = "Hamlet"; color = "#a67c52"; leaderRole = "Elder";
                 const total = 20 + Math.floor(prng()*30);
                 population = { total, faction: rFaction, occupations: [`1x ${leaderRole}`, `${Math.floor(total*0.8)}x Commoners`, `${Math.floor(total*0.2)}x Militia`] };
             }
             else if (roll < 0.7) { 
                 poiType = "LUMBER_CAMP"; label = "Logging Camp"; color = "#7a5c3d"; leaderRole = "Foreman";
                 const total = 10 + Math.floor(prng()*15);
                 population = { total, faction: rFaction, occupations: [`1x ${leaderRole}`, `${total-1}x Laborers`] };
             }
             else if (roll < 0.9) { 
                 poiType = "FARM"; label = "Farmstead"; color = "#d4b86a"; leaderRole = "Patriarch/Matriarch";
                 const total = 5 + Math.floor(prng()*10);
                 population = { total, faction: rFaction, occupations: [`1x ${leaderRole}`, `${total-1}x Farmhands`] };
             }
             else { 
                 poiType = "PATROL"; label = "Military Patrol"; color = "#8a0303"; leaderRole = "Captain";
                 const total = 5 + Math.floor(prng()*5);
                 population = { total, faction: rFaction, occupations: [`1x ${leaderRole}`, `${total-1}x Soldiers`] };
             }
             population.leader = generateNPC(prng, leaderRole, rFaction);
         } else if (civScore > 0.2) {
             let leaderRole = "Speaker";
             if (roll < 0.3) { 
                 poiType = "FRONTIER_VILLAGE"; label = "Frontier Village"; color = "#8b7355"; leaderRole = "Speaker";
                 const total = 15 + Math.floor(prng()*20);
                 population = { total, faction: "Independent Frontier", occupations: [`1x ${leaderRole}`, `${Math.floor(total*0.7)}x Pioneers`, `${Math.floor(total*0.3)}x Hunters`] };
             }
             else if (roll < 0.5) { 
                 poiType = "TRAPPER_CABIN"; label = "Trapper Cabin"; color = "#6b543c"; leaderRole = "Master Trapper";
                 const total = 1 + Math.floor(prng()*3);
                 population = { total, faction: "Independent", occupations: [`${total}x Trappers`] };
             }
             else if (roll < 0.8) { 
                 poiType = "BANDIT_CAMP"; label = "Bandit Camp"; color = "#3a3a3a"; leaderRole = "Bandit Chief";
                 const total = 10 + Math.floor(prng()*20);
                 population = { total, faction: "Ghostwind Raiders", occupations: [`1x ${leaderRole}`, `${Math.floor(total*0.2)}x Scouts`, `${Math.floor(total*0.8)-1}x Cutthroats`] };
             }
             else { 
                 poiType = "CARAVAN"; label = "Trading Caravan"; color = "#b8860b"; leaderRole = "Merchant Lord";
                 const total = 8 + Math.floor(prng()*12);
                 population = { total, faction: rFaction, occupations: [`1x ${leaderRole}`, `${Math.floor(total*0.6)}x Guards`, `${Math.floor(total*0.4)-1}x Handlers`] };
             }
             population.leader = generateNPC(prng, leaderRole, population.faction);
         } else {
             let leaderRole = "Wanderer";
             if (roll < 0.4) { 
                 poiType = "ANCIENT_RUIN"; label = "Ancient Ruins"; color = "#4f4f4f"; leaderRole = "Lost Explorer";
                 population = { total: 0, faction: "None", occupations: [] };
             }
             else if (roll < 0.6) { 
                 poiType = "HERMIT_CAVE"; label = "Hermit's Cave"; color = "#5c5c5c"; leaderRole = "Mad Sage";
                 population = { total: 1, faction: "Outcast", occupations: [`1x ${leaderRole}`] };
             }
             else if (roll < 0.8) { 
                 poiType = "CULTIST_ALTAR"; label = "Cultist Altar"; color = "#4a0052"; leaderRole = "High Priest";
                 const total = 5 + Math.floor(prng()*15);
                 population = { total, faction: "Cult of the Null-Equation", occupations: [`1x ${leaderRole}`, `${total-1}x Zealots`] };
             }
             else { 
                 poiType = "APEX_DEN"; label = "Apex Predator Den"; color = "#2e1a1a"; leaderRole = "Alpha Beast";
                 const total = 1 + Math.floor(prng()*4);
                 population = { total, faction: "Wilderness", occupations: [`${total}x Quake-Stalkers`] };
             }
             if (poiType !== "ANCIENT_RUIN" && poiType !== "APEX_DEN") {
                 population.leader = generateNPC(prng, leaderRole, population.faction);
             }
         }
         pois.push({ x: px, y: py, type: poiType, label, color, population });
     }
  }

  return {
    grid_size: SIZE,
    civ_score: civScore,
    pois,
    context: {
      temperature: context.cell.current_temp,
      base_temp: context.cell.base_temp,
      ecology: {
        plants: context.cell.eco_plants,
        prey: context.cell.eco_prey,
        predators: context.cell.eco_predators
      }
    },
    grid
  };
}
