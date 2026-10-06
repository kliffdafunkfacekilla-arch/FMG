// @ts-nocheck
import pool from "./pool";

async function seedDemographics() {
  try {
    console.log("Adding species_demographics column...");
    await pool.query(`ALTER TABLE sim_burg_economy ADD COLUMN species_demographics TEXT DEFAULT '{}';`);
    console.log("Column added.");
  } catch (error: any) {
    if (error.message.includes("duplicate column name") || error.message.includes("already exists")) {
      console.log("Column already exists, skipping addition.");
    } else {
      console.error("Error adding column:", error);
    }
  }

  try {
    const { rows } = await pool.query(`SELECT burg_id FROM sim_burg_economy`);
    console.log(`Found ${rows.length} burgs. Seeding demographics...`);

    const speciesList = ['Wolf', 'Horse', 'Rat', 'Lizard', 'Simian'];

    for (const row of rows) {
      // Generate high variance distribution
      let values = speciesList.map(() => Math.random() ** 3); // cubed to increase variance
      let sum = values.reduce((a, b) => a + b, 0);

      // occasionally completely bias one species
      if (Math.random() < 0.2) {
        values = speciesList.map(() => 0);
        const randIndex = Math.floor(Math.random() * speciesList.length);
        values[randIndex] = 1;
        sum = 1;
      }

      // normalize
      const demographics: Record<string, number> = {};
      speciesList.forEach((species, i) => {
        demographics[species] = parseFloat((values[i] / sum).toFixed(4));
      });

      // Ensure exact sum to 1.0 due to rounding
      let currentSum = Object.values(demographics).reduce((a, b) => a + b, 0);
      let diff = 1.0 - currentSum;
      if (diff !== 0) {
        demographics['Wolf'] += diff;
        demographics['Wolf'] = parseFloat(demographics['Wolf'].toFixed(4));
      }

      await pool.query(
        `UPDATE sim_burg_economy SET species_demographics = $1 WHERE burg_id = $2`,
        [JSON.stringify(demographics), row.burg_id]
      );
    }

    console.log("Demographics seeding complete.");
  } catch (error) {
    console.error("Error seeding demographics:", error);
  } finally {
    pool.end();
  }
}

seedDemographics();
