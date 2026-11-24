/**
 * Phase 13.2: Save the live world database as a custom-format PostgreSQL dump outside the repository,
 * alongside a `.meta.json` summary containing `world_clock` and `sim_calendar` metadata.
 *
 * Usage:
 *   node scripts/saveWorld.cjs [saveName]
 *   node scripts/saveWorld.cjs --list
 *   OSTRAKA_SAVES_DIR=C:\path\to\saves node scripts/saveWorld.cjs my_save
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const repoRoot = path.resolve(__dirname, "../..");
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

function assertOutsideRepo(targetDir) {
  const rel = path.relative(repoRoot, path.resolve(targetDir));
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    throw new Error(`[saveWorld] Saves directory must live outside the repository (${repoRoot}), got ${targetDir}`);
  }
}

function defaultSaveName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sanitizeName(raw) {
  const clean = String(raw || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!clean) throw new Error("[saveWorld] Save name must contain at least one alphanumeric character.");
  return clean;
}

async function listSaves() {
  fs.mkdirSync(savesDir, { recursive: true });
  const files = fs.readdirSync(savesDir).filter((f) => f.endsWith(".dump")).sort().reverse();
  const items = files.map((dumpFile) => {
    const base = dumpFile.slice(0, -".dump".length);
    const dumpPath = path.join(savesDir, dumpFile);
    const metaPath = path.join(savesDir, `${base}.meta.json`);
    let meta = null;
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      } catch {}
    }
    const stat = fs.statSync(dumpPath);
    return {
      name: base,
      dumpFile,
      dumpPath,
      sizeBytes: stat.size,
      tick: meta?.tick ?? null,
      mode: meta?.mode ?? null,
      schemaVersion: meta?.schemaVersion ?? null,
      createdAt: meta?.createdAt ?? stat.mtime.toISOString(),
    };
  });
  console.log(JSON.stringify({ savesDir, saves: items }, null, 2));
}

async function readMetadata() {
  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    const calRes = await client.query(`SELECT COALESCE(MAX(tick), 0)::int AS tick FROM sim_calendar`).catch(() => ({ rows: [{ tick: 0 }] }));
    const clkRes = await client.query(`SELECT tick, minute_of_day, mode FROM world_clock WHERE id = 1 LIMIT 1`).catch(() => ({ rows: [] }));
    const verRes = await client.query(`SELECT COALESCE(MAX(version), 0)::int AS version FROM schema_version`).catch(() => ({ rows: [{ version: 0 }] }));
    return {
      tick: Number(clkRes.rows[0]?.tick ?? calRes.rows[0]?.tick ?? 0),
      calendarTick: Number(calRes.rows[0]?.tick ?? 0),
      minuteOfDay: Number(clkRes.rows[0]?.minute_of_day ?? 0),
      mode: String(clkRes.rows[0]?.mode ?? "live"),
      schemaVersion: Number(verRes.rows[0]?.version ?? 0),
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--list") {
    await listSaves();
    return;
  }

  assertOutsideRepo(savesDir);
  fs.mkdirSync(savesDir, { recursive: true });

  const saveName = sanitizeName(arg && !arg.startsWith("-") ? arg : defaultSaveName());
  const dumpFile = `${saveName}.dump`;
  const dumpPath = path.join(savesDir, dumpFile);
  const metaPath = path.join(savesDir, `${saveName}.meta.json`);
  const pgDumpBin = resolvePgBin("pg_dump");

  const metaBefore = await readMetadata();
  console.log(`[saveWorld] Dumping world + world_clock (tick=${metaBefore.tick}, schema=${metaBefore.schemaVersion}) to ${dumpPath}...`);
  const res = spawnSync(pgDumpBin, ["-Fc", "-f", dumpPath, connStr], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (res.error) {
    throw new Error(`Failed to launch pg_dump: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`pg_dump exited with status ${res.status}: ${res.stderr || res.stdout || ""}`);
  }

  const stat = fs.statSync(dumpPath);
  const metadata = {
    name: saveName,
    dumpFile,
    dumpPath,
    createdAt: new Date().toISOString(),
    tick: metaBefore.tick,
    calendarTick: metaBefore.calendarTick,
    minuteOfDay: metaBefore.minuteOfDay,
    mode: metaBefore.mode,
    schemaVersion: metaBefore.schemaVersion,
    sizeBytes: stat.size,
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  console.log(`[saveWorld] Complete (${(stat.size / (1024 * 1024)).toFixed(2)} MB): ${dumpPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
