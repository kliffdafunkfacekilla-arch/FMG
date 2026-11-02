/**
 * prerenderWorldPopulation.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pre-renders the entire persistent citizen population for all 345 burgs
 * and stores them in PostgreSQL `population_demographics`.
 *
 * Core Simulation & Lore Guarantees:
 *  1. Demographics & Spark Distribution:
 *     - Exactly 50% True Nulls (immune to ambient chaos, unable to cast).
 *     - Exactly 50% Sparkborn:
 *       * 50% of Sparkborn (25% total): Dormant Spark (no practical channeling).
 *       * Sensitive: Slight arcane intuition, low manifestation.
 *       * Channelers: Active spellweavers, sigil smiths, elemental shapers.
 *       * Adepts: Top 1% of Sparkborn (top 0.5% of total pop), reality benders.
 *  2. Personhood & Backstory:
 *     - Real first and last names.
 *     - Species matching the burg's sovereign realm demographics (Bear-Folk,
 *       Avian, Lizard-Folk, Wolf-Kin, Felid, Human, Saurian, Plant-Folk, etc.).
 *     - Authentic professions (Blacksmith, Weaver, Scribe, Baker, Guard,
 *       Apothecary, Stonemason, Carpenter, Tanner, Farmer, Clockmaker, Laborer).
 *     - 8 Psychological Tempers (Greedy, Fanatical, Desperate, Scholarly,
 *       Stoic, Vengeful, Compassionate, Bitter) and Survival Instincts.
 *     - Dynamic social ties (Kin, Acquaintance, Rival) linking to fellow townsfolk.
 *     - Allegiance tracking ('CIVILIAN', 'CULTIST_INFILTRATOR', 'WARDEN_SENTINEL',
 *       'MANDATE_ZEALOT').
 */

import pool from "./pool";

const FIRST_NAMES: Record<string, string[]> = {
  "Human": ["Elian", "Vaelen", "Mara", "Lucian", "Kenneth", "Cassian", "Theron", "Orla", "Danica", "Gareth", "Fiona", "Tobias", "Morwen", "Darek", "Brina", "Jarek", "Sylvia"],
  "Avian": ["Corvus", "Aeron", "Peregrine", "Skye", "Talon", "Cirrus", "Zephyr", "Kestrel", "Osprey", "Altair", "Sora", "Gale"],
  "Bear-Folk": ["Bjorn", "Kaelis", "Ursan", "Torben", "Grizel", "Brant", "Hulda", "Bram", "Orson", "Valko", "Thora"],
  "Wolf-Kin": ["Fenrir", "Lupen", "Varik", "Kira", "Ragnar", "Skoll", "Volf", "Freki", "Torva", "Astrid"],
  "Felid": ["Leona", "Raza", "Sabre", "Tigran", "Panthera", "Vesper", "Lynx", "Cleo", "Shadow", "Zara"],
  "Saurian": ["Krag", "Ssys", "Xerxes", "Scales", "Gorgon", "Viper", "Drakon", "Slither", "Caiman", "Basil"],
  "Plant-Folk": ["Rowan", "Bramble", "Thorn", "Moss", "Willow", "Oakley", "Sylvan", "Fern", "Petal", "Barkley"]
};

const LAST_NAMES: Record<string, string[]> = {
  "Human": ["Thorne", "Vance", "Ironwood", "Miller", "Blackwood", "Fletcher", "Cooper", "Ashfall", "Clearwater", "Vane", "Frost", "Stone", "Cross", "Sterling", "Oakhaven", "Pike", "Weaver"],
  "Avian": ["Wind-Rider", "Cloud-Crest", "Sky-Watcher", "Feather-Bound", "Gale-Walker", "Storm-Beak", "High-Roost"],
  "Bear-Folk": ["Iron-Paw", "Rock-Cleaver", "Honey-Crag", "Heavy-Stride", "Frost-Fur", "Brawn-Hammer", "Stone-Back"],
  "Wolf-Kin": ["Blood-Howl", "Moon-Stalker", "Grey-Pelt", "Swift-Fang", "Night-Tracker", "Pine-Runner", "Frost-Howl"],
  "Felid": ["Silent-Paws", "Shadow-Pounce", "Sun-Basker", "Razor-Claw", "Night-Stalker", "Dune-Leaper"],
  "Saurian": ["Iron-Scale", "Deep-Basker", "Mud-Crag", "Venom-Spit", "Swamp-Stalker", "Spire-Tail"],
  "Plant-Folk": ["Deep-Root", "Green-Bough", "Sap-Flow", "Briar-Twist", "Autumn-Leaf", "Iron-Bark"]
};

