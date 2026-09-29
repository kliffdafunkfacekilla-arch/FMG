import pool from '../db/pool';

interface QuestResolutionParams {
  seed: string;
  questId: number;
  playerOutcome: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
  targetCellId: number;
}

/**
 * Evaluates quest completion, updates world state deltas, and branches the next story phase.
 */
export async function resolveQuestAndMutateWorld(params: QuestResolutionParams) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let worldAlterationType = 'NONE';
    let payload = {};
    let nextQuestTitle = '';
    let nextQuestDescription = '';

    // 1. Determine world state mutation based on player outcome
    if (params.playerOutcome === 'SUCCESS') {
      worldAlterationType = 'PLAYER_RESTORED_SHRINE';
      payload = { effect: 'Chaos suppressed, local crop yields boosted by 15%.' };
      nextQuestTitle = 'The Beneficiary’s Secret';
      nextQuestDescription = 'The local mayor thanks you, but a suspicious letter found in their office hints at dark bargains made with the neighboring faction.';
    } else if (params.playerOutcome === 'SABOTAGE') {
      worldAlterationType = 'PLAYER_CORRUPTED_SHRINE';
      payload = { effect: 'Leylines severed, reality warp index increased.' };
      nextQuestTitle = 'Whispers in the Smoke';
      nextQuestDescription = 'The shrine’s corruption has caught the attention of the Guardian Monastic Order. Cult scouts are now tracking your movements.';
    }

    // 2. Persist world delta to prevent database bloat while maintaining persistence
    await client.query(
      `INSERT INTO world_deltas (seed, tier_level, target_cell_id, local_coordinate, alteration_type, initial_timestamp, payload)
       VALUES ($1, 2, $2, $3, $4, 0, $5);`,
      [params.seed, params.targetCellId, JSON.stringify([50, 50]), worldAlterationType, JSON.stringify(payload)]
    );

    // 3. Generate and log the next piece of the evolving storyline
    const newQuestResult = await client.query(
      `INSERT INTO campaign_event_logs (seed, tick, event_type, headline, description)
       VALUES ($1, 0, 'QUEST_BRANCH', $2, $3) RETURNING event_id;`,
      [params.seed, nextQuestTitle, nextQuestDescription]
    );

    await client.query('COMMIT');
    console.log(`Quest resolved (${params.playerOutcome}). World mutated with delta type '${worldAlterationType}'. Next quest branched.`);

    return {
      status: 'success',
      nextQuestId: newQuestResult.rows[0].event_id,
      title: nextQuestTitle,
      description: nextQuestDescription,
      worldDeltaApplied: worldAlterationType
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Quest resolution and world mutation failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

