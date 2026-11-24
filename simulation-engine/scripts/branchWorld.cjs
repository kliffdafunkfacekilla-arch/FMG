/**
 * Phase 13.2: Restore a custom-format world save into an isolated PostgreSQL branch database, or drop a branch DB.
 *
 * Usage:
 *   node scripts/branchWorld.cjs <saveNameOrDumpPath> <branchDbName> [--force]
 *   node scripts/branchWorld.cjs --drop <branchDbName>
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connStr = process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres";
const savesDir = path.resolve(process.env.OSTRAKA_SAVES_DIR || path.join(os.homedir(), "OstrakaSaves"));

function resolvePgBin(exeName) {
  if (process.platform === "win32" && process.env.USERPROFILE) {
    const scoopPath = path.join(
      process.env.USERPROFILE,
      "scoop",
      "apps",
      "postgresql",
      "current",
      "bin",
      `${exeName}.exe`
    );
    if (fs.existsSync(scoopPath)) return scoopPath;
  }
  return exeName;
}

function parseUrlForDb(baseUrl, dbName) {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function getPrimaryDbName(baseUrl) {
  const u = new URL(baseUrl);
  return u.pathname.replace(/^\//, "") || "postgres";
}

function validateBranchDbName(dbName) {
  const name = String(dbName || "").trim();
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(name)) {
    throw new Error(`[branchWorld] Invalid branch database name "${name}". Use 2-49 chars of [a-z0-9_] starting with a letter.`);
  }
  const primaryDb = getPrimaryDbName(connStr);
  const reserved = new Set(["postgres", "template0", "template1", primaryDb]);
  if (reserved.has(name)) {
    throw new Error(`[branchWorld] Refusing to modify protected database "${name}".`);
  }
  return name;
}

function resolveDumpPath(saveArg) {
  const raw = String(saveArg || "").trim();
  if (!raw) throw new Error("[branchWorld] Missing save name or .dump file path.");
  if (path.isAbsolute(raw) || raw.includes(path.sep) || raw.includes("/")) {
    const p = path.resolve(raw);
    if (!fs.existsSync(p)) throw new Error(`[branchWorld] Dump file not found: ${p}`);
    return p;
  }
  const file = raw.endsWith(".dump") ? raw : `${raw}.dump`;
  const p = path.join(savesDir, file);
  if (!fs.existsSync(p)) throw new Error(`[branchWorld] Save "${raw}" not found in ${savesDir}`);
  return p;
}

async function terminateConnections(adminClient, dbName) {
  await adminClient.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );
}

async function dropBranch(dbName) {
  const safeName = validateBranchDbName(dbName);
  const adminUrl = parseUrlForDb(connStr, "postgres");
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await terminateConnections(admin, safeName);
    await admin.query(`DROP DATABASE IF EXISTS "${safeName}"`);
    console.log(`[branchWorld] Dropped branch database "${safeName}".`);
  } finally {
    await admin.end();
  }
}

async function createAndRestoreBranch(saveArg, branchDbArg, force) {
  const safeName = validateBranchDbName(branchDbArg);
  const dumpPath = resolveDumpPath(saveArg);
  const pgRestoreBin = resolvePgBin("pg_restore");
  const adminUrl = parseUrlForDb(connStr, "postgres");
  const branchUrl = parseUrlForDb(connStr, safeName);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const existsRes = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [safeName]);
    if (existsRes.rows.length > 0) {
      if (!force) {
        throw new Error(`[branchWorld] Branch database "${safeName}" already exists (pass --force or --drop first).`);
      }
      await terminateConnections(admin, safeName);
      await admin.query(`DROP DATABASE "${safeName}"`);
    }
    await admin.query(`CREATE DATABASE "${safeName}"`);
  } finally {
    await admin.end();
  }

  console.log(`[branchWorld] Restoring ${dumpPath} into branch database "${safeName}"...`);
  const res = spawnSync(
    pgRestoreBin,
    ["--no-owner", "--no-privileges", "-d", branchUrl, dumpPath],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (res.error) {
    throw new Error(`Failed to launch pg_restore: ${res.error.message}`);
  }

  // Verify the restored DB is live and check critical tables regardless of benign schema warnings
  const checkClient = new Client({ connectionString: branchUrl });
  await checkClient.connect();
  try {
    const tblRes = await checkClient.query(
      `SELECT to_regclass('public.world_clock') AS wc, to_regclass('public.sim_calendar') AS cal`
    );
    if (!tblRes.rows[0]?.wc || !tblRes.rows[0]?.cal) {
      throw new Error(`pg_restore did not restore world tables (status=${res.status}): ${res.stderr || res.stdout || ""}`);
    }
    const cal = await checkClient.query(`SELECT COALESCE(MAX(tick), 0)::int AS tick FROM sim_calendar`);
    const clk = await checkClient.query(`SELECT tick, mode FROM world_clock WHERE id = 1 LIMIT 1`);
    console.log(
      `[branchWorld] Branch "${safeName}" ready (tick=${cal.rows[0]?.tick}, clockTick=${clk.rows[0]?.tick}, mode=${clk.rows[0]?.mode}, pg_restore_status=${res.status})`
    );
  } finally {
    await checkClient.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--drop") {
    await dropBranch(args[1]);
    return;
  }
  const force = args.includes("--force");
  const pos = args.filter((a) => a !== "--force");
  if (pos.length < 2) {
    throw new Error("Usage: node scripts/branchWorld.cjs <saveNameOrDumpPath> <branchDbName> [--force] | --drop <branchDbName>");
  }
  await createAndRestoreBranch(pos[0], pos[1], force);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
