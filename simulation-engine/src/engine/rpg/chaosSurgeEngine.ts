/**
 * OSTRAKA PRIMORDIAL CHAOS SURGE & ENVIRONMENTAL STORM ENGINE
 * ==============================================================
 * Generates truly unpredictable, chaotic environmental anomalies,
 * wild magic surges, atmospheric storms, and ripple cascades for sectors
 * adjacent to or intersected by the 12 Primordial Chaos Flows.
 *
 * Surges are categorized into 4 tiers:
 * 1. BENEFICIAL BOONS (25%): Aetheric wells, transmutations, shields, boons.
 * 2. BIZARRE / HARMLESS ODDITIES (30%): Inverted rain, dancing shadows, singing grass, hovering pebbles.
 * 3. VOLATILE WEATHER STORMS (25%): Aetheric squalls, temporal stutter hail, baslatic gales.
 * 4. MUTATING & HAZARDOUS ANOMALIES (20%): Raw discharges, flesh-warping surges, cultist rifts.
 *
 * Each surge leans thematically into the elemental power of the nearby flow,
 * and ripples outward across nearby props, flora, and entities.
 */

export interface ChaosSurgeEffect {
  id: string;
  name: string;
  tier: "BENEFICIAL" | "ODDITY" | "STORM" | "HAZARD";
  domainLean: string; // Thematic dragon domain
  headline: string;
  description: string;
  mechanicalEffect: {
    hpDelta?: number;
    composureDelta?: number;
    goldDelta?: number;
    statBuff?: { stat: string; amount: number; durationTurns: number };
    inflictMutation?: boolean;
    weatherModifier?: string;
    spawnRiftNPC?: string;
    propTransformation?: string;
  };
  rippleDescription: string;
}

export interface RippleTarget {
  targetId: string;
  targetName: string;
  type: "PROP" | "NPC" | "PLAYER" | "FLORA";
  rippleType: "INHERITED" | "INDEPENDENT_WARP";
  outcomeDescription: string;
}

export interface SectorChaosSurgeResult {
  activeSurge: ChaosSurgeEffect;
  ripples: RippleTarget[];
  stormActive: boolean;
  stormType?: string | undefined;
  ambientChaosLevel: number;
}

