import pool from '../db/pool';

// The 12 Universal Constants Registry
export const UNIVERSAL_CONSTANTS = [
  'Mass', 'Ordo', 'Flux', 'Motus', 'Vita', 'Nexes', 
  'Anuminus', 'Ratio', 'Lux', 'Omen', 'Aura', 'Lex'
];

/**
 * Initializes population genetics (50/50 Attuned vs Null split) for a settlement.
 */
export async function populateSettlementGenetics(client: any, settlementId: number, citizenCount: number) {
  for (let i = 0; i < citizenCount; i++) {
    // 50% probability split between Null (immune to chaos) and Attuned (sensitive to leylines)
    const isNull = Math.random() < 0.5;
    const attunementLevel = isNull ? 0.0 : parseFloat((Math.random() * 0.9 + 0.1).toFixed(2));
    const chaosAttractionIndex = isNull ? 0.0 : parseFloat((attunementLevel * 10.0).toFixed(2));

    await client.query(
      `INSERT INTO population_demographics (settlement_id, name, is_null, attunement_level, chaos_attraction_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [settlementId, `Citizen_${i + 1}`, isNull, attunementLevel, chaosAttractionIndex]
    );
  }
}

/**
 * Executes the monthly cosmic shadow war and chaos attraction evaluation tick.
 */
export async function executeCosmicShadowWarTick(seed: string) {
  const client = await pool.connect();
  try {
    console.log(`Executing cosmic shadow war and chaos evaluation tick for seed: ${seed}...`);
    await client.query('BEGIN');

    // 1. Evaluate aggregate Chaos Attraction Index across settlements
    const settlementAttractionQuery = await client.query(
      `SELECT s.settlement_id, s.global_cell_id, SUM(p.chaos_attraction_index) as total_attraction
       FROM settlements s
       JOIN population_demographics p ON s.settlement_id = p.settlement_id
       WHERE s.seed = $1
       GROUP BY s.settlement_id, s.global_cell_id`,
      [seed]
    );

    for (const record of settlementAttractionQuery.rows) {
      if (record.total_attraction > 500.0) {
        // High attunement beacon triggers reality warp instability or attracts cultists
        await client.query(
          `UPDATE global_cells SET reality_warp_index = reality_warp_index + 5.0 WHERE cell_id = $1`,
          [record.global_cell_id]
        );
      }
    }

    // 2. Resolve Shadow War attrition between Chaos Cults and Guardian Monasteries
    const cosmicFactionsQuery = await client.query(
      `SELECT faction_id, faction_type, strength_rating FROM cosmic_factions WHERE seed = $1`,
      [seed]
    );

    for (const faction of cosmicFactionsQuery.rows) {
      if (faction.faction_type === 'GUARDIAN_MONASTERY') {
        // Monks constantly suppress adjacent chaos strength ratings
        const newStrength = Math.max(0, faction.strength_rating - 2);
        await client.query(
          `UPDATE cosmic_factions SET strength_rating = $1 WHERE faction_id = $2`,
          [newStrength, faction.faction_id]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Cosmic shadow war tick successfully completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cosmic shadow war tick failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

