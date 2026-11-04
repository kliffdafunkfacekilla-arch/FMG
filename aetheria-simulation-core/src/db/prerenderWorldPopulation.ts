/**
 * prerenderWorldPopulation.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pre-renders the entire persistent citizen population for all 345 burgs
 * at a strict 12-to-1 consolidation ratio (1 citizen record per unit of 12).
 *
 * Children & Upbringing Mechanics:
 *  1. Children Demographic Ratio:
 *     - Exactly 12 children for every 48 adults -> exactly 1 rendered child
 *       record for every 4 rendered adult records (~20% youth cohort).
 *     - Children hold `life_stage = 'CHILD'`, `unit_size = 12`, and ages 4–15.
 *     - Each child has a formative childhood background that shapes their
 *       temperament, instincts, and future adult trade.
 *  2. Adult Formative Upbringing:
 *     - Adults hold `life_stage = 'ADULT'`, `unit_size = 12`, and ages 16–65.
 *     - Adults retain their childhood background ("Adults with childhoods that shaped them").
 *  3. Sparkborn vs. True Null Distribution:
 *     - Exactly 50% True Nulls (immune to chaos, cannot channel).
 *     - Exactly 50% Sparkborn (25% Dormant, 17.5% Sensitive, 7% Channeler, 0.5% Adept).
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

const ADULT_PROFESSIONS = [
  "Blacksmith", "Weaver", "Miller", "Baker", "Carpenter", "Cobbler", "Stonemason",
  "Tanner", "Fisherman", "Farmer", "City Watchman", "Gate Sentry", "Town Scribe",
  "Hedge Herbalist", "Apothecary Apprentice", "Temple Acolyte", "Clockmaker",
  "Disenfranchised Laborer", "Merchant Trader", "Caravan Drover", "Potter",
  "Cooper", "Brewmaster", "Foundry Worker", "Armorer", "Bowyer"
];

const CHILD_ROLES = [
  "Forge Apprentice", "Weaver Youth", "Temple Ward", "Farm Hand",
  "Herbalist Gatherer", "Scribe Runner", "Potter Apprentice", "Dock Urchin",
  "Stable Hand", "Tinker Apprentice", "Kitchen Scullion", "Fisher Boy"
];

const CHILDHOOD_BACKGROUNDS = [
  "Apprenticed early at the forge; blistered palms taught them the stubborn value of endurance.",
  "Survived a bitter winter famine by foraging frozen marsh-moss with their elder siblings.",
  "Discovered strange arcane sparks dancing along their fingertips while resting beside an ancient stone megalith.",
  "Grew up listening to temple priests chant solemn hymns about the 12 Chaos Dragons and the weakening seals.",
  "Witnessed a city watch raid on their parents' workshop over unpaid grain taxes.",
  "Raised on a frontier farm constantly defending sheep herds from wandering shadow-wolves.",
  "Spent quiet candlelit hours in a scribe's dusty scriptorium copying forbidden dragon geometry.",
  "Lost a childhood companion to a river flood; swore never to abandon their fellow cohort.",
  "Learned to sprint across rooftops and alleys carrying sensitive missives for the merchant guild.",
  "Fascinated by clockwork mechanisms and copper gears salvaged from behind the master tinker's bench.",
  "Sheltered in an underground stone cellar while a chaotic purple thunderstorm warped the harvest fields.",
  "Labored in municipal clay pits from sunrise to twilight, dreaming of buying their family's independence."
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

function generateAdultMotivation(profession: string, temper: string, species: string, burgName: string, childhood: string): string {
  switch (temper) {
    case "GREEDY":
      return `Striving to expand their workshop in ${burgName}. Childhood lesson: wealth is the only true shield.`;
    case "FANATICAL":
      return `Convinced the 12 Dragon Seals are awakening. Their childhood memories of purple skies confirm it.`;
    case "DESPERATE":
      return `Working tirelessly to feed their 12-person household amidst municipal tariffs in ${burgName}.`;
    case "SCHOLARLY":
      return `Obsessed with uncovering the primordial equations behind dragon seals and leylines.`;
    case "STOIC":
      return `Quietly performing the daily craft of a ${profession.toLowerCase()}, shaped by early years of hard labor.`;
    case "VENGEFUL":
      return `Nursing a long grudge against the town council over wrongs committed during their youth.`;
    case "COMPASSIONATE":
      return `Sharing rations with hungry outcasts, remembering what it felt like to starve as a child.`;
    case "BITTER":
      return `Convinced that honest craftsmen are exploited by the wealthy elite of ${burgName}.`;
    default:
      return `Seeking an honest living and peace for their household in ${burgName}.`;
  }
}

function generateChildMotivation(role: string, temper: string, burgName: string): string {
  switch (temper) {
    case "CURIOUS":
    case "SCHOLARLY":
      return `Eager to learn the mysteries of ${burgName} and sneak into the guild libraries.`;
    case "DESPERATE":
    case "FEARFUL":
      return `Tries hard to avoid the magistrate's watchmen and bring scraps home to their kin.`;
    case "FANATICAL":
      return `Repeats temple prophecies to other children and watches the dragon leylines at twilight.`;
    default:
      return `Working diligently as a ${role.toLowerCase()} in ${burgName} while dreaming of adventure.`;
  }
}

export async function prerenderWorldPopulation() {
  const client = await pool.connect();
  try {
    console.log("[Prerender] Initializing 12-to-1 Consolidated World Population with Children & Upbringing...");
    await client.query("BEGIN");

    // 1. Prepare Schema
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
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS life_stage VARCHAR(20) DEFAULT 'ADULT';
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS age INT DEFAULT 25;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS childhood_background TEXT;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS is_immigrant BOOLEAN DEFAULT FALSE;
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS cause_of_death TEXT;

      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS pop_growth_pool FLOAT DEFAULT 0.0;

      CREATE INDEX IF NOT EXISTS idx_pop_settlement ON population_demographics(settlement_id);
      CREATE INDEX IF NOT EXISTS idx_pop_spark ON population_demographics(spark_tier);
      CREATE INDEX IF NOT EXISTS idx_pop_allegiance ON population_demographics(allegiance_status);
      CREATE INDEX IF NOT EXISTS idx_pop_stage ON population_demographics(settlement_id, life_stage);
    `);

    // 2. Fetch all 345 burgs
    const burgsRes = await client.query(`
      SELECT burg_id, name, cell_id, urban_tier, is_capital, species_demographics, wealth
      FROM sim_burg_economy
      ORDER BY wealth DESC, burg_id ASC
    `);

    console.log(`[Prerender] Re-normalizing populations for ${burgsRes.rows.length} burgs with children generation...`);

    let totalContinentalPop = 0;
    let totalAdultRecords = 0;
    let totalChildRecords = 0;

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
    let batchLifeStages: string[] = [];
    let batchAges: number[] = [];
    let batchChildhoods: string[] = [];

    const flushBatch = async () => {
      if (batchNames.length === 0) return;
      await client.query(`
        INSERT INTO population_demographics (
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links, allegiance_status,
          unit_size, life_stage, age, childhood_background
        )
        SELECT
          u.settlement_id, u.home_cell_id, u.name, u.profession, u.species,
          u.is_null, u.spark_tier, u.attunement_level, u.chaos_attraction_index,
          u.temper, u.instinct, u.motivation, u.traits::jsonb, u.social_links::jsonb, 'CIVILIAN',
          u.unit_size, u.life_stage, u.age, u.childhood_background
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
          $6::boolean[], $7::varchar[], $8::float[], $9::float[],
          $10::varchar[], $11::varchar[], $12::text[], $13::text[], $14::text[],
          $15::int[], $16::varchar[], $17::int[], $18::text[]
        ) AS u(
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links,
          unit_size, life_stage, age, childhood_background
        )
      `, [
        batchSettlementIds, batchCellIds, batchNames, batchProfessions, batchSpecies,
        batchIsNull, batchSparkTiers, batchAttunements, batchChaosIndices,
        batchTempers, batchInstincts, batchMotivations, batchTraits, batchSocialLinks,
        batchUnitSizes, batchLifeStages, batchAges, batchChildhoods
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
      batchLifeStages = [];
      batchAges = [];
      batchChildhoods = [];
    };

    // Clean previous population table
    await client.query("DELETE FROM population_demographics");

    const burgCount = burgsRes.rows.length;
    for (let idx = 0; idx < burgCount; idx++) {
      const burg = burgsRes.rows[idx];

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
      const adultRecordCount = realPop / 12;
      // Exactly 1 child record for every 4 adult records (12 children for every 48 adults)
      const childRecordCount = Math.max(1, Math.floor(adultRecordCount / 4));

      const urbanTier = realPop >= 12000 ? 3 : (realPop >= 1200 ? 2 : 1);
      const popNull = realPop / 2;
      const popAttuned = realPop / 2;

      await client.query(`
        UPDATE sim_burg_economy
        SET pop_null = $1,
            pop_attuned = $2,
            urban_tier = $3,
            pop_growth_pool = 0.0,
            food = GREATEST(food, $4),
            raw_materials = GREATEST(raw_materials, $5)
        WHERE burg_id = $6
      `, [popNull, popAttuned, urbanTier, Math.round(realPop * 0.15), Math.round(realPop * 0.1), burg.burg_id]);

      totalContinentalPop += realPop;
      totalAdultRecords += adultRecordCount;
      totalChildRecords += childRecordCount;

      const burgCitizens: { name: string; species: string; profession: string }[] = [];

      // 1. Generate Adults
      for (let a = 0; a < adultRecordCount; a++) {
        const species = resolveSpecies(burg.species_demographics);
        const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"], "Elian");
        const last = pickRandom(LAST_NAMES[species] || LAST_NAMES["Human"] || ["Thorne"], "Thorne");
        const name = `${first} ${last}`;
        const profession = pickRandom(ADULT_PROFESSIONS, "Laborer");
        const age = Math.floor(Math.random() * 45) + 18; // 18 to 62
        const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Grew up helping with the daily work of their household.");

        // Spark Distribution
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
        const motivation = generateAdultMotivation(profession, temper, species, burg.name || `Burg #${burg.burg_id}`, childhood);

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
        batchTraits.push(JSON.stringify([temper, instinct]));
        batchSocialLinks.push(JSON.stringify(socialLinks));
        batchUnitSizes.push(12);
        batchLifeStages.push("ADULT");
        batchAges.push(age);
        batchChildhoods.push(childhood);

        if (batchNames.length >= BATCH_SIZE) await flushBatch();
      }

      // 2. Generate Children (1 child record per 4 adult records)
      for (let c = 0; c < childRecordCount; c++) {
        const species = resolveSpecies(burg.species_demographics);
        const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Pip"], "Pip");
        const last = burgCitizens.length > 0 ? pickRandom(burgCitizens, burgCitizens[0]!).name.split(" ")[1] || "Thorne" : "Thorne";
        const name = `${first} ${last}`;
        const profession = pickRandom(CHILD_ROLES, "Apprentice");
        const age = Math.floor(Math.random() * 12) + 4; // 4 to 15 years old
        const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Learning the traditions of their elders.");

        // Child spark distribution (exact 50/50 split)
        const sparkRoll = Math.random();
        let isNull = false;
        let sparkTier: "NULL" | "DORMANT_SPARK" | "SENSITIVE" | "CHANNELER" | "ADEPT";
        let attunementLevel = 0.0;
        let chaosIndex = 0.0;

        if (sparkRoll < 0.50) {
          isNull = true;
          sparkTier = "NULL";
          totalNull++;
        } else {
          isNull = false;
          const subRoll = Math.random();
          if (subRoll < 0.50) {
            sparkTier = "DORMANT_SPARK";
            attunementLevel = 0.05;
            totalDormant++;
          } else if (subRoll < 0.85) {
            sparkTier = "SENSITIVE";
            attunementLevel = 0.25;
            totalSensitive++;
          } else if (subRoll < 0.99) {
            sparkTier = "CHANNELER";
            attunementLevel = 0.65;
            totalChannelers++;
          } else {
            sparkTier = "ADEPT";
            attunementLevel = 0.95;
            totalAdepts++;
          }
          chaosIndex = parseFloat((attunementLevel * 10.0).toFixed(2));
        }

        const temper = pickRandom(TEMPERS, "CURIOUS");
        const instinct = pickRandom(INSTINCTS, "WARY");
        const motivation = generateChildMotivation(profession, temper, burg.name || `Burg #${burg.burg_id}`);

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
        batchTraits.push(JSON.stringify([temper, instinct, "YOUTH"]));
        batchSocialLinks.push(JSON.stringify([{ relationship: "KIN", name: last, trust: 0.9 }]));
        batchUnitSizes.push(12);
        batchLifeStages.push("CHILD");
        batchAges.push(age);
        batchChildhoods.push(childhood);

        if (batchNames.length >= BATCH_SIZE) await flushBatch();
      }
    }

    await flushBatch();
    await client.query("COMMIT");

    const totalRecords = totalAdultRecords + totalChildRecords;
    console.log(`[Prerender] SUCCESS! Pre-rendered ${totalRecords.toLocaleString()} citizens across ${burgCount} burgs:`);
    console.log(`  - Adult Cohorts (12:1): ${totalAdultRecords.toLocaleString()}`);
    console.log(`  - Child Cohorts (1 per 4 adults): ${totalChildRecords.toLocaleString()} (~${((totalChildRecords / totalRecords) * 100).toFixed(1)}% of total records)`);
    console.log(`  - True Nulls: ${totalNull.toLocaleString()} (${((totalNull / totalRecords) * 100).toFixed(1)}%)`);
    console.log(`  - Sparkborn: ${(totalDormant + totalSensitive + totalChannelers + totalAdepts).toLocaleString()} (${(((totalDormant + totalSensitive + totalChannelers + totalAdepts) / totalRecords) * 100).toFixed(1)}%)`);
    console.log(`    * Dormant Sparks: ${totalDormant.toLocaleString()}`);
    console.log(`    * Sensitives: ${totalSensitive.toLocaleString()}`);
    console.log(`    * Channelers: ${totalChannelers.toLocaleString()}`);
    console.log(`    * Adepts (Top 1%): ${totalAdepts.toLocaleString()}`);
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
