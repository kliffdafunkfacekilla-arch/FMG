const { Client } = require('pg');
const Database = require('better-sqlite3');

async function test() {
    const sqlite = new Database('C:/Users/krazy/Desktop/FMG/simulation-engine/aetheria.sqlite');
    const r = sqlite.prepare("SELECT * FROM sim_burg_economy LIMIT 1").get();
    
    console.log("sqlite row:", r);

    const fi = (v, fallback=0) => (v === undefined || v === null || isNaN(v)) ? fallback : v;
    console.log("fi(r.pop_null, 100) =", fi(r.pop_null, 100));

    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    // delete burg 1
    await client.query("DELETE FROM sim_burg_economy WHERE burg_id = 1");

    // insert
    await client.query(
      `INSERT INTO sim_burg_economy
         (burg_id,food,raw_materials,refined_goods,wealth,unrest,pop_attuned,pop_null,
          dominant_domain,cell_id,crime_rate,species_demographics,health,military_forces,demographics)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [r.burg_id, fi(r.food, 1000), fi(r.raw_materials, 1000), fi(r.refined_goods, 1000),
       fi(r.wealth, 100), fi(r.unrest), fi(r.pop_attuned), fi(r.pop_null, 100),
       r.dominant_domain || "MATERIAL", r.cell_id, r.crime_rate || 0,
       r.species_demographics || "{}", fi(r.health, 90),
       r.military_forces || "{}", r.demographics || "{}"]
    );

    const pg = await client.query("SELECT pop_null FROM sim_burg_economy WHERE burg_id = 1");
    console.log("pg pop after insert:", pg.rows[0].pop_null);

    await client.end();
}
test().catch(console.error);
