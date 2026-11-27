/**
 * Rule 9 test runner: `npm test` (in simulation-engine/) and the pre-commit hook both run this.
 * Rebuilds dist/ from scratch so no stale compiled file can hide a failure, then runs every suite.
 * The suites run against the frozen TEST world (database fmg_test, or TEST_DATABASE_URL), never the live one,
 * so playing or opening the dashboard on the live world cannot block a commit. Postgres must be running.
 * Build the test world once with `npm run test:world`; after an intended behaviour change, re-record the
 * golden day with `npm run test:golden -- --note="why"`.
 * Add a new suite by adding its script name to SUITES.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// The thread/quest suites write while they run, but inside a transaction that is rolled back
// (src/scripts/testIsolation.ts), with LLM calls off, so they leave the test world unchanged too.
const SUITES = [
  "testCalendar", "testCanonMandates", "testTagMatrixFull", "testBrutalGMVisual", "testChaosFlows",
  "testThreadActors", "testThreadReactions", "testThreadClocks", "testQuestChainResolution", "testSystemicOutcomes",
  "testTacticalInteractions", "testStoryPipeline", "testStoryContext", "testStorylines", "testActionsAndStanding", "testMesoCalibration", "testMesoReplay", "testMicroObjectsAndClock", "testStoryMetricsAndSaves", "testSettlement", "testTickReplay", "testGoldenDay", "testMigrations", "testDeltas", "testMacroAgentsUnit", "testWorker", "testEntityRegistry", "testMicroWriteBack", "testTagRegistry", "testCohorts", "testLodRoundTrip", "testPopulationLedger", "testSimHealth", "testStoryCooldowns",
  "testTTRPGRules", "testVerticalSlice", "testAutonomousDrama", "testStrictPartyLlm", "testOstrakaMapParser", "testCitizenEconomy", "testCitizenLogistics", "testObserverApi", "testWeatherHealth", "testFactionFinances", "testCivicFlags", "testRiversAndClimate", "testCultureReligion", "testInMemoryDay", "testNotableLives",
];
const root = __dirname;

let suiteEnv = process.env;

function run(cmd, args, label) {
  // With shell: true (Windows) arguments are joined into one command line: quote any that contain spaces.
  if (process.platform === "win32") args = args.map((x) => (/\s/.test(x) ? `"${x}"` : x));
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", timeout: 300000, env: suiteEnv });
  if (r.status !== 0) {
    console.error(`\n✖ ${label} failed (exit ${r.status ?? r.signal}). Commit blocked (rule 9).`);
    process.exit(1);
  }
}

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
run("npx", ["tsc", "-p", "."], "TypeScript compile");

// Every suite gets the test world's DATABASE_URL (dotenv never overrides a variable that is already set)
// and the seed the golden day was recorded with, whatever the live .env says.
const { testDatabaseUrl } = require(path.join(root, "dist", "scripts", "buildTestWorld.js"));
suiteEnv = { ...process.env, DATABASE_URL: testDatabaseUrl(), SIM_SEED: "ostraka" };
run("node", [path.join("dist", "scripts", "buildTestWorld.js"), "--check"], "Test world check");

if (process.argv.includes("--record-golden")) {
  const note = process.argv.find((a) => a.startsWith("--note=")) || "--note=re-recorded";
  run("node", [path.join("dist", "scripts", "testGoldenDay.js"), "--record", note], "Golden day record");
  process.exit(0);
}

for (const s of SUITES) {
  console.log(`\n── ${s} ──`);
  run("node", [path.join("dist", "scripts", `${s}.js`)], s);
}
console.log(`\n✔ All ${SUITES.length} test suites passed.`);
