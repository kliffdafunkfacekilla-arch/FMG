import type { Db } from "../deltas/types.js";
import { getWorkplaceForProfession } from "../economy/goodCatalog.js";
import { adjustCohortCount } from "../entities/population.js";
import { upsertEntity } from "../entities/registry.js";
import { hashSeed, mulberry32 } from "../rng.js";
import { deriveCitizenMotives } from "../rpg/paragonMotives.js";

export interface PromoteFilter {
  profession?: string | undefined;
  species?: string | undefined;
  ageBand?: string | undefined;
  allegiance?: string | undefined;
  isNull?: boolean | undefined;
}

export interface PromotedPersonResult {
  citizenId: number;
  entityRef: string;
  name: string;
  profession: string;
  species: string;
  ageBand: string;
  sparkTier: string;
  isNull: boolean;
  allegiance: string;
  alreadyExisted: boolean;
  cohortKey: string;
}

const FIRST_NAMES: Record<string, string[]> = {
  Human: ["Elian", "Vaelen", "Mara", "Lucian", "Kenneth", "Cassian", "Theron", "Orla", "Danica", "Gareth", "Fiona", "Tobias", "Morwen", "Darek", "Brina", "Jarek", "Sylvia"],
  Avian: ["Corvus", "Aeron", "Peregrine", "Skye", "Talon", "Cirrus", "Zephyr", "Kestrel", "Osprey", "Altair", "Sora", "Gale"],
  "Bear-Folk": ["Bjorn", "Kaelis", "Ursan", "Torben", "Grizel", "Brant", "Hulda", "Bram", "Orson", "Valko", "Thora"],
  "Wolf-Kin": ["Fenrir", "Lupen", "Varik", "Kira", "Ragnar", "Skoll", "Volf", "Freki", "Torva", "Astrid"],
  Felid: ["Leona", "Raza", "Sabre", "Tigran", "Panthera", "Vesper", "Lynx", "Cleo", "Shadow", "Zara"],
  Saurian: ["Krag", "Ssys", "Xerxes", "Scales", "Gorgon", "Viper", "Drakon", "Slither", "Caiman", "Basil"],
  "Plant-Folk": ["Rowan", "Bramble", "Thorn", "Moss", "Willow", "Oakley", "Sylvan", "Fern", "Petal", "Barkley"],
};

const LAST_NAMES: Record<string, string[]> = {
  Human: ["Thorne", "Vance", "Ironwood", "Miller", "Blackwood", "Fletcher", "Cooper", "Ashfall", "Clearwater", "Vane", "Frost", "Stone", "Cross", "Sterling", "Oakhaven", "Pike", "Weaver"],
  Avian: ["Wind-Rider", "Cloud-Crest", "Sky-Watcher", "Feather-Bound", "Gale-Walker", "Storm-Beak", "High-Roost"],
  "Bear-Folk": ["Iron-Paw", "Rock-Cleaver", "Honey-Crag", "Heavy-Stride", "Frost-Fur", "Brawn-Hammer", "Stone-Back"],
  "Wolf-Kin": ["Blood-Howl", "Moon-Stalker", "Grey-Pelt", "Swift-Fang", "Night-Tracker", "Pine-Runner", "Frost-Howl"],
  Felid: ["Silent-Paws", "Shadow-Pounce", "Sun-Basker", "Razor-Claw", "Night-Stalker", "Dune-Leaper"],
  Saurian: ["Iron-Scale", "Deep-Basker", "Mud-Crag", "Venom-Spit", "Swamp-Stalker", "Spire-Tail"],
  "Plant-Folk": ["Deep-Root", "Green-Bough", "Sap-Flow", "Briar-Twist", "Autumn-Leaf", "Iron-Bark"],
};

