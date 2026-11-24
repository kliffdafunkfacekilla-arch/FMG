const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connStr = process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres";
const backupsDir = path.resolve(__dirname, "../../backups");
fs.mkdirSync(backupsDir, { recursive: true });

function defaultFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `world-${stamp}.dump`;
}

const rawArg = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : defaultFilename();
const outPath = path.isAbsolute(rawArg) ? rawArg : path.resolve(backupsDir, rawArg);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const pgDumpBin = process.platform === "win32" && process.env.USERPROFILE
  ? (() => {
      const scoopPath = path.join(process.env.USERPROFILE, "scoop", "apps", "postgresql", "current", "bin", "pg_dump.exe");
      return fs.existsSync(scoopPath) ? scoopPath : "pg_dump";
    })()
  : "pg_dump";

console.log(`[backup] Writing PostgreSQL dump to ${outPath}...`);
const res = spawnSync(pgDumpBin, ["-Fc", "-f", outPath, connStr], { stdio: "inherit" });
if (res.error) {
  console.error(`[backup] Failed to launch pg_dump: ${res.error.message}`);
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`[backup] pg_dump exited with status ${res.status}`);
  process.exit(res.status || 1);
}
const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
console.log(`[backup] Complete (${sizeMb} MB): ${outPath}`);
