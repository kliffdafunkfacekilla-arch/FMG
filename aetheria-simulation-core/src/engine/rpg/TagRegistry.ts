/**
 * OSTRAKA & CONCORDIA UNIVERSAL TAG-TO-STAT INTERACTION REGISTRY
 * ==============================================================
 * "1 Code, Infinite Uses"
 * Every interaction in the world is determined by:
 * 1. The target's physical and social tags (e.g. locked, wood, stone, metal, water, beast, merchant)
 * 2. The player's 12 Concordia attributes (Might, Endurance, Finesse, Reflex, Vitality,
 *    Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower)
 * 3. Relevant tools, equipment, and situational modifiers.
 *
 * Direct attacks and spells are handled by combat opposed rolls;
 * All environmental, subterfuge, social, survival, and investigatory interactions
 * map directly through this matrix.
 */

export type ConcordiaStat =
  | "might"
  | "endurance"
  | "finesse"
  | "reflex"
  | "vitality"
  | "fortitude"
  | "knowledge"
  | "logic"
  | "awareness"
  | "intuition"
  | "charm"
  | "willpower";

export interface TagStatAction {
  id: string;
  tagRequired: string;
  verb: string;
  actionTitle: string; // Short UI button label, e.g. "🗝️ Pick Lock [FIN 13]"
  template: string;    // Natural language prompt: "I pick the lock on {target} using my finesse"
  stat: ConcordiaStat;
  baseDC: number;
  category: "SUBTERFUGE" | "EXPLORATION" | "SURVIVAL" | "SOCIAL" | "MAGIC" | "TACTICAL";
  description: string;
  toolKeywords?: string[];
  toolMod?: number;
}

/**
 * ATOMIC TAG-TO-STAT ACTION MATRIX
 * Maps individual physical, material, or social tags to viable actions across all 12 Concordia stats.
 */
