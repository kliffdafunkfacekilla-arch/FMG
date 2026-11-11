/**
 * NPC MIND PURE ENGINE (OSTRAKA NPC COGNITION)
 * ====================================================
 * A pure, deterministic evaluation function governing individual NPC cognition.
 * Adheres strictly to GEMINI.md rules:
 * - Pure functions: Zero DOM, Zero direct DB calls, deterministic output.
 * - Structure of Arrays & typed records for CPU cache friendliness.
 * - Double quotes and semicolons throughout.
 *
 * Simulates real human agency through:
 * 1. 5 Core Needs: Food, Rest, Coin, Safety, Company.
 * 2. 3 Dynamic Mood Vectors: Fear, Anger, Joy (with homeostatic return to personality baseline).
 * 3. Beliefs & Rumors: Sourced knowledge with confidence and temporal decay.
 * 4. Social Mesh & Trust: Inter-NPC trust links for belief propagation (gossip).
 * 5. Utility Scoring with Hysteresis: Resilient decision making without action flickering.
 */

export type NPCInstinct = "WARY" | "HERD" | "BOLD" | "GREEDY" | "CURIOUS" | "DISCIPLINED";
export type NPCTemper = "STOIC" | "VOLATILE" | "WARM" | "CYNICAL" | "PROUD";

export interface NPCNeeds {
  food: number;     // 0.0 (starving) to 1.0 (satiated)
  rest: number;     // 0.0 (exhausted) to 1.0 (fully rested)
  coin: number;     // 0.0 (destitute) to 1.0 (financially secure)
  safety: number;   // 0.0 (in mortal peril) to 1.0 (secure)
  company: number;  // 0.0 (isolated) to 1.0 (socially fulfilled)
}

export interface NPCMood {
  fear: number;     // 0.0 to 1.0
  anger: number;    // 0.0 to 1.0
  joy: number;      // 0.0 to 1.0
}

export interface NPCBelief {
  topic: string;    // e.g. "unsafe:market", "famine:granary_empty", "distrusts:player"
  strength: number; // 0.0 to 1.0 (conviction)
  source: string;   // e.g. "witnessed", "gossip:citizen_4", "decree"
  certainty: number;// 0.0 to 1.0
}

export interface NPCSocialLink {
  targetNpcId: string;
  trust: number;    // -1.0 (mortal enemy) to +1.0 (devoted kin)
  relation: string; // "kin" | "friend" | "employer" | "rival" | "acquaintance"
}

export interface NPCMindState {
  npcId: string;
  role: string;
  instinct: NPCInstinct;
  temper: NPCTemper;
  needs: NPCNeeds;
  mood: NPCMood;
  beliefs: NPCBelief[];
  socialLinks: NPCSocialLink[];
  lastAction: ActionUtilityChoice;
}

export interface BurgEnvironmentalContext {
  burgId: number;
  foodStock: number;
  wealth: number;
  unrest: number;        // 0 to 100
  crimeRate: number;      // 0 to 100
  recentEvents?: Array<{ type: string; message: string; tier?: string }>;
  isDaytime: boolean;
  diurnalPhase: "MORNING" | "MIDDAY" | "EVENING" | "NIGHT";
}

export type ActionUtilityChoice =
  | "ROUTINE_WORK"
  | "ROUTINE_LEISURE"
  | "ROUTINE_REST"
  | "STAY_HOME"
  | "PROTEST_PLAZA"
  | "HOARD_FOOD"
  | "SEEK_HELP"
  | "FLEE_BURG";

export interface NPCMindEvaluationResult {
  nextNeeds: NPCNeeds;
  nextMood: NPCMood;
  nextBeliefs: NPCBelief[];
  chosenAction: ActionUtilityChoice;
  actionReason: string;
  dispositionToPlayer: number; // -2 to +2
  tradePriceMultiplier: number; // 0.8x to 1.5x
  semanticDialogueTags: string[];
  gossipPayload: NPCBelief | null;
}

/**
 * Returns the baseline resting mood levels determined by Instinct and Temper.
 */
