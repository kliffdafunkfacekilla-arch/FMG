/**
 * Rule 9 test runner: `npm test` (in simulation-engine/) and the pre-commit hook both run this.
 * Rebuilds dist/ from scratch so no stale compiled file can hide a failure, then runs every suite.
 * The suites read the live PostgreSQL database, so Postgres must be running.
 * Add a new suite by adding its script name to SUITES.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SUITES = ["testCanonMandates", "testTagMatrixFull", "testBrutalGMVisual", "testChaosFlows"];
const root = __dirname;

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", timeout: 300000 });
  if (r.status !== 0) {
    console.error(`\n✖ ${label} failed (exit ${r.status ?? r.signal}). Commit blocked (rule 9).`);
    process.exit(1);
  }
}

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
run("npx", ["tsc", "-p", "."], "TypeScript compile");
for (const s of SUITES) {
  console.log(`\n── ${s} ──`);
  run("node", [path.join("dist", "scripts", `${s}.js`)], s);
}
console.log(`\n✔ All ${SUITES.length} test suites passed.`);