export const ATOMIC_TAG_ACTIONS: TagStatAction[] = [
  // ==========================================
  // TAG: "locked"
  // ==========================================
  {
    id: "locked_finesse_pick",
    tagRequired: "locked",
    verb: "PICK_LOCK",
    actionTitle: "🗝️ Pick Lock",
    template: "I attempt to pick the lock on {target} with precision tools using my finesse",
    stat: "finesse",
    baseDC: 13,
    category: "SUBTERFUGE",
    description: "Manipulate internal pins with delicate tension without breaking the lock.",
    toolKeywords: ["lockpick", "thieves tools", "pick set"],
    toolMod: 3
  },
  {
    id: "locked_might_force",
    tagRequired: "locked",
    verb: "FORCE_OPEN",
    actionTitle: "🔨 Force / Pry Open",
    template: "I force and pry open {target} with brute might",
    stat: "might",
    baseDC: 14,
    category: "SUBTERFUGE",
    description: "Kick down, pry, or smash the locking shackle by brute force.",
    toolKeywords: ["crowbar", "prybar", "hammer"],
    toolMod: 3
  },
  {
    id: "locked_logic_bypass",
    tagRequired: "locked",
    verb: "BYPASS_LATCH",
    actionTitle: "📐 Bypass Latch",
    template: "I analyze the mechanical tolerances of {target} and shim the latch using logic",
    stat: "logic",
    baseDC: 12,
    category: "SUBTERFUGE",
    description: "Slide a thin blade or shim past the jamb to trip the spring latch."
  },
  {
    id: "locked_awareness_listen",
    tagRequired: "locked",
    verb: "INSPECT_KEYHOLE",
    actionTitle: "👂 Listen & Inspect",
    template: "I press my ear to {target} and inspect the tumblers using awareness",
    stat: "awareness",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Listen for sounds within and check for needle or poison traps."
  },
  {
    id: "locked_knowledge_identify",
    tagRequired: "locked",
    verb: "IDENTIFY_MAKER",
    actionTitle: "📜 Study Lock Type",
    template: "I examine the maker marks on {target} to deduce the lock mechanism using knowledge",
    stat: "knowledge",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Identify the guild of origin and known weaknesses in the locking design."
  },

  // ==========================================
  // TAG: "container" (Chest, Cache, Sarcophagus)
  // ==========================================
  {
    id: "container_awareness_search",
    tagRequired: "container",
    verb: "SEARCH",
    actionTitle: "🔍 Search Cache",
    template: "I search and inspect {target} closely for hidden compartments and catches",
    stat: "awareness",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Carefully inspect seams for false bottoms and hidden catches."
  },
  {
    id: "container_finesse_disarm",
    tagRequired: "container",
    verb: "DISARM_TRAP",
    actionTitle: "✂️ Disarm Trap",
    template: "I cautiously trace tripwires and disarm any spring traps on {target} using finesse",
    stat: "finesse",
    baseDC: 13,
    category: "SUBTERFUGE",
    description: "Detach concealed spring needles, pressure plates, or rune triggers.",
    toolKeywords: ["lockpick", "thieves tools", "pliers"],
    toolMod: 2
  },
  {
    id: "container_might_rip",
    tagRequired: "container",
    verb: "PRY_LID",
    actionTitle: "💪 Rip Open Lid",
    template: "I grip the heavy lid of {target} and heave it open with brute might",
    stat: "might",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Lever open heavy stone or iron-banded lids.",
    toolKeywords: ["crowbar", "prybar"],
    toolMod: 2
  },
  {
    id: "container_logic_catch",
    tagRequired: "container",
    verb: "DEDUCE_CATCH",
    actionTitle: "🧩 Trace Hidden Catch",
    template: "I analyze the weight distribution of {target} to locate the concealed release catch using logic",
    stat: "logic",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Deduce secret interior latches through balance and leverage."
  },
  {
    id: "container_intuition_sense",
    tagRequired: "container",
    verb: "SENSE_CONTAINER",
    actionTitle: "✨ Sense Contents",
    template: "I place my hand on {target} and attune my intuition to sense valuable relics or hidden curses",
    stat: "intuition",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Sense latent magic, gold resonance, or lingering hexes inside."
  },

  // ==========================================
  // TAG: "wood" / "flammable"
  // ==========================================
  {
    id: "wood_might_splinter",
    tagRequired: "wood",
    verb: "SPLINTER_WOOD",
    actionTitle: "🪓 Chop / Splinter",
    template: "I smash and splinter {target} with heavy force to clear the way",
    stat: "might",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Shatter dry timber into kindling and clear physical barricades.",
    toolKeywords: ["axe", "hatchet", "cleaver"],
    toolMod: 2
  },
  {
    id: "wood_fortitude_heave",
    tagRequired: "wood",
    verb: "HEAVE_TIMBER",
    actionTitle: "🪵 Heave Aside",
    template: "I brace my shoulders against {target} and heave the heavy timbers aside using fortitude",
    stat: "fortitude",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Endure the crushing weight of heavy timber to clear a path."
  },
  {
    id: "wood_intuition_ignite",
    tagRequired: "flammable",
    verb: "IGNITE",
    actionTitle: "🔥 Ignite / Burn",
    template: "I kindle flame and ignite {target} with burning embers",
    stat: "intuition",
    baseDC: 9,
    category: "MAGIC",
    description: "Touch torch or ember to flammable materials to burn them away.",
    toolKeywords: ["torch", "firestarter", "flint"],
    toolMod: 2
  },
  {
    id: "wood_finesse_carve",
    tagRequired: "wood",
    verb: "CARVE_MARK",
    actionTitle: "🔪 Carve Trail Sign",
    template: "I carve a discreet trail glyph into {target} using finesse",
    stat: "finesse",
    baseDC: 8,
    category: "SURVIVAL",
    description: "Leave subtle navigation marks for safe retracing.",
    toolKeywords: ["dagger", "knife"],
    toolMod: 2
  },

  // ==========================================
  // TAG: "stone" / "ruins" / "monolith"
  // ==========================================
  {
    id: "stone_knowledge_decipher",
    tagRequired: "stone",
    verb: "DECIPHER_RUNES",
    actionTitle: "📜 Decipher Carvings",
    template: "I study and translate the ancient engravings upon {target} using knowledge",
    stat: "knowledge",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Translate archaic inscriptions, heraldic lineage, and historic warnings."
  },
  {
    id: "stone_logic_puzzle",
    tagRequired: "stone",
    verb: "SOLVE_KEYSTONE",
    actionTitle: "🧩 Solve Keystones",
    template: "I deduce the counterweight balance and keystone sequence of {target} using logic",
    stat: "logic",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Detect interlocking runestones or hidden mechanical pressure mechanisms."
  },
  {
    id: "stone_might_dislodge",
    tagRequired: "stone",
    verb: "DISLODGE_STONE",
    actionTitle: "⛏️ Dislodge Masonry",
    template: "I use brute strength to shift and dislodge the stone of {target}",
    stat: "might",
    baseDC: 14,
    category: "EXPLORATION",
    description: "Heave heavy collapsed pillars or shift ancient sarcophagus lids."
  },
  {
    id: "stone_awareness_survey",
    tagRequired: "stone",
    verb: "INSPECT_CRACKS",
    actionTitle: "🔍 Inspect Flaws",
    template: "I examine the fissures and structural faults in {target} using awareness",
    stat: "awareness",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Detect hollow resonance, secret compartments, or structural weakness."
  },
  {
    id: "stone_endurance_scale",
    tagRequired: "stone",
    verb: "SCALE_STONE",
    actionTitle: "🧗 Scale Rockface",
    template: "I dig in my fingers and scale the sheer stone surface of {target} using endurance",
    stat: "endurance",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Climb slippery, weathered stone without losing stamina."
  },

  // ==========================================
  // TAG: "metal" / "crafting" / "forge" / "anvil"
  // ==========================================
  {
    id: "metal_knowledge_alloy",
    tagRequired: "metal",
    verb: "ANALYZE_ALLOY",
    actionTitle: "🔬 Analyze Metallurgy",
    template: "I examine the temper, grain, and conductor metals of {target} using knowledge",
    stat: "knowledge",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Identify metal quality (Osmium, Copper, Silver, Steel) and magical conductivity."
  },
  {
    id: "metal_finesse_sharpen",
    tagRequired: "crafting",
    verb: "SHARPEN_BLADE",
    actionTitle: "⚔️ Hone Edge",
    template: "I hone and true the blade edge upon {target} with precision finesse",
    stat: "finesse",
    baseDC: 9,
    category: "TACTICAL",
    description: "Restore razor sharpness to edged weapons for maximum damage.",
    toolKeywords: ["whetstone", "hammer"],
    toolMod: 2
  },
  {
    id: "metal_might_reshape",
    tagRequired: "crafting",
    verb: "FORGE_REPAIR",
    actionTitle: "🔨 Hammer Dent",
    template: "I strike heavy rhythmic blows upon {target} to hammer out armor dents using might",
    stat: "might",
    baseDC: 11,
    category: "TACTICAL",
    description: "Pound warped plate armor and weapons back into true alignment."
  },
  {
    id: "metal_endurance_temper",
    tagRequired: "crafting",
    verb: "TEMPER_HEAT",
    actionTitle: "🔥 Endure Forge Heat",
    template: "I withstand the intense furnace blast of {target} while quenching steel using endurance",
    stat: "endurance",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Work the scorching bellows and hearth without suffering exhaustion."
  },

  // ==========================================
  // TAG: "water" / "water_source" / "fountain" / "well"
  // ==========================================
  {
    id: "water_vitality_drink",
    tagRequired: "water",
    verb: "DRINK_REFRESH",
    actionTitle: "💧 Drink & Fill",
    template: "I drink deeply from {target} and refill waterskins to restore vitality",
    stat: "vitality",
    baseDC: 7,
    category: "SURVIVAL",
    description: "Quench thirst with cool water to recover stamina and clear field fatigue.",
    toolKeywords: ["waterskin", "canteen", "flask"],
    toolMod: 2
  },
  {
    id: "water_logic_filter",
    tagRequired: "water",
    verb: "PURIFY_WATER",
    actionTitle: "🧪 Purify Water",
    template: "I filter sand and boil stagnant water from {target} using logic",
    stat: "logic",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Filter out parasites and murk to render doubtful water safe to drink."
  },
  {
    id: "water_finesse_fish",
    tagRequired: "water",
    verb: "FISH",
    actionTitle: "🎣 Catch Fish",
    template: "I cast a line and spear fish in the currents of {target} using finesse",
    stat: "finesse",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Harvest fresh river game for nourishing field rations.",
    toolKeywords: ["spear", "fishing tackle", "net"],
    toolMod: 2
  },
  {
    id: "water_awareness_sound",
    tagRequired: "water",
    verb: "SOUND_DEPTH",
    actionTitle: "🌊 Scout Currents",
    template: "I study the eddies and gauge the depth of {target} using awareness",
    stat: "awareness",
    baseDC: 8,
    category: "EXPLORATION",
    description: "Detect undertows, submerged obstacles, and safe fording points."
  },
  {
    id: "water_fortitude_fording",
    tagRequired: "water",
    verb: "FORD_TORRENT",
    actionTitle: "🛡️ Ford Torrent",
    template: "I lock my footing against the frigid rushing torrent of {target} using fortitude",
    stat: "fortitude",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Wade through chest-deep freezing rapids without being swept away."
  },

  // ==========================================
  // TAG: "flora" / "forageable" / "herbs"
  // ==========================================
  {
    id: "flora_awareness_identify",
    tagRequired: "forageable",
    verb: "FORAGE",
    actionTitle: "🌿 Forage / Harvest",
    template: "I carefully forage and harvest {target} using my botanical awareness",
    stat: "awareness",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Spot edible herbs and viable medicinal stems without bruising roots.",
    toolKeywords: ["shears", "herb knife", "foraging kit"],
    toolMod: 2
  },
  {
    id: "flora_knowledge_botany",
    tagRequired: "forageable",
    verb: "EXAMINE_BOTANY",
    actionTitle: "🧪 Analyze Botany",
    template: "I inspect the alchemical and pharmacological properties of {target} using knowledge",
    stat: "knowledge",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Determine whether the plant produces healing salves, narcotics, or poisons."
  },
  {
    id: "flora_vitality_nourish",
    tagRequired: "forageable",
    verb: "GRAZE_EDIBLE",
    actionTitle: "🍃 Field Nourish",
    template: "I chew the tender edible shoots of {target} to sustain my vitality",
    stat: "vitality",
    baseDC: 8,
    category: "SURVIVAL",
    description: "Graze clean wild shoots for emergency hydration and minor relief."
  },
  {
    id: "flora_finesse_extract",
    tagRequired: "forageable",
    verb: "EXTRACT_SAP",
    actionTitle: "💧 Extract Toxin/Sap",
    template: "I delicately score the stems of {target} to harvest potent sap using finesse",
    stat: "finesse",
    baseDC: 11,
    category: "SURVIVAL",
    description: "Bleed pure alchemical sap or venomous coatings without contamination.",
    toolKeywords: ["vial", "herb knife"],
    toolMod: 2
  },
  {
    id: "flora_might_uproot",
    tagRequired: "forageable",
    verb: "UPROOT_TUBERS",
    actionTitle: "🥕 Uproot Tubers",
    template: "I dig deep into the earth and rip out the thick root tubers of {target} using might",
    stat: "might",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Unearth calorie-dense underground root bundles from rocky soil."
  },

  // ==========================================
  // TAG: "beast" / "fauna" (Non-Combat Interaction)
  // ==========================================
  {
    id: "beast_awareness_track",
    tagRequired: "beast",
    verb: "HUNT_TRACK",
    actionTitle: "🐾 Track & Observe",
    template: "I track and observe the behavioral habits and weak points of {target} using awareness",
    stat: "awareness",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Read trail signs, pacing, and breathing patterns to predict movements."
  },
  {
    id: "beast_intuition_pacify",
    tagRequired: "beast",
    verb: "PACIFY",
    actionTitle: "🕊️ Pacify Temperament",
    template: "I project calm demeanor and read the animal posture of {target} using intuition",
    stat: "intuition",
    baseDC: 11,
    category: "SURVIVAL",
    description: "Avoid direct eye contact, project calm rhythm, and de-escalate hostility."
  },
  {
    id: "beast_charm_bait",
    tagRequired: "beast",
    verb: "OFFER_BAIT",
    actionTitle: "🥩 Divert with Bait",
    template: "I offer fresh trail rations to placate and divert {target} using charm",
    stat: "charm",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Toss food rations to satisfy hunger and prevent predatory pursuit."
  },
  {
    id: "beast_finesse_fielddress",
    tagRequired: "beast",
    verb: "FIELD_DRESS",
    actionTitle: "🔪 Field Dress / Skin",
    template: "I field-dress and butcher the carcass of {target} using finesse to harvest pelts and meat",
    stat: "finesse",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Skin pelt cleanly and butcher game meat for trail provisions.",
    toolKeywords: ["skinning knife", "hunting knife", "cleaver"],
    toolMod: 2
  },
  {
    id: "beast_willpower_stand",
    tagRequired: "beast",
    verb: "STAND_GROUND",
    actionTitle: "🦁 Stand Ground",
    template: "I plant my feet and stare down {target} with unbroken willpower",
    stat: "willpower",
    baseDC: 11,
    category: "SURVIVAL",
    description: "Refuse to flinch against an intimidating predator to break its charge."
  },
  {
    id: "beast_reflex_outmaneuver",
    tagRequired: "beast",
    verb: "SIDESTEP_POUNCE",
    actionTitle: "⚡ Sidestep Charge",
    template: "I read the coiled spring of {target} and dodge fluidly aside using reflex",
    stat: "reflex",
    baseDC: 10,
    category: "TACTICAL",
    description: "Evade a sudden predator ambush with split-second agility."
  },

  // ==========================================
  // TAG: "corpse" / "carcass" / "remains"
  // ==========================================
  {
    id: "corpse_logic_autopsy",
    tagRequired: "corpse",
    verb: "AUTOPSY",
    actionTitle: "🔍 Forensic Autopsy",
    template: "I inspect wound angles, poison residue, and time of death on {target} using logic",
    stat: "logic",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Deduce exact cause of death, weapon type, and attacker identity."
  },
  {
    id: "corpse_awareness_loot",
    tagRequired: "corpse",
    verb: "LOOT_REMAINS",
    actionTitle: "🪙 Search Remains",
    template: "I search the garments and pouches of {target} for hidden valuables using awareness",
    stat: "awareness",
    baseDC: 8,
    category: "EXPLORATION",
    description: "Find coin purses, keys, letters, and boots."
  },
  {
    id: "corpse_willpower_rites",
    tagRequired: "corpse",
    verb: "BURIAL_RITES",
    actionTitle: "🕯️ Last Rites",
    template: "I speak final protective rites over {target} with solemn willpower to prevent necromancy",
    stat: "willpower",
    baseDC: 9,
    category: "MAGIC",
    description: "Consecrate fallen mortals so their spirits rest peacefully."
  },

  // ==========================================
  // TAG: "fire" / "campfire" / "hearth"
  // ==========================================
  {
    id: "fire_vitality_rest",
    tagRequired: "fire",
    verb: "REST",
    actionTitle: "🏕️ Rest at Fire",
    template: "I sit beside the warm hearth embers of {target} to rest and recover vitality",
    stat: "vitality",
    baseDC: 7,
    category: "SURVIVAL",
    description: "Rest by the hearthfire to warm cold limbs and recover full HP and stamina."
  },
  {
    id: "fire_logic_cook",
    tagRequired: "fire",
    verb: "COOK",
    actionTitle: "🍖 Cook Rations",
    template: "I roast raw game provisions over the embers of {target} using logic",
    stat: "logic",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Roast fresh venison and provisions into hearty, non-perishable trail rations."
  },
  {
    id: "fire_knowledge_brew",
    tagRequired: "fire",
    verb: "BREW",
    actionTitle: "🧪 Brew Salve",
    template: "I simmer foraged herbs over the heat of {target} using knowledge to brew healing salves",
    stat: "knowledge",
    baseDC: 10,
    category: "SURVIVAL",
    description: "Extract botanical essences over boiling heat to craft healing poultices."
  },
  {
    id: "fire_reflex_snatch",
    tagRequired: "fire",
    verb: "SNATCH_BRAND",
    actionTitle: "🔥 Snatch Torch Brand",
    template: "I pull a blazing brand from {target} with rapid reflex to light the way",
    stat: "reflex",
    baseDC: 7,
    category: "EXPLORATION",
    description: "Acquire an immediate blazing light source to ward off beasts."
  },

  // ==========================================
  // TAG: "civilian" / "wayfarer" / "refugee"
  // ==========================================
  {
    id: "civilian_charm_talk",
    tagRequired: "civilian",
    verb: "TALK",
    actionTitle: "🗣️ Speak / Converse",
    template: "I speak warmly with {target} to inquire about local rumors using charm",
    stat: "charm",
    baseDC: 9,
    category: "SOCIAL",
    description: "Engage in friendly conversation to learn recent happenings in the province."
  },
  {
    id: "civilian_awareness_sense",
    tagRequired: "civilian",
    verb: "SENSE_MOTIVE",
    actionTitle: "👁️ Sense Motive",
    template: "I observe the glances and body language of {target} using awareness to detect deceit",
    stat: "awareness",
    baseDC: 10,
    category: "SOCIAL",
    description: "Gauge nervous twitches, concealed weapons, or deceptive answers."
  },
  {
    id: "civilian_might_intimidate",
    tagRequired: "civilian",
    verb: "INTIMIDATE",
    actionTitle: "💀 Intimidate",
    template: "I draw steel and threaten {target} with brute might to demand cooperation",
    stat: "might",
    baseDC: 11,
    category: "SOCIAL",
    description: "Coerce compliance through aggressive posturing (reduces disposition)."
  },
  {
    id: "civilian_finesse_pickpocket",
    tagRequired: "civilian",
    verb: "PICKPOCKET",
    actionTitle: "🪙 Pickpocket",
    template: "I brush past {target} and attempt to lift their coin pouch using finesse",
    stat: "finesse",
    baseDC: 14,
    category: "SUBTERFUGE",
    description: "Cutpurse technique to steal gold coins unseen."
  },
  {
    id: "civilian_logic_directions",
    tagRequired: "civilian",
    verb: "INQUIRE_MAP",
    actionTitle: "🗺️ Inquire Landmarks",
    template: "I cross-reference travel landmarks with {target} using clear logic",
    stat: "logic",
    baseDC: 8,
    category: "SOCIAL",
    description: "Ask for exact geographic bearings to local burgs or caches."
  },

  // ==========================================
  // TAG: "merchant" / "trader"
  // ==========================================
  {
    id: "merchant_charm_barter",
    tagRequired: "merchant",
    verb: "BARTER",
    actionTitle: "⚖️ Barter & Trade",
    template: "I open commercial negotiations with {target} to buy and sell goods",
    stat: "charm",
    baseDC: 9,
    category: "SOCIAL",
    description: "Access the merchant's trade ledger to buy supplies and sell forage."
  },
  {
    id: "merchant_logic_haggle",
    tagRequired: "merchant",
    verb: "HAGGLE_PRICES",
    actionTitle: "📉 Haggle Margins",
    template: "I cite commodity indices and trade glut to haggle down {target}'s prices using logic",
    stat: "logic",
    baseDC: 11,
    category: "SOCIAL",
    description: "Dispute retail markup using economic rationale to earn a trade discount."
  },
  {
    id: "merchant_knowledge_routes",
    tagRequired: "merchant",
    verb: "INQUIRE_ROUTES",
    actionTitle: "🗺️ Inquire Routes",
    template: "I consult with {target} regarding bandit-free trade arteries and shortages",
    stat: "knowledge",
    baseDC: 9,
    category: "SOCIAL",
    description: "Obtain intelligence on regional commodity shortages and safe passages."
  },
  {
    id: "merchant_awareness_appraise",
    tagRequired: "merchant",
    verb: "APPRAISE_WARES",
    actionTitle: "💎 Appraise Wares",
    template: "I closely inspect the wares displayed by {target} to spot rare gems or counterfeit goods",
    stat: "awareness",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Spot hidden masterwork craftsmanship or identify fake goods."
  },

  // ==========================================
  // TAG: "authority" / "reeve" / "sentry"
  // ==========================================
  {
    id: "authority_logic_bounties",
    tagRequired: "authority",
    verb: "REVIEW_BOUNTIES",
    actionTitle: "📜 Review Bounties",
    template: "I formally present myself to {target} to review civic warrants and bounties",
    stat: "logic",
    baseDC: 8,
    category: "SOCIAL",
    description: "Inspect official municipal warrants and provincial defense bounties."
  },
  {
    id: "authority_charm_diplomacy",
    tagRequired: "authority",
    verb: "DIPLOMACY",
    actionTitle: "🤝 Diplomatic Appeal",
    template: "I present credentials and seek official safe passage from {target} using charm",
    stat: "charm",
    baseDC: 12,
    category: "SOCIAL",
    description: "Secure civic passage, clearance, or faction goodwill through diplomatic tact."
  },
  {
    id: "authority_willpower_stare",
    tagRequired: "authority",
    verb: "DEMAND_PASSAGE",
    actionTitle: "⚔️ Demand Clearance",
    template: "I stare down the scrutiny of {target} and command lawful clearance using sheer willpower",
    stat: "willpower",
    baseDC: 13,
    category: "SOCIAL",
    description: "Refuse intimidation and command respect from municipal guards."
  },

  // ==========================================
  // TAG: "notice_board"
  // ==========================================
  {
    id: "board_awareness_scan",
    tagRequired: "notice_board",
    verb: "READ_NOTICES",
    actionTitle: "📜 Read Notices",
    template: "I scan the pinned decrees, monster bounties, and trade calls upon {target}",
    stat: "awareness",
    baseDC: 7,
    category: "EXPLORATION",
    description: "Read active civic contracts, wanted notices, and commodity calls."
  },
  {
    id: "board_logic_analyze",
    tagRequired: "notice_board",
    verb: "ANALYZE_CRIME",
    actionTitle: "📍 Map Crime Leads",
    template: "I correlate the locations of bandit raids from {target} using logic",
    stat: "logic",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Deduce the probable location of outlaw lairs from raid reports."
  },
  {
    id: "board_knowledge_edict",
    tagRequired: "notice_board",
    verb: "DECIPHER_EDICT",
    actionTitle: "🏛️ Study Civic Law",
    template: "I examine the royal seals and legal proclamations on {target} using knowledge",
    stat: "knowledge",
    baseDC: 9,
    category: "EXPLORATION",
    description: "Interpret tax rates, martial law decrees, and sovereign jurisdiction."
  },

  // ==========================================
  // TAG: "magic" / "wardstone" / "arcane"
  // ==========================================
  {
    id: "magic_knowledge_analyze",
    tagRequired: "magic",
    verb: "ANALYZE_ARCANA",
    actionTitle: "🔮 Analyze Arcana",
    template: "I study the glowing arcane glyphs upon {target} using occult knowledge",
    stat: "knowledge",
    baseDC: 12,
    category: "MAGIC",
    description: "Identify ancient ward enchantments, schools of magic, and arcane hazards."
  },
  {
    id: "magic_intuition_attune",
    tagRequired: "magic",
    verb: "ATTUNE_CURRENT",
    actionTitle: "✨ Attune Aether",
    template: "I attune my senses to the aetheric resonance radiating from {target}",
    stat: "intuition",
    baseDC: 11,
    category: "MAGIC",
    description: "Commune with planar currents to sense occult anomalies and cosmic alignments."
  },
  {
    id: "magic_willpower_commune",
    tagRequired: "magic",
    verb: "COMMUNE",
    actionTitle: "🛡️ Channel Focus",
    template: "I channel my willpower directly into {target} to harmonize its mystic ward",
    stat: "willpower",
    baseDC: 13,
    category: "MAGIC",
    description: "Withstand arcane psychic backlash to activate or dispel the ward."
  },
  {
    id: "magic_fortitude_ground",
    tagRequired: "magic",
    verb: "GROUND_AETHER",
    actionTitle: "⚡ Ground Static",
    template: "I plant my guard into the earth to ground the crackling arcane discharge of {target} using fortitude",
    stat: "fortitude",
    baseDC: 11,
    category: "MAGIC",
    description: "Absorb sorcerous electrical arcs into the ground without injury."
  },

  // ==========================================
  // TAG: "altar" / "shrine" / "sacred"
  // ==========================================
  {
    id: "altar_knowledge_lore",
    tagRequired: "altar",
    verb: "STUDY_PANTHEON",
    actionTitle: "📜 Study Deific Lore",
    template: "I examine the iconography and patron divinity of {target} using knowledge",
    stat: "knowledge",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Identify ancient gods, martyr covenants, or sinister cosmic cults."
  },
  {
    id: "altar_intuition_pray",
    tagRequired: "altar",
    verb: "COMMUNE_PRAYER",
    actionTitle: "🙏 Commune in Prayer",
    template: "I kneel in quiet contemplation before {target} to seek spiritual clarity using intuition",
    stat: "intuition",
    baseDC: 9,
    category: "MAGIC",
    description: "Receive subtle blessings or divine intuition regarding imminent trials."
  },
  {
    id: "altar_willpower_cleanse",
    tagRequired: "altar",
    verb: "CLEANSE_CORRUPTION",
    actionTitle: "✨ Cleanse Ground",
    template: "I speak cleansing rites and exert my willpower to purge dark corruption from {target}",
    stat: "willpower",
    baseDC: 12,
    category: "MAGIC",
    description: "Dispel dark stains, breaking evil bindings and consecrating holy soil."
  },
  {
    id: "altar_might_smash",
    tagRequired: "altar",
    verb: "DESECRATE_IDOL",
    actionTitle: "🔨 Smash Dark Idol",
    template: "I swing heavy iron into {target} to shatter the blasphemous effigy with brute might",
    stat: "might",
    baseDC: 12,
    category: "TACTICAL",
    description: "Demolish evil altars to break cult summoning rituals."
  },

  // ==========================================
  // TAG: "trap" / "mechanism"
  // ==========================================
  {
    id: "trap_awareness_spot",
    tagRequired: "trap",
    verb: "SPOT_TRIGGER",
    actionTitle: "👀 Trace Trigger",
    template: "I examine the floorboards and tension lines around {target} using awareness",
    stat: "awareness",
    baseDC: 9,
    category: "EXPLORATION",
    description: "Locate hidden tripwires, tension cords, and concealed dart slits."
  },
  {
    id: "trap_finesse_disarm",
    tagRequired: "trap",
    verb: "DISARM_RIG",
    actionTitle: "✂️ Sever Tension",
    template: "I pinch and wedge the spring trigger of {target} to disarm it using finesse",
    stat: "finesse",
    baseDC: 12,
    category: "SUBTERFUGE",
    description: "Carefully snip or lock the trip mechanism without setting off the payload.",
    toolKeywords: ["pliers", "thieves tools", "lockpick"],
    toolMod: 2
  },
  {
    id: "trap_logic_deduce",
    tagRequired: "trap",
    verb: "DEDUCE_SPRING",
    actionTitle: "📐 Deduce Reset",
    template: "I analyze the counterweight cycle of {target} to safely trip it with a prop using logic",
    stat: "logic",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Calculate how to safely trigger the trap from a safe distance."
  },
  {
    id: "trap_reflex_evade",
    tagRequired: "trap",
    verb: "EVADE_TRIGGER",
    actionTitle: "⚡ Reflex Dive",
    template: "I dive and twist past the lethal arc of {target} using instant reflex",
    stat: "reflex",
    baseDC: 11,
    category: "TACTICAL",
    description: "Spring clear of flying darts, swinging blades, or spike pits."
  },

  // ==========================================
  // TAG: "climbable" / "cliff" / "ridge"
  // ==========================================
  {
    id: "climb_might_ascend",
    tagRequired: "climbable",
    verb: "PULL_UP",
    actionTitle: "💪 Haul Bodyweight",
    template: "I grip the rocky ledges of {target} and hoist my body upward using raw might",
    stat: "might",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Muscle up sheer ledges and rocky overhangs.",
    toolKeywords: ["climbing rope", "grappling hook", "pitons"],
    toolMod: 3
  },
  {
    id: "climb_endurance_longclimb",
    tagRequired: "climbable",
    verb: "ENDURE_ASCENT",
    actionTitle: "🧗 Sustained Ascent",
    template: "I maintain steady rhythmic pacing up the steep incline of {target} using endurance",
    stat: "endurance",
    baseDC: 10,
    category: "EXPLORATION",
    description: "Climb sustained heights without succumbing to muscle fatigue."
  },
  {
    id: "climb_awareness_holds",
    tagRequired: "climbable",
    verb: "SPOT_HANDHOLDS",
    actionTitle: "👁️ Map Ascent Route",
    template: "I scan the face of {target} to chart safe handholds and crevices using awareness",
    stat: "awareness",
    baseDC: 8,
    category: "EXPLORATION",
    description: "Identify the safest route up a treacherous natural precipice."
  },
  {
    id: "climb_finesse_rappel",
    tagRequired: "climbable",
    verb: "RAPPEL_DOWN",
    actionTitle: "🪢 Rappel Down",
    template: "I control my descent down {target} with balanced footing using finesse",
    stat: "finesse",
    baseDC: 9,
    category: "EXPLORATION",
    description: "Descend rapidly and silently without dislodging rockslides.",
    toolKeywords: ["climbing rope", "rope"],
    toolMod: 2
  },

  // ==========================================
  // TAG: "rubble" / "collapse" / "barricade"
  // ==========================================
  {
    id: "rubble_might_clear",
    tagRequired: "rubble",
    verb: "EXCAVATE_RUBBLE",
    actionTitle: "⛏️ Clear Debris",
    template: "I heave fallen stones and splintered beams from {target} using brute might",
    stat: "might",
    baseDC: 12,
    category: "EXPLORATION",
    description: "Clear a blocked passageway or unearth someone buried beneath collapsed ruins."
  },
  {
    id: "rubble_logic_shore",
    tagRequired: "rubble",
    verb: "SHORE_UP",
    actionTitle: "📐 Shore Ceiling",
    template: "I place brace timbers to stabilize the crumbling ceiling of {target} using logic",
    stat: "logic",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Prevent secondary cave-ins and structural collapse."
  },
  {
    id: "rubble_fortitude_brace",
    tagRequired: "rubble",
    verb: "BRACE_COLLAPSE",
    actionTitle: "🛡️ Brace Impact",
    template: "I raise my shield and weather falling debris from {target} with fortitude",
    stat: "fortitude",
    baseDC: 10,
    category: "TACTICAL",
    description: "Absorb falling mortar and rockfall without breaking stance."
  },
  {
    id: "rubble_reflex_slip",
    tagRequired: "rubble",
    verb: "SLIP_THROUGH",
    actionTitle: "🤸 Squeeze Gap",
    template: "I squeeze through a narrow fissure in {target} using agile reflex",
    stat: "reflex",
    baseDC: 10,
    category: "SUBTERFUGE",
    description: "Slip through tight crevices to bypass barricades or locked gates."
  },

  // ==========================================
  // TAG: "outlaw" / "bandit" / "hostile" (Non-Combat Maneuvers)
  // ==========================================
  {
    id: "outlaw_might_roar",
    tagRequired: "outlaw",
    verb: "BELLOW_INTIMIDATE",
    actionTitle: "💀 Terrify Outlaw",
    template: "I roar a lethal challenge at {target} to shatter their morale using might",
    stat: "might",
    baseDC: 12,
    category: "SOCIAL",
    description: "Intimidate highway robbers into breaking ranks or retreating."
  },
  {
    id: "outlaw_charm_bribe",
    tagRequired: "outlaw",
    verb: "BRIBE_BANDIT",
    actionTitle: "🪙 Bribe Passage",
    template: "I offer a pouch of gold to buy safe passage from {target} using charm",
    stat: "charm",
    baseDC: 10,
    category: "SOCIAL",
    description: "Pay a toll to pass through contested outlaw territory peacefully."
  },
  {
    id: "outlaw_finesse_feign",
    tagRequired: "outlaw",
    verb: "FEIGN_SURRENDER",
    actionTitle: "🎭 Feign Surrender",
    template: "I feign surrender before {target} while palming a concealed blade using finesse",
    stat: "finesse",
    baseDC: 12,
    category: "SUBTERFUGE",
    description: "Lower their guard before unleashing a lethal counter-ambush."
  },
  {
    id: "outlaw_awareness_listen",
    tagRequired: "outlaw",
    verb: "LISTEN_OUTLAW",
    actionTitle: "👂 Eavesdrop Orders",
    template: "I eavesdrop on the whispers and tactical signals of {target} using awareness",
    stat: "awareness",
    baseDC: 9,
    category: "SUBTERFUGE",
    description: "Learn bandit numbers, lair passwords, and ambush coordinates."
  },
  {
    id: "outlaw_willpower_stare",
    tagRequired: "outlaw",
    verb: "UNBLINKING_GLARE",
    actionTitle: "👁️ Unflinching Will",
    template: "I stare into the eyes of {target} with cold, terrifying willpower",
    stat: "willpower",
    baseDC: 11,
    category: "SOCIAL",
    description: "Force the bandit to second-guess fighting you."
  }
];

