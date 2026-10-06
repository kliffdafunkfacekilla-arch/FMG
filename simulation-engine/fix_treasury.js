const { Client } = require('pg'); 
async function check() { 
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres'); 
  await client.connect(); 
  await client.query("UPDATE sim_factions SET treasury = 1000"); 
  const res = await client.query("SELECT name, treasury FROM sim_factions LIMIT 3"); 
  console.log("After manual reset:", res.rows); 
  await client.end(); 
} 
check().catch(console.error);