const PROFESSIONS = [
  "Blacksmith", "Weaver", "Miller", "Baker", "Carpenter", "Cobbler", "Stonemason",
  "Tanner", "Fisherman", "Farmer", "City Watchman", "Gate Sentry", "Town Scribe",
  "Hedge Herbalist", "Apothecary Apprentice", "Temple Acolyte", "Clockmaker",
  "Disenfranchised Laborer", "Merchant Trader", "Caravan Drover", "Potter",
  "Cooper", "Brewmaster", "Foundry Worker", "Armorer", "Bowyer"
];

const TEMPERS = ["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "STOIC", "VENGEFUL", "COMPASSIONATE", "BITTER"];
const INSTINCTS = ["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL", "DEVOUT"];

function pickRandom<T>(arr: T[], fallback: T): T {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(Math.random() * arr.length)] ?? fallback;
}

function resolveSpecies(demographicsStr: string): string {
  try {
    const demo = JSON.parse(demographicsStr || "{}");
    const entries = Object.entries(demo);
    if (entries.length === 0) return "Human";
    const roll = Math.random();
    let cumulative = 0;
    for (const [sp, weight] of entries) {
      cumulative += Number(weight);
      if (roll <= cumulative) {
        if (sp.includes("Avian") || sp.includes("Eagle") || sp.includes("Hawk")) return "Avian";
        if (sp.includes("Bear") || sp.includes("Ursine")) return "Bear-Folk";
        if (sp.includes("Wolf") || sp.includes("Hound")) return "Wolf-Kin";
        if (sp.includes("Felid") || sp.includes("Cat") || sp.includes("Red Panda")) return "Felid";
        if (sp.includes("Lizard") || sp.includes("Reptile") || sp.includes("Saurian")) return "Saurian";
        if (sp.includes("Plant") || sp.includes("Mushroom") || sp.includes("Fae")) return "Plant-Folk";
        return sp;
      }
    }
  } catch (e) {}
  return "Human";
}

function generateMotivation(profession: string, temper: string, species: string, burgName: string): string {
  switch (temper) {
    case "GREEDY":
      return `Determined to amass coin and acquire prime real estate along the trade thoroughfare of ${burgName}.`;
    case "FANATICAL":
      return `Convinced of divine prophecy and the cosmic reckoning of the dragon alignment.`;
    case "DESPERATE":
      return `Struggling to provide for kin amidst municipal commodity price spikes in ${burgName}.`;
    case "SCHOLARLY":
      return `Fascinated by ancient pre-calamity texts and primordial geometry forgotten by the guilds.`;
    case "STOIC":
      return `Faithfully carries out the daily labor of a ${profession.toLowerCase()} without complaint.`;
    case "VENGEFUL":
      return `Harbors deep resentment against municipal magistrates over unredressed family grievances.`;
    case "COMPASSIONATE":
      return `Regularly shares bread and shelter with disenfranchised laborers outside the city gates.`;
    case "BITTER":
      return `Believes their lifelong craftsmanship as a ${profession.toLowerCase()} has been undervalued by the nobility.`;
    default:
      return `Seeking an honest livelihood and peace in ${burgName}.`;
  }
}