// 1. Universal Chaos Surge Table
const SURGE_TEMPLATES: Array<Omit<ChaosSurgeEffect, "id">> = [
  // --- BENEFICIAL BOONS (25%) ---
  {
    name: "Aetheric Resonance Well",
    tier: "BENEFICIAL",
    domainLean: "Nexus",
    headline: "An azure geyser of pristine folded aether erupts from a leyline fissure!",
    description: "Soothing celestial vapor washes over the area, knitting flesh, refreshing spiritual stamina, and clearing mental anguish.",
    mechanicalEffect: { hpDelta: 20, composureDelta: 20 },
    rippleDescription: "Nearby rocks pulse with calming blue light, and surrounding grasses instantly blossom into luminescent crystal flowers."
  },
  {
    name: "Transmutation Midas Rain",
    tier: "BENEFICIAL",
    domainLean: "Mass",
    headline: "Dense golden droplets precipitate from a low-hanging brass cloud!",
    description: "Rainwater coagulates into solid nuggets of refined titan gold upon hitting the soil.",
    mechanicalEffect: { goldDelta: 45 },
    rippleDescription: "Nearby stones and tree bark flash with veins of pure hammered gold."
  },
  {
    name: "Celestial Aegis Ward",
    tier: "BENEFICIAL",
    domainLean: "Ordo",
    headline: "A geometric crystalline lattice snaps into existence overhead!",
    description: "Resonant stasis geometry encases all travelers in a protective humming energy barrier.",
    mechanicalEffect: { statBuff: { stat: "fortitude", amount: 4, durationTurns: 10 } },
    rippleDescription: "Nearby landmarks become momentarily indestructible, encased in faceted mirror-ice."
  },
  {
    name: "Primordial Feather-Fall Current",
    tier: "BENEFICIAL",
    domainLean: "Motus",
    headline: "A whistling kinetic updraft suspends terrestrial weight!",
    description: "Gravity softens into weightless euphoria; boots barely touch the ground and movement feels effortless.",
    mechanicalEffect: { statBuff: { stat: "speed", amount: 3, durationTurns: 8 } },
    rippleDescription: "Pebbles and fallen branches float weightlessly two feet above the dirt."
  },
  {
    name: "Dragon-Nectar Pollen Bloom",
    tier: "BENEFICIAL",
    domainLean: "Vita",
    headline: "Primeval spores shower down from blooming aether blossoms!",
    description: "A rush of ferocious primeval vitality invigorates all living creatures in the vicinity.",
    mechanicalEffect: { statBuff: { stat: "might", amount: 3, durationTurns: 8 } },
    rippleDescription: "Nearby grazing fauna grow radiant moss upon their horns, humming with calm vitality."
  },

  // --- BIZARRE / HARMLESS ODDITIES (30%) ---
  {
    name: "Inverted Prismatic Rain",
    tier: "ODDITY",
    domainLean: "Lux",
    headline: "Raindrops fall upward from the soil toward a shimmering neon sky!",
    description: "Droplets of iridescent phosphor detach from the grass and ascend smoothly into the atmosphere. The sensation is utterly harmless yet surreal.",
    mechanicalEffect: { weatherModifier: "INVERTED_RAIN" },
    rippleDescription: "Shadows detach from objects and point toward the heavens."
  },
  {
    name: "Phantasmagoric Echo Chimes",
    tier: "ODDITY",
    domainLean: "Aura",
    headline: "Disembodied melodic bells harmonize with travelers' footsteps!",
    description: "Every step rings out with the crystal timbre of ancient carillons. Ethereal silhouettes gesture politely before fading.",
    mechanicalEffect: {},
    rippleDescription: "Inanimate props emit musical chords when inspected or tapped."
  },
  {
    name: "Singing Crystal Flora",
    tier: "ODDITY",
    domainLean: "Ratio",
    headline: "Underground fault lines vibrate in a three-tone harmonic chord!",
    description: "Botanical roots hum with mathematical precision, vibrating in synchrony with travelers' pulses.",
    mechanicalEffect: {},
    rippleDescription: "Nearby tree bark crystallizes into geometric hexagons, harmlessly chiming in the breeze."
  },
  {
    name: "Mirror Mirage Fissure",
    tier: "ODDITY",
    domainLean: "Nexus",
    headline: "Reflections in standing puddles take on an independent life!",
    description: "Surface waters reflect landscapes from another era. Your reflection politely nods before turning away.",
    mechanicalEffect: {},
    rippleDescription: "Nearby boulders take on glassy silver mirror surfaces that reflect distant stars in broad daylight."
  },
  {
    name: "Spectacle of Harmless Static",
    tier: "ODDITY",
    domainLean: "Motus",
    headline: "Frictionless violet sparks dance across travelers' hair and garments!",
    description: "Crackling static electricity stands hair on end and paints weapons in painless Saint Elmo's Fire.",
    mechanicalEffect: {},
    rippleDescription: "Leaves on nearby bushes twitch and glow like festive fireflies."
  },

  // --- VOLATILE WEATHER STORMS (25%) ---
  {
    name: "Aetheric Lightning Tempest",
    tier: "STORM",
    domainLean: "Motus",
    headline: "A howling squall of pressurized kinetic aether shrieks across the sector!",
    description: "Violet electrical arcs discharge between cloud and earth; visibility drops to near zero as gale winds tear through.",
    mechanicalEffect: { weatherModifier: "AETHER_TEMPEST", composureDelta: -3 },
    rippleDescription: "Nearby wooden wagons and trees catch crackling aetheric sparks; beasts huddle in dread."
  },
  {
    name: "Reality Stutter Hailstorm",
    tier: "STORM",
    domainLean: "Ordo",
    headline: "Hailstones of frozen temporal glass pelt down in staggered stutter!",
    description: "Each impact creates a localized temporal stutter. Physical actions require double stamina as time itself lags.",
    mechanicalEffect: { weatherModifier: "TEMPORAL_HAIL", hpDelta: -4 },
    rippleDescription: "Surrounding flora freezes in place mid-sway, locked in brittle glass stasis."
  },
  {
    name: "Basalt Pumice Squall",
    tier: "STORM",
    domainLean: "Mass",
    headline: "A crushing dust-front of volcanic obsidian pumice bludgeons the terrain!",
    description: "Dense mineral clouds grind through armor, blinding travelers and testing physical endurance.",
    mechanicalEffect: { weatherModifier: "BASALT_SQUALL", hpDelta: -6 },
    rippleDescription: "Boulders grind against the bedrock, and loose soil compacts into dense flagstones."
  },
  {
    name: "Necrotic Ash Gale",
    tier: "STORM",
    domainLean: "Anumis",
    headline: "A freezing blizzard of soul-ash and phantom wails sweeps across the soil!",
    description: "The chill strips living warmth, numbing fingers and chilling travelers' resolve with ghostly whispers.",
    mechanicalEffect: { weatherModifier: "NECROTIC_ASH", composureDelta: -6 },
    rippleDescription: "Nearby flora withers into gray bone-dust; water puddles freeze into black ice."
  },

  // --- MUTATING & HAZARDOUS ANOMALIES (20%) ---
  {
    name: "Primordial Arc Discharge",
    tier: "HAZARD",
    domainLean: "Flux",
    headline: "A serpentine arc of uncontained dragon power whips across the terrain!",
    description: "The raw shockwave vaporizes soil and tears into the nearest living vessels, threatening immediate cellular distortion.",
    mechanicalEffect: { hpDelta: -12, inflictMutation: true },
    rippleDescription: "Nearby wildlife screeches as strange chitinous plates or iridescent scales sprout along their flanks!"
  },
  {
    name: "Cultist Leyline Rift",
    tier: "HAZARD",
    domainLean: "Omen",
    headline: "The boundary between realms tears open in a vortex of black eclipse flames!",
    description: "Chanting void whispers coalesce as an anomaly manifests, drawing cultist shades from the astral void.",
    mechanicalEffect: { spawnRiftNPC: "Chaos Cultist Shade", composureDelta: -5 },
    rippleDescription: "Landmarks are stained in charred abyssal soot that continually smokes with sulfurous incense."
  },
  {
    name: "Spontaneous Biomantic Flesh Warp",
    tier: "HAZARD",
    domainLean: "Flux",
    headline: "Volatile mutating mists seep from fault fissures in the earth!",
    description: "The chemical fabric of life warps uncontrollably. Flesh, bark, and beast mutate in moments.",
    mechanicalEffect: { hpDelta: -8, inflictMutation: true },
    rippleDescription: "Nearby shrubs grow blinking eyes along their stems, and granite rocks sprout pulsing bioluminescent polyp tendrils."
  }
];

