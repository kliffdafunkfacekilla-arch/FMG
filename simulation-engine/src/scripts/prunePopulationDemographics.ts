import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { pruneNonNotableDemographics } from "../engine/entities/population.js";

async function main() {
  await migrate(pool);
  const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
  const tick = Number(tickRes.rows[0]?.t || 1);

  const sizeBeforeRes = await pool.query(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
            pg_size_pretty(pg_total_relation_size('population_demographics')) AS demo_size`
  );
  console.log("[prune-population] Before:", sizeBeforeRes.rows[0]);

  const summary = await pruneNonNotableDemographics(pool, { tick });
  console.log("[prune-population] Prune summary:", summary);

  // Run outside any transaction so PostgreSQL reclaims full dead tuple heap & index bloat
  await pool.query(`VACUUM (FULL, ANALYZE) population_demographics`);

  const sizeAfterRes = await pool.query(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
            pg_size_pretty(pg_total_relation_size('population_demographics')) AS demo_size,
            pg_size_pretty(pg_total_relation_size('population_cohorts')) AS cohort_size`
  );
  console.log("[prune-population] After VACUUM FULL:", sizeAfterRes.rows[0]);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("[prune-population] FAILED:", err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
