import pool from '../db/pool';
import { calculateSolarDeclination, calculateInsolation } from './mathUtils';

interface InitializeWorldParams {
  seed: string;
  resolution: number; // e.g., 10000 total global cells across faces
  axialTilt: number;
  daysPerYear: number;
}

export async function initializeWorldMesh(params: InitializeWorldParams) {
  const client = await pool.connect();
  try {
    console.log(`Starting world generation and D20 mesh seeding for seed: ${params.seed}...`);
    await client.query('BEGIN');

    // 1. Ensure root metadata record exists
    await client.query(
      `INSERT INTO world_metadata (seed, current_tick, hours_per_day, days_per_year, axial_tilt, solar_distance_multiplier, map_resolution)
       VALUES ($1, 0, 24.0, $2, $3, 1.0, $4)
       ON CONFLICT (seed) DO NOTHING;`,
      [params.seed, params.daysPerYear, params.axialTilt, params.resolution]
    );

    // 2. Generate Icosahedral D20 Macro Cells (Distributed across 20 triangular faces)
    const totalCells = params.resolution;
    const cellsPerFace = Math.floor(totalCells / 20);

    for (let face = 0; face < 20; face++) {
      for (let i = 0; i < cellsPerFace; i++) {
        const cellId = face * cellsPerFace + i;
        const lat = parseFloat(((Math.random() * 180) - 90).toFixed(4));
        const lon = parseFloat(((Math.random() * 360) - 180).toFixed(4));
        const elevation = parseFloat(((Math.random() * 2.0) - 1.0).toFixed(4)); // Range: -1.0 to 1.0
        const baseMoisture = parseFloat(Math.random().toFixed(4)); // Range: 0.0 to 1.0

        // Calculate baseline temperature using latitude and solar insolation
        const solarDeclination = calculateSolarDeclination(0, params.daysPerYear, params.axialTilt);
        const insolation = calculateInsolation(lat, solarDeclination);
        const baseMaxTemp = 35.0;
        const baseMinTemp = -25.0;
        const baseTemp = baseMaxTemp - (baseMaxTemp - baseMinTemp) * Math.abs(lat / 90);
        const seasonalTemp = baseTemp + (insolation * 15.0);
        const lapseRate = 6.5; // °C per km normalized
        const finalWeeklyTemp = parseFloat((seasonalTemp - (elevation * lapseRate)).toFixed(2));
        const tempWeeklySlope = 0.05;

        const chaosIntensity = 0.0;
        const realityWarpIndex = 0.0;
        const chaosVector = [0.0, 0.0];

        await client.query(
          `INSERT INTO global_cells 
           (cell_id, seed, face_index, lat_lon, elevation, base_moisture, base_weekly_temp, temp_weekly_slope, chaos_intensity, chaos_vector, reality_warp_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (cell_id) DO NOTHING;`,
          [
            cellId,
            params.seed,
            face,
            JSON.stringify([lat, lon]),
            elevation,
            baseMoisture,
            finalWeeklyTemp,
            tempWeeklySlope,
            chaosIntensity,
            JSON.stringify(chaosVector),
            realityWarpIndex
          ]
        );
      }
    }

    // 3. Anchor 13 Primordial Chaos Nodes (12 Sources at Vertices, 1 Sink at Center/Lowest Elevation)
    console.log('Anchoring 13 primordial chaos nodes...');
    for (let node = 1; node <= 13; node++) {
      const nodeType = node <= 12 ? 'source' : 'sink';
      const targetCellId = node <= 12 ? (node - 1) * Math.floor(cellsPerFace) : Math.floor(totalCells / 2);
      
      const cellRes = await client.query('SELECT lat_lon FROM global_cells WHERE cell_id = $1 AND seed = $2', [targetCellId, params.seed]);
      const coordinate = cellRes.rows[0]?.lat_lon || [0, 0];

      await client.query(
        `INSERT INTO chaos_nodes (node_id, seed, node_type, cell_id, coordinate)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (node_id) DO NOTHING;`,
        [node, params.seed, nodeType, targetCellId, JSON.stringify(coordinate)]
      );

      // Elevate chaos intensity on source/sink anchor cells
      await client.query(
        `UPDATE global_cells SET chaos_intensity = 1.0, reality_warp_index = 100.0 WHERE cell_id = $1 AND seed = $2`,
        [targetCellId, params.seed]
      );
    }

    await client.query('COMMIT');
    console.log(`World initialization mesh for seed '${params.seed}' completed successfully.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('World initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