export function getPersonalityBaselineMood(instinct: NPCInstinct, temper: NPCTemper): NPCMood {
  let fear = 0.10;
  let anger = 0.10;
  let joy = 0.20;

  // Instinct modifier
  switch (instinct) {
    case "WARY": fear += 0.15; break;
    case "BOLD": fear = Math.max(0.02, fear - 0.08); break;
    case "GREEDY": anger += 0.05; break;
    case "CURIOUS": joy += 0.10; break;
    case "DISCIPLINED": fear = Math.max(0.05, fear - 0.05); break;
    case "HERD": fear += 0.05; break;
  }

  // Temper modifier
  switch (temper) {
    case "STOIC":
      fear = Math.min(fear, 0.08);
      anger = Math.min(anger, 0.08);
      break;
    case "VOLATILE":
      fear += 0.08;
      anger += 0.12;
      break;
    case "WARM":
      joy += 0.18;
      anger = Math.max(0.02, anger - 0.06);
      break;
    case "CYNICAL":
      anger += 0.15;
      joy = Math.max(0.05, joy - 0.12);
      break;
    case "PROUD":
      anger += 0.10;
      break;
  }

  return {
    fear: Math.max(0, Math.min(1, fear)),
    anger: Math.max(0, Math.min(1, anger)),
    joy: Math.max(0, Math.min(1, joy))
  };
}

/**
 * PURE FUNCTION: Evaluates the next mental state, choice of action, and demeanor of an NPC.
 */
