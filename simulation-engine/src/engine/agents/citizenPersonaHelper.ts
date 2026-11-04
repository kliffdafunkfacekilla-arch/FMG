/**
 * citizenPersonaHelper.ts - Generates authentic living citizens and calculates
 * how their distinct human personalities influence their behavior as Cultists,
 * Wardens, or Mandate Zealots.
 */

export interface CitizenPersona {
  citizenName: string;
  profession: string;
  species: string;
  sparkTier: "NULL" | "DORMANT_SPARK" | "SENSITIVE" | "CHANNELER" | "ADEPT";
  temper: "GREEDY" | "FANATICAL" | "DESPERATE" | "SCHOLARLY" | "STOIC" | "VENGEFUL" | "COMPASSIONATE" | "BITTER";
  instinct: "WARY" | "CURIOUS" | "AGGRESSIVE" | "FEARFUL" | "DEVOUT";
  motivation: string;
  coinSiphonMult: number;
  unrestModifier: number;
  sealDrainMult: number;
  sealRepairMult: number;
  corruptionResistance: number;
  witchHuntFerocity: number;
}

const FIRST_NAMES = [
  "Elian", "Vaelen", "Mara", "Lucian", "Kenneth", "Kaelis", "Cassian", "Theron",
  "Orla", "Bran", "Danica", "Jesse", "Althea", "Ronen", "Gareth", "Teresa",
  "Fiona", "Tobias", "Silas", "Morwen", "Darek", "Brina", "Jarek", "Sylvia"
];

const LAST_NAMES = [
  "Thorne", "Vance", "Ironwood", "Miller", "Blackwood", "Fletcher", "Cooper",
  "Ashfall", "Clearwater", "Vane", "Frost", "Stone", "Cross", "Sterling",
  "Oakhaven", "Gale", "Harrow", "Pike", "Weaver", "Rook"
];

const PROFESSIONS = [
  "Weaver", "Blacksmith", "Miller", "Baker", "Carpenter", "Cobbler", "Stonemason",
  "Tanner", "Fisherman", "Farmer", "City Watchman", "Gate Sentry", "Town Scribe",
  "Hedge Herbalist", "Apothecary Apprentice", "Temple Acolyte", "Clockmaker",
  "Disenfranchised Laborer", "Ruined Merchant", "Beggar"
];

const SPECIES = ["Human", "Bear-Folk", "Wolf-Kin", "Felid", "Saurian", "Avian"];

function pick<T>(arr: T[], fallback: T): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  return item !== undefined ? item : fallback;
}

/**
 * Recruits an authentic civilian into the Cultist Cabal
 */
