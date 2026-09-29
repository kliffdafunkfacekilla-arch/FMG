import pool from '../db/pool';
import { calculateSolarDeclination, calculateInsolation } from './mathUtils';

interface TickParameters {
  seed: string;
  ticksToAdvance: number;
}

/**
 * Executes a planetary simulation tick, advancing time, updating climate vectors, and recalculating seasonal gradients.
 */
export async function advancePlanetaryTick(params: TickParameters) {
  const client = await pool.connect();
  try {
    console.log(`Advancing planetary simulation by ${params.ticksToAdvance} tick(s) for seed: ${params.seed}...`);
    await client.query('BEGIN');

    // 1. Fetch current world metadata parameters
    const metadataQuery = await client.query(
      `SELECT current_tick, days_per_year, axial_tilt FROM world_metadata WHERE seed = $1`,
      [params.seed]
    );

    if (metadataQuery.rows.length === 0) {
      throw new Error(`World metadata not found for seed: ${params.seed}`);
    }

    const metadata = metadataQuery.rows[0];
    const newTick = parseInt(metadata.current_tick) + params.ticksToAdvance;
    const currentDayOfYear = Math.floor((newTick / 24) % metadata.days_per_year);

    // 2. Calculate updated solar declination for the current day of the year
    const solarDeclination = calculateSolarDeclination(
      currentDayOfYear, 
      metadata.days_per_year, 
      metadata.axial_tilt
    );

    // 3. Fetch and update all global cell climate parameters
    const globalCells = await client.query(
      `SELECT cell_id, lat_lon, elevation FROM global_cells WHERE seed = $1`,
      [params.seed]
    );

    for (const cell of globalCells.rows) {
      const lat = cell.lat_lon[0];
      const insolation = calculateInsolation(lat, solarDeclination);
      
      const baseMaxTemp = 35.0;
      const baseMinTemp = -25.0;
      const baseTemp = baseMaxTemp - (baseMaxTemp - baseMinTemp) * Math.abs(lat / 90);
      const updatedTemp = parseFloat((baseTemp + (insolation * 18.0) - (cell.elevation * 6.5)).toFixed(2));

      await client.query(
        `UPDATE global_cells SET base_weekly_temp = $1 WHERE cell_id = $2 AND seed = $3`,
        [updatedTemp, cell.cell_id, params.seed]
      );
    }

    // 4. Update world metadata current tick counter
    await client.query(
      `UPDATE world_metadata SET current_tick = $1 WHERE seed = $2`,
      [newTick, params.seed]
    );

    await client.query('COMMIT');
    console.log(`Planetary tick successfully advanced to tick: ${newTick} (Day of Year: ${currentDayOfYear}).`);
    
    return {
      status: 'success',
      currentTick: newTick,
      dayOfYear: currentDayOfYear,
      solarDeclination: parseFloat(solarDeclination.toFixed(4))
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Planetary tick execution failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

