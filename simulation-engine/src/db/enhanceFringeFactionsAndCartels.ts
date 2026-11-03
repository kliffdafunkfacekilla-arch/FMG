import pool from "./pool";

export async function enhanceFringeFactionsAndCartels() {
  console.log("=== ENHANCING CRIMINAL ORGANIZATIONS & FRINGE FACTIONS ===");
  const client = await pool.connect();

  try {
    // 1. Upgrade Paragons for Outlaw Factions
    console.log("Upgrading Underworld Syndicate Bosses (sim_paragons)...");
    const bosses = [
      {
        outlaw_id: 1, // The Gilded Compass
        name: "High Factor Cassian Midas",
        title: "Archon of the Meridian Ledger",
        traits: JSON.stringify([
          { name: "Calculated", modifier: 0.3 },
          { name: "Usurious", modifier: 0.4 },
          { name: "Bribery_Master", modifier: 0.5 },
          { name: "Greedy", modifier: 0.2 }
        ])
      },
      {
        outlaw_id: 2, // The Free Sky-Barons
        name: "Commodore Vaelis Skystrider",
        title: "Master of the Cloud Fleet",
        traits: JSON.stringify([
          { name: "Daring", modifier: 0.4 },
          { name: "Smuggler", modifier: 0.5 },
          { name: "Airship_Ace", modifier: 0.3 },
          { name: "Ruthless", modifier: 0.3 }
        ])
      },
      {
        outlaw_id: 3, // The Devil's Choice
        name: "Captain Malakor Dread",
        title: "Condottiere of the Blood Company",
        traits: JSON.stringify([
          { name: "Mercenary", modifier: 0.5 },
          { name: "Brutal", modifier: 0.4 },
          { name: "Disciplined", modifier: 0.3 },
          { name: "Veteran", modifier: 0.3 }
        ])
      },
      {
        outlaw_id: 4, // The Ivory-Gate Syndicate
        name: "Legate General Vorun Iron-Grip",
        title: "Warden of the Ivory Pass",
        traits: JSON.stringify([
          { name: "Martial", modifier: 0.5 },
          { name: "Inflexible", modifier: 0.4 },
          { name: "Extortionist", modifier: 0.3 },
          { name: "Intimidating", modifier: 0.4 }
        ])
      },
      {
        outlaw_id: 5, // The Ghostwind Raiders
        name: "Corsair Queen Lyra Ghostwind",
        title: "Terror of the Sunder Channel",
        traits: JSON.stringify([
          { name: "Sea_Wolf", modifier: 0.5 },
          { name: "Cunning", modifier: 0.4 },
          { name: "Reaver", modifier: 0.4 },
          { name: "Elusive", modifier: 0.3 }
        ])
      }
    ];

    for (const b of bosses) {
      await client.query(`
        UPDATE sim_paragons
        SET name = $1, title = $2, traits = $3::jsonb
        WHERE outlaw_id = $4
      `, [b.name, b.title, b.traits, b.outlaw_id]);
    }

    // 2. Diversify Lair Types across existing sim_fringe_lairs
    console.log("Diversifying active fringe lairs to match specialized faction operations...");
    await client.query(`
      UPDATE sim_fringe_lairs
      SET lair_type = CASE
        WHEN faction_id = 1 THEN CASE WHEN id % 2 = 0 THEN 'SHADOW_VAULT' ELSE 'USURY_HOUSE' END
        WHEN faction_id = 2 THEN CASE WHEN id % 2 = 0 THEN 'CONTRABAND_DOCK' ELSE 'SKY_CORSAIR_CACHE' END
        WHEN faction_id = 3 THEN 'MERCENARY_GARRISON'
        WHEN faction_id = 4 THEN CASE WHEN id % 2 = 0 THEN 'TOLL_BLOCKADE' ELSE 'ENFORCER_DEN' END
        WHEN faction_id = 5 THEN CASE WHEN id % 2 = 0 THEN 'RAIDER_REDOUBT' ELSE 'SMUGGLER_COVE' END
        ELSE lair_type
      END;
    `);

    // 3. Establish specific sovereign-to-underworld headquarters
    console.log("Setting origin cells and headquarters for each cartel...");
    // Free Sky-Barons HQ in Zeveed (Burg 330)
    await client.query("UPDATE sim_outlaw_factions SET origin_cell_id = (SELECT cell_id FROM sim_burg_economy WHERE burg_id = 330) WHERE id = 2");
    // Gilded Compass HQ in Peculiurus Spire (Burg 338)
    await client.query("UPDATE sim_outlaw_factions SET origin_cell_id = (SELECT cell_id FROM sim_burg_economy WHERE burg_id = 338) WHERE id = 1");
    // Ivory-Gate Syndicate HQ in Ivory Pass (Burg 344)
    await client.query("UPDATE sim_outlaw_factions SET origin_cell_id = (SELECT cell_id FROM sim_burg_economy WHERE burg_id = 344) WHERE id = 4");
    // The Devil's Choice HQ in Shravhiek (Burg 53)
    await client.query("UPDATE sim_outlaw_factions SET origin_cell_id = (SELECT cell_id FROM sim_burg_economy WHERE burg_id = 53) WHERE id = 3");
    // Ghostwind Raiders HQ in coastal port Port Sunder
    await client.query("UPDATE sim_outlaw_factions SET origin_cell_id = (SELECT cell_id FROM sim_burg_economy WHERE name ILIKE '%Sunder%' LIMIT 1) WHERE id = 5");

    console.log("=== ENHANCEMENT COMPLETE ===");
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes("enhanceFringeFactionsAndCartels")) {
  enhanceFringeFactionsAndCartels()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
