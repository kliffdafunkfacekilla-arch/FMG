/**
 * prerenderWorldPopulation.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pre-renders the entire persistent citizen population across all burgs
 * at a strict 12-to-1 consolidation ratio (1 citizen record per unit of 12),
 * assigning professions and workplaces directly from each burg's map
 * primary extraction profile, secondary crafting production, port/river access,
 * and faction logistics capabilities.
 */

import pool from "./pool";
import {
  AIR_CAPABLE_FACTION_IDS,
  getProfessionForGood,
  getWorkplaceForProfession,
} from "../engine/economy/goodCatalog";

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

const ADULT_PROFESSIONS_MAINTENANCE = [
  "Stonemason", "Carpenter", "Cooper", "Cobbler", "Town Scribe", "Clockmaker", "Disenfranchised Laborer"
];
const ADULT_PROFESSIONS_HEALTH_SPIRIT = [
  "Temple Acolyte", "Hedge Herbalist", "Apothecary Apprentice", "Temple Priest", "Sanctuary Healer"
];
const ADULT_PROFESSIONS_DEFENSE = [
  "City Watchman", "Gate Sentry", "Town Investigator", "Militia Guard", "Garrison Scout", "Armorer"
];

const CHILD_ROLES_FOOD = ["Farm Hand", "Mill Apprentice", "Orchard Youth", "Pasture Youth"];
const CHILD_ROLES_RESOURCE = ["Forge Apprentice", "Weaver Youth", "Woodsman Lad", "Potter Apprentice"];
const CHILD_ROLES_MAINTENANCE = ["Tinker Apprentice", "Mason Apprentice", "Scribe Runner", "Workshop Scullion"];
const CHILD_ROLES_HEALTH_SPIRIT = ["Herbalist Gatherer", "Temple Ward", "Apothecary Ward"];
const CHILD_ROLES_DEFENSE = ["Cadet Runner", "Stable Hand", "Lookout Youth"];

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

function pickWeighted<T>(items: Array<{ item: T; weight: number }>, fallback: T): T {
  const valid = items.filter((i) => i.weight > 0);
  if (valid.length === 0) return fallback;
  const total = valid.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const entry of valid) {
    r -= entry.weight;
    if (r <= 0) return entry.item;
  }
  return valid[valid.length - 1]!.item;
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

interface BurgProfessionWeights {
  primaryPool: Array<{ item: string; weight: number }>;
  craftedPool: Array<{ item: string; weight: number }>;
  logisticsPool: Array<{ item: string; weight: number }>;
  guaranteed: string[];
  isAquatic: boolean;
}

