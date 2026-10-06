const { Client } = require('pg'); 
async function check() { 
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres'); 
  await client.connect(); 
  const res = await client.query("SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle'"); 
  console.log(res.rows); 
  await client.end(); 
} 
check().catch(console.error);
