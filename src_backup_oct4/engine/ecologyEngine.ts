import pool from '../db/pool';
import { simulateCellEcology, detectEcologyAnomaly, CellEcologyState } from '../simulation/ecologyPure';

interface EcologicalVector {
  plants: number;     // Primary Producers (0.0 to 100.0)
  prey: number;       // Herbivores (0.0 to 100.0)
  predators: number;  // Carnivores (0.0 to 100.0)
  resources: number;  // Abiotic Yields (Stone, Water, Ores)
  status?: string;
}

/**
 * Executes the monthly trophic cycle simulation update for all local cells.
 */
export async function updateLocalEcologicalCycles(seed: string) {
  const client = await pool.connect();
  try {
    console.log(`Executing ecological trophic update for seed: ${seed}...`);
    await client.query('BEGIN');

    const calRes = await client.query('SELECT month FROM sim_calendar LIMIT 1');
    const month = calRes.rows[0]?.month || 1;

    // Fetch local cells and their current ecological vectors stored in JSONB
    const localCellsQuery = await client.query(
      `SELECT lc.local_id, lc.ecological_vector 
       FROM local_cells lc
       JOIN regional_cells rc ON lc.regional_id = rc.regional_id
       JOIN global_cells gc ON rc.global_cell_id = gc.cell_id
       WHERE gc.seed = $1`,
      [seed]
    );

    for (const cell of localCellsQuery.rows) {
      const eco: EcologicalVector = cell.ecological_vector || { plants: 50.0, prey: 25.0, predators: 10.0, resources: 100.0 };

      // Map to pure state
      const pureState: CellEcologyState = {
          eco_plants: eco.plants,
          eco_prey: eco.prey,
          eco_predators: eco.predators,
          eco_resources: eco.resources
      };

      // Compute differential updates through the pure function
      const newState = simulateCellEcology(pureState, 0, month);

      const updatedVector: EcologicalVector = {
        plants: newState.eco_plants,
        prey: newState.eco_prey,
        predators: newState.eco_predators,
        resources: newState.eco_resources || 100
      };

      // Check for migration or overabundance anomalies
      const anomalyTag = detectEcologyAnomaly(newState);

      // Update database record
      await client.query(
        `UPDATE local_cells SET ecological_vector = $1 WHERE local_id = $2`,
        [JSON.stringify({ ...updatedVector, status: anomalyTag }), cell.local_id]
      );
    }

    await client.query('COMMIT');
    console.log('Ecological trophic cycle tick successfully completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ecological simulation tick failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