export function evaluateNPCMind(
  state: NPCMindState,
  env: BurgEnvironmentalContext,
  deltaHours: number = 24
): NPCMindEvaluationResult {
  const timeFactor = Math.max(0.1, deltaHours / 24);

  // -------------------------------------------------------------------------
  // 1. NEEDS STEP (Metabolic burn and environmental replenishment)
  // -------------------------------------------------------------------------
  const nextNeeds: NPCNeeds = { ...state.needs };

  // Food metabolism: burns ~0.15 per day
  nextNeeds.food = Math.max(0, nextNeeds.food - 0.15 * timeFactor);
  // Rest metabolism: burns ~0.20 while active
  nextNeeds.rest = Math.max(0, nextNeeds.rest - 0.20 * timeFactor);

  // Food intake: If burg has food (> 200) and not sleeping, citizen eats
  if (env.foodStock > 200 && env.diurnalPhase !== "NIGHT") {
    nextNeeds.food = Math.min(1.0, nextNeeds.food + 0.35 * timeFactor);
  } else if (env.foodStock < 100) {
    // Severe famine in burg prevents food recovery
    nextNeeds.food = Math.max(0, nextNeeds.food - 0.08 * timeFactor);
  }

  // Rest recovery: When resting or in NIGHT phase, rest is restored
  if (env.diurnalPhase === "NIGHT" || state.lastAction === "ROUTINE_REST" || state.lastAction === "STAY_HOME") {
    nextNeeds.rest = Math.min(1.0, nextNeeds.rest + 0.50 * timeFactor);
  }

  // Safety reflects burg crime rate and unrest
  const baseSafety = Math.max(0.05, 1.0 - (env.unrest * 0.005 + env.crimeRate * 0.004));
  nextNeeds.safety = Math.max(0, Math.min(1, nextNeeds.safety * 0.7 + baseSafety * 0.3));

  // Coin depends on burg wealth and citizen greed
  const baseCoin = Math.max(0.1, Math.min(0.9, env.wealth / 1500));
  nextNeeds.coin = Math.max(0, Math.min(1, nextNeeds.coin * 0.85 + baseCoin * 0.15));

  // Company decays if isolated
  if (state.lastAction === "STAY_HOME") {
    nextNeeds.company = Math.max(0, nextNeeds.company - 0.15 * timeFactor);
  } else {
    nextNeeds.company = Math.min(1.0, nextNeeds.company + 0.20 * timeFactor);
  }

  // -------------------------------------------------------------------------
  // 2. PERCEPTION & EVENT INGESTION
  // -------------------------------------------------------------------------
  const nextBeliefs: NPCBelief[] = [];
  const existingBeliefsMap = new Map<string, NPCBelief>();

  // Age existing beliefs with temporal decay
  for (const b of state.beliefs) {
    const decayedStrength = b.strength * Math.pow(0.90, timeFactor);
    if (decayedStrength > 0.08) {
      const updated = { ...b, strength: decayedStrength };
      nextBeliefs.push(updated);
      existingBeliefsMap.set(b.topic, updated);
    }
  }

  // Ingest today's burg events into localized beliefs
  for (const ev of (env.recentEvents || [])) {
    const text = ev.message.toLowerCase();
    if (text.includes("famine") || text.includes("starv") || text.includes("bread") || env.foodStock < 100) {
      upsertBelief(nextBeliefs, existingBeliefsMap, "famine:granary_empty", 0.85, "witnessed");
    }
    if (text.includes("riot") || text.includes("unrest") || text.includes("clash") || env.unrest > 50) {
      upsertBelief(nextBeliefs, existingBeliefsMap, "unsafe:civil_unrest", 0.80, "witnessed");
    }
    if (text.includes("cartel") || text.includes("crime") || text.includes("smuggl") || env.crimeRate > 60) {
      upsertBelief(nextBeliefs, existingBeliefsMap, "threat:cartel_presence", 0.70, "witnessed");
    }
  }

  // Local state triggers
  if (nextNeeds.food < 0.25) {
    upsertBelief(nextBeliefs, existingBeliefsMap, "need:desperate_hunger", 0.95, "internal");
  }
  if (nextNeeds.safety < 0.3) {
    upsertBelief(nextBeliefs, existingBeliefsMap, "threat:streets_dangerous", 0.85, "internal");
  }

  // -------------------------------------------------------------------------
  // 3. MOOD DELTA & HOMEOSTATIC RETURN
  // -------------------------------------------------------------------------
  const baseline = getPersonalityBaselineMood(state.instinct, state.temper);
  const decayRate = state.temper === "STOIC" ? 0.35 : state.temper === "VOLATILE" ? 0.15 : 0.25;

  let nextFear = state.mood.fear + (baseline.fear - state.mood.fear) * decayRate * timeFactor;
  let nextAnger = state.mood.anger + (baseline.anger - state.mood.anger) * decayRate * timeFactor;
  let nextJoy = state.mood.joy + (baseline.joy - state.mood.joy) * decayRate * timeFactor;

  // Needs impact on mood
  if (nextNeeds.food < 0.3) {
    nextAnger += 0.25 * (1.0 - nextNeeds.food / 0.3);
    nextFear += 0.15 * (1.0 - nextNeeds.food / 0.3);
    nextJoy = Math.max(0, nextJoy - 0.20);
  }
  if (nextNeeds.safety < 0.4) {
    nextFear += 0.30 * (1.0 - nextNeeds.safety / 0.4);
    nextJoy = Math.max(0, nextJoy - 0.15);
  }
  if (env.unrest > 50) {
    nextAnger += (env.unrest - 50) * 0.005;
  }

  const nextMood: NPCMood = {
    fear: Math.max(0, Math.min(1.0, nextFear)),
    anger: Math.max(0, Math.min(1.0, nextAnger)),
    joy: Math.max(0, Math.min(1.0, nextJoy))
  };

  // -------------------------------------------------------------------------
  // 4. UTILITY SCORING WITH HYSTERESIS (+0.15 on lastAction)
  // -------------------------------------------------------------------------
  const scores: Record<ActionUtilityChoice, number> = {
    ROUTINE_WORK: 0,
    ROUTINE_LEISURE: 0,
    ROUTINE_REST: 0,
    STAY_HOME: 0,
    PROTEST_PLAZA: 0,
    HOARD_FOOD: 0,
    SEEK_HELP: 0,
    FLEE_BURG: 0
  };

  const isNight = env.diurnalPhase === "NIGHT";
  const isEvening = env.diurnalPhase === "EVENING";
  const isWorkPhase = env.diurnalPhase === "MORNING" || env.diurnalPhase === "MIDDAY";

  // ROUTINE_WORK
  if (isWorkPhase) {
    scores.ROUTINE_WORK = 60 * nextNeeds.safety * (1.0 - nextMood.fear * 0.6);
    if (state.instinct === "DISCIPLINED") scores.ROUTINE_WORK += 25;
    if (state.role.toLowerCase().includes("guard") || state.role.toLowerCase().includes("sentry")) {
      scores.ROUTINE_WORK += 20; // Duty bound
    }
  }

  // ROUTINE_LEISURE (Tavern / Plaza socializing)
  if (isEvening) {
    scores.ROUTINE_LEISURE = 55 * (nextNeeds.company < 0.5 ? 1.4 : 1.0) * (1.0 - nextMood.fear * 0.5);
    if (state.instinct === "HERD") scores.ROUTINE_LEISURE += 20;
    if (state.temper === "WARM") scores.ROUTINE_LEISURE += 15;
  }

  // ROUTINE_REST
  if (isNight) {
    scores.ROUTINE_REST = 75 + (1.0 - nextNeeds.rest) * 35;
  } else if (nextNeeds.rest < 0.25) {
    scores.ROUTINE_REST = 50 + (0.25 - nextNeeds.rest) * 80;
  }

  // STAY_HOME (Fearful isolation behind bolted shutters)
  if (nextMood.fear > 0.45 || nextNeeds.safety < 0.35) {
    scores.STAY_HOME = (nextMood.fear * 60) + (1.0 - nextNeeds.safety) * 40;
    if (state.instinct === "WARY") scores.STAY_HOME += 25;
    if (hasBelief(nextBeliefs, "unsafe:civil_unrest")) scores.STAY_HOME += 20;
  }

  // PROTEST_PLAZA (Emergent civic demonstration or riot)
  const hasHungerBelief = hasBelief(nextBeliefs, "famine:granary_empty") || nextNeeds.food < 0.3;
  if ((nextMood.anger > 0.45 || hasHungerBelief) && !isNight) {
    scores.PROTEST_PLAZA = (nextMood.anger * 55) + (1.0 - nextNeeds.food) * 45;
    if (state.instinct === "HERD") scores.PROTEST_PLAZA += 18; // Follows the crowd
    if (state.temper === "PROUD" || state.temper === "VOLATILE") scores.PROTEST_PLAZA += 20;
    if (state.role.toLowerCase().includes("guard")) {
      // Guards only join protest if starving and highly disgruntled
      scores.PROTEST_PLAZA -= 45;
    }
  }

  // HOARD_FOOD (Desperate survival stockpiling)
  if (nextNeeds.food < 0.35 || state.instinct === "GREEDY") {
    scores.HOARD_FOOD = (1.0 - nextNeeds.food) * 50;
    if (state.instinct === "GREEDY") scores.HOARD_FOOD += 25;
    if (hasHungerBelief) scores.HOARD_FOOD += 15;
  }

  // SEEK_HELP (Appealing to guards, temples, or authorities)
  if (nextMood.fear > 0.60 && nextNeeds.safety < 0.4) {
    scores.SEEK_HELP = nextMood.fear * 50 + (1.0 - nextNeeds.safety) * 35;
    if (state.temper === "CYNICAL") scores.SEEK_HELP -= 25; // Distrusts authorities
  }

  // FLEE_BURG (Total collapse)
  if (env.unrest > 75 && nextNeeds.safety < 0.15 && nextMood.fear > 0.8) {
    scores.FLEE_BURG = 85 + nextMood.fear * 30;
    if (state.instinct === "BOLD") scores.FLEE_BURG -= 40;
  }

  // Apply Hysteresis: Bonus to lastAction to prevent state flicker
  if (state.lastAction && scores[state.lastAction] !== undefined) {
    scores[state.lastAction] += 15;
  }

  // Select highest utility action
  let bestAction: ActionUtilityChoice = "ROUTINE_WORK";
  let bestScore = -Infinity;
  for (const key of Object.keys(scores) as ActionUtilityChoice[]) {
    if (scores[key] > bestScore) {
      bestScore = scores[key];
      bestAction = key;
    }
  }

  // Action reason explanation
  let actionReason = "Fulfilling daily municipal routine";
  if (bestAction === "STAY_HOME") actionReason = "Barricading inside quarters out of fear";
  else if (bestAction === "PROTEST_PLAZA") actionReason = "Confronting authorities in plaza over hunger and unrest";
  else if (bestAction === "HOARD_FOOD") actionReason = "Desperately securing food supplies";
  else if (bestAction === "SEEK_HELP") actionReason = "Seeking sanctuary or protection";
  else if (bestAction === "FLEE_BURG") actionReason = "Fleeing the collapsing burg for the wilderness";

  // -------------------------------------------------------------------------
  // 5. DEMEANOR OUT (Disposition, Trade Prices, Dialogue Tags & Gossip)
  // -------------------------------------------------------------------------
  // Disposition to Player (-2 Hostile to +2 Allied)
  let disposition = 0;
  if (nextMood.joy > 0.4 && nextMood.anger < 0.3) disposition += 1;
  if (nextMood.anger > 0.6 || (bestAction === "PROTEST_PLAZA" && state.temper === "VOLATILE")) disposition -= 1;
  if (bestAction === "FLEE_BURG" || (nextMood.fear > 0.8 && state.instinct === "WARY")) disposition -= 1;
  if (hasBelief(nextBeliefs, "distrusts:player")) disposition -= 1;
  const clampedDisposition = Math.max(-2, Math.min(2, disposition));

  // Trade Price Multiplier (0.8x to 1.5x)
  let priceMult = 1.0;
  if (state.instinct === "GREEDY") priceMult += 0.20;
  if (nextNeeds.food < 0.3) priceMult += 0.25; // Gouging in famine
  if (clampedDisposition >= 1) priceMult -= 0.15; // Friendly discount
  else if (clampedDisposition <= -1) priceMult += 0.30;
  const clampedPrice = Math.max(0.75, Math.min(1.60, Number(priceMult.toFixed(2))));

  // Semantic dialogue tags for Gemini GM prompt context
  const dialogueTags: string[] = [];
  if (nextNeeds.food < 0.25) dialogueTags.push("starving", "haggard");
  else if (nextNeeds.food < 0.5) dialogueTags.push("hungry");

  if (nextMood.fear > 0.55) dialogueTags.push("paranoid", "glancing_over_shoulder");
  if (nextMood.anger > 0.50) dialogueTags.push("spiteful", "clenching_fists");
  if (nextMood.joy > 0.50) dialogueTags.push("jovial", "warm_toned");

  if (bestAction === "PROTEST_PLAZA") dialogueTags.push("defiant", "shouting_slogans");
  if (bestAction === "STAY_HOME") dialogueTags.push("reclusive", "whispering_behind_door");
  if (state.instinct === "GREEDY") dialogueTags.push("calculating", "covetous");
  if (state.temper === "CYNICAL") dialogueTags.push("sarcastic", "skeptical");

  // Gossip Payload: Select strongest active belief to share at the evening hearth
  let strongestBelief: NPCBelief | null = null;
  for (const b of nextBeliefs) {
    if (!strongestBelief || b.strength > strongestBelief.strength) {
      strongestBelief = b;
    }
  }

  return {
    nextNeeds,
    nextMood,
    nextBeliefs,
    chosenAction: bestAction,
    actionReason,
    dispositionToPlayer: clampedDisposition,
    tradePriceMultiplier: clampedPrice,
    semanticDialogueTags: dialogueTags,
    gossipPayload: strongestBelief
  };
}