function buildBurgProfessionWeights(burg: any): BurgProfessionWeights {
  let profile: { primary?: Array<{ goodId: number; share: number }>; crafted?: Array<{ goodId: number; targetOutput: number }> } = {};
  try {
    if (burg.resource_profile) {
      profile = typeof burg.resource_profile === "string" ? JSON.parse(burg.resource_profile) : burg.resource_profile;
    }
  } catch {}

  const isAquatic = Boolean(burg.port) || (Number(burg.river_id) || 0) > 0;
  const factionId = Number(burg.faction_id) || 0;
  const hasAir = AIR_CAPABLE_FACTION_IDS.has(factionId);

  const primaryWeights = new Map<string, number>();
  const primarySet = new Set<string>();
  const primEntries = Array.isArray(profile.primary) ? profile.primary : [];
  for (const entry of primEntries) {
    const role = getProfessionForGood(Number(entry.goodId));
    if (role.profession === "Fisherman" && !isAquatic) continue;
    const w = Math.max(0.05, Number(entry.share) || 0.1);
    primaryWeights.set(role.profession, (primaryWeights.get(role.profession) || 0) + w);
    primarySet.add(role.profession);
  }
  if (primaryWeights.size === 0) {
    primaryWeights.set("Farmer", 0.5);
    primaryWeights.set("Woodcutter", 0.5);
    primarySet.add("Farmer");
    primarySet.add("Woodcutter");
  }
  // Modest local provisions support
  primaryWeights.set("Baker", (primaryWeights.get("Baker") || 0) + 0.08);
  primaryWeights.set("Grain Miller", (primaryWeights.get("Grain Miller") || 0) + 0.06);

  const craftedWeights = new Map<string, number>();
  const craftedSet = new Set<string>();
  let prodEntries: Array<{ goodId: number; targetOutput: number }> = Array.isArray(profile.crafted) ? profile.crafted : [];
  if (prodEntries.length === 0 && Array.isArray(burg.production)) {
    prodEntries = burg.production.map(([gid, out]: [number, number]) => ({ goodId: Number(gid), targetOutput: Number(out) || 1 }));
  }
  for (const entry of prodEntries) {
    const role = getProfessionForGood(Number(entry.goodId));
    const w = Math.max(2, (Number(entry.targetOutput) || 1) * 5);
    craftedWeights.set(role.profession, (craftedWeights.get(role.profession) || 0) + w);
    craftedSet.add(role.profession);
  }
  for (const fallbackCraft of ["Blacksmith", "Carpenter", "Weaver", "Potter", "Foundry Worker", "Tanner", "Brewmaster"]) {
    craftedWeights.set(fallbackCraft, (craftedWeights.get(fallbackCraft) || 0) + 1);
  }

  const logisticsPool: Array<{ item: string; weight: number }> = [
    { item: "Merchant Factor", weight: 3 },
    { item: "Caravan Drover", weight: 3 },
    { item: "Caravan Guard", weight: 2 },
  ];
  const logisticsSet = new Set<string>(["Merchant Factor", "Caravan Drover", "Caravan Guard"]);
  if (isAquatic) {
    logisticsPool.push({ item: "Sailor", weight: 2.5 });
    logisticsSet.add("Sailor");
  }
  if (hasAir) {
    logisticsPool.push({ item: "Aether-Crew", weight: 2.0 });
    logisticsSet.add("Aether-Crew");
  }

  const guaranteed = [
    ...Array.from(primarySet),
    ...Array.from(craftedSet),
    ...Array.from(logisticsSet),
    "City Watchman",
    "Farmer"
  ];

  return {
    primaryPool: Array.from(primaryWeights.entries()).map(([item, weight]) => ({ item, weight })),
    craftedPool: Array.from(craftedWeights.entries()).map(([item, weight]) => ({ item, weight })),
    logisticsPool,
    guaranteed,
    isAquatic
  };
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
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS workplace_type VARCHAR(64);
      ALTER TABLE population_demographics ADD COLUMN IF NOT EXISTS workplace_name VARCHAR(128);

      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS pop_growth_pool FLOAT DEFAULT 0.0;

      CREATE INDEX IF NOT EXISTS idx_pop_settlement ON population_demographics(settlement_id);
      CREATE INDEX IF NOT EXISTS idx_pop_home_cell ON population_demographics(home_cell_id);
      CREATE INDEX IF NOT EXISTS idx_pop_spark ON population_demographics(spark_tier);
      CREATE INDEX IF NOT EXISTS idx_pop_allegiance ON population_demographics(allegiance_status);
      CREATE INDEX IF NOT EXISTS idx_pop_stage ON population_demographics(settlement_id, life_stage);
      CREATE INDEX IF NOT EXISTS idx_pop_demo_workplace ON population_demographics(workplace_type);
    `);

    // 2. Fetch all burgs with their economic profile, coastal/river flags & faction
    const burgsRes = await client.query(`
      SELECT b.burg_id, b.name, b.cell_id, b.urban_tier, b.is_capital, b.port,
             b.species_demographics, b.wealth, b.resource_profile, b.production,
             c.faction_id, c.river_id
      FROM sim_burg_economy b
      LEFT JOIN sim_cells c ON c.id = b.cell_id
      ORDER BY b.wealth DESC, b.burg_id ASC
    `);

    console.log(`[Prerender] Re-normalizing populations for ${burgsRes.rows.length} burgs with economy-driven professions...`);

    let totalContinentalPop = 0;
    let totalAdultRecords = 0;
    let totalChildRecords = 0;

    let totalNull = 0;
    let totalDormant = 0;
    let totalSensitive = 0;
    let totalChannelers = 0;
    let totalAdepts = 0;

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
    let batchWpTypes: string[] = [];
    let batchWpNames: string[] = [];

    const flushBatch = async () => {
      if (batchNames.length === 0) return;
      await client.query(`
        INSERT INTO population_demographics (
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links, allegiance_status,
          unit_size, life_stage, age, childhood_background,
          workplace_type, workplace_name
        )
        SELECT
          u.settlement_id, u.home_cell_id, u.name, u.profession, u.species,
          u.is_null, u.spark_tier, u.attunement_level, u.chaos_attraction_index,
          u.temper, u.instinct, u.motivation, u.traits::jsonb, u.social_links::jsonb, 'CIVILIAN',
          u.unit_size, u.life_stage, u.age, u.childhood_background,
          u.workplace_type, u.workplace_name
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
          $6::boolean[], $7::varchar[], $8::float[], $9::float[],
          $10::varchar[], $11::varchar[], $12::text[], $13::text[], $14::text[],
          $15::int[], $16::varchar[], $17::int[], $18::text[],
          $19::varchar[], $20::varchar[]
        ) AS u(
          settlement_id, home_cell_id, name, profession, species,
          is_null, spark_tier, attunement_level, chaos_attraction_index,
          temper, instinct, motivation, traits, social_links,
          unit_size, life_stage, age, childhood_background,
          workplace_type, workplace_name
        )
      `, [
        batchSettlementIds, batchCellIds, batchNames, batchProfessions, batchSpecies,
        batchIsNull, batchSparkTiers, batchAttunements, batchChaosIndices,
        batchTempers, batchInstincts, batchMotivations, batchTraits, batchSocialLinks,
        batchUnitSizes, batchLifeStages, batchAges, batchChildhoods,
        batchWpTypes, batchWpNames
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
      batchWpTypes = [];
      batchWpNames = [];
    };

    await client.query("DELETE FROM population_demographics");

    const burgCount = burgsRes.rows.length;
    for (let idx = 0; idx < burgCount; idx++) {
      const burg = burgsRes.rows[idx];
      const burgName = burg.name || `Burg #${burg.burg_id}`;
      const profWeights = buildBurgProfessionWeights(burg);

      const progress = burgCount > 1 ? idx / (burgCount - 1) : 0;
      let realPop = 0;
      if (progress < 0.15) {
        const t = progress / 0.15;
        realPop = Math.round(75000 - t * 40000);
      } else if (progress < 0.40) {
        const t = (progress - 0.15) / 0.25;
        realPop = Math.round(35000 - t * 23000);
      } else if (progress < 0.75) {
        const t = (progress - 0.40) / 0.35;
        realPop = Math.round(12000 - t * 9000);
      } else {
        const t = (progress - 0.75) / 0.25;
        realPop = Math.round(3000 - t * 2200);
      }

      realPop = Math.max(120, Math.round(realPop / 12) * 12);
      const adultRecordCount = realPop / 12;
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
      `, [popNull, popAttuned, urbanTier, Math.round(realPop * 0.25), Math.round(realPop * 0.1), burg.burg_id]);

      totalContinentalPop += realPop;
      totalAdultRecords += adultRecordCount;
      totalChildRecords += childRecordCount;

      const burgCitizens: { name: string; species: string; profession: string }[] = [];

      // 1. Generate Adults grounded in this burg's real economic & logistics roles
      for (let a = 0; a < adultRecordCount; a++) {
        const species = resolveSpecies(burg.species_demographics);
        const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"], "Elian");
        const last = pickRandom(LAST_NAMES[species] || LAST_NAMES["Human"] || ["Thorne"], "Thorne");
        const name = `${first} ${last}`;

        let profession: string;
        if (a < profWeights.guaranteed.length) {
          profession = profWeights.guaranteed[a]!;
        } else {
          const slot = a % 12;
          if (slot < 5) {
            profession = pickWeighted(profWeights.primaryPool, "Farmer");
          } else if (slot < 7) {
            profession = pickWeighted(profWeights.craftedPool, "Blacksmith");
          } else if (slot === 7) {
            profession = pickWeighted(profWeights.logisticsPool, "Caravan Drover");
          } else if (slot === 8) {
            profession = pickRandom(ADULT_PROFESSIONS_MAINTENANCE, "Carpenter");
          } else if (slot === 9) {
            profession = pickRandom(ADULT_PROFESSIONS_HEALTH_SPIRIT, "Temple Acolyte");
          } else {
            profession = pickRandom(ADULT_PROFESSIONS_DEFENSE, "City Watchman");
          }
        }

        const wp = getWorkplaceForProfession(profession, burgName);
        const age = Math.floor(Math.random() * 45) + 18;
        const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Grew up helping with the daily work of their household.");

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
        const motivation = generateAdultMotivation(profession, temper, species, burgName, childhood);

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
        batchWpTypes.push(wp.type);
        batchWpNames.push(wp.name);

        if (batchNames.length >= BATCH_SIZE) await flushBatch();
      }

      // 2. Generate Children (1 child record per 4 adult records)
      const foodChildren = profWeights.isAquatic ? [...CHILD_ROLES_FOOD, "Fisher Boy"] : CHILD_ROLES_FOOD;
      for (let c = 0; c < childRecordCount; c++) {
        const species = resolveSpecies(burg.species_demographics);
        const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Pip"], "Pip");
        const last = burgCitizens.length > 0 ? pickRandom(burgCitizens, burgCitizens[0]!).name.split(" ")[1] || "Thorne" : "Thorne";
        const name = `${first} ${last}`;

        const childSlot = c % 12;
        let profession: string;
        if (childSlot < 6) {
          profession = pickRandom(foodChildren, "Farm Hand");
        } else if (childSlot < 8) {
          profession = pickRandom(CHILD_ROLES_RESOURCE, "Forge Apprentice");
        } else if (childSlot === 8) {
          profession = pickRandom(CHILD_ROLES_MAINTENANCE, "Tinker Apprentice");
        } else if (childSlot === 9) {
          profession = pickRandom(CHILD_ROLES_HEALTH_SPIRIT, "Herbalist Gatherer");
        } else {
          profession = pickRandom(CHILD_ROLES_DEFENSE, "Cadet Runner");
        }

        const age = Math.floor(Math.random() * 12) + 4;
        const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Learning the traditions of their elders.");

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
        const motivation = generateChildMotivation(profession, temper, burgName);

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
        batchWpTypes.push("APPRENTICESHIP");
        batchWpNames.push(`${burgName} Trade Guildhall`);

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

if (require.main === module) {
  prerenderWorldPopulation().then(() => {
    pool.end();
    process.exit(0);
  }).catch(() => {
    pool.end();
    process.exit(1);
  });
}
