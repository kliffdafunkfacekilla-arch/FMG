import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function fixFactions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  const updates = [
    { old: 'Iron Caladra', new: 'Iron Caldera' },
    { old: 'Relience', new: 'Reliance' },
    { old: 'Guirilla', new: 'Guerrilla Clans' },
    { old: 'Theocracy', new: 'Coastal Theocracy' },
    { old: 'Canopy', new: 'Canopy Clans' },
    { old: 'Scute', new: 'Scute Confederacy' },
    { old: 'Ursine', new: 'Ursine Hegemony' },
    { old: 'Vaneer', new: 'Vaneer Concord' },
    { old: 'RiverFolk', new: 'Riverfolk' }
  ];

  for (const u of updates) {
    await client.query('UPDATE sim_factions SET name = $1 WHERE name = $2', [u.new, u.old]);
  }

  console.log("Postgres factions patched!");
  await client.end();
}

fixFactions();
