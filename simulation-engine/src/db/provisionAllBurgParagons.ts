import pool from "./pool";

/**
 * provisionAllBurgParagons.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Expands the Paragon System across all 345 burgs in the world simulation.
 * Ensures every burg has:
 *  1. A Civic Paragon (Mayor / Reeve)
 *  2. A Security Paragon (Watch Commander)
 * Drawn directly from that burg's 12-to-1 consolidated citizen population
 * in population_demographics, linking macro leadership directly to living personas.
 */

const CIVIC_TITLES: Record<number, string> = {
  1: "Village Headman",
  2: "Town Reeve",
  3: "High Burgomaster",
  4: "Imperial Lord Mayor"
};

const SECURITY_TITLES: Record<number, string> = {
  1: "Militia Warden",
  2: "Watch Captain",
  3: "Garrison Commander",
  4: "High Marshal of the Citadel"
};

export async function provisionAllBurgParagons() {
  console.log("=== EXPANDING PARAGON SYSTEM ACROSS ALL 345 BURGS ===");
  const client = await pool.connect();

  try {
    const burgsRes = await client.query(`
      SELECT b.burg_id, b.name, b.cell_id, b.urban_tier, b.hierarchy_tier, b.is_capital,
             b.unrest, b.crime_rate, c.faction_id, f.name AS faction_name
      FROM sim_burg_economy b
      JOIN sim_cells c ON b.cell_id = c.id
      LEFT JOIN sim_factions f ON c.faction_id = f.id
      ORDER BY b.burg_id ASC
    `);

    console.log(`Found ${burgsRes.rows.length} burgs. Auditing existing paragons...`);

    const existingParagonsRes = await client.query(`
      SELECT burg_id, title FROM sim_paragons WHERE burg_id IS NOT NULL
    `);
    const burgParagonMap = new Set<string>();
    for (const p of existingParagonsRes.rows) {
      burgParagonMap.add(`${p.burg_id}_${p.title}`);
    }

    let createdCivic = 0;
    let createdSecurity = 0;

    for (const burg of burgsRes.rows) {
      const tier = burg.urban_tier || 1;
      const civicTitle = CIVIC_TITLES[tier] || "Town Reeve";
      const securityTitle = SECURITY_TITLES[tier] || "Watch Captain";

      // 1. Ensure Civic Paragon (Mayor / Headman)
      if (!burgParagonMap.has(`${burg.burg_id}_${civicTitle}`) && !burgParagonMap.has(`${burg.burg_id}_Mayor`)) {
        // Find best candidate from population_demographics
        const candRes = await client.query(`
          SELECT citizen_id, name, species, temper, instinct, motivation, childhood_background
          FROM population_demographics
          WHERE home_cell_id = $1 AND life_stage = 'ADULT'
            AND profession IN ('Town Scribe', 'Merchant Trader', 'Temple Acolyte', 'Caravan Drover', 'Clockmaker')
          ORDER BY citizen_id ASC
          LIMIT 1
        `, [burg.cell_id]);

        let cand = candRes.rows[0];
        if (!cand) {
          // Fallback to any adult citizen in that cell
          const fallbackRes = await client.query(`
            SELECT citizen_id, name, species, temper, instinct, motivation, childhood_background
            FROM population_demographics
            WHERE home_cell_id = $1 AND life_stage = 'ADULT'
            LIMIT 1
          `, [burg.cell_id]);
          cand = fallbackRes.rows[0] || {
            name: `${burg.name} Elder`,
            species: "Human",
            temper: "STOIC",
            instinct: "WARY"
          };
        }

        const traits = [
          { name: cand.temper || "STOIC", modifier: 0.2 },
          { name: cand.instinct || "WARY", modifier: 0.1 }
        ];

        const corruption = Math.min(100, Math.floor((burg.unrest || 0) * 0.4 + (burg.crime_rate || 0) * 0.6));

        await client.query(`
          INSERT INTO sim_paragons (burg_id, title, name, traits, corruption_score, faction_id, is_counselor)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          burg.burg_id,
          civicTitle,
          cand.name,
          JSON.stringify(traits),
          corruption,
          burg.faction_id,
          burg.is_capital
        ]);
        createdCivic++;
      }

      // 2. Ensure Security Paragon (Watch Commander)
      if (!burgParagonMap.has(`${burg.burg_id}_${securityTitle}`) && !burgParagonMap.has(`${burg.burg_id}_Commander`)) {
        const guardRes = await client.query(`
          SELECT citizen_id, name, species, temper, instinct, motivation, childhood_background
          FROM population_demographics
          WHERE home_cell_id = $1 AND life_stage = 'ADULT'
            AND profession IN ('City Watchman', 'Gate Sentry', 'Armorer', 'Blacksmith')
          ORDER BY citizen_id ASC
          LIMIT 1
        `, [burg.cell_id]);

        let guard = guardRes.rows[0];
        if (!guard) {
          const fallbackRes = await client.query(`
            SELECT citizen_id, name, species, temper, instinct, motivation, childhood_background
            FROM population_demographics
            WHERE home_cell_id = $1 AND life_stage = 'ADULT'
            OFFSET 1 LIMIT 1
          `, [burg.cell_id]);
          guard = fallbackRes.rows[0] || {
            name: `Sergeant of ${burg.name}`,
            species: "Human",
            temper: "RESOLUTE",
            instinct: "VIGILANT"
          };
        }

        const guardTraits = [
          { name: guard.temper || "RESOLUTE", modifier: 0.3 },
          { name: guard.instinct || "VIGILANT", modifier: 0.2 }
        ];

        await client.query(`
          INSERT INTO sim_paragons (burg_id, title, name, traits, corruption_score, faction_id, is_counselor)
          VALUES ($1, $2, $3, $4, 10, $5, false)
        `, [
          burg.burg_id,
          securityTitle,
          guard.name,
          JSON.stringify(guardTraits),
          burg.faction_id
        ]);
        createdSecurity++;
      }
    }

    console.log(`=== PARAGON SYSTEM FULLY PROVISIONED ===`);
    console.log(`Created ${createdCivic} Civic Paragons and ${createdSecurity} Security Paragons.`);

    // Reset sequence
    await client.query(`SELECT setval('sim_paragons_id_seq', (SELECT MAX(id) FROM sim_paragons))`);
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes("provisionAllBurgParagons")) {
  provisionAllBurgParagons()
    .then(() => {
      console.log("Paragon provisioning completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Provisioning failed:", err);
      process.exit(1);
    });
}

