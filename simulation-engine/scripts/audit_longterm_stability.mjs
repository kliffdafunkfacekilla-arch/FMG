import "dotenv/config";
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function postTick() {
    const res = await fetch('http://localhost:3000/api/observer/tick', { method: 'POST' });
    if (!res.ok) throw new Error(`Tick failed with HTTP ${res.status}`);
    return res.json();
}

async function getMetrics(client, tick) {
    const burgsRes = await client.query(`
        SELECT 
            COUNT(*)::int as burg_count,
            SUM(pop_null)::int as total_pop,
            AVG(pop_null)::int as avg_pop,
            MIN(pop_null)::int as min_pop,
            MAX(pop_null)::int as max_pop,
            SUM(food)::bigint as total_food,
            MIN(food)::int as min_food,
            MAX(food)::int as max_food,
            SUM(wealth)::bigint as total_burg_wealth,
            AVG(unrest)::float as avg_unrest,
            MAX(unrest)::int as max_unrest,
            AVG(crime_rate)::float as avg_crime,
            MAX(crime_rate)::int as max_crime,
            AVG(health)::float as avg_health,
            MIN(health)::int as min_health
        FROM sim_burg_economy
    `);

    const factionsRes = await client.query(`
        SELECT 
            COUNT(*)::int as faction_count,
            SUM(treasury)::bigint as total_treasury,
            AVG(treasury)::int as avg_treasury
        FROM sim_factions
    `);

    const diploRes = await client.query(`
        SELECT 
            COUNT(*) FILTER (WHERE status = 'WAR')::int as war_count,
            COUNT(*) FILTER (WHERE status = 'ALLIANCE')::int as alliance_count,
            COUNT(*) FILTER (WHERE status = 'DEFENSIVE_PACT')::int as pact_count,
            COUNT(*) FILTER (WHERE status = 'TRADE_PACT')::int as trade_count
        FROM sim_diplomacy
    `);

    const lairsRes = await client.query(`
        SELECT 
            COUNT(*)::int as total_lairs,
            SUM(manpower)::int as total_lair_manpower
        FROM sim_fringe_lairs
    `);

    const sealsRes = await client.query(`
        SELECT 
            AVG(seal_strength)::float as avg_seal_strength,
            MIN(seal_strength)::int as min_seal_strength
        FROM sim_sacred_groves
    `);

    const calRes = await client.query(`
        SELECT tick, year, month, month_name, day_of_month, day_of_year, season, moon_phase, active_flow, dragon_domain, is_shadow_week FROM sim_calendar LIMIT 1
    `);

    const eventCountsRes = await client.query(`
        SELECT type, COUNT(*)::int as cnt
        FROM sim_events
        GROUP BY type
        ORDER BY cnt DESC
    `);

    return {
        tick,
        calendar: calRes.rows[0],
        burgs: burgsRes.rows[0],
        factions: factionsRes.rows[0],
        diplo: diploRes.rows[0],
        lairs: lairsRes.rows[0],
        seals: sealsRes.rows[0],
        events: eventCountsRes.rows
    };
}

