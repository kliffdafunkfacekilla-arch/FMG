/**
 * Runs a test script against the live database without changing it, and without calling any LLM.
 *
 * Call `const done = await isolateTest()` before the test touches the database and `await done()` at the
 * end (including on failure). In between, every query from any module, through the shared pool, runs
 * on one connection inside a single transaction that `done()` rolls back. Transactions the code opens
 * itself (BEGIN / COMMIT / ROLLBACK) become savepoints inside it, so nothing can commit for real.
 *
 * Also sets STORY_LLM=off so story code uses its procedural paths: tests never send data to Gemini or
 * Ollama.
 */
import pool from "../db/pool.js";
import zlib from "zlib";

/**
 * Makes sure a surface tactical map row exists at (cellId, rx, ry), creating a blank one if not.
 * Tests must not depend on which maps happen to be cached in the live world (they broke when a cleanup
 * removed the one they relied on). Inside isolateTest() the row disappears again at rollback.
 */
export async function ensureFixtureLayer(cellId: number, rx: number, ry: number): Promise<void> {
  await pool.query(
    `INSERT INTO sim_sector_layers (cell_id, rx, ry, z_layer, layer_name, compressed_terrain, props, npcs, features)
     VALUES ($1, $2, $3, 0, 'Test fixture', $4, '[]', '[]', '{}')
     ON CONFLICT (cell_id, rx, ry, z_layer) DO NOTHING`,
    [cellId, rx, ry, zlib.gzipSync(Buffer.alloc(256 * 256))]
  );
}

export async function isolateTest(): Promise<() => Promise<void>> {
  process.env.STORY_LLM = "off";

  const client = await pool.connect();
  await client.query("BEGIN");

  const savepoints: string[] = [];
  let counter = 0;
  const rewrite = (text: string): string => {
    const t = text.trim().replace(/;$/, "").toUpperCase();
    if (t === "BEGIN" || t === "START TRANSACTION") {
      const name = `iso_${++counter}`;
      savepoints.push(name);
      return `SAVEPOINT ${name}`;
    }
    if (t === "COMMIT" || t === "END") {
      const name = savepoints.pop();
      return name ? `RELEASE SAVEPOINT ${name}` : "SELECT 1";
    }
    if (t === "ROLLBACK") {
      const name = savepoints.pop();
      return name ? `ROLLBACK TO SAVEPOINT ${name}` : "SELECT 1";
    }
    return text;
  };

  const query = (text: any, params?: any) =>
    typeof text === "string" ? client.query(rewrite(text), params) : client.query(text, params);

  const p = pool as any;
  const original = { query: p.query, connect: p.connect, end: p.end };
  p.query = query;
  p.connect = async () => ({ query, release: () => {} });
  p.end = async () => {}; // scripts end the pool themselves; done() does it after rolling back

  return async () => {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
      p.query = original.query;
      p.connect = original.connect;
      p.end = original.end;
      await pool.end();
    }
  };
}
