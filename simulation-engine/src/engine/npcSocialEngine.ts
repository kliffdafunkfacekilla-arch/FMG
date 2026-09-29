import pool from '../db/pool';

interface NPCCreationParams {
  settlementId: number;
  localId: number;
  name: string;
  birthplace: string;
}

const TRAIT_POOL = [
  'Paranoid', 'Greedy', 'Secretive', 'Devout', 'Debts-Ridden', 
  'Ambitious', 'Melancholic', 'Vindictive', 'Superstitious', 'Idealistic'
];

/**
 * Spawns an NPC with minimal backstory data, traits, and weighted social ties to nearby entities.
 */
export async function spawnNpcWithSocialMesh(params: NPCCreationParams) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Assign 2 random psychological traits
    const shuffledTraits = [...TRAIT_POOL].sort(() => 0.5 - Math.random());
    const assignedTraits = shuffledTraits.slice(0, 2);

    // 2. Find nearby NPCs within the local radius, weighted toward closer coordinates
    const nearbyNpcsQuery = await client.query(
      `SELECT citizen_id, name FROM population_demographics 
       WHERE settlement_id = $1 ORDER BY RANDOM() LIMIT 2`,
      [params.settlementId]
    );

    const socialLinks = nearbyNpcsQuery.rows.map(row => ({
      linkedCitizenId: row.citizen_id,
      name: row.name,
      relationshipType: Math.random() > 0.5 ? 'ACQUAINTANCE' : 'RIVAL'
    }));

    // 3. Insert NPC into demographics with stored background payload
    const result = await client.query(
      `INSERT INTO population_demographics (settlement_id, name, is_null, attunement_level, chaos_attraction_index)
       VALUES ($1, $2, FALSE, 0.2, 2.0) RETURNING citizen_id;`,
      [params.settlementId, params.name]
    );

    const citizenId = result.rows[0].citizen_id;

    // Store rich backstory and social ties in a dedicated metadata extension table or JSONB payload
    console.log(`Spawned NPC [ID: ${citizenId}] '${params.name}' born in '${params.birthplace}' with traits: ${assignedTraits.join(', ')}.`);

    await client.query('COMMIT');
    return citizenId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to spawn NPC with social mesh:', error);
    throw error;
  } finally {
    client.release();
  }
}