/**
 * DEFAULT WILDERNESS ACTIONS
 * Presented when no specific target is locked (interacting with the immediate surrounding terrain).
 */
export const WILDERNESS_AREA_ACTIONS: TagStatAction[] = [
  {
    id: "wild_awareness_scout",
    tagRequired: "wilderness",
    verb: "SEARCH",
    actionTitle: "🔍 Scout Surroundings",
    template: "I scout and search the surroundings for tracks, hidden caches, and threats",
    stat: "awareness",
    baseDC: 9,
    category: "EXPLORATION",
    description: "Scan immediate topography for subtle game trails and concealed tracks."
  },
  {
    id: "wild_awareness_forage",
    tagRequired: "wilderness",
    verb: "FORAGE",
    actionTitle: "🌿 Forage Terrain",
    template: "I scan the immediate terrain for wild herbs, edible roots, and game tracks",
    stat: "awareness",
    baseDC: 9,
    category: "SURVIVAL",
    description: "Search undergrowth for harvestable flora and edible roots."
  },
  {
    id: "wild_vitality_camp",
    tagRequired: "wilderness",
    verb: "REST",
    actionTitle: "🏕️ Rest & Camp",
    template: "I take a tactical pause to make a quick camp, bandage wounds, and rest",
    stat: "vitality",
    baseDC: 7,
    category: "SURVIVAL",
    description: "Make a hasty wilderness bivouac to catch breath and bind injuries."
  },
  {
    id: "wild_finesse_sneak",
    tagRequired: "wilderness",
    verb: "SNEAK",
    actionTitle: "👤 Sneak Through Shadows",
    template: "I move stealthily from cover to cover without alerting enemies",
    stat: "finesse",
    baseDC: 10,
    category: "SUBTERFUGE",
    description: "Mask footsteps and move through concealment."
  },
  {
    id: "wild_intuition_sense",
    tagRequired: "wilderness",
    verb: "SENSE_MAGIC",
    actionTitle: "🔮 Sense Arcana",
    template: "I open my senses to detect aetheric currents and hidden arcane hazards",
    stat: "intuition",
    baseDC: 10,
    category: "MAGIC",
    description: "Detect cosmic radiation, invisible wards, and planar distortions."
  },
  {
    id: "wild_endurance_march",
    tagRequired: "wilderness",
    verb: "FORCED_MARCH",
    actionTitle: "👟 Steady March",
    template: "I lock into an enduring stride to cross the sector terrain quickly using endurance",
    stat: "endurance",
    baseDC: 8,
    category: "EXPLORATION",
    description: "Cross harsh rough terrain without accumulating fatigue."
  },

  // ==========================================
  // TAG: "warden" / "grey_cloak" (Secretive Guardians)
  // ==========================================
  {
    id: "warden_charm_parley",
    tagRequired: "warden",
    verb: "PARLEY_WARDEN",
    actionTitle: "🤝 Seek Warden Counsel",
    template: "I hail the Grey Warden with solemn respect to request safe conduct and counsel using charm",
    stat: "charm",
    baseDC: 9,
    category: "SOCIAL",
    description: "Earn the trust of secretive guardians who stand vigil over cosmic horrors."
  },
  {
    id: "warden_knowledge_lore",
    tagRequired: "warden",
    verb: "ASK_DRAGON_LORE",
    actionTitle: "📜 Inquire on Cosmic Dragon",
    template: "I ask the Warden about the ancient seals and the nature of the slumbering chaos dragon using knowledge",
    stat: "knowledge",
    baseDC: 11,
    category: "EXPLORATION",
    description: "Learn cosmic dragon vulnerabilities, prison history, and active lunar flows."
  },
  {
    id: "warden_willpower_pledge",
    tagRequired: "warden",
    verb: "PLEDGE_VIGIL",
    actionTitle: "🛡️ Pledge Blood Vigil",
    template: "I steel my soul and swear to stand with the Grey Wardens against cosmic madness using willpower",
    stat: "willpower",
    baseDC: 12,
    category: "TACTICAL",
    description: "Form an unwavering pact with the wardens, gaining their battlefield support."
  },

  // ==========================================
  // TAG: "cultist" / "blood_magic" (Dragon Zealots)
  // ==========================================
  {
    id: "cultist_knowledge_heresy",
    tagRequired: "cultist",
    verb: "DECIPHER_HERESY",
    actionTitle: "📖 Decipher Heretical Chants",
    template: "I analyze the blood-rites and dark chants of the cultists using forbidden knowledge",
    stat: "knowledge",
    baseDC: 11,
    category: "MAGIC",
    description: "Identify which chaos dragon they are beseeching and which seals they threaten."
  },
  {
    id: "cultist_intuition_disrupt",
    tagRequired: "cultist",
    verb: "DISRUPT_RESONANCE",
    actionTitle: "🔮 Disrupt Ritual Harmonics",
    template: "I project psychic dissonance into the cultists' circle to disrupt their ritual using intuition",
    stat: "intuition",
    baseDC: 13,
    category: "MAGIC",
    description: "Cause dark sacrificial energies to backfire on the cultists before the dragon responds."
  },
  {
    id: "cultist_finesse_sever",
    tagRequired: "cultist",
    verb: "SEVER_ALTAR_CORDS",
    actionTitle: "🗡️ Sunder Ritual Focus",
    template: "I dart forward with surgical precision to sever the blood-fetishes of the cultists using finesse",
    stat: "finesse",
    baseDC: 12,
    category: "TACTICAL",
    description: "Destroy obsidian ritual daggers and cruor vials before blood strikes the barrow."
  },

  // ==========================================
  // TAG: "dragon_seal" / "prison" (Dragon Barrow Megaliths)
  // ==========================================
  {
    id: "seal_knowledge_inspect",
    tagRequired: "dragon_seal",
    verb: "INSPECT_TITANIUM_WARDS",
    actionTitle: "📜 Inspect Titanium Ward-Anchors",
    template: "I examine the ancient titanium ciphers and ward-bindings holding the dragon sealed using knowledge",
    stat: "knowledge",
    baseDC: 13,
    category: "EXPLORATION",
    description: "Measure seal degradation, runic fracturing, and flow absorption."
  },
  {
    id: "seal_willpower_channel",
    tagRequired: "dragon_seal",
    verb: "CHANNEL_GROUNDING_WILL",
    actionTitle: "🛡️ Anchor Dragon Seal",
    template: "I place my palms upon the barrow and channel immovable cosmic resolve into the seal using willpower",
    stat: "willpower",
    baseDC: 14,
    category: "MAGIC",
    description: "Reinforce crumbling wards with pure unyielding conviction, suppressing dragon tremors."
  },
  {
    id: "seal_intuition_mind",
    tagRequired: "dragon_seal",
    verb: "COMMUNE_DRAGON_DREAM",
    actionTitle: "👁️ Peer into Slumbering Mind",
    template: "I open my mind to touch the vast slumbering consciousness of the chaos dragon using intuition",
    stat: "intuition",
    baseDC: 15,
    category: "MAGIC",
    description: "Glimpse terrifying cosmic secrets radiating from the dragon's abyssal dream."
  }
];