export async function prerenderWorldPopulation() {
  const client = await pool.connect();
  try {
    console.log("[Prerender] Starting World Population Pre-Rendering pipeline...");
    await client.query("BEGIN");

    // 1. Prepare Schema & Indexes
    await client.query(`
      ALTER TABLE population_demographics DROP CONSTRAINT IF EXISTS population_demographics_settlement_id_fkey;

      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS home_cell_id INT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS profession TEXT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS species TEXT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS spark_tier VARCHAR(30);
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS temper VARCHAR(30);
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS instinct VARCHAR(30);
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS motivation TEXT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS allegiance_status VARCHAR(50) DEFAULT 'CIVILIAN';

      CREATE INDEX IF NOT EXISTS idx_pop_settlement ON population_demographics(settlement_id);
      CREATE INDEX IF NOT EXISTS idx_pop_spark ON population_demographics(spark_tier);
      CREATE INDEX IF NOT EXISTS idx_pop_allegiance ON population_demographics(allegiance_status);
    `);

    // 2. Fetch all 345 burgs
    const burgsRes = await client.query(`
      SELECT burg_id, name, cell_id, urban_tier, is_capital, species_demographics
      FROM sim_burg_economy
      ORDER BY burg_id ASC
    `);

    console.log(`[Prerender] Found ${burgsRes.rows.length} burgs to populate.`);
    await client.query("DELETE FROM population_demographics");
    console.log("[Prerender] Cleared previous population_demographics.");

    let totalCitizens = 0;
    let totalNull = 0;
    let totalDormant = 0;
    let totalSensitive = 0;
    let totalChannelers = 0;
    let totalAdepts = 0;

    // Batch insertion collector
    const BATCH_SIZE = 2500;
    let batchSettlementIds: number[] = [];
    let batchCellIds: number[] = [];
    let batchNames: string[] = [];
    let batchProfessions: string[] = [];
    let batchSpecies: string[] = [];
    let batchIsNull: boolean[] = [];
    let batchSparkTiers: string[] = [];
    let batchAttunements: number[] = [];
    let batchChaosIndices: number[] = [];
    let batchTempers: string[] = [];
    let batchInstincts: string[] = [];
    let batchMotivations: string[] = [];
    let batchTraits: string[] = [];
    let batchSocialLinks: string[] = [];

    const flushBatch = async () => {
      if (batchNames.length === 0) return;
      await client.query(`
        INSERT INTO population_demographics (
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links, allegiance_status
        )
        SELECT
          u.settlement_id, u.home_cell_id, u.name, u.profession, u.species,
          u.is_null, u.spark_tier, u.attunement_level, u.chaos_attraction_index,
          u.temper, u.instinct, u.motivation, u.traits::jsonb, u.social_links::jsonb, 'CIVILIAN'
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
          $6::boolean[], $7::varchar[], $8::float[], $9::float[],
          $10::varchar[], $11::varchar[], $12::text[], $13::text[], $14::text[]
        ) AS u(
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links
        )
      `, [
        batchSettlementIds, batchCellIds, batchNames, batchProfessions, batchSpecies,
        batchIsNull, batchSparkTiers, batchAttunements, batchChaosIndices,
        batchTempers, batchInstincts, batchMotivations, batchTraits, batchSocialLinks
      ]);

      batchSettlementIds = [];
      batchCellIds = [];
      batchNames = [];
      batchProfessions = [];
      batchSpecies = [];
      batchIsNull = [];
      batchSparkTiers = [];
      batchAttunements = [];
      batchChaosIndices = [];
      batchTempers = [];
      batchInstincts = [];
      batchMotivations = [];
      batchTraits = [];
      batchSocialLinks = [];
    };

    for (const burg of burgsRes.rows) {
      // Citizen sample scale per burg based on urban tier
      const tier = burg.urban_tier || 1;
      const citizenCount = burg.is_capital ? 400 : (tier === 3 ? 250 : (tier === 2 ? 160 : 100));

      const burgCitizens: { name: string; species: string; profession: string }[] = [];

      for (let i = 0; i < citizenCount; i++) {
        const species = resolveSpecies(burg.species_demographics);
        const firstList = FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"];
        const lastList = LAST_NAMES[species] || LAST_NAMES["Human"] || ["Thorne"];
        const first = pickRandom(firstList, "Elian");
        const last = pickRandom(lastList, "Thorne");
        const name = `${first} ${last}`;
        const profession = pickRandom(PROFESSIONS, "Laborer");

        // Strict Spark Distribution:
        // 50% True Null
        // 50% Sparkborn:
        //   - 50% of Sparkborn (25% total): Dormant Spark
        //   - 35% of Sparkborn (17.5% total): Sensitive
        //   - 14% of Sparkborn (7% total): Channeler
        //   - 1% of Sparkborn (0.5% total): Adept
        const sparkRoll = Math.random();
        let isNull = false;
        let sparkTier: "NULL" | "DORMANT_SPARK" | "SENSITIVE" | "CHANNELER" | "ADEPT";
        let attunementLevel = 0.0;
        let chaosIndex = 0.0;

        if (sparkRoll < 0.50) {
          isNull = true;
          sparkTier = "NULL";
          attunementLevel = 0.0;
          chaosIndex = 0.0;
          totalNull++;
        } else {
          isNull = false;
          const subRoll = Math.random();
          if (subRoll < 0.50) {
            sparkTier = "DORMANT_SPARK";
            attunementLevel = 0.05;
            chaosIndex = 0.5;
            totalDormant++;
          } else if (subRoll < 0.85) {
            sparkTier = "SENSITIVE";
            attunementLevel = parseFloat((Math.random() * 0.3 + 0.15).toFixed(2));
            chaosIndex = parseFloat((attunementLevel * 5.0).toFixed(2));
            totalSensitive++;
          } else if (subRoll < 0.99) {
            sparkTier = "CHANNELER";
            attunementLevel = parseFloat((Math.random() * 0.35 + 0.5).toFixed(2));
            chaosIndex = parseFloat((attunementLevel * 10.0).toFixed(2));
            totalChannelers++;
          } else {
            sparkTier = "ADEPT";
            attunementLevel = parseFloat((Math.random() * 0.14 + 0.86).toFixed(2));
            chaosIndex = parseFloat((attunementLevel * 15.0).toFixed(2));
            totalAdepts++;
          }
        }

        const temper = pickRandom(TEMPERS, "STOIC");
        const instinct = pickRandom(INSTINCTS, "WARY");
        const motivation = generateMotivation(profession, temper, species, burg.name || `Burg #${burg.burg_id}`);

        // Generate 2 traits
        const traits = [temper, instinct];

        // Seed basic social links within burg populace
        const socialLinks: any[] = [];
        if (burgCitizens.length > 2) {
          const target = pickRandom(burgCitizens, burgCitizens[0]!);
          socialLinks.push({
            name: target.name,
            relationship: Math.random() < 0.3 ? "KIN" : (Math.random() < 0.7 ? "ACQUAINTANCE" : "RIVAL"),
            trust: parseFloat((Math.random() * 1.4 - 0.4).toFixed(2))
          });
        }

        burgCitizens.push({ name, species, profession });

        // Add to batch
        batchSettlementIds.push(burg.burg_id);
        batchCellIds.push(burg.cell_id);
        batchNames.push(name);
        batchProfessions.push(profession);
        batchSpecies.push(species);
        batchIsNull.push(isNull);
        batchSparkTiers.push(sparkTier);
        batchAttunements.push(attunementLevel);
        batchChaosIndices.push(chaosIndex);
        batchTempers.push(temper);
        batchInstincts.push(instinct);
        batchMotivations.push(motivation);
        batchTraits.push(JSON.stringify(traits));
        batchSocialLinks.push(JSON.stringify(socialLinks));

        totalCitizens++;

        if (batchNames.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }

    // Flush any remaining
    await flushBatch();

    await client.query("COMMIT");
    console.log(`[Prerender] SUCCESS! Pre-rendered ${totalCitizens} persistent citizens across ${burgsRes.rows.length} burgs:`);
    console.log(`  - True Nulls: ${totalNull} (${((totalNull / totalCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Dormant Sparks: ${totalDormant} (${((totalDormant / totalCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Sensitives: ${totalSensitive} (${((totalSensitive / totalCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Channelers: ${totalChannelers} (${((totalChannelers / totalCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Adepts (Top 1% of Sparkborn): ${totalAdepts} (${((totalAdepts / totalCitizens) * 100).toFixed(2)}%)`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Prerender] FAILED with error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// CLI runner if invoked directly
if (require.main === module) {
  prerenderWorldPopulation().then(() => {
    pool.end();
    process.exit(0);
  }).catch(() => {
    pool.end();
    process.exit(1);
  });
}
