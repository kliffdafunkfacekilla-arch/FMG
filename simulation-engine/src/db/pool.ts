import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
// Load simulation-engine/.env by this file's location (dist/db/pool.js), not the current folder: started
// from the repo root, a bare dotenv.config() found no .env and DATABASE_URL and other settings were ignored.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

// Create a Postgres Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres",
});

// An idle client that loses its connection (Postgres restarted or stopped, network reset) emits 'error'
// on the pool. With no listener Node treats it as fatal and the whole server exits. The pool already
// discards the dead client, so log it and carry on: the next query opens a fresh connection, or fails
// with its own error that the route handler catches.
pool.on("error", (err) => {
  console.error(`[db] Idle Postgres connection lost (${(err as any).code || err.message}). Pool will reconnect on next query.`);
});

// The same loss on a checked-out client (mid-tick, mid-request) emits 'error' on that client instead.
// Its running query already rejects, so the caller's catch/ROLLBACK path handles it; this listener only
// stops the event itself from killing the process.
pool.on("connect", (client) => {
  client.on("error", (err) => {
    console.error(`[db] Active Postgres connection lost (${(err as any).code || err.message}).`);
  });
});

export default pool;
