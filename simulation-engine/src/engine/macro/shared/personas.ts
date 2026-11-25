/**
 * Pure procedural fallback persona generators for Cultists, Wardens, and Mandate Zealots.
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
  "Fiona", "Tobias", "Silas", "Morwen", "Darek", "Brina", "Jarek", "Sylvia",
];

const LAST_NAMES = [
  "Thorne", "Vance", "Ironwood", "Miller", "Blackwood", "Fletcher", "Cooper",
  "Ashfall", "Clearwater", "Vane", "Frost", "Stone", "Cross", "Sterling",
  "Oakhaven", "Gale", "Harrow", "Pike", "Weaver", "Rook",
];

const PROFESSIONS = [
  "Weaver", "Blacksmith", "Miller", "Baker", "Carpenter", "Cobbler", "Stonemason",
  "Tanner", "Fisherman", "Farmer", "City Watchman", "Gate Sentry", "Town Scribe",
  "Hedge Herbalist", "Apothecary Apprentice", "Temple Acolyte", "Clockmaker",
  "Disenfranchised Laborer", "Ruined Merchant", "Beggar",
];

const SPECIES = ["Human", "Bear-Folk", "Wolf-Kin", "Felid", "Saurian", "Avian"];

function pick<T>(arr: T[], fallback: T, random: () => number): T {
  const item = arr[Math.floor(random() * arr.length)];
  return item !== undefined ? item : fallback;
}

/** Recruits a fallback civilian persona into a Cultist cabal. */
export function recruitCultistPersona(burgName: string, random: () => number = Math.random): CitizenPersona {
  const first = pick(FIRST_NAMES, "Vaelen", random);
  const last = pick(LAST_NAMES, "Thorne", random);
  const citizenName = `${first} ${last}`;
  const profession = pick(PROFESSIONS, "Weaver", random);
  const species = pick(SPECIES, "Human", random);

  const sparkRoll = random();
  let sparkTier: CitizenPersona["sparkTier"] = "DORMANT_SPARK";
  if (sparkRoll < 0.20) sparkTier = "NULL";
  else if (sparkRoll < 0.55) sparkTier = "DORMANT_SPARK";
  else if (sparkRoll < 0.85) sparkTier = "SENSITIVE";
  else if (sparkRoll < 0.97) sparkTier = "CHANNELER";
  else sparkTier = "ADEPT";

  const tempers: CitizenPersona["temper"][] = ["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "BITTER"];
  const temper = pick(tempers, "DESPERATE", random);

  const instincts: CitizenPersona["instinct"][] = ["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL"];
  const instinct = pick(instincts, "WARY", random);

  const motivations: Record<string, string[]> = {
    GREEDY: [
      `Ruined by municipal trade tariffs in ${burgName}; joined the cabal to siphon gold and repay heavy debts.`,
      `Saw corrupt nobles feast while common folk starve; determined to hoard wealth for personal power.`,
    ],
    FANATICAL: [
      `Witnessed a dragon eclipse dream and became completely convinced the 12 Chaos Dragons will cleanse Ostraka.`,
      `Believes that mortal order is a brittle lie that must be shattered to unleash cosmic truth.`,
    ],
    DESPERATE: [
      `Family was starving on the outskirts of ${burgName}; the cabal offered food and protection when the magistrate turned them away.`,
      `Afflicted by strange arcane tremors and ostracized by neighbors; sought refuge among fellow outcasts.`,
    ],
    SCHOLARLY: [
      `Former scribe obsessed with forbidden primordial dragon geometry forbidden by orthodox libraries.`,
      `Seeks to decipher ancient dragon sigils and unravel the primal equations of creation.`,
    ],
    BITTER: [
      `Lost a sibling to cruel city watch brutality; swore vengeance against the town reeve and council.`,
      `Blames the regional sovereignty for burning their family workshop during the last food riot.`,
    ],
  };

  const motivationList = motivations[temper] || motivations["DESPERATE"] || ["Seeking refuge in the shadows"];
  const motivation = pick(motivationList, `Afflicted by hardship in ${burgName}`, random);

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
    witchHuntFerocity: 1.0,
  };
}

