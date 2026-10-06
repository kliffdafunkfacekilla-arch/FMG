const { Client } = require('pg');
const Database = require('better-sqlite3');

async function prune() {
    const pg = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await pg.connect();
    
    // Get valid burg IDs from Postgres
    const validBurgsRes = await pg.query('SELECT burg_id FROM sim_burg_economy');
    const validBurgIds = validBurgsRes.rows.map(r => r.burg_id);
    console.log(`Found ${validBurgIds.length} valid burgs in Postgres.`);
    
    // Open SQLite
    const sqlite = new Database('aetheria.sqlite');
    
    // Delete from SQLite
    const stmt = sqlite.prepare(`DELETE FROM sim_burg_economy WHERE burg_id NOT IN (${validBurgIds.join(',')})`);
    const info = stmt.run();
    console.log(`Deleted ${info.changes} ghost burgs from aetheria.sqlite.`);
    
    // Also prune sim_paragons and sim_infrastructure
    const pStmt = sqlite.prepare(`DELETE FROM sim_paragons WHERE burg_id NOT IN (${validBurgIds.join(',')})`);
    console.log(`Deleted ${pStmt.run().changes} orphaned paragons from aetheria.sqlite.`);
    
    const iStmt = sqlite.prepare(`DELETE FROM sim_infrastructure WHERE burg_id IS NOT NULL AND burg_id NOT IN (${validBurgIds.join(',')})`);
    console.log(`Deleted ${iStmt.run().changes} orphaned infrastructure from aetheria.sqlite.`);

    sqlite.close();
    await pg.end();
}

prune().catch(console.error);
