/**
 * Calendar tests (rule 9). Pure: no database.
 *
 * 1. engine/canon/calendar.ts matches Canon/04 (year, months, weeks, the eight seasons).
 * 2. Ticks map to dates correctly across a year boundary and through Shadowfall.
 * 3. Every day of the year has a canon season and a canon Cruorbus phase.
 * 4. No source file keeps an old season or moon name, or a hard-coded old year length.
 */
import fs from "fs";
import path from "path";
import {
  CANON_SEASONS, DAYS_PER_MONTH, DAYS_PER_WEEK, DAYS_PER_YEAR, MERCY_ALIGNMENT, NIGHTMARE_ALIGNMENT,
  SHADOWFALL, SHADOWFALL_DAYS, SHADOWFALL_ECLIPSE, dateForTick, isYearEnd,
} from "../engine/canon/calendar.js";
import { DRAGON_MONTHS } from "../engine/agents/calendarAgent.js";

// Canon/04 §5. Changing this list means canon changed: update it from canon, never by guess.
const CANON_SEASON_TABLE: [string, string, number, number[]][] = [
  ["Shadowburn", "Summer", 96, [1, 2]], ["Dryspell", "Autumn", 48, [3]], ["Frostin", "Winter", 48, [4]],
  ["Greenspan", "Spring", 96, [5, 6]], ["Dimburn", "Summer", 48, [7]], ["Cropfade", "Autumn", 96, [8, 9]],
  ["Dimfreeze", "Winter", 96, [10, 11]], ["Thawrise", "Spring", 48, [12]],
];
const CANON_MONTHS = ["Nexar", "Massis", "Motom", "Fluxen", "Vitan", "Lexis", "Ration", "Ordis", "Luxen", "Omin", "Aurum", "Anum"];
const PHASES = new Set(["The Leering", "The Open Eye", "The Receding", "The Halo", NIGHTMARE_ALIGNMENT, MERCY_ALIGNMENT, SHADOWFALL_ECLIPSE]);

// Names the engine used before it read the canon calendar. None may come back.
const LEGACY_NAMES = [
  "The Bloom", "The High Sun", "The Harvest", "The Withering", "The Deep Cold", "The Thaw", "The Awakening", "The Roaring",
  "Rimefall", "Deep Chill", "The Green", "High Bloom", "Rust Harvest", "The Bitter Void", "The Shadow Eclipse",
  "Waxing Blood", "Full Blood", "FULL_BLOOD", "Shadow Week",
];

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let allPassed = true;
function run(label: string, fn: () => void) {
  try { fn(); console.log(`✅ ${label}`); } catch (err: any) { console.log(`❌ ${label}: ${err.message}`); allPassed = false; }
}

run("Year, month and week lengths match Canon/04", () => {
  check(DAYS_PER_YEAR === 589, `year is ${DAYS_PER_YEAR}, canon 589`);
  check(DAYS_PER_MONTH === 48, `month is ${DAYS_PER_MONTH}, canon 48`);
  check(SHADOWFALL_DAYS === 13, `Shadowfall is ${SHADOWFALL_DAYS}, canon 13`);
  check(DAYS_PER_WEEK === 12, `week is ${DAYS_PER_WEEK}, canon 12`);
  check(JSON.stringify(DRAGON_MONTHS.map(m => m.name)) === JSON.stringify(CANON_MONTHS), "month names or order differ from canon");
});

run("The eight seasons match Canon/04 and tile days 1-576", () => {
  check(CANON_SEASONS.length === 8, `expected 8 seasons, got ${CANON_SEASONS.length}`);
  let nextDay = 1;
  CANON_SEASON_TABLE.forEach(([name, kind, len, months], i) => {
    const s = CANON_SEASONS[i]!;
    check(s.name === name && s.kind === kind, `season ${i + 1}: ${s.name}/${s.kind}, canon ${name}/${kind}`);
    check(s.start === nextDay && s.end - s.start + 1 === len, `${name}: days ${s.start}-${s.end}, canon ${len} days from ${nextDay}`);
    check(JSON.stringify(s.months) === JSON.stringify(months), `${name}: months ${s.months}, canon ${months}`);
    nextDay = s.end + 1;
  });
  check(nextDay === 577, `seasons end on day ${nextDay - 1}, not 576`);
});

run("Ticks map to dates across the year boundary and Shadowfall", () => {
  const d1 = dateForTick(1);
  check(d1.year === 1 && d1.dayOfYear === 1 && d1.month === 1 && d1.season === "Shadowburn", "tick 1 is not Year 1, Nexar 1, Shadowburn");
  const d576 = dateForTick(576);
  check(d576.month === 12 && d576.dayOfMonth === 48 && d576.season === "Thawrise", "tick 576 is not Anum 48, Thawrise");
  const d577 = dateForTick(577);
  check(d577.isShadowfall && d577.dayOfMonth === 1 && d577.season === SHADOWFALL, "tick 577 is not Shadowfall day 1");
  const d589 = dateForTick(589);
  check(d589.isShadowfall && d589.dayOfMonth === 13 && isYearEnd(589), "tick 589 is not the last day of the year");
  const d590 = dateForTick(590);
  check(d590.year === 2 && d590.dayOfYear === 1 && !isYearEnd(590), "tick 590 is not Year 2, day 1");
});

run("Every day has a canon season and Cruorbus phase", () => {
  for (let t = 1; t <= DAYS_PER_YEAR; t++) {
    const d = dateForTick(t);
    check(PHASES.has(d.moonPhase), `day ${t}: unknown phase "${d.moonPhase}"`);
    check(d.isShadowfall || CANON_SEASONS.some(s => s.name === d.season), `day ${t}: unknown season "${d.season}"`);
  }
});

run("No source file uses an old season/moon name, a hard-coded 541-day year or a 44-day month", () => {
  const srcDir = path.resolve(__dirname, "..", "..", "src");
  const self = path.join(srcDir, "scripts", "testCalendar.ts");
  // The old month was 44 days: catch "% 44", "/44" and "44-day"/"44 ticks" (other 44s, like pixel sizes, are fine).
  const legacy = new RegExp(`["'\`](${LEGACY_NAMES.join("|")})|\\b(${LEGACY_NAMES.join("|")})\\b|\\b(541|5410)\\b|(%\\s*44\\b|\\/44\\b|\\b44[- ](?:day|tick))`);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && p !== self) {
        fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((line, i) => {
          const m = line.match(legacy);
          if (m) hits.push(`${path.relative(srcDir, p)}:${i + 1} (${m[1] || m[2] || m[3] || m[4]})`);
        });
      }
    }
  };
  walk(srcDir);
  check(hits.length === 0, hits.join("; "));
});

console.log(allPassed ? "\nALL CALENDAR TESTS PASSED" : "\nCALENDAR TESTS FAILED - COMMIT BLOCKED");
if (!allPassed) process.exit(1);