/**
 * FAIR DC CALCULATION ENGINE
 * Modifies an action's base DC according to target materials, condition tags, and player tools.
 */
export function computeActionDC(
  action: TagStatAction,
  targetTags: string[],
  playerInventory: string[] = []
): { dc: number; breakdown: { base: number; materialMod: number; toolBonus: number } } {
  let materialMod = 0;
  const tagsLower = targetTags.map((t) => t.toLowerCase());

  // Material & Structural Modifiers
  if (tagsLower.includes("fragile") || tagsLower.includes("weathered") || tagsLower.includes("rotten")) {
    materialMod -= 3;
  }
  if (tagsLower.includes("iron") || tagsLower.includes("sturdy")) {
    materialMod += 1;
  }
  if (tagsLower.includes("steel") || tagsLower.includes("reinforced") || tagsLower.includes("heavy") || tagsLower.includes("unyielding")) {
    materialMod += 2;
  }
  if (tagsLower.includes("ancient") || tagsLower.includes("eldritch") || tagsLower.includes("masterwork")) {
    materialMod += 3;
  }

  // Tool Modifiers
  let toolBonus = 0;
  if (action.toolKeywords && action.toolKeywords.length > 0) {
    const invLower = playerInventory.map((i) => i.toLowerCase());
    const hasTool = action.toolKeywords.some((kw) => invLower.some((invItem) => invItem.includes(kw)));
    if (hasTool) {
      toolBonus = action.toolMod || 2;
    }
  }

  const finalDC = Math.max(5, action.baseDC + materialMod - toolBonus);
  return {
    dc: finalDC,
    breakdown: {
      base: action.baseDC,
      materialMod,
      toolBonus
    }
  };
}