/**
 * PURE FUNCTION: Simulates belief transmission during evening hearth gathering
 */
export function exchangeGossip(
  listener: NPCMindState,
  speakerBelief: NPCBelief,
  trustLevel: number
): NPCMindState {
  // If listener actively distrusts speaker (trust < 0), belief is discarded or inverted
  if (trustLevel <= -0.2) {
    return listener;
  }

  const effectiveTrust = Math.max(0.1, Math.min(1.0, (trustLevel + 1.0) / 2));
  const incomingStrength = speakerBelief.strength * effectiveTrust * 0.85;

  if (incomingStrength < 0.15) {
    return listener;
  }

  const updatedBeliefs = [...listener.beliefs];
  const existingIdx = updatedBeliefs.findIndex(b => b.topic === speakerBelief.topic);

  if (existingIdx !== -1) {
    // Merge belief confidence
    const prev = updatedBeliefs[existingIdx];
    if (prev) {
      updatedBeliefs[existingIdx] = {
        topic: prev.topic,
        source: prev.source,
        strength: Math.min(1.0, Math.max(prev.strength, incomingStrength)),
        certainty: Math.min(1.0, prev.certainty + 0.1)
      };
    }
  } else {
    updatedBeliefs.push({
      topic: speakerBelief.topic,
      strength: incomingStrength,
      source: `gossip:${speakerBelief.source}`,
      certainty: effectiveTrust * 0.7
    });
  }

  return {
    ...listener,
    beliefs: updatedBeliefs
  };
}

function upsertBelief(
  beliefs: NPCBelief[],
  map: Map<string, NPCBelief>,
  topic: string,
  strength: number,
  source: string
) {
  const existing = map.get(topic);
  if (existing) {
    existing.strength = Math.min(1.0, Math.max(existing.strength, strength));
    existing.certainty = Math.min(1.0, existing.certainty + 0.15);
  } else {
    const fresh: NPCBelief = {
      topic,
      strength,
      source,
      certainty: 0.8
    };
    beliefs.push(fresh);
    map.set(topic, fresh);
  }
}

function hasBelief(beliefs: NPCBelief[], topic: string): boolean {
  return beliefs.some(b => b.topic === topic && b.strength > 0.3);
}
