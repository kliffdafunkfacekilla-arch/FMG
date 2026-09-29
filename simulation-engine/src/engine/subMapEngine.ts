import pool from '../db/pool';
import { createNoise2D } from 'simplex-noise';

interface SubMapParameters {
  localId: number;
  mapType?: string; // Optional override, otherwise derives from DB
  width: number;
  height: number;
}

export async function generateSubMapInterior(params: SubMapParameters) {
  try {
    let finalMapType = params.mapType || 'GRASSLAND';
    let isOcean = false;

    // Try to derive biome from regional cell if localId exists
    const localRes = await pool.query('SELECT regional_id, elevation FROM local_cells WHERE local_id = $1', [params.localId]);
    if (localRes.rows.length > 0) {
        const regionalId = localRes.rows[0].regional_id;
        const elevation = localRes.rows[0].elevation;
        const regRes = await pool.query('SELECT biome_id, temperature, moisture FROM regional_cells WHERE regional_id = $1', [regionalId]);
        if (regRes.rows.length > 0) {
            const reg = regRes.rows[0];
            // Infer biome based on elevation and typical FMG data if biome_id is generic
            if (elevation < 0) {
                isOcean = true;
                if (elevation < -0.8) finalMapType = 'DEEP_OCEAN';
                else if (reg.temperature > 20) finalMapType = 'CORAL_REEF';
                else if (reg.temperature < 0) finalMapType = 'FROZEN_OCEAN';
                else finalMapType = 'KELP_FOREST';
            } else {
                if (elevation > 0.8) finalMapType = 'MOUNTAIN';
                else if (reg.temperature < 0) finalMapType = 'SNOW';
                else if (reg.temperature > 30 && reg.moisture < 0.2) finalMapType = 'DESERT';
                else if (reg.temperature > 25 && reg.moisture > 0.7) finalMapType = 'JUNGLE';
                else if (reg.moisture > 0.8) finalMapType = 'SWAMP';
                else if (reg.moisture > 0.5) finalMapType = 'FOREST';
                else finalMapType = 'GRASSLAND';
            }
        }
    }

    const noise2D = createNoise2D();
    const gridSquares = [];
    const scale = 0.15; // Noise frequency

    for (let x = 0; x < params.width; x++) {
      for (let y = 0; y < params.height; y++) {
        // Map edges are more likely to be open if wilderness, but let's just do organic scattering
        const noiseVal = noise2D(x * scale + params.localId, y * scale + params.localId); // Use localId as seed offset
        
        let terrain = 'FLOOR';
        
        if (finalMapType === 'DUNGEON' || finalMapType === 'CAVE') {
            const isEdge = (x === 0 || x === params.width - 1 || y === 0 || y === params.height - 1);
            if (isEdge || noiseVal > 0.4) terrain = 'WALL';
        } else {
            // Wilderness organic obstacles (trees, rocks, coral, kelp)
            if (noiseVal > 0.35) terrain = 'WALL';
        }

        gridSquares.push({
          x,
          y,
          terrain,
          cover: terrain === 'WALL' ? 2 : 0
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO interior_sub_maps (local_id, map_type, grid_width, grid_height, layout_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING sub_map_id;`,
      [params.localId, finalMapType, params.width, params.height, JSON.stringify(gridSquares)]
    );

    const subMapId = result.rows[0].sub_map_id;

    // Phase 7: Spawn Procedural Entities
    const numNpcs = Math.floor(Math.random() * 3) + 1; // Spawn 1-3 NPCs
    const enemyTypes = {
      'DUNGEON': 'Skeleton Guard',
      'CORAL_REEF': 'Razorfin Shark',
      'FROZEN_OCEAN': 'Abyssal Ghoul',
      'KELP_FOREST': 'Triton Hunter',
      'DEEP_OCEAN': 'Kraken Spawn',
      'DESERT': 'Sandworm Hatchling',
      'JUNGLE': 'Jaguar Warrior',
      'SWAMP': 'Bog Hag',
      'FOREST': 'Dire Wolf',
      'MOUNTAIN': 'Stone Golem',
      'SNOW': 'Frost Troll',
      'GRASSLAND': 'Bandit Scout',
      'CAVE': 'Cave Spider'
    };
    const npcName = enemyTypes[finalMapType as keyof typeof enemyTypes] || 'Wandering Monster';

    for (let i = 0; i < numNpcs; i++) {
      let nx = Math.floor(Math.random() * (params.width - 4)) + 2;
      let ny = Math.floor(Math.random() * (params.height - 4)) + 2;
      // Note: we don't strictly check if nx,ny is a WALL here for simplicity of the prototype, 
      // but in a perfect world we would.
      await pool.query(
        `INSERT INTO npc_entities (sub_map_id, name, hp_current, hp_max, grid_x, grid_y, behavior_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [subMapId, npcName + ' ' + (i+1), 30, 30, nx, ny, 'HOSTILE']
      );
    }

    console.log(`Generated organic map (${finalMapType}) with ID: ${subMapId} and ${numNpcs} NPCs.`);
    return subMapId;
  } catch (error) {
    console.error('Failed to generate interior sub-map:', error);
    throw error;
  }
}
