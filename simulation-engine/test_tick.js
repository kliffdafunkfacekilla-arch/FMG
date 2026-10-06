const { Client } = require('pg'); 
const { executeMasterTick } = require('./dist/engine/masterOrchestrator.js');
async function check() { 
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres'); 
  await client.connect(); 
  
  await executeMasterTick();
  
  const res = await client.query("SELECT name, treasury FROM sim_factions LIMIT 3"); 
  console.log("After tick:", res.rows); 
  await client.end(); 
} 
check().catch(console.error);