/** Recruits a fallback civilian persona into the Grey Wardens. */
export function recruitWardenPersona(random: () => number = Math.random): CitizenPersona {
  const first = pick(FIRST_NAMES, "Cassian", random);
  const last = pick(LAST_NAMES, "Stone", random);
  const citizenName = `${first} ${last}`;
  const profession = pick(
    [
      "Temple Guardian", "Apothecary", "Hedge Astrologer", "Former Watch Captain",
      "Stonemason", "Wandering Scholar", "Clockmaker", "Herbalist",
    ],
    "Temple Guardian",
    random
  );
  const species = pick(SPECIES, "Human", random);

  const sparkRoll = random();
  let sparkTier: CitizenPersona["sparkTier"] = "SENSITIVE";
  if (sparkRoll < 0.10) sparkTier = "DORMANT_SPARK";
  else if (sparkRoll < 0.55) sparkTier = "SENSITIVE";
  else if (sparkRoll < 0.88) sparkTier = "CHANNELER";
  else sparkTier = "ADEPT";

  const tempers: CitizenPersona["temper"][] = ["STOIC", "COMPASSIONATE", "SCHOLARLY", "FANATICAL"];
  const temper = pick(tempers, "STOIC", random);

  const instincts: CitizenPersona["instinct"][] = ["WARY", "DEVOUT", "CURIOUS", "AGGRESSIVE"];
  const instinct = pick(instincts, "DEVOUT", random);

  const motivations: Record<string, string[]> = {
    STOIC: [
      "Swore an ancient binding oath to stand between innocent civilians and cosmic annihilation.",
      "A veteran soldier who traded secular steel for the sacred burden of holding the dragon seals.",
    ],
    COMPASSIONATE: [
      "Guided by a deep empathy for common folk suffering from chaos blight and unnatural droughts.",
      "Cannot bear to see another child mutated by raw aetheric radiation; volunteers for the frontline.",
    ],
    SCHOLARLY: [
      "Fascinated by ancient Warden rune-weaving; seeks to master sigil mathematics at the Sacred Spire.",
      "Believes that stabilizing the 12 cosmic flows is the ultimate intellectual calling of humankind.",
    ],
    FANATICAL: [
      "Driven by an unyielding crusade against darkness; vows to eliminate every cultist on Ostraka.",
      "Views martyrdom as the highest honor an awakened soul can achieve in service of cosmic order.",
    ],
  };

  const motivationList = motivations[temper] || motivations["STOIC"] || ["Devoted to holding the seals"];
  const motivation = pick(motivationList, "Sworn to protect the realm from cosmic collapse", random);

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
    witchHuntFerocity: 1.0,
  };
}

/** Recruits a fallback Null civilian persona into the Mandate of the Chain. */
export function recruitMandatePersona(burgName: string, random: () => number = Math.random): CitizenPersona {
  const first = pick(FIRST_NAMES, "Lucian", random);
  const last = pick(LAST_NAMES, "Cooper", random);
  const citizenName = `${first} ${last}`;
  const profession = pick(
    [
      "Stonemason", "Cobbler", "Blacksmith", "Woodcutter", "Laborer",
      "Farmer", "Town Guard", "Tanner", "Bailiff Deputy",
    ],
    "Stonemason",
    random
  );
  const species = pick(SPECIES, "Human", random);

  const sparkTier: CitizenPersona["sparkTier"] = "NULL";

  const tempers: CitizenPersona["temper"][] = ["VENGEFUL", "FANATICAL", "BITTER", "DESPERATE", "COMPASSIONATE"];
  const temper = pick(tempers, "VENGEFUL", random);

  const instincts: CitizenPersona["instinct"][] = ["AGGRESSIVE", "DEVOUT", "WARY", "FEARFUL"];
  const instinct = pick(instincts, "AGGRESSIVE", random);

  const motivations: Record<string, string[]> = {
    VENGEFUL: [
      `Lost their spouse when a wild hedge-wizard lost control of a chaos spark in ${burgName}; vowed to shackle every spark user.`,
      `Bitterly hates the arrogance of awakened channelers who look down on ordinary Null laborers.`,
    ],
    FANATICAL: [
      `Devout believer in the Mandate doctrine: sparks are an unholy infection that must be drained to save the world.`,
      `Convinced that by discharging stolen sparks into the dragon prisons, humanity will finally silence the chaos flows.`,
    ],
    BITTER: [
      `Worked forty years in the quarries only to be displaced by an adept who carved mountains in minutes.`,
      `Refuses to live in a world where magic users hold unaccountable dominion over mortal lives.`,
    ],
    DESPERATE: [
      `Terrified that chaos storms will destroy their farm; joined the Chain warband to protect their remaining children.`,
      `Sought brotherhood and protection among fellow Nulls when the city watch failed to police wild mages.`,
    ],
    COMPASSIONATE: [
      `Believes draining sparks actually saves the channelers from losing their minds to eldritch chaos.`,
      `Carries chains not out of hatred, but out of a solemn perceived duty to cleanse the world gently.`,
    ],
  };

  const motivationList = motivations[temper] || motivations["VENGEFUL"] || ["Vowed to silence chaotic magic"];
  const motivation = pick(motivationList, "Believes sparks are the true source of all chaos", random);

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
    witchHuntFerocity: temper === "VENGEFUL" ? 1.8 : temper === "BITTER" ? 1.5 : 1.0,
  };
}
