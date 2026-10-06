const { Client } = require('pg'); 
async function check() { 
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres'); 
  await client.connect(); 
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sim_factions'"); 
  console.log(res.rows); 
  await client.end(); 
} 
check().catch(console.error);
