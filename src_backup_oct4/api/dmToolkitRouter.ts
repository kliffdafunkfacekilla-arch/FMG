import pool from '../db/pool';

interface WorldEditParams {
  seed: string;
  axialTilt?: number;
  daysPerYear?: number;
}

/**
 * Updates core world metadata parameters (World Editing Console).
 */
export async function editWorldMetadata(params: WorldEditParams) {
  const client = await pool.connect();
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.axialTilt !== undefined) {
      updates.push(`axial_tilt = $${paramIndex++}`);
      values.push(params.axialTilt);
    }
    if (params.daysPerYear !== undefined) {
      updates.push(`days_per_year = $${paramIndex++}`);
      values.push(params.daysPerYear);
    }

    values.push(params.seed);
    const query = `UPDATE world_metadata SET ${updates.join(', ')} WHERE seed = $${paramIndex}`;

    await client.query(query, values);
    console.log(`World metadata updated for seed: ${params.seed}`);
  } finally {
    client.release();
  }
}

/**
 * Deep Inspection Tool: Extracts all details, active events, lore, and NPC setups for a clicked coordinate (DM Brief).
 */
export async function getDmCellBrief(seed: string, globalId: number, regX: number, regY: number) {
  const client = await pool.connect();
  try {
    // 1. Fetch Regional and Global Cell Environment Data
    const cellQuery = await client.query(
      `SELECT r.*, g.chaos_intensity as global_chaos, g.elevation as global_elevation
       FROM regional_cells r
       JOIN global_cells g ON r.global_cell_id = g.cell_id
       WHERE g.seed = $1 AND g.cell_id = $2 AND r.local_x = $3 AND r.local_y = $4`,
      [seed, globalId, regX, regY]
    );

    if (cellQuery.rows.length === 0) {
      return { status: 'error', message: 'Coordinate out of bounds or sub-grid not generated.' };
    }

    const cellData = cellQuery.rows[0];

    // 2. Fetch Active Events / Famine logs
    const eventsQuery = await client.query(
      `SELECT headline, description, event_type FROM campaign_event_logs WHERE seed = $1`,
      [seed]
    );

    // 3. Fetch Associated Lore
    const loreQuery = await client.query(
      `SELECT title, category, content FROM world_lore WHERE seed = $1`,
      [seed]
    );

    // 4. Synthesize DM Brief Output
    return {
      status: 'success',
      coordinates: { globalId, regX, regY },
      environment: {
        elevation: cellData.elevation,
        moisture: cellData.moisture,
        temperature: cellData.temperature,
        biomeId: cellData.biome_id,
        chaosIntensity: cellData.chaos_intensity
      },
      storyHooks: eventsQuery.rows,
      loreSnippets: loreQuery.rows,
      dmPromptSuggestion: `The players arrive at coordinate [${regX}, ${regY}] within Global Cell ${globalId}. Biome ID is ${cellData.biome_id} with a chaos intensity of ${cellData.chaos_intensity}. Incorporate active campaign events to drive immediate roleplay tension.`
    };
  } finally {
    client.release();
  }
}

