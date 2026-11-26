/**
 * Soak run: plays many ticks and prints world health every N ticks, so slow drifts and death spirals
 * show up as a trend instead of only in the end state. It COMMITS every tick, so point it at a copy of
 * the world, never the live one:
 *   DATABASE_URL=postgres://.../fmg_soak node dist/scripts/soakRun.js 2000 100
 * Arguments: total ticks (default 1000), report interval (default 100). The script refuses to run
 * against the database named in .env unless SOAK_ALLOW_LIVE=1 is set.
 */
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";

const HEALTH_SQL = `
  SELECT
    (SELECT COALESCE(MAX(tick), 0) FROM sim_calendar)::int AS tick,
    COUNT(*)::int AS burgs,
    COUNT(*) FILTER (WHERE parent_burg_id IS NOT NULL)::int AS sats,
    COUNT(*) FILTER (WHERE pop_null + COALESCE(pop_attuned, 0) <= 0)::int AS empty,
    SUM(pop_null)::bigint AS nulls,
    SUM(COALESCE(pop_attuned, 0))::bigint AS attuned,
    (SELECT COALESCE(SUM(count), 0) FROM population_cohorts)::bigint AS cohorts,
    ROUND(AVG(unrest))::int AS unrest_avg,
    COUNT(*) FILTER (WHERE unrest >= 70)::int AS unrest70,
    COUNT(*) FILTER (WHERE crime_rate >= 100)::int AS crime100,
    COUNT(*) FILTER (WHERE food <= 0)::int AS food0,
    MAX(food)::bigint AS food_max,
    ROUND(AVG(health))::int AS health_avg,
    (SELECT COUNT(*) FROM sim_agents)::int AS agents,
    (SELECT COUNT(*) FROM storylines WHERE state IN ('proposed', 'open', 'escalated'))::int AS live_stories,
    (SELECT COUNT(*) FROM sim_events WHERE tick > (SELECT COALESCE(MAX(tick), 0) FROM sim_calendar) - 10)::int AS events_10t
  FROM sim_burg_economy`;

async function report(ms: number[]) {
  const r = (await pool.query(HEALTH_SQL)).rows[0];
  const avgMs = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0;
  console.log(
    `tick ${r.tick} | burgs ${r.burgs} (sats ${r.sats}, empty ${r.empty}) | nulls ${r.nulls} attuned ${r.attuned} ` +
      `cohorts ${r.cohorts} | unrest avg ${r.unrest_avg} >=70:${r.unrest70} | crime100 ${r.crime100} | food0 ${r.food0} ` +
      `foodMax ${r.food_max} | health ${r.health_avg} | agents ${r.agents} | stories ${r.live_stories} | ` +
      `events/10t ${r.events_10t} | ${avgMs} ms/tick`
  );
}

async function main() {
  const total = Number(process.argv[2] || 1000);
  const every = Number(process.argv[3] || 100);
  const db = (await pool.query(`SELECT current_database() AS d`)).rows[0].d;
  if (db === "postgres" && process.env.SOAK_ALLOW_LIVE !== "1") {
    throw new Error(`Refusing to soak the live database "${db}". Point DATABASE_URL at a copy.`);
  }
  await migrate(pool);
  console.log(`Soaking ${total} ticks on database "${db}", reporting every ${every}.`);
  await report([]);
  let ms: number[] = [];
  for (let i = 1; i <= total; i++) {
    const t0 = Date.now();
    const r = await executeMasterTick();
    ms.push(Date.now() - t0);
    if ((r as any)?.status && (r as any).status !== "success" && i % every !== 0) {
      console.log(`  tick ${(r as any).currentTick}: ${(r as any).status}`);
    }
    if (i % every === 0) {
      await report(ms);
      ms = [];
    }
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("Soak failed:", err?.message || err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
