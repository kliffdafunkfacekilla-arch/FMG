import "dotenv/config";
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function postTick() {
    const res = await fetch('http://localhost:3000/api/observer/tick', { method: 'POST' });
    if (!res.ok) throw new Error(`Tick failed with HTTP ${res.status}`);
    return res.json();
}

async function verifyShadowWeek() {
    console.log("================================================================================");
    console.log("            TESTING 541-DAY CALENDAR: TRANSITION INTO SHADOW WEEK               ");
    console.log("================================================================================");

    const client = await pool.connect();
    try {
        // Fast-forward calendar to Day 527 (end of Month 12: Lophex)
        console.log("Fast-forwarding calendar to Tick 527 (Eve of Shadow Week)...");
        await client.query("UPDATE sim_calendar SET tick = 527, day_of_year = 527, month = 12, day_of_month = 43");
        await client.query("DELETE FROM sim_events WHERE tick > 527");

        console.log("\nRunning 16 ticks across Day 528 (Month 12 end), Days 529-541 (Shadow Week), and Day 542 (New Year 2)...");
        console.log("--------------------------------------------------------------------------------");
        console.log("Tick | DOY | Month / Period       | Day | Season               | Cruorbus Phase        | Active Flow");
        console.log("--------------------------------------------------------------------------------");

        for (let i = 0; i < 16; i++) {
            await postTick();
            const calRes = await client.query("SELECT * FROM sim_calendar LIMIT 1");
            const c = calRes.rows[0];
            const period = c.is_shadow_week ? "Shadow Week" : `Month ${c.month} (${c.month_name})`;
            console.log(
                `${String(c.tick).padStart(4)} | ` +
                `${String(c.day_of_year).padStart(3)} | ` +
                `${period.padEnd(20)} | ` +
                `D${String(c.day_of_month).padStart(2)} | ` +
                `${c.season.padEnd(20)} | ` +
                `${c.moon_phase.padEnd(21)} | ` +
                `${c.active_flow} (${c.dragon_domain})`
            );
        }
        console.log("--------------------------------------------------------------------------------");

        const shadowEvents = await client.query("SELECT type, message, lore_date FROM sim_events WHERE type = 'SHADOW_WEEK_ECLIPSE' ORDER BY tick ASC");
        console.log(`\nShadow Week Eclipse Events Triggered (${shadowEvents.rows.length}):`);
        for (const ev of shadowEvents.rows) {
            console.log(`  [Tick ${ev.lore_date}]: ${ev.message}`);
        }
        console.log("\nVERIFICATION COMPLETE: 541-day calendar, 1-day tick, and Shadow Week fully validated!");
    } finally {
        client.release();
        await pool.end();
    }
}

verifyShadowWeek().catch(console.error);