async function runAudit() {
    console.log("================================================================================");
    console.log("            AETHERIA SIMULATION: 100-TICK LONG-TERM STABILITY AUDIT             ");
    console.log("================================================================================");

    const client = await pool.connect();
    const history = [];
    const tickLatencies = [];

    try {
        console.log("\n[1/3] Capturing baseline metrics at Tick 1...");
        const baseline = await getMetrics(client, 1);
        history.push(baseline);
        console.log(`Initial Burgs: ${baseline.burgs.burg_count}`);
        console.log(`Initial Total Population: ${baseline.burgs.total_pop.toLocaleString()}`);
        console.log(`Initial Total Food: ${baseline.burgs.total_food.toLocaleString()}`);
        console.log(`Initial Avg Health: ${baseline.burgs.avg_health.toFixed(1)}% | Avg Unrest: ${baseline.burgs.avg_unrest.toFixed(1)}% | Avg Crime: ${baseline.burgs.avg_crime.toFixed(1)}%`);

        console.log("\n[2/3] Executing 100 master simulation ticks (~2 in-game years)...");
        console.log("--------------------------------------------------------------------------------");
        console.log("Tick | Year / Date (541d Calendar)      | Pop (Tot/Min/Max) | Food Reserves | Unrest | Crime | Wars | Lairs | Time");
        console.log("---------------------------------------------------------------------------------------------------------");

        for (let t = 2; t <= 101; t++) {
            const start = Date.now();
            await postTick();
            const latency = Date.now() - start;
            tickLatencies.push(latency);

            if (t % 10 === 0 || t === 101) {
                const metrics = await getMetrics(client, t);
                history.push(metrics);
                const b = metrics.burgs;
                const d = metrics.diplo;
                const l = metrics.lairs;
                const cal = metrics.calendar;
                
                const calStr = cal.is_shadow_week
                    ? `Y${cal.year} ShadowWk D${String(cal.day_of_month).padStart(2)}/13`
                    : `Y${cal.year} M${String(cal.month).padStart(2)} D${String(cal.day_of_month).padStart(2)} (${(cal.month_name || '').padEnd(8)})`;

                console.log(
                    `${String(t).padStart(4)} | ` +
                    `${calStr.padEnd(32)} | ` +
                    `${b.total_pop.toLocaleString().padStart(7)} / ${String(b.min_pop).padStart(4)} / ${b.max_pop.toLocaleString().padStart(6)} | ` +
                    `${Number(b.total_food).toLocaleString().padStart(12)} | ` +
                    `${b.avg_unrest.toFixed(1).padStart(5)}% | ` +
                    `${b.avg_crime.toFixed(1).padStart(4)}% | ` +
                    `${String(d.war_count).padStart(4)} | ` +
                    `${String(l.total_lairs).padStart(5)} | ` +
                    `${latency}ms`
                );
            }
        }

        console.log("--------------------------------------------------------------------------------");
        console.log("\n[3/3] Analyzing Long-Term Equilibrium & Emergence Trends...");

        const finalMetrics = history[history.length - 1];
        const initialBurgs = baseline.burgs;
        const finalBurgs = finalMetrics.burgs;

        const popDelta = finalBurgs.total_pop - initialBurgs.total_pop;
        const popGrowthPct = ((popDelta / initialBurgs.total_pop) * 100).toFixed(2);
        const foodDelta = BigInt(finalBurgs.total_food) - BigInt(initialBurgs.total_food);
        const avgLatency = (tickLatencies.reduce((a, b) => a + b, 0) / tickLatencies.length).toFixed(1);

        console.log("\n======================== AUDIT VERDICT & SUMMARY ========================");
        console.log(`Total Simulation Ticks Executed: 100 Days (Calendar: Year ${finalMetrics.calendar.year}, ${finalMetrics.calendar.is_shadow_week ? 'Shadow Week' : `Month ${finalMetrics.calendar.month} (${finalMetrics.calendar.month_name})`}, Day ${finalMetrics.calendar.day_of_month} [Day of Year ${finalMetrics.calendar.day_of_year}/541], Season: ${finalMetrics.calendar.season}, Cruorbus: ${finalMetrics.calendar.moon_phase})`);
        console.log(`Average Execution Time per Tick: ${avgLatency} ms`);
        console.log(`Burg Count: Initial ${initialBurgs.burg_count} -> Final ${finalBurgs.burg_count}`);
        console.log(`Total Population: Initial ${initialBurgs.total_pop.toLocaleString()} -> Final ${finalBurgs.total_pop.toLocaleString()} (${popGrowthPct > 0 ? '+' : ''}${popGrowthPct}%)`);
        console.log(`Population Range: Min ${finalBurgs.min_pop} | Max ${finalBurgs.max_pop.toLocaleString()} | Avg ${finalBurgs.avg_pop.toLocaleString()}`);
        console.log(`Any Burgs Extinct (Pop <= 0)?: ${finalBurgs.min_pop <= 0 ? 'FAIL - EXTINCTION DETECTED' : 'PASS - ALL BURGS SURVIVED'}`);
        console.log(`Total Food Reserves: Initial ${Number(initialBurgs.total_food).toLocaleString()} -> Final ${Number(finalBurgs.total_food).toLocaleString()}`);
        console.log(`Any Burg Starving (Food < 0)?: ${finalBurgs.min_food < 0 ? 'FAIL - STARVATION' : 'PASS - POSITIVE GRAIN RESERVES'}`);
        console.log(`Average Unrest: ${finalBurgs.avg_unrest.toFixed(2)}% (Max: ${finalBurgs.max_unrest}%)`);
        console.log(`Average Crime Rate: ${finalBurgs.avg_crime.toFixed(2)}% (Max: ${finalBurgs.max_crime}%)`);
        console.log(`Average Civil Health: ${finalBurgs.avg_health.toFixed(2)}% (Min: ${finalBurgs.min_health}%)`);
        console.log(`Geopolitical State: ${finalMetrics.diplo.war_count} Active Wars, ${finalMetrics.diplo.trade_count} Trade Pacts, ${finalMetrics.diplo.alliance_count} Alliances`);
        console.log(`Underworld Lairs Active: ${finalMetrics.lairs.total_lairs} (Manpower: ${finalMetrics.lairs.total_lair_manpower})`);
        console.log(`Dragon Prison Seals: Avg Integrity ${finalMetrics.seals?.avg_seal_strength != null ? finalMetrics.seals.avg_seal_strength.toFixed(1) + '%' : 'N/A'} (Min: ${finalMetrics.seals?.min_seal_strength ?? 'N/A'}%)`);

        console.log("\nTop 10 Emergent Global Events Generated:");
        for (const ev of finalMetrics.events.slice(0, 10)) {
            console.log(`  - ${ev.type.padEnd(28)}: ${ev.cnt} events`);
        }
        console.log("========================================================================\n");

    } finally {
        client.release();
        await pool.end();
    }
}

runAudit().catch(err => {
    console.error("Audit error:", err);
    process.exit(1);
});