const CHILDHOOD_BACKGROUNDS = [
  "Apprenticed early at the forge; blistered palms taught them the stubborn value of endurance.",
  "Survived a bitter winter famine by foraging frozen marsh-moss with their elder siblings.",
  "Discovered strange sparks dancing along their fingertips while resting beside an ancient wardstone.",
  "Grew up listening to temple priests chant solemn hymns about the 12 Chaos Dragons and the seals.",
  "Witnessed a city watch raid on their parents' workshop over unpaid grain taxes.",
  "Raised on a frontier farm defending sheep herds from wandering packs.",
  "Spent quiet candlelit hours in a scriptorium copying civic tallies.",
  "Learned to sprint across rooftops carrying urgent missives for the merchant guild.",
];

const TEMPERS = ["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "STOIC", "VENGEFUL", "COMPASSIONATE", "CURIOUS"];
const INSTINCTS = ["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL", "DEVOUT"];

function pickSeeded<T>(arr: readonly T[], rng: () => number, fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[Math.floor(rng() * arr.length)] ?? fallback;
}

export function buildCohortFilterKey(filter: PromoteFilter): string {
  return [
    filter.species ?? "*",
    filter.profession ?? "*",
    filter.ageBand ?? "*",
    filter.allegiance ?? "*",
    filter.isNull === undefined ? "*" : String(filter.isNull),
  ].join("|");
}

/**
 * Deterministically promotes 1 living person out of a matching `population_cohorts` bucket into
 * `population_demographics` and `entities` under a stable `(burgId, cohortKey, slotKey)`. Calling twice
 * with the same `(burgId, filter, slotKey)` returns the exact same person without double-decrementing.
 */
export async function promoteFromCohort(
  db: Db,
  burgId: number,
  filter: PromoteFilter,
  slotKey: string,
  tick: number = 1
): Promise<PromotedPersonResult | null> {
  const cohortKey = buildCohortFilterKey(filter);

  const existingSlot = await db.query(
    `SELECT ps.*, p.name
     FROM promoted_slots ps
     JOIN population_demographics p ON p.citizen_id = ps.citizen_id
     WHERE ps.burg_id = $1 AND ps.cohort_key = $2 AND ps.slot_key = $3
     LIMIT 1`,
    [burgId, cohortKey, slotKey]
  );
  if (existingSlot.rows.length > 0) {
    const s = existingSlot.rows[0];
    return {
      citizenId: Number(s.citizen_id),
      entityRef: String(s.entity_ref),
      name: String(s.name),
      profession: String(s.profession),
      species: String(s.species),
      ageBand: String(s.age_band),
      sparkTier: String(s.spark_tier),
      isNull: Boolean(s.is_null),
      allegiance: String(s.allegiance),
      alreadyExisted: true,
      cohortKey,
    };
  }

  const conds: string[] = ["burg_id = $1", "count > 0"];
  const params: any[] = [burgId];
  let idx = 2;
  if (filter.profession) { conds.push(`profession = $${idx++}`); params.push(filter.profession); }
  if (filter.species) { conds.push(`species = $${idx++}`); params.push(filter.species); }
  if (filter.ageBand) { conds.push(`age_band = $${idx++}`); params.push(filter.ageBand); }
  if (filter.allegiance) { conds.push(`allegiance = $${idx++}`); params.push(filter.allegiance); }
  if (filter.isNull !== undefined) { conds.push(`is_null = $${idx++}`); params.push(filter.isNull); }

  const pickRes = await db.query(
    `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE ${conds.join(" AND ")}
     ORDER BY count DESC, profession ASC, species ASC, age_band ASC, spark_tier ASC, is_null DESC
     LIMIT 1`,
    params
  );
  if (pickRes.rows.length === 0) return null;
  const coh = pickRes.rows[0];

  const burgMetaRes = await db.query(`SELECT cell_id, name FROM sim_burg_economy WHERE burg_id = $1 LIMIT 1`, [burgId]);
  const cellId = burgMetaRes.rows[0]?.cell_id ? Number(burgMetaRes.rows[0].cell_id) : null;
  const burgName = String(burgMetaRes.rows[0]?.name || `Burg #${burgId}`);

  await adjustCohortCount(
    db,
    {
      burgId,
      species: String(coh.species),
      profession: String(coh.profession),
      ageBand: String(coh.age_band),
      sparkTier: String(coh.spark_tier),
      isNull: Boolean(coh.is_null),
      allegiance: String(coh.allegiance),
    },
    -1
  );

  const rng = mulberry32(hashSeed(`${burgId}:${cohortKey}:${slotKey}`));
  const species = String(coh.species);
  const profession = String(coh.profession);
  const ageBand = String(coh.age_band);
  const sparkTier = String(coh.spark_tier);
  const isNull = Boolean(coh.is_null);
  const allegiance = String(coh.allegiance);

  const first = pickSeeded(FIRST_NAMES[species] || FIRST_NAMES.Human!, rng, "Elian");
  const last = pickSeeded(LAST_NAMES[species] || LAST_NAMES.Human!, rng, "Vance");
  const name = `${first} ${last}`;
  const temper = pickSeeded(TEMPERS, rng, "STOIC");
  const instinct = pickSeeded(INSTINCTS, rng, "WARY");
  const childhood = pickSeeded(CHILDHOOD_BACKGROUNDS, rng, CHILDHOOD_BACKGROUNDS[0]!);
  const age = ageBand === "CHILD" ? 7 + Math.floor(rng() * 8) : ageBand === "ELDER" ? 56 + Math.floor(rng() * 18) : 20 + Math.floor(rng() * 28);
  const wp = getWorkplaceForProfession(profession, burgName);
  const motives = deriveCitizenMotives({ profession, temper, instinct, allegiance_status: allegiance });
  const motivation = `Active ${profession} at ${wp.name} in ${burgName}.`;

  const insRes = await db.query(
    `INSERT INTO population_demographics (
       settlement_id, home_cell_id, name, profession, species,
       is_null, spark_tier, attunement_level, chaos_attraction_index,
       temper, instinct, motivation, traits, social_links, allegiance_status,
       unit_size, life_stage, age, childhood_background, is_immigrant,
       workplace_type, workplace_name, want, flaw, line_wont_cross
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13::jsonb, '[]'::jsonb, $14,
       1, $15, $16, $17, false,
       $18, $19, $20, $21, $22
     ) RETURNING citizen_id`,
    [
      burgId,
      cellId,
      name,
      profession,
      species,
      isNull,
      sparkTier,
      isNull ? 0 : 0.3,
      isNull ? 0 : 1.5,
      temper,
      instinct,
      motivation,
      JSON.stringify([temper, instinct]),
      allegiance,
      ageBand,
      age,
      childhood,
      wp.type,
      wp.name,
      motives.want,
      motives.flaw,
      motives.lineWontCross,
    ]
  );

  const citizenId = Number(insRes.rows[0].citizen_id);
  const entityRef = `citizen:${citizenId}`;

  await upsertEntity(db, {
    ref: entityRef,
    kind: "person",
    name: profession ? `${name} (${profession})` : name,
    alive: true,
    lod: "micro",
    cellId,
    sourceTable: "population_demographics",
    sourceId: String(citizenId),
    createdTick: tick,
  });

  await db.query(
    `INSERT INTO promoted_slots (
       burg_id, cohort_key, slot_key, citizen_id, entity_ref,
       species, profession, age_band, spark_tier, is_null, allegiance, created_tick
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      burgId,
      cohortKey,
      slotKey,
      citizenId,
      entityRef,
      species,
      profession,
      ageBand,
      sparkTier,
      isNull,
      allegiance,
      tick,
    ]
  );

  return {
    citizenId,
    entityRef,
    name,
    profession,
    species,
    ageBand,
    sparkTier,
    isNull,
    allegiance,
    alreadyExisted: false,
    cohortKey,
  };
}
