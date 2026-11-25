import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import pool from "./pool.js";

export interface Queryable {
  query: (text: string, params?: any[]) => Promise<any>;
  connect?: () => Promise<Queryable & { release?: () => void }>;
}

export interface MigrateOptions {
  migrationsDir?: string;
}

interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  fullPath: string;
  noTransaction: boolean;
  sql: string;
}

function resolveMigrationsDir(override?: string): string {
  if (override) return path.resolve(override);
  const candidates = [
    path.resolve(__dirname, "migrations"),
    path.resolve(__dirname, "../../src/db/migrations"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(`Could not locate migrations directory (tried ${candidates.join(", ")})`);
}

function parseForwardMigrations(dir: string): MigrationFile[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: MigrationFile[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.endsWith(".down.sql")) continue;
    const m = /^(\d{4})_([a-zA-Z0-9_]+)\.sql$/.exec(e.name);
    if (!m) continue;
    const version = Number(m[1]);
    const name = m[2]!;
    const fullPath = path.join(dir, e.name);
    const sql = fs.readFileSync(fullPath, "utf8");
    const firstLine = sql.trimStart().split(/\r?\n/, 1)[0] || "";
    const noTransaction = /^--\s*no-transaction\b/i.test(firstLine);
    files.push({ version, name, filename: e.name, fullPath, noTransaction, sql });
  }
  files.sort((a, b) => a.version - b.version);
  for (let i = 1; i < files.length; i++) {
    if (files[i]!.version === files[i - 1]!.version) {
      throw new Error(`Duplicate migration version ${files[i]!.version}: ${files[i - 1]!.filename} and ${files[i]!.filename}`);
    }
  }
  return files;
}

function findDownMigration(dir: string, version: number): MigrationFile | null {
  const prefix = String(version).padStart(4, "0") + "_";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(prefix) && e.name.endsWith(".down.sql")) {
      const name = e.name.slice(prefix.length, -".down.sql".length);
      const fullPath = path.join(dir, e.name);
      const sql = fs.readFileSync(fullPath, "utf8");
      const firstLine = sql.trimStart().split(/\r?\n/, 1)[0] || "";
      const noTransaction = /^--\s*no-transaction\b/i.test(firstLine);
      return { version, name, filename: e.name, fullPath, noTransaction, sql };
    }
  }
  return null;
}

async function ensureSchemaVersionTable(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INT PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function withDbClient<T>(db: Queryable, fn: (c: Queryable) => Promise<T>): Promise<T> {
  const isPool =
    typeof db.connect === "function" &&
    typeof (db as any).release !== "function" &&
    !(db instanceof Client);
  if (isPool) {
    const client = await db.connect!();
    try {
      return await fn(client);
    } finally {
      if (typeof client.release === "function") client.release();
    }
  }
  return fn(db);
}

/**
 * Applies all pending NNNN_*.sql migrations in ascending version order.
 */
export async function migrate(
  db: Queryable = pool,
  opts: MigrateOptions = {}
): Promise<{ applied: number[]; currentVersion: number }> {
  const dir = resolveMigrationsDir(opts.migrationsDir);
  const migrations = parseForwardMigrations(dir);

  return withDbClient(db, async (client) => {
    await ensureSchemaVersionTable(client);
    const appliedRes = await client.query(`SELECT version FROM schema_version ORDER BY version ASC`);
    const appliedSet = new Set<number>(appliedRes.rows.map((r: any) => Number(r.version)));

    const appliedNow: number[] = [];
    for (const m of migrations) {
      if (appliedSet.has(m.version)) continue;
      if (m.noTransaction) {
        await client.query(m.sql);
        await client.query(`INSERT INTO schema_version (version, name) VALUES ($1, $2)`, [m.version, m.name]);
      } else {
        await client.query("BEGIN");
        try {
          await client.query(m.sql);
          await client.query(`INSERT INTO schema_version (version, name) VALUES ($1, $2)`, [m.version, m.name]);
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw new Error(`Migration ${m.filename} failed: ${(err as any)?.message || err}`);
        }
      }
      appliedSet.add(m.version);
      appliedNow.push(m.version);
    }

    const maxRes = await client.query(`SELECT COALESCE(MAX(version), 0)::int AS v FROM schema_version`);
    return { applied: appliedNow, currentVersion: Number(maxRes.rows[0]?.v ?? 0) };
  });
}

/**
 * Rolls back applied migrations down to targetVersion (inclusive of keeping targetVersion).
 */
export async function migrateDown(
  db: Queryable = pool,
  targetVersion: number,
  opts: MigrateOptions = {}
): Promise<{ reverted: number[]; currentVersion: number }> {
  if (!Number.isInteger(targetVersion) || targetVersion < 0) {
    throw new Error(`Invalid targetVersion for migrateDown: ${targetVersion}`);
  }
  const dir = resolveMigrationsDir(opts.migrationsDir);

  return withDbClient(db, async (client) => {
    await ensureSchemaVersionTable(client);
    const appliedRes = await client.query(
      `SELECT version, name FROM schema_version WHERE version > $1 ORDER BY version DESC`,
      [targetVersion]
    );
    const reverted: number[] = [];
    for (const row of appliedRes.rows) {
      const version = Number(row.version);
      const down = findDownMigration(dir, version);
      if (!down) {
        throw new Error(`Missing down migration for version ${version} in ${dir}`);
      }
      if (down.noTransaction) {
        await client.query(down.sql);
        await client.query(`DELETE FROM schema_version WHERE version = $1`, [version]);
      } else {
        await client.query("BEGIN");
        try {
          await client.query(down.sql);
          await client.query(`DELETE FROM schema_version WHERE version = $1`, [version]);
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw new Error(`Down migration ${down.filename} failed: ${(err as any)?.message || err}`);
        }
      }
      reverted.push(version);
    }

    const maxRes = await client.query(`SELECT COALESCE(MAX(version), 0)::int AS v FROM schema_version`);
    return { reverted, currentVersion: Number(maxRes.rows[0]?.v ?? 0) };
  });
}

if (require.main === module) {
  (async () => {
    const downIdx = process.argv.indexOf("--down");
    try {
      if (downIdx !== -1) {
        const target = Number(process.argv[downIdx + 1]);
        const res = await migrateDown(pool, target);
        console.log(`[migrate] Rolled back versions [${res.reverted.join(", ")}]; currentVersion=${res.currentVersion}`);
      } else {
        const res = await migrate(pool);
        console.log(`[migrate] Applied versions [${res.applied.join(", ")}]; currentVersion=${res.currentVersion}`);
      }
    } finally {
      await pool.end();
    }
  })().catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
}
