import pool from "./pool";

async function seed() {
  try {
    console.log("Starting database seeding with Ostraka Lore...");
    
    // Insert a default world metadata record
    const insertWorld = `
      INSERT INTO world_metadata (seed, current_tick, hours_per_day, days_per_year, axial_tilt, solar_distance_multiplier, map_resolution)
      VALUES ($1, 0, 24.0, 365, 23.5, 1.0, 10000)
      ON CONFLICT (seed) DO NOTHING;
    `;
    await pool.query(insertWorld, ["aetheria_seed_001"]);

    // Insert Great Powers (Factions)
    const factions = [
      ["Scute Confederacy", "Stone Masons of the Knife's Edge", "Gray", 50000, 95.0, 0.2, 8000],
      ["Coastal Theocracy", "Sovereignty of the Hum", "Blue", 75000, 85.0, 0.5, 6000],
      ["Meridian Chain", "The Ghost-Light Cartel", "Gold", 120000, 70.0, 1.5, 4000],
      ["Avian Empire", "The Gilded Compass", "Yellow", 60000, 80.0, 1.2, 5500],
      ["Iron Caldera", "Forgespire", "Red", 45000, 90.0, 0.8, 10000],
      ["Ursine Hegemony", "The 360-Hearth", "White", 30000, 99.0, 0.1, 9000],
      ["Verdant Tangle", "The Twelve Crowns", "Green", 40000, 60.0, 0.6, 7000],
      ["Heartland Alliance", "The Broken Machine", "Brown", 80000, 50.0, 1.0, 5000],
      ["Mandate of the Chain", "Anti-Magic Zealots", "Black", 15000, 100.0, 2.0, 3000] // Secret Order
    ];

    const insertFaction = `
      INSERT INTO factions (seed, name, leader_name, color, treasury, stability, expansionism, military_strength)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING;
    `;

    for (const f of factions) {
      await pool.query(insertFaction, ["aetheria_seed_001", f[0], f[1], f[2], f[3], f[4], f[5], f[6]]);
    }

    // Insert Cosmology Lore
    const lore = [
      ["The Shattering", "History", "The historical event that bound the Twelve Magistars beneath the Sacred Groves."],
      ["Aetheric Fever", "Magic", "The physiological consequence of over-channeling the Twelve Powers."],
      ["Dragonstone", "Economy", "The fundamental currency and energetic resource powering all Aether-tech."],
      ["The Great Wheel", "Magic", "The unbreakable cycle of vulnerabilities among the 12 Breaker Metals."]
    ];

    const insertLore = `
      INSERT INTO world_lore (seed, title, category, content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING;
    `;

    for (const l of lore) {
      await pool.query(insertLore, ["aetheria_seed_001", l[0], l[1], l[2]]);
    }

    // Insert Sump-Kin into sim_factions
    const insertSumpKin = `
      INSERT INTO sim_factions (id, name, color, lore_text, trait_aggression, trait_magic, trait_economy)
      VALUES (28, 'Sump-Kin', '#2E8B57', 'A mutation-prone swamp faction born of toxic runoff.', 10, 5, 8)
      ON CONFLICT DO NOTHING;
    `;
    await pool.query(insertSumpKin);

    console.log("Ostraka Lore Seeding completed successfully.");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    pool.end();
  }
}

seed();