/**
 * UNIVERSAL ACTION RETRIEVER
 * Aggregates all valid actions matching a target's tags, deduplicating and calculating fair DCs.
 */
export function getAvailableActionsForTarget(
  target: { name: string; tags: string[] | Set<string> } | null,
  playerInventory: string[] = []
): Array<TagStatAction & { finalDC: number; toolBonus: number; formulatedPrompt: string }> {
  if (!target) {
    return WILDERNESS_AREA_ACTIONS.map((action) => {
      const calc = computeActionDC(action, ["wilderness"], playerInventory);
      return {
        ...action,
        finalDC: calc.dc,
        toolBonus: calc.breakdown.toolBonus,
        formulatedPrompt: action.template.replace("{target}", "the surrounding area")
      };
    });
  }

  const rawTags = Array.isArray(target.tags) ? target.tags : Array.from(target.tags || []);
  const tagsLower = rawTags.map((t) => t.toLowerCase());

  const matchedActions: Array<TagStatAction & { finalDC: number; toolBonus: number; formulatedPrompt: string }> = [];
  const seenVerbs = new Set<string>();

  for (const action of ATOMIC_TAG_ACTIONS) {
    const required = action.tagRequired.toLowerCase();

    // Check if target has the tag or matches related synonyms
    const matches = tagsLower.some((t) => {
      if (t === required) return true;
      if (required === "wood" && (t === "timber" || t === "lumber" || t === "branch" || t === "snag" || t === "trunk")) return true;
      if (required === "stone" && (t === "rock" || t === "masonry" || t === "monolith" || t === "granite" || t === "slate" || t === "boulder" || t === "pillar")) return true;
      if (required === "metal" && (t === "iron" || t === "steel" || t === "bronze" || t === "gold" || t === "silver" || t === "anvil" || t === "forge")) return true;
      if (required === "crafting" && (t === "forge" || t === "anvil" || t === "blacksmith" || t === "artisan" || t === "workshop")) return true;
      if (required === "water" && (t === "water_source" || t === "fountain" || t === "well" || t === "spring" || t === "stream" || t === "basin" || t === "pool")) return true;
      if (required === "fire" && (t === "flame" || t === "hearth" || t === "burning" || t === "brazier" || t === "spit" || t === "campfire")) return true;
      if (required === "flora" && (t === "forageable" || t === "herbs" || t === "lichen" || t === "fern" || t === "flower" || t === "berries" || t === "roots" || t === "reed")) return true;
      if (required === "forageable" && (t === "flora" || t === "herbs" || t === "edible" || t === "grain" || t === "fiber" || t === "medicine" || t === "salt")) return true;
      if (required === "beast" && (t === "predator" || t === "prey" || t === "fauna" || t === "animal" || t === "creature")) return true;
      if (required === "corpse" && (t === "carcass" || t === "remains" || t === "skeleton" || t === "bones" || t === "skull")) return true;
      if (required === "civilian" && (t === "merchant" || t === "innkeeper" || t === "wayfarer" || t === "refugee" || t === "commoner" || t === "townsfolk")) return true;
      if (required === "merchant" && (t === "trader" || t === "vendor" || t === "caravaner" || t === "peddler")) return true;
      if (required === "authority" && (t === "reeve" || t === "sentry" || t === "guard" || t === "bailiff" || t === "patrol" || t === "official")) return true;
      if (required === "magic" && (t === "arcane" || t === "wardstone" || t === "rune" || t === "crystal" || t === "aether")) return true;
      if (required === "altar" && (t === "shrine" || t === "sacred" || t === "temple" || t === "sanctuary" || t === "relic")) return true;
      if (required === "trap" && (t === "mechanism" || t === "tripwire" || t === "pressure_plate" || t === "contraption")) return true;
      if (required === "climbable" && (t === "cliff" || t === "ridge" || t === "crag" || t === "elevation" || t === "ledge")) return true;
      if (required === "rubble" && (t === "debris" || t === "barricade" || t === "collapse" || t === "ruins")) return true;
      if (required === "outlaw" && (t === "bandit" || t === "cannibal" || t === "raider" || t === "smuggler" || t === "marauder")) return true;
      return false;
    });

    if (matches && !seenVerbs.has(action.verb)) {
      seenVerbs.add(action.verb);
      const calc = computeActionDC(action, tagsLower, playerInventory);
      matchedActions.push({
        ...action,
        finalDC: calc.dc,
        toolBonus: calc.breakdown.toolBonus,
        formulatedPrompt: action.template.replace("{target}", target.name)
      });
    }
  }

  // If no specific tag actions matched, provide the universal exploration fallback
  if (matchedActions.length === 0) {
    return WILDERNESS_AREA_ACTIONS.map((action) => {
      const calc = computeActionDC(action, tagsLower, playerInventory);
      return {
        ...action,
        finalDC: calc.dc,
        toolBonus: calc.breakdown.toolBonus,
        formulatedPrompt: action.template.replace("{target}", target.name)
      };
    });
  }

  return matchedActions;
}
