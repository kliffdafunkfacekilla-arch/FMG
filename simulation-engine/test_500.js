const { Client } = require('pg'); 
const { executeMasterTick } = require('./dist/engine/masterOrchestrator.js');
async function check() { 
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres'); 
  await client.connect(); 
  
  console.log("Running 500 ticks...");
  for(let i=1; i<=500; i++){
    await executeMasterTick();
    if (i % 50 === 0) console.log(`Tick ${i} complete...`);
  }
  
  console.log("\n=== 500 TICK REPORT ===");
  const burgsRes = await client.query('SELECT COUNT(*) as c, SUM(pop_null) as pop, SUM(wealth) as wealth, SUM(food) as food FROM sim_burg_economy');
  const bStats = burgsRes.rows[0];
  console.log(`Total Settlements: ${bStats.c}`);
  console.log(`Global Population: ${Math.floor(bStats.pop).toLocaleString()}`);
  console.log(`Global Wealth: ${Math.floor(bStats.wealth).toLocaleString()}`);
  
  console.log(`\nTOP 5 WEALTHIEST FACTIONS:`);
  const wealthRes = await client.query('SELECT name, treasury FROM sim_factions ORDER BY treasury DESC LIMIT 5');
  wealthRes.rows.forEach(r => console.log(`- ${r.name}: ${Math.floor(Number(r.treasury)).toLocaleString()} gold`));

  const warsRes = await client.query('SELECT COUNT(*) as c FROM sim_diplomacy WHERE status = \'WAR\'');
  console.log(`\nACTIVE WARS: ${warsRes.rows[0].c}`);

  console.log(`\nRECENT EVENTS:`);
  const evRes = await client.query("SELECT tick, type, message FROM sim_events WHERE tier = 'MAJOR' AND type NOT IN ('CHAOS_STORM', 'MERCY_ALIGNMENT', 'LUNAR_HEMORRHAGE') ORDER BY id DESC LIMIT 5");
  evRes.rows.forEach(r => console.log(`[Tick ${r.tick}] ${r.type}: ${r.message.substring(0, 100)}...`));

  await client.end(); 
} 
check().catch(console.error);
