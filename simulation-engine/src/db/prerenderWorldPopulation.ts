/**
 * prerenderWorldPopulation.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pre-renders the entire persistent citizen population for all 345 burgs
 * at a strict 12-to-1 consolidation ratio (1 citizen per unit of 12).
 *
 * Core Simulation & Lore Rules (from GEMINI.md):
 *  1. Population Scaling & Urbanization Tiers:
 *     - Village / Hamlet: < 1,200 population (Tier 1)
 *     - Town: 1,200 – 12,000 population (Tier 2)
 *     - City / Metropolis: > 12,000 population (Tier 3)
 *     - Strictly organized into "Groups of 12" workers.
 *  2. 12-to-1 Personhood Consolidation:
 *     - Each database record represents the primary persona & household head
 *       for a discrete unit of 12 (`unit_size = 12`).
 *     - Total continental urban population: ~1.95 Million across 345 burgs.
 *     - Total persistent citizens in DB: ~162,980 individuals.
 *  3. Sparkborn vs. True Null Distribution:
 *     - Exactly 50% True Nulls (immune to chaos, cannot channel).
 *     - Exactly 50% Sparkborn:
 *       * 25% of total (50% of sparkborn): Dormant Spark.
 *       * 17.5% of total: Sensitive (slight empathy/intuition).
 *       * 7.0% of total: Channelers (active spellcrafters).
 *       * 0.5% of total: Adepts (Top 1% of Sparkborn, reality benders).
 *  4. Full Living Backstories:
 *     - First & last names, species drawn from realm demographics.
 *     - Mundane trades (Blacksmith, Weaver, Scribe, Baker, Armorer, Guard, etc.).
 *     - 8 Psychological Tempers & Survival Instincts.
 *     - In-town social ties & allegiance tracking.
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
      return `Leading their workshop to corner local commerce in ${burgName}.`;
    case "FANATICAL":
      return `Convinced the 12 Dragon Seals are awakening and preaching imminent cosmic judgment.`;
    case "DESPERATE":
      return `Leading a struggling household striving to pay municipal guild levies in ${burgName}.`;
    case "SCHOLARLY":
      return `Quietly cataloging ancient pre-calamity texts and primordial dragon geometry.`;
    case "STOIC":
      return `Upholding the daily duties of a ${profession.toLowerCase()} and providing for their 12-person cohort.`;
    case "VENGEFUL":
      return `Nursing a bitter family feud against the local burg reeve.`;
    case "COMPASSIONATE":
      return `Sheltering outcasts and sharing workshop rations with hungry laborers.`;
    case "BITTER":
      return `Believing their cohort's hard labor is stolen by corrupt provincial nobles.`;
    default:
      return `Seeking peace and honest trade in ${burgName}.`;
  }
}

export async function prerenderWorldPopulation() {
  const client = await pool.connect();
  try {
    console.log("[Prerender] Initializing 12-to-1 Consolidated World Population pipeline...");
    await client.query("BEGIN");

    // 1. Prepare Schema & Add unit_size
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
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS unit_size INT DEFAULT 12;

      CREATE INDEX IF NOT EXISTS idx_pop_settlement ON population_demographics(settlement_id);
      CREATE INDEX IF NOT EXISTS idx_pop_spark ON population_demographics(spark_tier);
      CREATE INDEX IF NOT EXISTS idx_pop_allegiance ON population_demographics(allegiance_status);
    `);

    // 2. Fetch all 345 burgs and sort by original wealth/population to preserve hierarchy
    const burgsRes = await client.query(`
      SELECT burg_id, name, cell_id, urban_tier, is_capital, species_demographics, wealth
      FROM sim_burg_economy
      ORDER BY wealth DESC, burg_id ASC
    `);

    console.log(`[Prerender] Re-normalizing populations for ${burgsRes.rows.length} burgs into realistic historical tiers...`);

    let totalContinentalPop = 0;
    let totalConsolidatedCitizens = 0;

    let totalNull = 0;
    let totalDormant = 0;
    let totalSensitive = 0;
    let totalChannelers = 0;
    let totalAdepts = 0;

    // Batch insertion collector
    const BATCH_SIZE = 3500;
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
    let batchUnitSizes: number[] = [];

    const flushBatch = async () => {
      if (batchNames.length === 0) return;
      await client.query(`
        INSERT INTO population_demographics (
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links, allegiance_status, unit_size
        )
        SELECT
          u.settlement_id, u.home_cell_id, u.name, u.profession, u.species,
          u.is_null, u.spark_tier, u.attunement_level, u.chaos_attraction_index,
          u.temper, u.instinct, u.motivation, u.traits::jsonb, u.social_links::jsonb, 'CIVILIAN', u.unit_size
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
          $6::boolean[], $7::varchar[], $8::float[], $9::float[],
          $10::varchar[], $11::varchar[], $12::text[], $13::text[], $14::text[],
          $15::int[]
        ) AS u(
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links, unit_size
        )
      `, [
        batchSettlementIds, batchCellIds, batchNames, batchProfessions, batchSpecies,
        batchIsNull, batchSparkTiers, batchAttunements, batchChaosIndices,
        batchTempers, batchInstincts, batchMotivations, batchTraits, batchSocialLinks,
        batchUnitSizes
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
      batchUnitSizes = [];
    };

    // Clean previous population table
    await client.query("DELETE FROM population_demographics");

    const burgCount = burgsRes.rows.length;
    for (let idx = 0; idx < burgCount; idx++) {
      const burg = burgsRes.rows[idx];

      // Realistic historical scaling:
      // Top 10 Major Capitals: 35,000 – 75,000
      // Next 35 Citadels & Provincial Hubs: 10,000 – 25,000
      // Next 120 Walled Market Towns: 2,000 – 8,000
      // Remaining 180 Hamlets, Garrisons & Camps: 300 – 1,500
      let realPop = 0;
      if (idx < 10) {
        const ratio = 1 - (idx / 10);
        realPop = Math.round(35000 + ratio * 40000);
      } else if (idx < 45) {
        const ratio = 1 - ((idx - 10) / 35);
        realPop = Math.round(10000 + ratio * 15000);
      } else if (idx < 165) {
        const ratio = 1 - ((idx - 45) / 120);
        realPop = Math.round(2000 + ratio * 6000);
      } else {
        const ratio = 1 - ((idx - 165) / 180);
        realPop = Math.round(300 + ratio * 1200);
      }

      // Strictly ensure divisible by 12
      realPop = Math.round(realPop / 12) * 12;
      const citizenCount12to1 = realPop / 12;

      // Urbanization Tier according to GEMINI.md:
      // Village (< 1,200), Town (< 12,000), City (> 12,000)
      const urbanTier = realPop >= 12000 ? 3 : (realPop >= 1200 ? 2 : 1);
      const popNull = realPop / 2;
      const popAttuned = realPop / 2;

      // Update sim_burg_economy with realistic census
      await client.query(`
        UPDATE sim_burg_economy
        SET pop_null = $1,
            pop_attuned = $2,
            urban_tier = $3,
            food = GREATEST(food, $4),
            raw_materials = GREATEST(raw_materials, $5)
        WHERE burg_id = $6
      `, [popNull, popAttuned, urbanTier, Math.round(realPop * 0.15), Math.round(realPop * 0.1), burg.burg_id]);

      totalContinentalPop += realPop;
      totalConsolidatedCitizens += citizenCount12to1;

      const burgCitizens: { name: string; species: string; profession: string }[] = [];

      for (let c = 0; c < citizenCount12to1; c++) {
        const species = resolveSpecies(burg.species_demographics);
        const firstList = FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"];
        const lastList = LAST_NAMES[species] || LAST_NAMES["Human"] || ["Thorne"];
        const first = pickRandom(firstList, "Elian");
        const last = pickRandom(lastList, "Thorne");
        const name = `${first} ${last}`;
        const profession = pickRandom(PROFESSIONS, "Laborer");

        // Strict Spark Distribution:
        // 50% True Null
        // 50% Sparkborn (25% Dormant, 17.5% Sensitive, 7% Channeler, 0.5% Adept)
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
        const traits = [temper, instinct];

        const socialLinks: any[] = [];
        if (burgCitizens.length > 2 && Math.random() < 0.35) {
          const target = pickRandom(burgCitizens, burgCitizens[0]!);
          socialLinks.push({
            name: target.name,
            relationship: Math.random() < 0.3 ? "KIN" : (Math.random() < 0.7 ? "ACQUAINTANCE" : "RIVAL"),
            trust: parseFloat((Math.random() * 1.4 - 0.4).toFixed(2))
          });
        }

        burgCitizens.push({ name, species, profession });

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
        batchUnitSizes.push(12);

        if (batchNames.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }

    await flushBatch();
    await client.query("COMMIT");

    console.log(`[Prerender] SUCCESS! 12-to-1 Consolidated Population created:`);
    console.log(`  - Total Realistic Continental Burg Population: ${totalContinentalPop.toLocaleString()}`);
    console.log(`  - Total Persistent 12:1 Citizens in DB: ${totalConsolidatedCitizens.toLocaleString()}`);
    console.log(`  - True Nulls: ${totalNull.toLocaleString()} (${((totalNull / totalConsolidatedCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Dormant Sparks: ${totalDormant.toLocaleString()} (${((totalDormant / totalConsolidatedCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Sensitives: ${totalSensitive.toLocaleString()} (${((totalSensitive / totalConsolidatedCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Channelers: ${totalChannelers.toLocaleString()} (${((totalChannelers / totalConsolidatedCitizens) * 100).toFixed(1)}%)`);
    console.log(`  - Adepts (Top 1% of Sparkborn): ${totalAdepts.toLocaleString()} (${((totalAdepts / totalConsolidatedCitizens) * 100).toFixed(2)}%)`);
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
