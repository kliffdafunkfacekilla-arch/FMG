import pool from "../db/pool.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";

async function main() {
  const TICKS_TO_RUN = 100;
  console.log(`Starting Economy & Trade calibration test: running ${TICKS_TO_RUN} ticks...`);

  const initialCalRes = await pool.query('SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1');
  const startTick = initialCalRes.rows[0]?.tick || 0;
  console.log(`Starting tick: ${startTick} (Year ${initialCalRes.rows[0]?.year}, Month ${initialCalRes.rows[0]?.month})`);

  for (let i = 1; i <= TICKS_TO_RUN; i++) {
    const t0 = Date.now();
    await executeMasterTick();
    const elapsed = Date.now() - t0;

    if (i % 25 === 0 || i === TICKS_TO_RUN) {
      const [econRes, tradeEventsRes, embargoesRes] = await Promise.all([
        pool.query(`
          SELECT AVG(unrest) as avg_unrest,
                 AVG(health) as avg_health,
                 AVG(crime_rate) as avg_crime,
                 SUM(wealth) as total_wealth,
                 COUNT(*) FILTER (WHERE urban_tier >= 2) as tier2_count,
                 COUNT(*) FILTER (WHERE urban_tier >= 3) as tier3_count,
                 COUNT(*) FILTER (WHERE urban_tier >= 4) as tier4_count
          FROM sim_burg_economy
        `),
        pool.query(`
          SELECT COUNT(*) as caravan_count,
                 COUNT(*) FILTER (WHERE type = 'TRADE_EMBARGO_CHOKEPOINT') as chokepoint_count
          FROM sim_events
          WHERE tick > $1 AND type IN ('CARAVAN_DISPATCH', 'TRADE_EMBARGO_CHOKEPOINT')
        `, [startTick]),
        pool.query(`SELECT COUNT(*) as war_count FROM sim_diplomacy WHERE status = 'WAR'`)
      ]);

      const e = econRes.rows[0];
      const t = tradeEventsRes.rows[0];
      const w = embargoesRes.rows[0];

      console.log(`[Tick ${startTick + i} (+${i}/${TICKS_TO_RUN}) | ${elapsed}ms]`);
      console.log(`  Unrest: ${Number(e.avg_unrest).toFixed(1)}% | Health: ${Number(e.avg_health).toFixed(1)}% | Crime: ${Number(e.avg_crime).toFixed(1)}%`);
      console.log(`  Tiers: T1=${352 - Number(e.tier2_count)}, T2=${Number(e.tier2_count) - Number(e.tier3_count)}, T3=${Number(e.tier3_count) - Number(e.tier4_count)}, T4=${Number(e.tier4_count)}`);
      console.log(`  Trade: Caravans Dispatched=${t.caravan_count} | Embargo Chokepoints=${t.chokepoint_count} | Active Wars=${w.war_count}`);
      console.log('---');
    }
  }

  console.log('Calibration run completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Calibration error:', err);
  process.exit(1);
});
