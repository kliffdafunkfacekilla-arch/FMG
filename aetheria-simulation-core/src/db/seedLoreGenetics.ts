// @ts-nocheck
import pool from './pool';

const loreMapping = {
  'Ursine': {"Bear": 0.8, "Porcupine": 0.2},
  'Avian': {"Eagle": 0.4, "Hawk": 0.3, "Crow": 0.3},
  'Iron Caladra': {"Lizard-Folk": 0.6, "Shelled Reptile": 0.3, "Salamander": 0.1},
  'Sumpkin': {"Mutant Amphibian": 0.8, "Rat": 0.2},
  'Vaneer': {"Arachnid": 0.6, "Insect": 0.3, "Mouse": 0.1},
  'Heartlands': {"Horse": 0.4, "Wolf": 0.3, "Rat": 0.2, "Otter": 0.1},
  'RiverFolk': {"Frog": 0.5, "Otter": 0.3, "Penguin": 0.2},
  'Flower Valley': {"Red Panda": 0.6, "Simian": 0.4},
  'Sylvania': {"Plant-Folk": 0.7, "Fae": 0.3},
  'Guirilla': {"Simian": 0.8, "Tarsier": 0.2},
  'Relience': {"Mushroom-Folk": 1.0},
  'Canopy': {"Vulpine": 0.3, "Tarsier": 0.3, "Simian": 0.2, "Sciurini": 0.2},
  'Eastern Hounds': {"Hound": 0.8, "Wolf": 0.2},
  'Prism': {"Peacock": 0.9, "Scarred-Guard": 0.1},
  'Scute': {"Armadillo": 0.5, "Pangolin": 0.5},
  'Meridian Chain': {"Penguin": 0.4, "Walrus": 0.3, "Seal": 0.2, "Otter": 0.1},
  'Hive': {"Bee": 0.6, "Ant": 0.4},
  'Dusk Husk': {"Dune Dog": 0.5, "Dust-Skipper": 0.3, "Fur-Wyrm": 0.2},
  'Theocracy': {"Avian": 0.5, "Reptile": 0.5}
};

const fallback = {"Rat": 0.3, "Mouse": 0.3, "Wolf": 0.4};

async function seed() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT b.burg_id, c.faction_id, f.name as faction_name 
      FROM sim_burg_economy b 
      JOIN sim_cells c ON b.cell_id = c.id 
      JOIN sim_factions f ON c.faction_id = f.id
    `);

    let count = 0;
    for (const row of res.rows) {
      const { burg_id, faction_name } = row;
      const demographics = loreMapping[faction_name] || fallback;
      await client.query(
        `UPDATE sim_burg_economy SET species_demographics = $1 WHERE burg_id = $2`,
        [JSON.stringify(demographics), burg_id]
      );
      count++;
    }
    console.log(`Seeded ${count} burgs with lore genetics!`);
  } catch (err) {
    console.error('Error seeding lore genetics:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