export function recruitCultistPersona(burgName: string): CitizenPersona {
  const first = pick(FIRST_NAMES, "Vaelen");
  const last = pick(LAST_NAMES, "Thorne");
  const citizenName = `${first} ${last}`;
  const profession = pick(PROFESSIONS, "Weaver");
  const species = pick(SPECIES, "Human");

  const sparkRoll = Math.random();
  let sparkTier: CitizenPersona["sparkTier"] = "DORMANT_SPARK";
  if (sparkRoll < 0.20) sparkTier = "NULL";
  else if (sparkRoll < 0.55) sparkTier = "DORMANT_SPARK";
  else if (sparkRoll < 0.85) sparkTier = "SENSITIVE";
  else if (sparkRoll < 0.97) sparkTier = "CHANNELER";
  else sparkTier = "ADEPT";

  const tempers: CitizenPersona["temper"][] = ["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "BITTER"];
  const temper = pick(tempers, "DESPERATE");

  const instincts: CitizenPersona["instinct"][] = ["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL"];
  const instinct = pick(instincts, "WARY");

  const motivations: Record<string, string[]> = {
    GREEDY: [
      `Ruined by municipal trade tariffs in ${burgName}; joined the cabal to siphon gold and repay heavy debts.`,
      `Saw corrupt nobles feast while common folk starve; determined to hoard wealth for personal power.`
    ],
    FANATICAL: [
      `Witnessed a dragon eclipse dream and became completely convinced the 12 Chaos Dragons will cleanse Ostraka.`,
      `Believes that mortal order is a brittle lie that must be shattered to unleash cosmic truth.`
    ],
    DESPERATE: [
      `Family was starving on the outskirts of ${burgName}; the cabal offered food and protection when the magistrate turned them away.`,
      `Afflicted by strange arcane tremors and ostracized by neighbors; sought refuge among fellow outcasts.`
    ],
    SCHOLARLY: [
      `Former scribe obsessed with forbidden primordial dragon geometry forbidden by orthodox libraries.`,
      `Seeks to decipher ancient dragon sigils and unravel the primal equations of creation.`
    ],
    BITTER: [
      `Lost a sibling to cruel city watch brutality; swore vengeance against the town reeve and council.`,
      `Blames the regional sovereignty for burning their family workshop during the last food riot.`
    ]
  };

  const motivationList = motivations[temper] || motivations["DESPERATE"] || ["Seeking refuge in the shadows"];
  const motivation = pick(motivationList, `Afflicted by hardship in ${burgName}`);

  return {
    citizenName,
    profession,
    species,
    sparkTier,
    temper,
    instinct,
    motivation,
    coinSiphonMult: temper === "GREEDY" ? 2.2 : temper === "DESPERATE" ? 1.4 : 1.0,
    unrestModifier: temper === "FANATICAL" ? 3 : temper === "BITTER" ? 2 : 1,
    sealDrainMult: temper === "SCHOLARLY" ? 2.0 : temper === "FANATICAL" ? 1.5 : 1.0,
    sealRepairMult: 0,
    corruptionResistance: temper === "SCHOLARLY" ? 10 : -10,
    witchHuntFerocity: 1.0
  };
}

/**
 * Recruits an authentic civilian into the Grey Wardens
 */
export function recruitWardenPersona(): CitizenPersona {
  const first = pick(FIRST_NAMES, "Cassian");
  const last = pick(LAST_NAMES, "Stone");
  const citizenName = `${first} ${last}`;
  const profession = pick([
    "Temple Guardian", "Apothecary", "Hedge Astrologer", "Former Watch Captain",
    "Stonemason", "Wandering Scholar", "Clockmaker", "Herbalist"
  ], "Temple Guardian");
  const species = pick(SPECIES, "Human");

  const sparkRoll = Math.random();
  let sparkTier: CitizenPersona["sparkTier"] = "SENSITIVE";
  if (sparkRoll < 0.10) sparkTier = "DORMANT_SPARK";
  else if (sparkRoll < 0.55) sparkTier = "SENSITIVE";
  else if (sparkRoll < 0.88) sparkTier = "CHANNELER";
  else sparkTier = "ADEPT";

  const tempers: CitizenPersona["temper"][] = ["STOIC", "COMPASSIONATE", "SCHOLARLY", "FANATICAL"];
  const temper = pick(tempers, "STOIC");

  const instincts: CitizenPersona["instinct"][] = ["WARY", "DEVOUT", "CURIOUS", "AGGRESSIVE"];
  const instinct = pick(instincts, "DEVOUT");

  const motivations: Record<string, string[]> = {
    STOIC: [
      "Swore an ancient binding oath to stand between innocent civilians and cosmic annihilation.",
      "A veteran soldier who traded secular steel for the sacred burden of holding the dragon seals."
    ],
    COMPASSIONATE: [
      "Guided by a deep empathy for common folk suffering from chaos blight and unnatural droughts.",
      "Cannot bear to see another child mutated by raw aetheric radiation; volunteers for the frontline."
    ],
    SCHOLARLY: [
      "Fascinated by ancient Warden rune-weaving; seeks to master sigil mathematics at the Spire of Convergence.",
      "Believes that stabilizing the 12 cosmic flows is the ultimate intellectual calling of humankind."
    ],
    FANATICAL: [
      "Driven by an unyielding crusade against darkness; vows to eliminate every cultist on Ostraka.",
      "Views martyrdom as the highest honor an awakened soul can achieve in service of cosmic order."
    ]
  };

  const motivationList = motivations[temper] || motivations["STOIC"] || ["Devoted to holding the seals"];
  const motivation = pick(motivationList, "Sworn to protect the realm from cosmic collapse");

  return {
    citizenName,
    profession,
    species,
    sparkTier,
    temper,
    instinct,
    motivation,
    coinSiphonMult: 0,
    unrestModifier: 0,
    sealDrainMult: 0,
    sealRepairMult: temper === "STOIC" ? 1.5 : temper === "SCHOLARLY" ? 1.3 : 1.0,
    corruptionResistance: temper === "STOIC" ? 20 : temper === "FANATICAL" ? -15 : 0,
    witchHuntFerocity: 1.0
  };
}

/**
 * Recruits an authentic civilian into the Mandate of the Chain (The Null Zealots)
 */
export function recruitMandatePersona(burgName: string): CitizenPersona {
  const first = pick(FIRST_NAMES, "Lucian");
  const last = pick(LAST_NAMES, "Cooper");
  const citizenName = `${first} ${last}`;
  const profession = pick([
    "Stonemason", "Cobbler", "Blacksmith", "Woodcutter", "Laborer",
    "Farmer", "Town Guard", "Tanner", "Bailiff Deputy"
  ], "Stonemason");
  const species = pick(SPECIES, "Human");

  const sparkTier: CitizenPersona["sparkTier"] = "NULL";

  const tempers: CitizenPersona["temper"][] = ["VENGEFUL", "FANATICAL", "BITTER", "DESPERATE", "COMPASSIONATE"];
  const temper = pick(tempers, "VENGEFUL");

  const instincts: CitizenPersona["instinct"][] = ["AGGRESSIVE", "DEVOUT", "WARY", "FEARFUL"];
  const instinct = pick(instincts, "AGGRESSIVE");

  const motivations: Record<string, string[]> = {
    VENGEFUL: [
      `Lost their spouse when a wild hedge-wizard lost control of a chaos spark in ${burgName}; vowed to shackle every spark user.`,
      `Bitterly hates the arrogance of awakened channelers who look down on ordinary Null laborers.`
    ],
    FANATICAL: [
      `Devout believer in the Mandate doctrine: sparks are an unholy infection that must be drained to save the world.`,
      `Convinced that by discharging stolen sparks into the dragon prisons, humanity will finally silence the chaos flows.`
    ],
    BITTER: [
      `Worked forty years in the quarries only to be displaced by an adept who carved mountains in minutes.`,
      `Refuses to live in a world where magic users hold unaccountable dominion over mortal lives.`
    ],
    DESPERATE: [
      `Terrified that chaos storms will destroy their farm; joined the Chain warband to protect their remaining children.`,
      `Sought brotherhood and protection among fellow Nulls when the city watch failed to police wild mages.`
    ],
    COMPASSIONATE: [
      `Believes draining sparks actually saves the channelers from losing their minds to eldritch chaos.`,
      `Carries chains not out of hatred, but out of a solemn perceived duty to cleanse the world gently.`
    ]
  };

  const motivationList = motivations[temper] || motivations["VENGEFUL"] || ["Vowed to silence chaotic magic"];
  const motivation = pick(motivationList, "Believes sparks are the true source of all chaos");

  return {
    citizenName,
    profession,
    species,
    sparkTier,
    temper,
    instinct,
    motivation,
    coinSiphonMult: 0,
    unrestModifier: 0,
    sealDrainMult: 0,
    sealRepairMult: 1.0,
    corruptionResistance: 0,
    witchHuntFerocity: temper === "VENGEFUL" ? 1.8 : temper === "BITTER" ? 1.5 : 1.0
  };
}

/**
 * Backfills any existing agents in sim_agents that lack citizen personas
 */
export async function backfillBlankPersonas(client: any): Promise<number> {
  const blankRes = await client.query(`
    SELECT id, role, sub_role, home_burg_id, name
    FROM sim_agents
    WHERE citizen_name IS NULL OR citizen_name = ''
  `);

  if (!blankRes.rows || blankRes.rows.length === 0) return 0;

  for (const row of blankRes.rows) {
    let persona: CitizenPersona;
    if (row.role === "Cultist") {
      persona = recruitCultistPersona(`Burg #${row.home_burg_id || 1}`);
    } else if (row.role === "Warden") {
      persona = recruitWardenPersona();
    } else {
      persona = recruitMandatePersona(`Burg #${row.home_burg_id || 1}`);
    }

    const title = `${persona.citizenName} the ${persona.profession}`;
    await client.query(`
      UPDATE sim_agents
      SET citizen_name = $1,
          profession = $2,
          species = $3,
          spark_tier = $4,
          personality_temper = $5,
          personality_instinct = $6,
          motivation = $7,
          name = CASE 
            WHEN name LIKE 'Cabal of %' OR name = 'Grey Warden Flow-Patrol' OR name LIKE 'Chain Chapter of %' 
            THEN $8
            ELSE name 
          END
      WHERE id = $9
    `, [
      persona.citizenName,
      persona.profession,
      persona.species,
      persona.sparkTier,
      persona.temper,
      persona.instinct,
      persona.motivation,
      title,
      row.id
    ]);
  }

  return blankRes.rows.length;
}

/**
 * Injects narrative tags and emotional state updates into real citizens of a burg
 */
export async function tagBurgCitizens(
  client: any,
  settlementId: number,
  tags: string[],
  newTemper?: string | null,
  newMotivation?: string | null,
  professionFilter?: string | null,
  limit: number = 4
): Promise<number> {
  try {
    const tagsJson = JSON.stringify(tags);
    const res = await client.query(`
      UPDATE population_demographics
      SET traits = (
          SELECT jsonb_agg(DISTINCT elem)
          FROM (
              SELECT jsonb_array_elements_text(COALESCE(traits, '[]'::jsonb)) AS elem
              UNION
              SELECT jsonb_array_elements_text($1::jsonb) AS elem
          ) t
      ),
      temper = COALESCE($2, temper),
      motivation = COALESCE($3, motivation)
      WHERE citizen_id IN (
          SELECT citizen_id FROM population_demographics
          WHERE settlement_id = $4
          AND ($5::text IS NULL OR profession ILIKE $5)
          AND allegiance_status = 'CIVILIAN'
          ORDER BY RANDOM()
          LIMIT $6
      )
      RETURNING citizen_id
    `, [tagsJson, newTemper || null, newMotivation || null, settlementId, professionFilter || null, limit]);
    return res.rowCount || 0;
  } catch (err) {
    return 0;
  }
}