/**
 * Synthesizes a truly random, chaotic environmental surge for a sector near or in a flow.
 */
export function generateChaosSurge(
  adjacentFlowDomain: string = "Flux",
  ambientChaosLevel: number = 0.5,
  nearbyProps: Array<{ id: string; name: string }> = [],
  nearbyNPCs: Array<{ id: string; name: string }> = []
): SectorChaosSurgeResult {
  // 1. Roll for Surge Template with a thematic domain weight
  const weightedList: Array<Omit<ChaosSurgeEffect, "id">> = [];
  for (const t of SURGE_TEMPLATES) {
    weightedList.push(t);
    // Extra weight if the template aligns with the adjacent flow's elemental domain
    if (t.domainLean.toLowerCase() === adjacentFlowDomain.toLowerCase()) {
      weightedList.push(t);
      weightedList.push(t);
    }
    // High ambient chaos increases storm and hazard probability
    if (ambientChaosLevel > 0.7 && (t.tier === "STORM" || t.tier === "HAZARD")) {
      weightedList.push(t);
    }
  }

  const selectedTemplate = weightedList[Math.floor(Math.random() * weightedList.length)] || SURGE_TEMPLATES[0]!;
  const surgeId = `surge_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const activeSurge: ChaosSurgeEffect = {
    ...selectedTemplate,
    id: surgeId
  };

  // 2. Cascade Ripple Calculation:
  // "everything it has an effect on would either experience the same effect as a nearby effect or a random effect of their own."
  const ripples: RippleTarget[] = [];

  // Ripple on nearby Props
  for (const p of nearbyProps.slice(0, 3)) {
    const isInherited = Math.random() < 0.5;
    if (isInherited) {
      ripples.push({
        targetId: p.id,
        targetName: p.name,
        type: "PROP",
        rippleType: "INHERITED",
        outcomeDescription: `${p.name} resonated with the surge: ${activeSurge.rippleDescription}`
      });
    } else {
      const altEffects = [
        "sprouted glowing bioluminescent lichen",
        "turned momentarily to transparent glass",
        "floated several inches above the ground",
        "crystallized in a crust of stasis frost",
        "emitted a low musical hum when approached"
      ];
      const altOutcome = altEffects[Math.floor(Math.random() * altEffects.length)];
      ripples.push({
        targetId: p.id,
        targetName: p.name,
        type: "PROP",
        rippleType: "INDEPENDENT_WARP",
        outcomeDescription: `${p.name} underwent a spontaneous chaotic warp and ${altOutcome}!`
      });
    }
  }

  // Ripple on nearby NPCs
  for (const n of nearbyNPCs.slice(0, 2)) {
    const isInherited = Math.random() < 0.5;
    if (isInherited) {
      ripples.push({
        targetId: n.id,
        targetName: n.name,
        type: "NPC",
        rippleType: "INHERITED",
        outcomeDescription: `${n.name} caught the ripple resonance: stunned by the aetheric wash.`
      });
    } else {
      const npcWarps = [
        "fur/skin briefly shone with iridescent phosphor",
        "startled by auditory whispers echoing their true name",
        "surged with primeval bloodlust, eyes flaring red",
        "staggered as their shadow momentarily froze in place"
      ];
      const npcOutcome = npcWarps[Math.floor(Math.random() * npcWarps.length)];
      ripples.push({
        targetId: n.id,
        targetName: n.name,
        type: "NPC",
        rippleType: "INDEPENDENT_WARP",
        outcomeDescription: `${n.name} was caught in an independent reality warp: ${npcOutcome}.`
      });
    }
  }

  return {
    activeSurge,
    ripples,
    stormActive: activeSurge.tier === "STORM",
    stormType: activeSurge.mechanicalEffect.weatherModifier,
    ambientChaosLevel
  };
}
