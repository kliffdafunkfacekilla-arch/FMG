import pool from '../db/pool';

interface LoreEntry {
  seed: string;
  title: string;
  category: 'MYTH' | 'HISTORY' | 'FACTION_LORE' | 'CHAOS_LORE';
  content: string;
  associatedCellId: number | null;
}

/**
 * Injects foundational world lore into the persistence layer.
 */
export async function injectWorldLore(entry: LoreEntry) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO world_lore (seed, title, category, content, associated_cell_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.seed, entry.title, entry.category, entry.content, entry.associatedCellId]
    );

    console.log(`Lore injected successfully: '${entry.title}'`);
  } catch (error) {
    console.error('Failed to inject world lore:', error);
    throw error;
  } finally {
    client.release();
  }
}

