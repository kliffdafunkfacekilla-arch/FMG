import pool from "../db/pool";
import { NPCInstinct, NPCTemper } from "./ai/npcMindPure";

interface NPCCreationParams {
  settlementId: number;
  localId?: number;
  name: string;
  birthplace: string;
  role?: string;
  cellId?: number;
  currentRx?: number;
  currentRy?: number;
}

const TRAIT_POOL = [
  "Paranoid", "Greedy", "Secretive", "Devout", "Debts-Ridden",
  "Ambitious", "Melancholic", "Vindictive", "Superstitious", "Idealistic"
];

const INSTINCT_POOL: NPCInstinct[] = ["WARY", "HERD", "BOLD", "GREEDY", "CURIOUS", "DISCIPLINED"];
const TEMPER_POOL: NPCTemper[] = ["STOIC", "VOLATILE", "WARM", "CYNICAL", "PROUD"];

/**
 * Spawns an NPC with full backstory data, personality traits, and weighted social ties
 * persistently saved to PostgreSQL.
 */
export async function spawnNpcWithSocialMesh(params: NPCCreationParams) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Assign 2 psychological traits, Instinct and Temper
    const shuffledTraits = [...TRAIT_POOL].sort(() => 0.5 - Math.random());
    const assignedTraits = shuffledTraits.slice(0, 2);
    const instinct: NPCInstinct = INSTINCT_POOL[Math.floor(Math.random() * INSTINCT_POOL.length)] || "WARY";
    const temper: NPCTemper = TEMPER_POOL[Math.floor(Math.random() * TEMPER_POOL.length)] || "STOIC";

    // 2. Query nearby NPCs in the same settlement to establish genuine social links
    const nearbyNpcsQuery = await client.query(
      `SELECT citizen_id, name FROM population_demographics 
       WHERE settlement_id = $1 ORDER BY RANDOM() LIMIT 3`,
      [params.settlementId]
    );

    const socialLinks = nearbyNpcsQuery.rows.map(row => ({
      linkedCitizenId: row.citizen_id,
      name: row.name,
      trust: Number((Math.random() * 1.4 - 0.4).toFixed(2)), // -0.4 to 1.0
      relationshipType: Math.random() > 0.6 ? "KIN" : Math.random() > 0.4 ? "ACQUAINTANCE" : "RIVAL"
    }));

    // 3. Ensure columns exist on population_demographics
    await client.query(`
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS birthplace TEXT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS instinct TEXT DEFAULT 'WARY';
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS temper TEXT DEFAULT 'STOIC';
    `);

    // 4. Insert NPC into demographics with persistent background payload
    const result = await client.query(
      `INSERT INTO population_demographics 
        (settlement_id, name, is_null, attunement_level, chaos_attraction_index, traits, social_links, birthplace, instinct, temper)
       VALUES ($1, $2, FALSE, 0.2, 2.0, $3, $4, $5, $6, $7) 
       RETURNING citizen_id;`,
      [
        params.settlementId,
        params.name,
        JSON.stringify(assignedTraits),
        JSON.stringify(socialLinks),
        params.birthplace,
        instinct,
        temper
      ]
    );

    const citizenId = result.rows[0].citizen_id;

    // 5. If spatial coordinates are present, also persist directly to sim_npc_instances
    if (params.cellId !== undefined && params.currentRx !== undefined && params.currentRy !== undefined) {
      await client.query(`
        INSERT INTO sim_npc_instances (
          id, cell_id, current_rx, current_ry, local_pos, name, role,
          tags, faction, hp, max_hp, disposition, alive, instinct, temper, social_links
        ) VALUES (
          $1, $2, $3, $4, ARRAY[128, 128], $5, $6,
          $7, 'Civilian', 20, 20, 0, true, $8, $9, $10
        )
        ON CONFLICT (id) DO UPDATE SET
          instinct = EXCLUDED.instinct,
          temper = EXCLUDED.temper,
          social_links = EXCLUDED.social_links;
      `, [
        `citizen_${citizenId}`,
        params.cellId,
        params.currentRx,
        params.currentRy,
        params.name,
        params.role || "Citizen",
        JSON.stringify(assignedTraits),
        instinct,
        temper,
        JSON.stringify(socialLinks)
      ]);
    }

    await client.query("COMMIT");
    return citizenId;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to spawn NPC with social mesh:", error);
    throw error;
  } finally {
    client.release();
  }
}

