# B.R.U.T.A.L. ENGINE: MASTER SYSTEM REFERENCE DOCUMENT (SRD)
## IMPLEMENTATION BLUEPRINT FOR THE CHARACTER CREATOR AND THE RULES ENGINE

---

### INTRODUCTION & PHILOSOPHY
This document serves as the absolute, mathematically complete, and uncompressed Master System Reference Document (SRD) for the **B.R.U.T.A.L. Engine**. It contains the comprehensive dataset, algorithms, validation constraints, and physical logic loops required to program both a digital **Character Creator** and a real-time **Combat & Rules Engine**.

The B.R.U.T.A.L. Engine transitions from a math-heavy roleplaying game into a highly modular, card-driven tactical system. It eliminates mid-session arithmetic, replacing it with tactile resource tracking, strict physical loadouts, and spatial tag interactions.

---

## SECTION 1: GLOBAL DATA STRUCTURES & SYSTEMS

### 1.1 THE 12 CORE ATTRIBUTES
The B.R.U.T.A.L. Engine divides a character's "Source Code" into exactly 12 attributes, strictly categorized into Body (Physical Execution) and Mind (Mental/Aetheric Processing).

#### BODY STATS (Physical Execution)
1. **MIGHT (Mass & Force):** Physical power, lifting, melee damage scale, and the *Press* Clash Tactic.
2. **ENDURANCE (Stasis & Structure):** Pain tolerance, physical shielding, and the *Hold* Clash Tactic.
3. **FINESSE (Precision & Bypass):** Dexterity, micro-mechanics, armor penetration, and the *Trick* Clash Tactic.
4. **REFLEX (Momentum & Speed):** Kinetic reaction speed, dodging, and the *Maneuver* Clash Tactic.
5. **VITALITY (Biology & Life):** Physiological density, natural weapon damage, healing, and the *Disengage* Clash Tactic.
6. **FORTITUDE (Matter & Heat):** Material structural hardness, thermal resistance, demolition, and the *Feint* Clash Tactic.

#### MIND STATS (Mental/Aetheric Processing)
7. **KNOWLEDGE (Arcane & Data):** Logic databases, spell decryption, and the *Press* Clash Tactic.
8. **LOGIC (Math & Geometry):** Trajectory calculation, algorithmic puzzle solving, and the *Hold* Clash Tactic.
9. **AWARENESS (Perception & Light):** Environmental data ingestion, micro-expression reading, and the *Trick* Clash Tactic.
10. **INTUITION (Entropy & Probability):** Subconscious warning systems, luck manipulation, and the *Maneuver* Clash Tactic.
11. **CHARM (Spirit & Emotion):** Intrapersonal resonance, behavioral command, and the *Disengage* Clash Tactic.
12. **WILLPOWER (Law & Authority):** Reality assertion, psychic shields, and the *Feint* Clash Tactic.

---

### 1.2 BIOLOGICAL KINGDOMS & BASE STATS
Characters do not use randomized attribute pools. They select a pre-calculated matrix from one of six **Biological Kingdoms**. Within their Kingdom, they choose a **Mechanical Sub-Type (T1–T4)** to ensure niche protection.
*(Note: T0 Origin stats are strictly utilized by the Game Master to initialize mundane beasts and NPCs. They are ineligible for player character selection).*

#### KINGDOM 1: MAMMALS (The Hinterland Clans)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 3 | 3 | 4 | 4 | 2 |
| **Endurance** | 4 | 3 | 4 | 5 | 4 |
| **Finesse** | 5 | 4 | 4 | 5 | 5 |
| **Reflex** | 2 | 3 | 2 | 1 | 4 |
| **Vitality** | 3 | 3 | 2 | 2 | 2 |
| **Fortitude** | 1 | 2 | 2 | 1 | 1 |
| **Knowledge** | 5 | 4 | 4 | 5 | 5 |
| **Logic** | 1 | 2 | 2 | 1 | 1 |
| **Awareness** | 2 | 3 | 2 | 1 | 4 |
| **Intuition** | 3 | 3 | 2 | 2 | 2 |
| **Charm** | 4 | 3 | 4 | 5 | 4 |
| **Willpower** | 3 | 3 | 4 | 4 | 2 |

#### KINGDOM 2: REPTILES & AMPHIBIANS (The Biome Sectors)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 3 | 3 | 4 | 4 | 2 |
| **Endurance** | 2 | 3 | 2 | 1 | 4 |
| **Finesse** | 1 | 2 | 2 | 1 | 1 |
| **Reflex** | 4 | 3 | 4 | 5 | 4 |
| **Vitality** | 3 | 3 | 2 | 2 | 2 |
| **Fortitude** | 5 | 4 | 4 | 5 | 5 |
| **Knowledge** | 3 | 3 | 2 | 2 | 2 |
| **Logic** | 5 | 4 | 4 | 5 | 5 |
| **Awareness** | 1 | 2 | 2 | 1 | 1 |
| **Intuition** | 4 | 3 | 4 | 5 | 4 |
| **Charm** | 3 | 3 | 4 | 4 | 2 |
| **Willpower** | 2 | 3 | 2 | 1 | 4 |

#### KINGDOM 3: AVIANS (Imperial & Nomadic Chronicles)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 1 | 2 | 2 | 1 | 1 |
| **Endurance** | 3 | 3 | 4 | 2 | 2 |
| **Finesse** | 3 | 3 | 2 | 4 | 2 |
| **Reflex** | 5 | 4 | 4 | 5 | 5 |
| **Vitality** | 4 | 3 | 4 | 5 | 4 |
| **Fortitude** | 2 | 3 | 2 | 1 | 4 |
| **Knowledge** | 4 | 3 | 4 | 5 | 4 |
| **Logic** | 2 | 3 | 2 | 1 | 4 |
| **Awareness** | 5 | 4 | 4 | 5 | 5 |
| **Intuition** | 1 | 2 | 2 | 1 | 1 |
| **Charm** | 3 | 3 | 4 | 2 | 2 |
| **Willpower** | 3 | 3 | 2 | 4 | 2 |

#### KINGDOM 4: AQUATICS (Benthic & River Folk)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 2 | 3 | 2 | 1 | 4 |
| **Endurance** | 5 | 4 | 4 | 5 | 5 |
| **Finesse** | 4 | 3 | 4 | 5 | 4 |
| **Reflex** | 3 | 3 | 2 | 4 | 2 |
| **Vitality** | 1 | 2 | 2 | 1 | 1 |
| **Fortitude** | 3 | 3 | 4 | 2 | 2 |
| **Knowledge** | 2 | 3 | 2 | 1 | 4 |
| **Logic** | 3 | 3 | 4 | 2 | 2 |
| **Awareness** | 4 | 3 | 4 | 5 | 4 |
| **Intuition** | 3 | 3 | 2 | 4 | 2 |
| **Charm** | 1 | 2 | 2 | 1 | 1 |
| **Willpower** | 5 | 4 | 4 | 5 | 5 |

#### KINGDOM 5: INSECTS & ARTHROPODS (Chitinous Juggernauts)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 5 | 4 | 4 | 5 | 5 |
| **Endurance** | 1 | 2 | 2 | 1 | 1 |
| **Finesse** | 3 | 3 | 4 | 2 | 2 |
| **Reflex** | 3 | 3 | 2 | 4 | 2 |
| **Vitality** | 2 | 3 | 2 | 1 | 4 |
| **Fortitude** | 4 | 3 | 4 | 5 | 4 |
| **Knowledge** | 3 | 3 | 2 | 2 | 2 |
| **Logic** | 4 | 3 | 4 | 5 | 4 |
| **Awareness** | 3 | 3 | 4 | 4 | 2 |
| **Intuition** | 5 | 4 | 4 | 5 | 5 |
| **Charm** | 2 | 3 | 2 | 1 | 4 |
| **Willpower** | 1 | 2 | 2 | 1 | 1 |

#### KINGDOM 6: PLANTS & MYCONIDS (Timber Titans)
| Attribute | T0 (Origin) | T1 (Balancer) | T2 (Heavy) | T3 (Predator) | T4 (Specialist) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Might** | 4 | 3 | 4 | 5 | 4 |
| **Endurance** | 3 | 3 | 4 | 2 | 2 |
| **Finesse** | 2 | 3 | 2 | 1 | 4 |
| **Reflex** | 1 | 2 | 2 | 1 | 1 |
| **Vitality** | 5 | 4 | 4 | 5 | 5 |
| **Fortitude** | 3 | 3 | 2 | 4 | 2 |
| **Knowledge** | 1 | 2 | 2 | 1 | 1 |
| **Logic** | 3 | 3 | 2 | 2 | 2 |
| **Awareness** | 3 | 3 | 4 | 4 | 2 |
| **Intuition** | 2 | 3 | 2 | 1 | 4 |
| **Charm** | 5 | 4 | 4 | 5 | 5 |
| **Willpower** | 4 | 3 | 4 | 5 | 4 |

---

### 1.3 THE 144 BIOLOGICAL ORIGINS
Every character chooses one specific Origin corresponding to their Kingdom. This provides a unique, highly specific passive mechanical ability tied to Ostraka's **Fictional Positioning** rules.

#### KINGDOM 1: MAMMALS (The Hinterland Clans)
*   **Heavies (Stout/Heavy):**
    1. **Horses (Unstoppable Stride):** Never lose footing or fall Prone on flat terrain.
    2. **Zebras (Dazzling Herd):** Gain Advantage on saving throws vs. Ranged attacks when standing adjacent to an ally.
    3. **Donkeys (Stubborn Root):** Completely immune to non-magical forced movement.
    4. **Cattle/Sheep (Iron Stomach):** Can digest raw, toxic, or spoiled vegetation without taking damage.
    5. **Hippos (Immovable Mass):** Cannot be pushed, dragged, or swept away by liquid currents.
    6. **Bears (Hibernation):** Resting for a continuous 24-hour period instantly cures all non-permanent diseases and exhaustion.
*   **Predators (Lean/Light):**
    7. **Deer/Elk (Velvet Tread):** Can run at full speed through forests or foliage without generating noise.
    8. **Wolves (Pack Hunter):** Instinctively sense the exact direction and distance of packmates within 1 mile.
    9. **Coyotes (Scavenger's Wit):** Unerringly find survival rations and water in barren wilderness ruins.
    10. **Foxes (Cunning Dive):** Leap into mud, snow, or rubble to immediately gain T3 Cover.
    11. **Big Cats (Tree-Dragger):** Can scale vertical surfaces while carrying objects equal to their own body weight.
    12. **Otters (River-Dancer):** Swim speed equals land speed; can hold breath 5x longer than standard.
*   **Specialists (Light/Stout):**
    13. **Rats (Sewer-Born):** Total immunity to mundane diseases and stagnant or poisoned water.
    14. **Mice (Squeeze):** Can pass through any structural gap wide enough for their skull without reducing speed.
    15. **Beavers (Dam-Builder):** Construct highly durable timber barricades out of debris in 1 minute.
    16. **Porcupines (Quill-Guard):** Any entity that initiates a Grapple against you takes 1 automatic physical injury severity check.
    17. **Flying Squirrels (Glide):** Convert every 1 foot of vertical fall into 3 feet of horizontal traversal.
    18. **Bats (Echolocation):** Ignore Disadvantage from Blinded or Obscured status conditions within a 30ft radius.
*   **Balancers (Lean/Stout/Light):**
    19. **Monkeys (Arboreal Acrobat):** Use hands and feet interchangeably; climb sheer surfaces while fighting.
    20. **Sloths (Metabolic Pause):** Can hold breath for up to 1 hour; halves the rate of any poison spread.
    21. **Red Pandas (Innocuous):** Hostile entities will target you last unless you perform a hostile action.
    22. **Raccoons (Bandit's Hands):** Identify structural trap components purely by physical touch in pitch darkness.
    23. **Opossums (Play Dead):** Perfectly mimic death; hostile AI entities will immediately ignore you.
    24. **Pangolins (Scale-Curl):** Curl into a defensive ball to gain total immunity to Slashing and Piercing damage.

#### KINGDOM 2: REPTILES & AMPHIBIANS (The Biome Sectors)
*   **Heavies (Volcanic/Swamp/Canyon):**
    25. **Stone-Scales (Lava-Treader):** Completely ignore movement penalties and damage from volcanic or thermal terrain hazards.
    26. **Crocodiles (Submerged Ambush):** Completely invisible and untrackable while resting just below a water surface.
    27. **Alligators (Marsh-Dozer):** Ignore movement penalties for Difficult/Slowing terrain in swamps, mud, or bogs.
    28. **Komodos (Carrion Eater):** Total immunity to ingested poisons, rotting flesh, or toxic biological matter.
    29. **Toad Barons (Immovable Anchor):** Gain automatic success on all saving throws to resist being knocked Prone or Shoved.
    30. **Resonance-Basilisks (Seismic Step):** Detect the location of moving entities through solid walls via crystalline vibrations.
*   **Predators (Jungle/Desert):**
    31. **Serpentes (Coiled Spring):** Triple jumping distance from a complete standstill.
    32. **Pit-Vipers (Thermal Pits):** Target warm-blooded entities through Obscured or smoke tags by reading heat.
    33. **Monitors (Blood-Tracker):** Can track Bleeding entities for miles through scent alone.
    34. **Aquatic Frogs (Current-Rider):** Swim speed is double normal land walk speed.
    35. **Salamander-Lizards (Ash-Walker):** Breathe and see perfectly through heavy volcanic ash, smoke, and toxic smog.
    36. **Crystal-Serpents (Resonant Rattle):** Emit a sub-audible chime to automatically apply the Docile tag to mundane beasts.
*   **Specialists (Jungle/Swamp/Canyon):**
    37. **Geckoes (Sticky Pads):** Walk on vertical walls and sheer ceilings at full bipedal speed.
    38. **Gliding Skinks (Membrane Glide):** Convert vertical falls into horizontal gliding distance.
    39. **Ranidae (Toxic Excretion):** Any entity that touches your bare skin must save vs. the Poisoned tag.
    40. **Tree Frogs (Canopy Leaper):** Ignore movement penalties for Difficult/Slowing terrain above ground level.
    41. **Shovel-Snouts (Sand-Swimmer):** Instantly burrow into ash, sand, or loose dirt to gain T3 Cover.
    42. **Glass-Skinks (Harmonic Shatter):** Emit a high-frequency hum to instantly break all Brittle objects within 15ft.
*   **Balancers (Swamp/Desert/Jungle):**
    43. **Frilled-Lizards (Sudden Display):** Gain automatic Advantage on all physical Intimidation displays.
    44. **Newt-Kin (Regrowth):** Naturally regrow severed physical limbs over a 30-day period.
    45. **Mud Frogs (Mud-Meld):** Perfectly camouflaged and invisible to scrying while resting in mud or shallow water.
    46. **Echo-Toads (Vocal Reverb):** Project your voice up to 1 mile away to create precise auditory distractions.
    47. **Desert Iguanas (Thermal Sink):** Absorb environmental heat to survive extreme freezing environments.
    48. **Chameleons (Color-Shift):** Gain the Hidden tag automatically by remaining completely stationary.

#### KINGDOM 3: AVIANS (Imperial & Nomadic Chronicles)
*   **Heavies (Grounded/Imperial):**
    49. **Penguins (Tundra-Slide):** Slide on stomach to double movement speed on ice, mud, or wet slopes.
    50. **Chickens (Flock Sentinel):** Only require 2 hours of sleep; detect hostile intent up to 60ft away.
    51. **Ostriches/Emus (Powerful Strides):** Sprint distance is doubled; can carry passengers of equal physical size.
    52. **Cassowaries (Brutal Kick):** Performing a Shove action deals 1 physical injury severity level.
    53. **Turkeys (Puffed Chest):** Gain Advantage on Intimidation checks vs. all non-sapient, mundane beasts.
    54. **Geese (Territorial Honk):** Instantly remove the Stealth tag from all enemies in your active Zone.
*   **Predators (Imperial Elite/Navy):**
    55. **Owls (Technical Truth):** Gain Advantage on Deception checks when technically telling the truth.
    56. **Eagles (Eye for Dishonesty):** Instantly detect if a non-magical NPC is telling a direct lie.
    57. **Hawks (Dive-Bomb):** Dropping at least 15ft vertically onto a target bypasses all mundane Armor Mods.
    58. **Falcons (High-Speed Stoop):** Triple flight speed when moving in a direct, uninterrupted line.
    59. **Vultures/Condors (Carrion Eater):** Extract complete nutritional value from rotting, decayed, or poisoned food.
    60. **Ospreys (Water-Plunge):** See perfectly through water; ignore kinetic damage from surface tension when diving.
*   **Specialists (Nomadic Gypsy):**
    61. **Finches/Sparrows (Swarm-Squeeze):** Fit through structural gaps as small as 2 inches in diameter.
    62. **Hummingbirds (Perfect Hover):** Arrest kinetic momentum in mid-air to execute technical Manual actions.
    63. **Nightingales (Lullaby):** Remove the Fear, Panic, and Enraged tags from target via vocal performance.
    64. **Mockingbirds (Sound-Thief):** Digitally/acoustically "throw" a recorded sound or voice up to 60ft away.
    65. **Lyrebirds (Acoustic Illusion):** Replicate the sounds of entire armies or giant monsters with massive volume.
    66. **Magpies (Shiny-Seeker):** Sense the presence of raw metal or high-value currency; find hidden drawers instantly.
*   **Balancers (Imperial Aristocracy/Navy):**
    67. **Ducks (Water-Shed):** Completely immune to Cold and Sapped tags from water or mud.
    68. **Ravens/Crows (Contract Memory):** Possess photographic memory for debts, financial ledgers, and spoken oaths.
    69. **Swans (Aristocratic Grace):** Mundane guards and NPCs defer to your legal authority without a check.
    70. **Parrots/Macaws (Perfect Mimicry):** Flawlessly replicate any voice or animal call heard within 24 hours.
    71. **Pigeons/Doves (Homing Instinct):** Unerringly retrace steps out of any dungeon; always know absolute North.
    72. **Gulls/Albatross (Wind-Rider):** Sleep while gliding; ignore travel fatigue during oceanic flight.

#### KINGDOM 4: AQUATICS (Benthic & River Folk)
*   **Heavies (Deep Ocean/Coastal):**
    73. **Walruses (Ice-Breaker):** Shatter Brittle doors and blockages by ramming them.
    74. **Orcas (Apex Sonar):** Communicate silent, high-density tactical details up to 5 miles away.
    75. **Giant Crabs (Chitin Carapace):** Ignore the first physical instance of Slashing or Piercing damage each combat.
    76. **Lobsters (Vice-Grip):** Targets suffer Disadvantage on checks to break your Grapple.
    77. **Elephant Seals (Deep-Dive Blubber):** Immune to deep-ocean pressure and Freezing/Sapped hazards.
    78. **Manatees (Placid Aura):** Mundane beasts will not attack you unless you initiate hostility.
*   **Predators (Saltwater Predators):**
    79. **Great White Sharks (Blood-Frenzy):** Track Bleeding targets for miles through water, rain, or blood scent.
    80. **Hammerhead Sharks (Electro-Receptor):** Sense active electrical currents or heartbeats within 30ft, ignoring Invisibility.
    81. **Barracudas (Torpedo Strike):** Triple speed when moving in a straight, unobstructed line.
    82. **Moray Eels (Crevice Lurker):** Gain T3 Cover instantly when occupying structural cracks, pipes, or narrow spaces.
    83. **Tiger Sharks (Ocean Scavenger):** Total immunity to ingested toxins; extract useable metal from scrap debris.
    84. **Marlin/Swordfish (Living Rapier):** Natural weapon counts as an unbreakable Finesse blade; cannot be Disarmed.
*   **Specialists (Reef/Trench):**
    85. **Seahorses (Prehensile Anchor):** Tail lock makes you immune to Pushed tags and strong aquatic currents.
    86. **Anglerfish (Bioluminescent Lure):** Apply the Fascinated tag to weak-minded NPCs or beasts.
    87. **Lionfish (Toxic Spines):** Any entity that grapples you takes immediate Poisoned damage.
    88. **Mantis Shrimp (Cavitation Snap):** Unarmed strikes shatter glass, Brittle locks, and dense chitin.
    89. **Pufferfish (Spike-Inflate):** Expand body as a free action to physically block narrow doorways and corridors.
    90. **Flounder/Flatfish (Sand-Meld):** Dropping Prone on sand, dirt, or silt immediately grants the Hidden tag.
*   **Balancers (River Folk/Nomad):**
    91. **Koi/Carp (Merchant’s Appraisal):** Instantly detect counterfeit currency, fake gems, and items under illusions.
    92. **Salmon/Trout (Upstream Navigator):** Ignore travel speed penalties for moving uphill or against high winds.
    93. **Seals/Sea Lions (Sleek Acrobatics):** Ignore Difficult terrain and movement penalties on wet, slick, or muddy surfaces.
    94. **Dolphins (Joyous Leap):** Launch out of water to land perfectly on bipedal feet on solid ground.
    95. **Manta Rays (Hydro-Glide):** Convert high-speed aquatic surface breaches into short horizontal aerial glides.
    96. **Catfish (Barbel Whiskers):** Never suffer Disadvantage from murky water, heavy silt, or dense river fog.

#### KINGDOM 5: INSECTS & ARTHROPODS (Chitinous Juggernauts)
*   **Heavies (Undergrowth Armor):**
    97. **Goliath/Rhino Beetles (Unstoppable Horn):** Shove environmental objects up to 5x your weight without rolling.
    98. **Pill Bugs (Chitin-Sphere):** Roll into a sphere to gain total immunity to fall damage and Crushing.
    99. **Cockroaches (Wasteland Survivor):** Absolute immunity to radiation, chemical fallout, and weeks of starvation.
    100. **Stag Beetles (Vice-Grip Mandibles):** Retain a permanent Grapple; snap wooden structural locks in half.
    101. **Soldier Ants (Unbreakable Line):** Permanently immune to the Fear, Terrified, and Panic status conditions.
    102. **Ironclad Beetles (Crush-Proof):** Cannot be crushed by collapsing ceilings, industrial presses, or massive debris.
*   **Predators (Apex Carnivores):**
    103. **Praying Mantises (Lightning Strike):** Once per combat, execute an attack that completely ignores enemy Reactive actions.
    104. **Wasps (Nerve Sting):** Paralyze a single NPC limb for 1 hour without killing the target.
    105. **Hornets (Alarm Pheromone):** Mark a target; the target is continuously harassed by mundane swarms for 24 hours.
    106. **Tarantulas (Multi-Eye Tracking):** Cannot be flanked; see through magical or non-magical smoke and obscurity.
    107. **Assassin Bugs (Lethal Injection):** Attacks executed against Surprised targets completely bypass all Armor Mods.
    108. **Centipedes (Multi-Leg Skitter):** Ignore movement restrictions from magical webs, sticky fluids, or leg-traps.
*   **Specialists (Silk & Hive):**
    109. **Honey Bees (The Waggle Dance):** Communicate complex maps, coordinates, and paths silently via movement.
    110. **Orb-Weaver Spiders (Silk-Spinner):** Produce 100 feet of high-strength, weight-bearing silk rope per day.
    111. **Caterpillars (Thermal Cocoon):** Spin a insulated, waterproof shelter to protect the party during extreme blizzards.
    112. **Trapdoor Spiders (Ambush Earth):** Bury yourself in dirt/rubble in 1 minute to gain T3 Cover and Hidden status.
    113. **Mosquitoes (Blood-Savant):** Taste a droplet of blood to learn the target's species, current HP, and active toxins.
    114. **Fleas (Coiled Spring):** Leap 50 feet vertically as a free action without making a check.
*   **Balancers (Canopy Survivors):**
    115. **Butterflies (Dazzling Wings):** Gain Advantage on Charm and Distraction checks in direct, bright sunlight.
    116. **Moths (Dust-Cloak):** Micro-scales completely neutralize your biological scent and Odor tag.
    117. **Grasshoppers (Acoustic Resonance):** Chirp to send clear, high-frequency messages to allies up to 1 mile away.
    118. **Leafcutter Ants (Flawless Logistics):** Ignore the Encumbered status penalty when carrying raw crafting materials.
    119. **Fireflies (Bioluminescence):** Act as a heatless light source; signal silent Morse code in absolute darkness.
    120. **Stick Insects (Branch-Meld):** Stand still in any vegetation or forest to gain the Hidden tag automatically.

#### KINGDOM 6: PLANTS & MYCONIDS (Timber Titans)
*   **Heavies (The Hardwoods):**
    121. **Oaks (Deep Roots):** Immune to Pushed, Prone, and all forced movement when standing on natural soil.
    122. **Redwoods (Towering Canopy):** Count as one physical size category larger for lifting, pulling, and grappling.
    123. **Willows (Weeping Boughs):** Highly flexible structural fibers absorb shock; completely ignore fall damage.
    124. **Mangroves (Brackish Filter):** Naturally filter mud, salt, and contaminants from water, rendering it drinkable.
    125. **Pines (Evergreen Resin):** Secrete a fast-drying sap to plug structural leaks or immediately stop Bleeding.
    126. **Baobabs (Water Vault):** Internal reservoir stores water, allowing survival in desert wastes indefinitely.
*   **Predators (Strangling Growth):**
    127. **Strangler Figs (Constricting Coil):** Enemies suffer Disadvantage on checks to break your biological Grapple.
    128. **Kudzu (Overnight Overgrowth):** Grow dense vines over a campsite in 10 minutes to gain T3 environmental camouflage.
    129. **Blood-Briars (Barbed Embrace):** Any entity grappling you takes 1 physical injury severity level to their arms.
    130. **Ivy/Creepers (Structural Meld):** Climb vertical stone surfaces at full speed without using hands or tools.
    131. **Pitcher-Vines (Acidic Reservoir):** Internal digestive pouch slowly dissolves small metallic or organic items.
    132. **Morning Glories (Twining Bind):** Stems act as unbreakable, self-tightening ropes to secure captives.
*   **Specialists (The Myconid Network):**
    133. **Truffles (Seismic Mycelium):** Sense the location of all moving entities within 60ft touching the ground.
    134. **Death Caps (Toxic Flesh):** Any entity that bites or consumes your flesh immediately gains the Poisoned and Weakened tags.
    135. **Ink Caps (Deliquescence):** Melt portions of cap into highly corrosive acidic ink that eats through iron locks.
    136. **Bioluminescent Mycena (Ghost-Glow):** Light cap at will to pierce magical and non-magical darkness.
    137. **Puffballs (Spore-Smokescreen):** Taking damage releases a 10ft radius cloud of heavy Obscuring spores.
    138. **Cordyceps (Nerve-Hack):** Puppet the nervous system of a recently deceased small beast as a scout for 10 minutes.
*   **Balancers (Blossoming Flora):**
    139. **Roses (Deceptive Beauty):** Airborne pheromones grant Advantage on Charm checks against targets who can smell.
    140. **Lotus (Purifying Bloom):** Rest in water for 1 hour to completely purge all internal toxins, poisons, and diseases.
    141. **Nightshades (Apothecary's Blood):** Identify poisons by taste; completely immune to your own internal toxins.
    142. **Orchids (Mimicry Petals):** Physically alter color, scent, and leaf shape to mimic other plants or heraldic crests.
    143. **Sunflowers (Solar Battery):** 4 hours of direct sunlight bypasses the need for food, water, or sleep for 48 hours.
    144. **Tumbleweeds (Wind-Rider):** Travel at 3x normal speed in strong winds across desert or flat terrain.

---

### 1.4 DERIVED TACTICAL SUB-STATS
Four derived stats dictate the combat timeline and battlefield control. They are calculated using a strict 2:1 ratio (2 Mind points to 1 Body point, or 2 Body points to 1 Mind point).

```python
# Formulas for Derived Sub-Stats (Calculate during Character Creation)
Perception = Awareness (Mind) + Logic (Mind) + Vitality (Body)
Stealth    = Knowledge (Mind) + Charm (Mind) + Finesse (Body)
Movement   = Reflexes (Body) + Might (Body) + Intuition (Mind)
Balance    = Endurance (Body) + Fortitude (Body) + Willpower (Mind)
```

---

### 1.5 THE RESOURCE POOLS
The B.R.U.T.A.L. Engine tracks resources numerically as physical tokens.

#### HEALTH POOLS (HP & Composure)
*   **Physical Health (HP):** Maximum HP = `Endurance + Fortitude + Vitality`. Represents physical structural integrity.
*   **Composure:** Maximum Composure = `Willpower + Logic + Charm`. Represents psychological and cognitive integrity.

#### THE UNIVERSAL COMBAT BATTERY
*   **Active Stamina:** Always begins combat at **10/10 tokens**.
*   **Active Focus:** Always begins combat at **10/10 tokens**.
Regardless of biological build, every entity receives this initial 10/10 adrenaline surge at the start of a firefight to fuel opening-round tactics.

#### BIOLOGICAL CAPACITY & THE RESERVE POOL
Your biological attributes determine your long-term capacity to recharge your Active Battery.
*   **Stamina Capacity:** `Might + Reflexes + Finesse`
*   **Focus Capacity:** `Knowledge + Awareness + Intuition`
*   **Reserve Pool Calculation:**
    *   `Reserve Stamina = Stamina Capacity - Equipped Physical Gear Tax`
    *   `Reserve Focus = Focus Capacity - Equipped Mental Gear Tax`

#### RESERVE BURN (Desperation Dynamics)
If a player's Active Battery (Stamina or Focus) drops to 0 mid-combat, they may permanently "Burn" points from their underlying Reserve Pool on a 1-to-1 basis to immediately regenerate active tokens.
*   *Constraint:* Burned Reserve points are completely lost until a **Full Rest** is completed. Burning reserves simulates exhausting your physiological "gas tank" to survive an emergency, but it does **not** lower your maximum Capacity threshold.

---

### 1.6 GEAR TAX & STATIC LOADOUTS
A character is restricted to a strict **6-Piece Static Loadout**: exactly 3 Physical items (Armor, Melee Weapon, Ranged Weapon) and exactly 3 Mental items (Headgear, Jewelry, Ranged Projector).
Equipping gear reduces your Biological Capacity. This is the **Gear Tax**.

| Tier | Item Type | Capacity Resource Tax | Armor Mod (Damage Reduction) |
| :--- | :--- | :---: | :---: |
| **Zero** | Light Surgical Weapons | -0 Tax | 0 Armor Mod |
| **Light** | Silks / Daggers / Wards | -1 Tax | 1 Armor Mod |
| **Medium** | Chainmail / War Hammers | -2 Tax | 2 Armor Mod |
| **Heavy** | Plate Armor / Greatswords | -3 Tax | 3 Armor Mod |

#### THE 50% THRESHOLD RULE
If your total equipped Physical Gear Tax exceeds 50% of your maximum **Stamina Capacity**, or your total Mental Gear Tax exceeds 50% of your **Focus Capacity**, your body and mind are overburdened.
*   **Mechanical Penalty:** Your end-of-round Action Die regeneration rate immediately drops from the standard **2 tokens per turn** to a sluggish **1 token per turn**.
*   *Validation:* Because this threshold is calculated against your Maximum Capacity, burning Reserve points mid-dive will never trigger this penalty.

#### THE SHOCK OF LOSS RULE
Equipment cannot be reallocated or altered during a firefight. If your Heavy Plate Armor (-3 Tax) is shattered, disarmed, or stripped mid-combat:
*   **Mechanical Constraint:** The **Max Pool Tax remains fully applied** (-3 Capacity). The violent physiological shock of losing protection, the sudden shift in your center of gravity, and the sudden psychological panic prevent pool recalculation until the combat resolves and the adrenaline fades.

---

## SECTION 2: THE CHARACTER CREATION PROTOCOL (ALGORITHM)

An agent or compiler building a character creator must execute these exact steps in sequence to guarantee validation.

```
                  [ START: Choose Kingdom ]
                              │
               [ Choose Mechanical Sub-Type ]
                              │
               [ Initialize Base Attributes ]
                              │
                  [ Apply Origin Passive ]
                              │
                    [ Select Size Shift ]
                     (Modify Stats +1/-1)
                              │
                 [ Life Experience Allocation ]
                    (+3 Body / +3 Mind)
                              │
               [ Professional Training (Draft 6) ]
                    (+2 per selected track)
                              │
               [ VALIDATION Check: Hard Cap 8 ]
                 (Reallocate attribute overflow)
                              │
                 [ Calculate Resource Pools ]
                  (HP, Composure, Capacities)
                              │
                  [ Equip 6-Piece Loadout ]
                     (3 Phys / 3 Mental)
                              │
               [ Calculate Gear Tax & Reserves ]
                              │
             [ VALIDATION Check: 50% Threshold ]
               (Set round regen to 1 or 2 tokens)
                              │
                  [ END: Character Ready ]
```

### 2.1 CONSTRAINTS & VALIDATION RULINGS
1. **The Biological Ceiling (Creation Hard Cap):** No attribute may exceed an **8** during character creation. If size shifts, life experience, and the six +2 track bonuses push an attribute to 9 or higher, the engine must hard-cap the stat at 8. The player must immediately reallocate the overflow points on a 1-to-1 basis into any other attribute of the same biological category (Body points to Body stats, Mind points to Mind stats).
2. **Loadout Balance Check:** The character creator must strictly validate that the loadout contains exactly 3 Physical cards and 3 Mental cards.
3. **Capacity Non-Negativity:** The subtraction of Gear Tax from Capacity to yield the Reserve Pool can never result in a negative number. If Gear Tax exceeds Capacity, the loadout is invalid and cannot be equipped.

---

## SECTION 3: THE COMBAT & PHYSICS RULES ENGINE

Combat in the B.R.U.T.A.L. Engine is designed as a "desperate negotiation of physics," operating on a hyper-reactive framework where turn order is dictated by Perception and Speed.

### 3.1 PHASE 1: THE INFORMATION STEP (PERCEPTION)
1. **The Vector Declaration (Fluid Intent):** Turn order in Phase 1 is sorted by **Perception** from **lowest to highest**.
2. **Intent Placement:** The entity with the lowest Perception must declare their Target Vector first by placing a physical **Target Token** (crosshair) on their intended enemy target or tactical Zone. The entity with the highest Perception declares last.
3. *Design Benefit (The Advantage):* This allows highly perceptive characters to observe the "Source Code" of the enemy's movements and drop their Target Tokens reactively to counter them.
4. **The [Enraged] Hard-Lock Exception:** If an entity is applied with the **[Enraged]** tag, their self-preservation and tactical AI are bypassed. They cannot "Pivot." They are hard-locked to their Target Token and must take the most direct physical path to reach it, even if that path forces them to sprint directly through a lethal **[Hazard]** terrain or a **[Sharp]** debris field.

---

### 3.2 PHASE 2: THE EXECUTION STEP (RESOLUTION)
1. **The Order of Operations:** Sorted by **Movement (Speed)** sub-stat from **highest to lowest**. The fastest entity executes their turn first.
2. **The 3-Beat Pulse Expenditure:** On their execution turn, an entity spends their physical S-Die and F-Die tokens to resolve their Move Beat, Stamina Action, and Focus Action.
3. **The Tactical Pivot:** If a high-speed ally kills your marked target before your speed order resolves, your target is invalidated. Because your intent is "Fluid," you do not waste your turn or your action tokens. You simply **Pivot**: you pick up your Target Token, evaluate the new board state, and spend your 3-Beat Pulse resources on a different, viable action (such as taking cover or attacking a secondary target).

---

### 3.3 PHASE 3: CONTESTED ROLLS & CLASH SYSTEM
When two entities engage in a contested action, both roll `1d20 + Stat Modifier`.

#### THE STAT-DRIVEN CLASH MATRIX
If a contested roll results in an **exact tie**, the combatants instantly enter a **Clash**. This represents an exhausting, blade-locked deadlock.

*   **The Clash Cost:** For every round a Clash deadlock continues, both combatants must immediately discard **1 Active Stamina and 1 Active Focus** token.
*   **Clash Declaration:** Sorted by Perception; the combatant with the lower Perception must declare their Tactic first.
*   **Clash Resolution:** Both players make a new contested `1d20 + Attribute` roll corresponding to their selected Tactic.

| Selected Tactic | Physical Attribute (Body) | Mental Attribute (Mind) | Winner's Delivery (Active Outcome) | Loser's Vulnerability (Consequence) |
| :--- | :--- | :--- | :--- | :--- |
| **PRESS** | Might | Knowledge | Steps 1 space forward, overpowering the center. | Overcommits; suffers amplified counter-damage. |
| **HOLD** | Endurance | Logic | Anchors in place; strike delivered from a fixed stance. | *Arcane Note:* Spells detonate in the middle, dealing half damage to both and creating an environmental Hazard. |
| **MANEUVER** | Reflex | Intuition | Shifts 1 space (Left/Right); strikes from flanking angle. | Attempts to side-step; moves directly into the hit. |
| **TRICK** | Finesse | Awareness | Alters strike frequency; bypasses all active blocks. | Bluff exposed; left Stunned by psychological shock. |
| **FEINT** | Fortitude | Willpower | Bait & Switch: Instantly switches spaces with the loser. | Staggered: Steps out of stance; absorbs strike unprotected. |
| **DISENGAGE** | Vitality | Charm | Delivers parting strike; leaps 1 space backward. | Caught flat-footed; impact throws them farther backward. |

#### THE MOMENTUM ARREST RULE
If an entity attempts to resolve a high-speed charge (Momentum) and ties a Clash against a defender executing a **Hold** or **Press** tactic:
*   The charger's kinetic momentum is instantly arrested. They lose the remainder of their Move beats and take 1 automatic point of Composure damage from the jarring kinetic feedback.

---

### 3.4 THE MAGIC DUEL
When two casters target each other simultaneously with Anomaly spells, a Magic Duel is initiated.
1. **The Bane Advantage:** The Celestial Clockwork dictates elemental relationships. If a caster's Anomaly school is the elemental **Bane** of their opponent's (e.g., Ratio/Lightning vs. Flux/Acid), they receive **Advantage** on their contested Mind check.
2. **Resolution:** The winner's spell completely dissipates the loser's magic, punching through to hit the loser with full mechanical effect.
3. **Chaos Generation:** Resolving a Magic Duel is highly volatile. The rules engine must automatically add **+1 Tick to the Chaos Tracker**, regardless of the dice outcomes.

---

## SECTION 4: THE SURVIVAL HORROR & TRAUMA ENGINE

The **Trauma Pipeline** processes all damage from initial impact through to the permanent structural scars of survival.

```
 [ Incoming Damage ] ──> [ Subtract Armor Mod ] ──> [ Check 4-Tier Injury Thresholds ]
                                                                 │
 [ Come-Down Phase: Roll 1d4 Locations ] <── [ Apply Adrenaline Shock (Next Roll Disadvantage) ]
              │
 [ Check Location Escalations ] ──> [ Entering 0 HP/Composure: Entering Zero-State ]
                                                     │
 [ Wake Up: Adrenaline d20 Check ] ──> [ Revived: Shock Wipe (Active Battery = 0, Defense = DC 10) ]
                                                     │
                                       [ Apply Permanent Scar & Stat Penalties ]
```

### 4.1 THE TRAUMA PIPELINE STAGES

#### STAGE 1: ARMOR MITIGATION
Calculate Net Damage: `Net Damage = Raw Damage - Equipped Armor Mod`. (Minimum Net Damage is 0).

#### STAGE 2: THE 4-TIER INJURY THRESHOLDS
Compare the Net Damage to the following thresholds:
1. **1–2 Damage (Bruise/Flinch):** Direct HP or Composure subtraction. No mechanical trauma or lingering penalties.
2. **3–6 Damage (Minor Injury):** Immediate **Adrenaline Shock** applied. Record one 1d4 location tally to resolve during the "Come-Down."
3. **6–10 Damage (Major Injury):** Immediate **Adrenaline Shock** applied. Record one 1d4 location tally. The target immediately begins taking **continuous Bleed (HP) or Trauma (Composure)** damage at the start of every subsequent round.
4. **11+ Damage (Critical Injury):** Catastrophic trauma. Apply **Adrenaline Shock**. The target suffers two simultaneous location penalties or escalations, immediate continuous Bleed/Trauma, and **cannot self-treat** the injury.

#### STAGE 3: ADRENALINE SHOCK & THE DELAYED LOCATION RESOLUTION
Adrenaline masks physical damage in the heat of combat.
*   **The Immediate Penalty:** Any strike hitting a Minor threshold or higher instantly applies **Disadvantage to the target's very next roll**. This represents the kinetic or mental shock rattling their system.
*   **The "Come-Down" Phase:** The specific location penalties (the 1d4 rolls) are **delayed until the end of combat**. When the adrenaline fades, the characters roll 1d4 for every injury tally marked during the fight.
*   *Note on Arterial Spray:* Continuous Bleed or Trauma damage must be managed immediately during combat; adrenaline cannot stop physical blood loss.

#### STAGE 4: THE ESCALATION CHARTS
If a location is hit a second time during an encounter, the injury **escalates** to the 2nd level.

| 1d4 Roll | Physical Location | 1st Injury Tally (Penalty) | 2nd Injury Tally (Escalation) |
| :---: | :--- | :--- | :--- |
| **1** | **Legs** | Movement speed is halved. | Disadvantage on all Active Defense. |
| **2** | **Arms** | Disadvantage on Offense rolls. | Disadvantage on both Offense and Defense. |
| **3** | **Core** | Movement speed halved; applied Staggered. | Disadvantage on sustained and Clash actions. |
| **4** | **Head** | Disadvantage on Perception checks. | Disadvantage on all Attack and Defense rolls. |

| 1d4 Roll | Mental Location | 1st Trauma Tally (Penalty) | 2nd Trauma Tally (Escalation) |
| :---: | :--- | :--- | :--- |
| **1** | **Confidence** | Disadvantage on Social Defense. | Lose Self-Assured and Impressive tags. |
| **2** | **Reason** | Disadvantage on Focus actions and spells. | Cannot utilize Logical-based skills. |
| **3** | **Instinct** | Disadvantage on Initiative & Intuition. | Cannot read hostile or friendly intents. |
| **4** | **Memory** | Disadvantage on Willpower and Lore. | Automatically fail checks vs. Fear or Deception. |

#### STAGE 5: THE ZERO-STATE (Physical & Mental Collapse)
Reaching **0 HP (Neutralized)** or **0 Composure (Psychic Break)** immediately forces the entity into the **Zero-State**. All active Clash locks are broken, and the entity falls Prone.
*   **The Descent Countdown:** Continuous Bleed/Trauma ticks at the start of every turn.
    *   If a resource pool drops to **-1 to -5 Capacity**, the entity has a strict **3-round countdown** before expiring.
    *   If a resource pool drops to **-10 Capacity**, the entity suffers **Instant Expiry** (death or irreversible brain death).
*   **Waking Up (The Adrenaline Check):** At the start of their turn while at 0, the player may attempt a d20 Adrenaline Check to force themselves awake.
    *   *Turn 1 at 0:* Requires a Natural 20.
    *   *Turn 2+ at 0:* The target number expands downward by 1 each turn (19-20, then 18-20, etc.).
*   **Fragile Recovery & The Shock Wipe (HARD RULE):** Receiving any healing or composure treatment that restores at least 1 point instantly wakes the character. However, returning from the brink of death is violently traumatic:
    *   **The Shock Wipe:** The physiological shock instantly wipes their Active Action Pools (**Stamina and Focus Battery**) to exactly **0/10 tokens**.
    *   **Exposed Defenses:** They awaken with the **[Winded]** or **[Confused]** tag. Because they possess 0 active tokens to spend on reactions, their derived defenses instantly collapse to a flat **DC 10** until their battery naturally reboots at the end of the round.

#### STAGE 6: THE PERMANENT SCAR SYSTEM
Surviving the Zero-State after suffering Major or Critical injuries leaves a permanent physical or mental scar.
*   **Physical Scars (Maimed / Infected):**
    *   *Penalty:* Permanent **-1 Maximum HP**. Suffer Disadvantage on physical checks during severe weather or for the first hour after resting.
    *   *Fictional Blessing:* May leverage horrific physical features to gain **Advantage** on Intimidation rolls.
*   **Mental Scars:**
    *   *Penalty:* Permanent **-1 Maximum Composure**. Define a specific psychological Trigger. Suffer Disadvantage on all mental checks when exposed to this trigger.
    *   *Fictional Blessing:* Leverage manic intensity or hyper-fixation to gain **Advantage** on highly specific narrative scenarios.

---

### 4.2 FIELD TREATMENT COSTS
*   **Treating Minor Injury:** Costs **1 Stamina Action + a successful Vitality check**. Removes the location penalty.
*   **Treating Major Injury:** Costs **1 Action Beat (Vitality for physical, Charm/Willpower for mental) + 1 S-Die + 1 F-Die**. Stops continuous damage, but the location penalty remains for the rest of the encounter.
*   **Treating Critical Injury:** Cannot be self-treated. An adjacent ally must spend **1 Action Beat + 1 S-Die + 1 F-Die** to patch. Continuous damage is arrested; location penalties remain.

---

## SECTION 5: THE CHAOS ENGINE & REPLAYABILITY ARCHITECTURE

The **Chaos Engine** tracks localized reality degradation caused by tapping into the Primordial Gears.

### 5.1 THE PERSISTENT CHAOS CLOCK
The **Chaos Tracker** is a 10-Tick clock. It **carries over** between room encounters; it does not reset when combat ends.
*   **The Trigger Matrix (Requires d20 matching check):** Activating any Professional Skill Track (Tiers 1-9) or channeling Anomaly spells requires comparing your d20 roll to the room's active **Chaos Number**.
*   **Automatic Ticks (No d20 check required):**
    *   Resolving a Magic Duel immediately adds **+1 Tick**.
    *   Entering a Zone with the **[Hazard: Chaos]** tag immediately adds **+1 Tick**.
    *   **The Rest Penalty:** For every **1 hour** the party spends resting, searching, or failing out-of-combat checks outside of a Safe Zone, the GM automatically adds **+1 Tick**.

#### MARGIN EXPANSION
At the start of an encounter, the GM rolls a d20 to set the active **Chaos Number**. As the Chaos Tracker ticks up, the margin for triggering a reality Glitch expands:
*   **0–3 Ticks:** Exact Match only on the active Chaos Number.
*   **4–6 Ticks:** Expansion to **±1 margin** of the Chaos Number.
*   **7–9 Ticks:** Expansion to **±2 margin** of the Chaos Number.

#### THE GLITCH RESOLUTION (1d6)
If a d20 check falls within the active Chaos Number's margin, a Glitch is triggered. The active player rolls a d6:
*   **1–2 (Full Hijack):** The action is hijacked by the **Wild Resonance Chart** and redirected to a random target (determined by the GM; may hit an ally or the user). Add +1 Tick to Chaos Tracker.
*   **3–4 (Targeted Hijack):** The action is hijacked by the **Wild Resonance Chart** but successfully hits the intended target. Add +1 Tick to Chaos Tracker.
*   **5–6 (Pure Luck):** Reality stabilizes. The action resolves unaffected. Add +1 Tick to Chaos Tracker.

---

### 5.2 THE 1d20 WILD RESONANCE CHART
1. **Kinetic Reversal:** Damage heals the target; healing causes equivalent damage.
2. **Elemental Swap:** The action's element changes to its Bane in the Celestial Clockwork (e.g., Ratio/Lightning becomes Flux/Acid).
3. **Gravitational Slingshot:** Attacker and target are pulled into adjacent spaces.
4. **Vocal Echo:** The action emits an Echoing boom; the entire Zone gains the Muted tag for 1 round.
5. **Aetheric Tether:** Attacker and target share a health pool for 1 round.
6. **Temporal Stutter:** Action fails now; resolves automatically at the start of the next round.
7. **Dimensional Phase:** Target becomes Incorporeal for 1 beat.
8. **Friction Loss:** Target and Attacker are pushed 2 Zones apart; ground becomes Unstable.
9. **Psychic Backlash:** Action converts entirely to Composure Damage.
10. **Magnetic Attraction:** All Metal objects in the Zone fly toward the target.
11. **Sensory Swap:** Attacker is Blinded but sees through the target's eyes for 1 turn.
12. **Accelerated Rot:** Used weapons or focuses gain the Brittle tag.
13. **Mirror Clones:** Target fractures into 3 illusions. Attacks vs. target have Disadvantage; hitting an illusion destroys it.
14. **Thermal Vacuum:** Room hits absolute zero; applies Sapped to everyone in the Zone.
15. **Overclocked Force:** Double damage/effect, but destroys the weapon or focus used.
16. **Amnesia Spike:** Attacker forgets the skill used; it is unavailable until the next rest.
17. **Blood to Acid:** Attack deals equivalent Acid damage back to the attacker.
18. **Polymorph Glitch:** Target becomes a harmless mundane animal for 1 beat.
19. **Resurrection Spark:** Nearest corpse is revived as a hostile undead entity.
20. **The Perfect Storm:** *CRITICAL SYSTEM FAILURE.* Action is an automatic Critical Hit bypassing all armor. Add **+3 Ticks** to the Chaos Tracker.

---

### 5.3 ZONE ENVELOPMENT: THE 10-TICK RULE-FLIP
When the Chaos Tracker hits **10 Ticks**, local reality shatters. The GM rolls a 1d6 to apply a permanent, map-wide **Reality Shattering** rule-flip:
*   **1 (Gravity Flip):** Ground actions cost 0 Stamina; occupants must "swim" through air to stay in place.
*   **2 (Entropy Flip):** Roll Low to succeed (1 is a Critical, 20 is a Fail). Disadvantage becomes Advantage.
*   **3 (Thermal Swap):** Fire/Acid heal; healing and regeneration deal Burn damage.
*   **4 (Mirror Ego):** All entities swap physical positions and current HP with their nearest enemy.
*   **5 (The Floor is Vapor):** The ground is Incorporeal. Entities must cling to furniture or Vertical surfaces to avoid the void.
*   **6 (Hyper-Lethality):** All Armor Mods are reduced to 0; all HP and Composure damage is doubled.

---

### 5.4 CHANNELING THE CHAOS
If a player's Stamina or Focus tokens are completely depleted, they may attempt to **Channel the Chaos** to execute skills at **0 tokens**.
*   **The Chaos Die:** The player rolls a second d20 (the Chaos Die) alongside their standard d20 and compares it to the room's active **Chaos Number**.
    *   *Exact Match:* Perfect flow. Double the action's effect. Add **+1 Tick** to the Chaos Tracker.
    *   *Within 5 (±5):* Volatile resolution. Action resolves normally, but instantly trigger a random **Wild Resonance** effect in the Zone. Add **+1 Tick** to the Chaos Tracker.
    *   *Miss by 5+:* The Drift rejects the conduit. The action fails. Instantly trigger a random **Wild Resonance** targeting **ONLY yourself**. Add **+2 Ticks** to the Chaos Tracker.

---

## SECTION 6: THE 48 COMPREHENSIVE SKILL TRACKS

A character creator or rules engine must contain the precise, uncompressed mechanical behaviors for all 48 professional skill tracks.

---

### PART I: THE PASSIVE HARDWARE (ASSAULT & AEGIS)
These tracks contain no active skills to trigger; they permanently upgrade base actions and modify gear efficiency.

#### 1. MIGHT (Mass & Force)
*   **Assault (Imposing Weapons):**
    *   **T1:** *Drive Back* - Free 1-space push on a successful hit.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Cleave* - Adjacent enemies take half damage from physical strikes.
    *   **T4:** *Crushing Weight* - Striking ignores Shield or Braced armor modifiers.
    *   **T5:** *The Wall* - Free strike when an enemy enters your melee zone.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Sunder* - Standard strikes automatically apply the **[Broken Armor]** tag.
    *   **T8:** *Momentum* - Executing a kill restores 1 S-Die and grants a free strike.
    *   **T9:** *Unstoppable Force* - Strikes cannot be dodged or parried.
*   **Aegis (Braced Armor):**
    *   **T1:** *Planted* - Gain +1 Defense if 0 Move Beats were spent this round.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *The Bulwark* - Allies standing directly behind you receive Full Cover.
    *   **T4:** *Rooted* - Gain absolute immunity to Pushed, Pulled, and Prone tags.
    *   **T5:** *Recoil* - Attackers failing to deal 3+ damage to you take 1 point of recoil damage.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Jarring Halt* - Melee attackers targeting you instantly gain the **[Numb]** tag.
    *   **T8:** *Unbroken* - Surviving an attack of 5+ damage grants +1 S-Die and a free Action Beat.
    *   **T9:** *Immovable Object* - Completely immune to non-magical forced movement.

#### 2. ENDURANCE (Stasis & Structure)
*   **Assault (Defending Weapons):**
    *   **T1:** *Shield-Bash* - Gain +1 to your next Defense roll after executing a successful strike.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Iron Turtle* - Strike and Defend in the same Action Beat.
    *   **T4:** *Relentless* - Ignore all physical action and movement penalties from injuries.
    *   **T5:** *Intercept* - Reaction to redirect an adjacent ally's incoming attack to yourself.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Exhaust* - Standard strikes automatically apply the **[Winded]** tag.
    *   **T8:** *Hold the Line* - Blocking an attack for an ally grants a free Action Beat.
    *   **T9:** *Inevitable* - Your strikes never suffer Disadvantage.
*   **Aegis (Fortress Armor):**
    *   **T1:** *Deflect* - Reduce all incoming physical damage by a flat 1.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Walking Bunker* - Ignore movement speed penalties for encumbrance or dragging.
    *   **T4:** *Reinforced* - Gain absolute immunity to Critical Hit damage multipliers.
    *   **T5:** *Shatter-Point* - Missed ranged physical attacks shatter on impact, preventing ricochet.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *The Anvil* - Enemies tying a contested Clash roll against you automatically lose.
    *   **T8:** *Last Stand* - Dropping to 1 HP instantly restores 1 S-Die and 1 free Action Beat.
    *   **T9:** *The Living Wall* - Gain absolute immunity to Bleeding and Pierced tags.

#### 3. FINESSE (Precision & Bypass)
*   **Assault (Precision Weapons):**
    *   **T1:** *Lunge* - Gain +1 space strike reach on melee attacks.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Surgical Flurry* - Free second strike against a distracted or flanked enemy.
    *   **T4:** *Armor Piercing* - Melee strikes ignore Fortress or Reinforced armor mods.
    *   **T5:** *Punish* - Free strike against a melee enemy that misses an attack against you.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Hamstring* - Standard strikes automatically apply the **[Severed]** tag to a targeted limb.
    *   **T8:** *The Dissection* - Applying a Status Tag to an enemy grants you a free Move Beat.
    *   **T9:** *Internal Strike* - Melee strikes bypass physical armor modifications completely.
*   **Aegis (Agile Armor):**
    *   **T1:** *Contortion* - Move through occupied enemy spaces without penalty.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Fluid Guard* - Execute a Move Beat and a Defend action within the same beat.
    *   **T4:** *Slippery* - Gain absolute immunity to Grappled and Restrained tags.
    *   **T5:** *Shadow-Step* - Free 1-space shift when an enemy enters your melee zone.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Overcommit* - Enemies missing an attack against you instantly gain the **[Exposed]** tag.
    *   **T8:** *The Ghost* - Successfully dodging an incoming Critical Hit grants you a free Action Beat.
    *   **T9:** *Weightless* - Never trigger physical floor traps, tripwires, or pressure plates.

#### 4. REFLEX (Momentum & Speed)
*   **Assault (Quick Weapons):**
    *   **T1:** *Quick-Step* - Free 1-space shift before or after executing a physical Strike.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Follow-Through* - Successful hit grants a free secondary strike on an adjacent target.
    *   **T4:** *Find the Gap* - Striking ignores 2 points of physical Armor Mods.
    *   **T5:** *Riposte* - Free strike against a melee attacker that misses you or loses a Clash.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Artery Sever* - Landing two strikes in one round automatically applies **[Bleeding]** and **[Slowed]**.
    *   **T8:** *Momentum State* - Securing a kill restores 1 S-Die and grants a free Move Beat.
    *   **T9:** *Blinding Speed* - Strikes cannot be parried or blocked; gain Advantage vs. enemies who haven't acted.
*   **Aegis (Mobile Armor):**
    *   **T1:** *The Slip* - Free 1-Zone shift after a successful defense or a Clash tie.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Sure-Footed* - Ignore movement penalties from Difficult, Slick, and Unstable terrain tags.
    *   **T4:** *Ghost-Step* - Gain absolute immunity to Attacks of Opportunity.
    *   **T5:** *Fluid Escape* - Automatically succeed on Disengage Clash rolls without rolling dice.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax. Sprint/Dash actions cost 0 Stamina.
    *   **T7:** *Overextend* - Enemies rolling a Critical Failure or missing you by 5+ are knocked **[Prone]** and **[Off-Balance]**.
    *   **T8:** *Kinetic Battery* - Moving through 2 or more Zones in a single turn restores 1 S-Die.
    *   **T9:** *Untouchable* - The first physical attack targeted at you each round automatically misses.

#### 5. VITALITY (Biology & Life)
*   **Assault (Bio Weapons):**
    *   **T1:** *Predator's Latch* - Unarmed strikes deal lethal damage and automatically initiate a Grapple.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Frenzy* - Striking a grappled target grants a free secondary bite or claw strike.
    *   **T4:** *Primal Force* - Unarmed strikes ignore all non-metallic Armor Mods.
    *   **T5:** *Blood-Drunk* - Free retaliatory unarmed strike whenever you take HP damage.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Maim* - Standard strikes automatically apply the **[Infected]** or **[Maimed]** tag.
    *   **T8:** *The Feast* - Executing an enemy restores 1 HP and 1 S-Die.
    *   **T9:** *Apex Predator* - Unarmed strikes treat all physical targets as possessing 0 Armor Mod.
*   **Aegis (Organic Armor):**
    *   **T1:** *Rapid Clotting* - Regenerate 1 HP at the end of a combat round if you took physical damage.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Adrenaline Surge* - Completely ignore movement and action penalties from active injuries.
    *   **T4:** *Iron Gut* - Gain absolute immunity to Poisoned and Diseased tags.
    *   **T5:** *Shed Skin* - Halve incoming Critical damage; your Armor Mod drops to 0 for the round.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Toxic Carapace* - Entities attempting to grapple you take automatic acid or spine damage.
    *   **T8:** *The Rebirth* - Regenerating to Maximum HP instantly grants a free Action Beat.
    *   **T9:** *Unkillable* - Cannot bleed out; automatically stabilize at 0 HP.

#### 6. FORTITUDE (Matter & Heat)
*   **Assault (Disciplined Weapons):**
    *   **T1:** *Demolition* - Deal double damage against inanimate structural objects and tactical cover.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Follow-Through* - Excess damage dealt from breaking cover carries over to the enemy behind it.
    *   **T4:** *Armor Cracker* - Physical strikes ignore Hardened and Resistant weapon/armor tags.
    *   **T5:** *Punishing Blow* - Blocked strikes deal severe damage to the enemy's shield or weapon structural integrity.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *Structural Collapse* - Attacks automatically apply the **[Sundered]** tag, permanently breaking gear.
    *   **T8:** *The Wrecking Ball* - Destroying cover or an enemy's armor grants you a free Strike action.
    *   **T9:** *The Siege Engine* - Treat all physical structures and cover as possessing the **[Brittle]** tag.
*   **Aegis (Reinforced Armor):**
    *   **T1:** *Insulated* - Ignore the first 2 points of environmental or elemental damage taken each round.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Stamina physical gear tax.
    *   **T3:** *Hazard-Walker* - Moving through Fire, Acid, and Hazards costs 0 extra Move beats.
    *   **T4:** *Thermal Plating* - Gain absolute immunity to Burn and Frozen tags.
    *   **T5:** *Slag* - Metallic weapons hitting your armor take automatic heat or acid degradation.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Stamina physical gear tax.
    *   **T7:** *The Furnace* - Enemies starting their turn in your melee zone instantly gain the **[Overheated]** tag.
    *   **T8:** *Thermal Battery* - Absorbing elemental damage nullifies the effect and grants a free Action Beat.
    *   **T9:** *The Forge* - Gain absolute immunity to all non-magical elemental damage.

#### 7. KNOWLEDGE (Arcane & Data)
*   **Assault (Clever Weapons):**
    *   **T1:** *Exploit Flaw* - Gain Advantage on attacks against targets carrying any active Status Tags.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Collateral* - Bounces spell effect to a secondary adjacent target for half damage.
    *   **T4:** *Bypass Ward* - Attacks ignore Scholar and Ceremonial armor modifications.
    *   **T5:** *Counter-Measure* - Free spell strike against an enemy attempting to cast a spell.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Nullify* - Spells automatically apply the **[Silenced]** tag.
    *   **T8:** *The Epiphany* - Breaking armor or securing a kill restores 1 F-Die and a free Action Beat.
    *   **T9:** *Omniscience* - Attacks automatically hit mundane, non-boss enemies without rolling dice.
*   **Aegis (Scholar Armor):**
    *   **T1:** *Warded* - Reduce all incoming Anomaly or magical damage by a flat 1.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Read the Room* - Automatically identify all traps and magical hazards in a Zone for 0 action cost.
    *   **T4:** *Grounded* - Gain absolute immunity to magical Pushed, Pulled, and Teleported effects.
    *   **T5:** *Feedback Loop* - Enemy spell misses or Clash losses deal 1 Composure damage back to the caster.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Mental Fortress* - Melee attackers targeting your mental ward instantly gain the **[Confused]** tag.
    *   **T8:** *Data Absorption* - Defending against an Anomaly attack restores 1 F-Die and a free Action Beat.
    *   **T9:** *The Blank Page* - Gain absolute immunity to all Anomaly-generated Status Tags.

#### 8. LOGIC (Math & Geometry)
*   **Assault (Calculated Weapons):**
    *   **T1:** *The Angle* - Ranged strikes ignore Half and Three-Quarters Cover.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Geometric Arc* - Target unseen enemies behind corners via ricochet calculations.
    *   **T4:** *Surgical* - Attacks ignore defensive bonuses of Static or Braced enemies.
    *   **T5:** *Overwatch* - Free ranged strike when an enemy enters your optimal range vector.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Pinning Strike* - Attacks automatically apply the **[Immobilized]** tag.
    *   **T8:** *The Domino Effect* - Triggering an environmental trap or dropping a target grants a free Strike.
    *   **T9:** *Inevitable Trajectory* - Bypasses all distance and atmospheric penalties to ranged combat.
*   **Aegis (Protective Armor):**
    *   **T1:** *Deflecting Angle* - Gain +1 Defense vs. Ranged attacks if you moved 1+ space this turn.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Clockwork Step* - Execute a Move Beat and a Defend action within the same beat.
    *   **T4:** *Vital Guard* - Gain absolute immunity to Bleeding and enemy Critical Hit multipliers.
    *   **T5:** *Calculated Retreat* - Clash ties on a Disengage action automatically succeed.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Overextend* - Enemies rolling 5 or less to hit you fall **[Prone]**.
    *   **T8:** *Perfect Algorithm* - Dodging an attack by 5+ points grants a free Action Beat.
    *   **T9:** *Untouchable Equation* - Take 0 damage from AoE attacks if a safe grid square exists in the Zone.

#### 9. AWARENESS (Perception & Light)
*   **Assault (Accurate Weapons):**
    *   **T1:** *Eagle Eye* - Gain +1 Zone to your maximum effective ranged distance.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Suppressive Fire* - Split strike: deals 0 damage, but forces two enemies to lose their Move Beats.
    *   **T4:** *Piercing Vision* - Attacks ignore Concealing armor, illusions, and the **[Hidden]** tag.
    *   **T5:** *Skeet Shooter* - Reaction to shoot physical, non-magical projectiles out of the air.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Pinpoint* - Ranged attacks automatically apply the **[Exposed]** tag.
    *   **T8:** *The One Shot* - Eliminating a target from 1+ Zone away restores 1 F-Die and 1 S-Die.
    *   **T9:** *Horizon Strike* - If you possess an uninterrupted line of sight, you can strike from miles away.
*   **Aegis (Concealing Armor):**
    *   **T1:** *Meld* - Gain +1 Defense if ending your turn adjacent to structural cover or an object.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Shadow-Walk* - You can Sprint without generating noise or losing Stealth.
    *   **T4:** *Unseen* - Gain absolute immunity to Illuminated, Marked, and Scrying tags.
    *   **T5:** *Vanish* - Free Move Beat to gain **[Hidden]** status if an enemy attacks and misses you.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Paranoia* - Enemies missing an attack against you gain **[Doubtful]** and take Composure damage.
    *   **T8:** *The Ghost* - Successfully gaining the **[Hidden]** tag grants you a free Action Beat.
    *   **T9:** *True Invisibility* - Cannot be targeted by mundane enemies unless you dealt damage this round.

#### 10. INTUITION (Entropy & Probability)
*   **Assault (Lucky Weapons):**
    *   **T1:** *Wild Swing* - Your Critical Hit range expands to include rolls of 19–20.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Happy Accident* - A missed physical strike automatically re-rolls against a secondary target.
    *   **T4:** *Blind Luck* - Ignore all combat penalties from Blinded, Obscured, and Confused tags.
    *   **T5:** *Jinx* - Force an enemy to re-roll a successful hit against an ally.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Cursed Wound* - Strikes automatically apply the **[Jinxed]** tag (-1d4 penalty to target's next roll).
    *   **T8:** *The Jackpot* - Rolling a Natural 20 restores 1 F-Die and grants a free Action Beat.
    *   **T9:** *Russian Roulette* - Gain immunity to Critical Failures; Critical Hit range expands to 18–20.
*   **Aegis (Tribal Armor):**
    *   **T1:** *Sixth Sense* - Gain +2 Defense during the opening round of combat.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Warning Whispers* - Gain absolute immunity to Surprise; act normally during Ambushes.
    *   **T4:** *Charmed Life* - Gain absolute immunity to Cursed, Jinxed, and Doomed tags.
    *   **T5:** *Dumb Luck* - Reaction to trip charging or high-momentum enemies, immediately ending their turn.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Bad Karma* - Enemies that deal damage to you automatically gain the **[Jinxed]** tag.
    *   **T8:** *Cheating Death* - Dropping to 1 HP instantly restores 1 Action Beat and 1 Move Beat.
    *   **T9:** *Probability Shield* - Flip a coin upon being targeted; on a win, the attack automatically fails before rolling.

#### 11. CHARM (Spirit & Emotion)
*   **Assault (Commanding Weapons):**
    *   **T1:** *Flourish* - Gain +1 space melee reach on physical weapon strikes.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *The Sweep* - Target up to 3 adjacent enemies; deals 0 damage but knocks them **[Prone]**.
    *   **T4:** *Distracting Arc* - Attacks ignore all enemy Shield modifiers.
    *   **T5:** *The Disarm* - Reaction to rip a weapon away from an enemy that misses a melee strike against you.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Humiliate* - Attacks automatically apply the **[Enraged]** or **[Distracted]** tag.
    *   **T8:** *The Applause* - Disarming, tripping, or killing a target restores 1 F-Die and a free Move Beat.
    *   **T9:** *Puppet Master* - Successful weapon strikes force the target to move 1 space in a direction of your choice.
*   **Aegis (Ornate Armor):**
    *   **T1:** *Dazzle* - Gain +1 Defense when standing in bright light or open space.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Center of Attention* - Move through occupied enemy spaces without triggering Reactions or AoO.
    *   **T4:** *Untouchable Ego* - Gain absolute immunity to Intimidated, Terrified, and Shamed tags.
    *   **T5:** *The Parry* - Reaction to redirect an incoming physical attack to an adjacent enemy.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Awe* - Enemies missing an attack against you instantly gain the **[Hesitant]** tag.
    *   **T8:** *The Encore* - Defending against a Boss or a Critical Hit restores 1 F-Die and a free Action Beat.
    *   **T9:** *Plot Armor* - Mundane enemies cannot target you if another valid target is present.

#### 12. WILLPOWER (Law & Authority)
*   **Assault (Dominating Weapons):**
    *   **T1:** *The Verdict* - Deal +1 damage against wounded or unarmored enemies.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *Wide Sweep* - Auto-hit a secondary adjacent enemy for full weapon damage.
    *   **T4:** *Overwhelming Presence* - Attacks ignore the Resistance of physically smaller enemies.
    *   **T5:** *Kneel* - Reaction to knock a melee attacker that misses you **[Prone]**.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Broken Will* - Attacks automatically apply **[Terrified]**, dealing direct Composure trauma.
    *   **T8:** *The Execution* - Eliminating a target restores 1 F-Die and a free Strike action.
    *   **T9:** *Absolute Decree* - Struck enemies lose their Reaction and their Move Beats for the round.
*   **Aegis (Ceremonial Armor):**
    *   **T1:** *Unyielding* - Gain +2 Defense vs. all Anomaly and Psychic attacks.
    *   **T2:** *Loadout Efficiency* - Permanent -1 to Max Focus mental gear tax.
    *   **T3:** *March of Law* - Ignore movement penalties when moving directly toward an enemy target.
    *   **T4:** *Iron Mind* - Gain absolute immunity to Charmed, Controlled, and Sleep tags.
    *   **T5:** *Rebuke* - Enemies hitting you in melee take 1 automatic Composure damage.
    *   **T6:** *Master Loadout* - Permanent -2 to Max Focus mental gear tax.
    *   **T7:** *Guilt* - Enemies attempting to attack you instantly gain the **[Doubtful]** tag.
    *   **T8:** *The Martyr* - Surviving an attack of 5+ damage restores 1 F-Die and a free Action Beat.
    *   **T9:** *Divine Right* - While spending 0 Move Beats, your HP cannot be reduced below 1 by mundane means.

---

### PART II: THE ACTIVE MARTIAL TACTICS
Active Martial Tactics require active resource expenditure to trigger. Tiers 1-6 utilize the primary resource, while Tiers 7 and 9 trigger a dual-cost (requiring both physical S-Die and mental F-Die).

#### 1. MIGHT: The Wrangler (Gravity/Mass)
*   **T1 (1 S-Die):** *Grapple/Throw* - Deal physical damage and push/pull target 1 Zone. *Passive:* Immune to disarm.
*   **T2 (1 S-Die):** *Leverage* - Manipulate center-of-mass out of combat to tip heavy structures or stop charging beasts.
*   **T3 (2 S-Die):** *The Toss* - Thrown enemies gain **[Off-Balance]** and take collision damage if hitting objects.
*   **T4 (2 S-Die):** *Momentum Transfer* - Throw allies safely or physically catch falling boulders.
*   **T5 (3 S-Die):** *Heavy Carry* - *Passive:* Ignore all physical penalties for dragging wounded or massive loads.
*   **T6 (Passive):** T1/T2 cost 0. *The Slam:* Thrown targets fall **[Prone]** and suffer -1 Armor Mod.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Heave* - Suplex a giant monster or shatter a watchtower bare-handed.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when throwing an enemy into an active hazard.
*   **T9 (5 S-Die + 2 F-Die):** *Orbital Drop* - Launch target high and drive them into the earth. Permanently **[Maims]** target, knocks Zone prone.

#### 2. ENDURANCE: The Sponge (Stasis/Ordo)
*   **T1 (1 S-Die):** *Brace* - Reduce incoming damage by a flat 1. *Passive:* Immune to **[Staggered]** status.
*   **T2 (1 S-Die):** *Kinetic Anchor* - Plant feet to become an immovable physical wall.
*   **T3 (2 S-Die):** *Repel* - Attackers dealing 0 net damage to you are shoved 1 Zone backward.
*   **T4 (2 S-Die):** *Structural Lock* - Freeze muscle fibers to hold up collapsing ceilings indefinitely.
*   **T5 (3 S-Die):** *Enviro-Shield* - *Passive:* Ignore the first 2 points of environmental hazard damage per round.
*   **T6 (Passive):** T1/T2 cost 0. *Exhaustion:* Attackers targeting your shield gain the **[Fatigued]** tag.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Stasis* - Lock your biology; your HP cannot drop below 1 for the round.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when blocking a lethal hit meant for an ally.
*   **T9 (5 S-Die + 2 F-Die):** *The Monolith* - Absorb a Zone-wide catastrophic attack, taking zero damage and protecting all behind you.

#### 3. REFLEX: The Dervish (Speed/Motus)
*   **T1 (1 S-Die):** *Whirlwind* - Execute a physical Strike and receive a free 1-space shift. *Passive:* Immune to **[Slowed]**.
*   **T2 (1 S-Die):** *Momentum Carry* - Run across water or up vertical walls for a single Move Beat.
*   **T3 (2 S-Die):** *Cleave-Step* - Strike two adjacent targets seamlessly within a single action.
*   **T4 (2 S-Die):** *Frictionless Slide* - Slide under falling gates, heavy traps, or sweeping blades.
*   **T5 (3 S-Die):** *Slip-Step* - *Passive:* Permanent Advantage on Defense checks vs. Attacks of Opportunity.
*   **T6 (Passive):** T1/T2 cost 0. *The Tornado:* Hitting 3 targets applies **[Off-Balance]** to all.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Speed* - Instantly take two complete Action Beats in one turn.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when dropping an enemy and striking a new one.
*   **T9 (5 S-Die + 2 F-Die):** *Thousand Cuts* - Strike every enemy in the active Zone simultaneously.

#### 4. FINESSE: The Ghost (Permeability/Flux)
*   **T1 (1 S-Die):** *Surgical Strike* - Strike an unaware target and shift 1 Zone. *Passive:* Leave no physical tracks.
*   **T2 (1 S-Die):** *The Blind Spot* - Hide in shadows and crevices mathematically too small.
*   **T3 (2 S-Die):** *The Artery* - Stealth strikes apply the **[Bleeding]** tag and ignore 1 Armor Mod.
*   **T4 (2 S-Die):** *Disarticulation* - Dislocate joints to slide through iron bars or pick locks by touch.
*   **T5 (3 S-Die):** *Weightless* - *Passive:* Cannot trigger pressure plates; take 0 fall damage.
*   **T6 (Passive):** T1/T2 cost 0. *Nerve Pinch:* Target is **[Silenced]** and Disarmed.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Slip* - Sprint over glass silently or run across sheer, frictionless walls.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when eliminating an enemy from stealth.
*   **T9 (5 S-Die + 2 F-Die):** *Perfect Murder* - Strike microscopic gaps. Silent death; body caught flawlessly.

#### 5. VITALITY: The Medic (Biomancy/Vita)
*   **T1 (1 S-Die):** *Triage* - Heal 1 HP or clear 1 Tag from an adjacent ally. *Passive:* Immune to **[Diseased]** and **[Poisoned]**.
*   **T2 (1 S-Die):** *Adrenaline Injection* - Wake an unconscious ally instantly at 1 HP.
*   **T3 (2 S-Die):** *Combat Stitches* - Healed target gains a temporary +1 Armor Mod.
*   **T4 (2 S-Die):** *Bone-Set* - Cure a Major physical limb injury, removing the penalty.
*   **T5 (3 S-Die):** *Blood-Sense* - *Passive:* Instinctively know the exact HP and injury statuses of everyone in your Zone.
*   **T6 (Passive):** T1/T2 cost 0. *Bio-Overdrive:* Allies you heal gain a free Move Beat.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Regeneration* - Reattach severed limbs or restart stopped hearts mid-combat.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when pulling an ally back from the Zero-State.
*   **T9 (5 S-Die + 2 F-Die):** *Spark of Life* - Resurrect a creature that died within the last round at full HP.

#### 6. FORTITUDE: The Sunderer (Heat/Nexus)
*   **T1 (1 S-Die):** *Armor Crack* - Deal 0 HP damage; reduce the target's Armor Mod by 1. *Passive:* Immune to weapon breaking.
*   **T2 (1 S-Die):** *Structural Weakness* - Shatter mundane doors, barricades, and locks with a tap.
*   **T3 (2 S-Die):** *Shatter-Cleave* - Crack the armor of up to three adjacent targets.
*   **T4 (2 S-Die):** *Demolition* - Destroy inanimate objects and cover regardless of their HP pool.
*   **T5 (3 S-Die):** *Sunder-Strike* - *Passive:* Deal +2 Damage vs. enemies with 0 Armor Mod or broken weapons.
*   **T6 (Passive):** T1/T2 cost 0. *Ruin:* Armor is completely destroyed; target is **[Exposed]**.
*   **T7 (4 S-Die + 1 F-Die):** *Mythic Resonance* - Snap an enemy's primary weapon or magical focus in half.
*   **T8 (Passive):** *Flow State:* Restore 1 S-Die and 1 F-Die when destroying enemy gear or cover.
*   **T9 (5 S-Die + 2 F-Die):** *Flawless Dismantle* - Strip the target of all armor, weapons, and magical wards in one hit.

#### 7. LOGIC: The Warden (Geometry/Ratio)
*   **T1 (1 F-Die):** *Calculated Trap* - Fast-deploy a tactical hazard. *Passive:* Immune to triggering traps.
*   **T2 (1 F-Die):** *Ricochet* - Bounce a ranged projectile around a corner.
*   **T3 (2 F-Die):** *Grid-Lock* - Trap pins the target; applies **[Immobilized]**.
*   **T4 (2 F-Die):** *Choke-Point* - Kick a pillar or heavy table to flawlessly barricade a door.
*   **T5 (3 F-Die):** *Eagle Vision* - *Passive:* Ranged attacks completely ignore Half and Three-Quarters Cover.
*   **T6 (Passive):** T1/T2 cost 0. *Domino Effect:* Triggering one trap primes a secondary hidden strike.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Geometry* - Collapse a structure by removing the single correct load-bearing brick.
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die when an enemy triggers your trap.
*   **T9 (5 F-Die + 2 S-Die):** *The Death Room* - Turn your Zone into an unavoidable kill-box of ricochets and hazards.

#### 8. AWARENESS: The Sniper/Executioner (Light/Lux)
*   **T1 (1 F-Die):** *Vitals* - Execute a focused strike. *Passive:* Immune to **[Blinded]** and dazzle effects.
*   **T2 (1 F-Die):** *Overwatch* - Hold your action for a guaranteed free shot upon enemy movement.
*   **T3 (2 F-Die):** *Pin-Down* - Suppress target, removing their Move Beat.
*   **T4 (2 F-Die):** *Curve the Bullet* - Ignore Full Cover via perfect trajectory vector prediction.
*   **T5 (3 F-Die):** *Horizon Sight* - *Passive:* Double effective range; zero extreme distance penalties.
*   **T6 (Passive):** T1/T2 cost 0. *The Kill-Shot:* Striking a moving target knocks them **[Prone]** and **[Bleeding]**.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Trajectory* - Shoot perfectly through solid stone walls via sensory prediction.
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die when dropping a target from 1+ Zone away.
*   **T9 (5 F-Die + 2 S-Die):** *Inevitable Bullet* - Unavoidable kill shot; bypasses all armor, magic, and distance barriers.

#### 9. INTUITION: The Harrier (Entropy/Omen)
*   **T1 (1 F-Die):** *Taunt/Feint* - Target gets Disadvantage on attacks vs. you. *Passive:* Immune to **[Surprised]**.
*   **T2 (1 F-Die):** *Dumb Luck* - Magically stumble out of a guaranteed lethal hit.
*   **T3 (2 F-Die):** *Contagious Rage* - Your Taunt jumps to an adjacent enemy.
*   **T4 (2 F-Die):** *Weapon Jam* - Force an enemy's bowstring or sword hilt to jam mid-strike.
*   **T5 (3 F-Die):** *Karma Field* - *Passive:* Enemies rolling less than 10 to hit you trip and fall **[Prone]**.
*   **T6 (Passive):** T1/T2 cost 0. *Blind Rage:* Taunted enemies must attack you but lose their Action Beat.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Coincidence* - Cause a catastrophic environmental accident exactly where an enemy steps.
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die when an enemy rolls a Critical Failure against you.
*   **T9 (5 F-Die + 2 S-Die):** *The Final Glitch* - The target's luck runs out; they suffer a lethal accident or impale themselves.

#### 10. CHARM: The Commander (Spirit/Aura)
*   **T1 (1 F-Die):** *Rally* - Restore 1 Composure or grant +1 Action Die to an ally. *Passive:* Immune to **[Terrified]**.
*   **T2 (1 F-Die):** *The Order* - Grant a target ally an immediate free Move Beat.
*   **T3 (2 F-Die):** *Formation* - Rally up to 3 allies simultaneously.
*   **T4 (2 F-Die):** *Phalanx* - Adjacent allies auto-share your highest Defense bonus.
*   **T5 (3 F-Die):** *Inspire* - *Passive:* Allies in your Zone gain Advantage on Composure and Fear saves.
*   **T6 (Passive):** T1/T2 cost 0. *The Charge:* Rallied allies gain Advantage on their next strike.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Command* - Override an ally's death state; they fight at 0 HP for one round.
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die when a buffed ally secures a kill.
*   **T9 (5 F-Die + 2 S-Die):** *Warlord's Cry* - Every ally in your Zone takes a full free turn immediately.

#### 11. WILLPOWER: The Vanguard (Law/Lex)
*   **T1 (1 F-Die):** *The Glare* - Force an enemy to target you. *Passive:* Immune to **[Compelled]** and charm.
*   **T2 (1 F-Die):** *Hold the Line* - You and adjacent allies cannot be pushed, pulled, or moved.
*   **T3 (2 F-Die):** *The Challenge* - Draw the physical aggro of all enemies in your Zone.
*   **T4 (2 F-Die):** *Intimidating Wall* - Physically block a 10-foot gap via pure authoritarian terror.
*   **T5 (3 F-Die):** *Unshakable* - *Passive:* Absorb the first 2 points of Composure damage taken per round.
*   **T6 (Passive):** T1/T2 cost 0. *The Rebuke:* Enemies striking you take 1 automatic Composure damage.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Authority* - Command a massive horde to **"KNEEL"**; they lose their turns.
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die if surviving a round where you were attacked by 3+ enemies.
*   **T9 (5 F-Die + 2 S-Die):** *Absolute Bastion* - Immovable god of war. For 1 round, no ally in your Zone can be harmed.

#### 12. KNOWLEDGE: The Saboteur (Data/Anumis)
*   **T1 (1 F-Die):** *Calculated Strike* - Deal damage and cancel the target's Advantage. *Passive:* Know exact HP and Tags.
*   **T2 (1 F-Die):** *The Flaw* - Weaponize structural data (e.g., strike a rusted hinge or unbuckled strap).
*   **T3 (2 F-Die):** *System Shock* - Strikes automatically apply the **[Confused]** tag.
*   **T4 (2 F-Die):** *The Override* - Hijack physical traps, jam crossbows, or pick mechanical locks by ear.
*   **T5 (3 F-Die):** *Predictive Algorithms* - *Passive:* Auto-succeed on Reflex/Balance checks vs. Zone hazards.
*   **T6 (Passive):** T1/T2 cost 0. *Action Deletion:* Target loses their Reactive beats and AoO for the round.
*   **T7 (4 F-Die + 1 S-Die):** *Mythic Algorithm* - Process reality faster than it happens (e.g., walk through a volley of arrows).
*   **T8 (Passive):** *Flow State:* Restore 1 F-Die and 1 S-Die when bypassing a vault/trap or stripping armor.
*   **T9 (5 F-Die + 2 S-Die):** *Checkmate* - Declare target's action; trap auto-triggers, shattering their weapon and applying **[Exposed]**.

---

### PART III: THE ANOMALIES (CELESTIAL CLOCKWORK MAGIC)
The 12 magical schools of Ostraka. Activating or sustaining an Anomaly requires a **Dual-Cost** of both S-Die (Stamina) and F-Die (Focus) tokens.

#### 1. MASS (Gravity) - Might
*   **T1 (1 Sec):** *Base Gravity* - Apply heavy mass. *Passive:* Rooted (Immune to Push/Pull). *Kicker:* Crush (Applies **[Slowed]**).
*   **T2 (1 Rnd):** *Gravitational Weight* - Alter density and mass of objects.
*   **T3 (1 Min):** *Pin* - Knock target **[Prone]**; they cannot stand.
*   **T4 (10 Min):** *Directional Vectors* - Walk up walls; create localized orbital paths.
*   **T5 (1 Hr):** *Dense Form* - Gain 50% Resistance to Force damage; infinite physical carrying weight.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Implode:* Armor crushes inward, applying the **[Broken Armor]** tag.
*   **T7 (24 Hr):** *The Singularity* - Compress environmental matter into a hyper-dense, crushing point.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when crushing an enemy or catching a falling ally.
*   **T9 (1 Wk):** *Event Horizon* - Squeeze the target out of physical existence.

#### 2. ORDO (Stasis) - Endurance
*   **T1 (1 Sec):** *Base Cold* - Apply stasis. *Passive:* Cold-Blooded (Immune to Cold/**[Frozen]**). *Kicker:* Frostbite (Applies **[Stiff]**).
*   **T2 (1 Rnd):** *Kinetic Drain* - Flash-freeze liquids; stop physical pendulums.
*   **T3 (1 Min):** *Lock* - Physically freeze target in ice, applying **[Immobilized]**.
*   **T4 (10 Min):** *Structural Enforcement* - Lock molecular bonds; harden glass or doors to high-durability states.
*   **T5 (1 Hr):** *Unbreaking* - Gain 50% Resistance to Cold; receive absolute immunity to aging and decay.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Shatter:* Apply the **[Brittle]** tag to the target.
*   **T7 (24 Hr):** *Absolute Zero* - Completely halt all biological and temporal processes in the Zone.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when stasis stops a lethal blow.
*   **T9 (1 Wk):** *Frozen Eternity* - Turn target into a permanent, unmoving statue.

#### 3. FLUX (Acid/Solvent) - Finesse
*   **T1 (1 Sec):** *Base Corrosion* - Secrete acid. *Passive:* Teflon Skin (Immune to Acid/**[Grappled]**). *Kicker:* Degrade (-1 Armor Mod).
*   **T2 (1 Rnd):** *Corrosion* - Melt physical locks and unbind structural matter.
*   **T3 (1 Min):** *Liquefy* - Target's gear or weapon gains the **[Broken]** tag.
*   **T4 (10 Min):** *Permeability* - Solid matter acts like liquid; pass your hand through solid glass.
*   **T5 (1 Hr):** *Fluid Form* - Gain 50% Resistance to Acid; take 0 fall damage.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Melt:* Flesh and steel lose cohesion; apply **[Weakened]**.
*   **T7 (24 Hr):** *State Severance* - Instantly separate compounds, alloys, and poisons.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when your solvent completely destroys enemy armor.
*   **T9 (1 Wk):** *Universal Solvent* - Target melts completely into organic sludge.

#### 4. MOTUS (Speed/Kinetics) - Reflex
*   **T1 (1 Sec):** *Base Velocity* - Accelerate. *Passive:* Perpetual Motion (Immune to **[Restrained]** and **[Slowed]**). *Kicker:* Repel.
*   **T2 (1 Rnd):** *Velocity* - Dictate the speed of a projectile or a person.
*   **T3 (1 Min):** *Reposition* - Receive a free Move Beat or instantly swap places with a target.
*   **T4 (10 Min):** *Friction* - Remove friction for sliding; maximize friction to seize mechanical joints.
*   **T5 (1 Hr):** *Kinetic Battery* - Gain 50% Resistance to Kinetic damage; absorb falling and crash impact.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Momentum Steal:* Steal the target's Move Beat.
*   **T7 (24 Hr):** *Vibration/Frequency* - Phase through solid walls; shatter weapons on contact.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when dodging a lethal hit via speed.
*   **T9 (1 Wk):** *Molecular Dispersal* - Vibrate the target's molecules until they disperse into a red mist.

#### 5. VITA (Biomancy) - Vitality
*   **T1 (1 Sec):** *Base Life* - Mend tissue. *Passive:* Panacea (Immune to diseases and **[Poisoned]**). *Kicker:* Bio-Shock (Applies **[Fatigued]**).
*   **T2 (1 Rnd):** *Cellular Acceleration* - Knit deep flesh wounds; accelerate plant growth.
*   **T3 (1 Min):** *Mutate* - Force rapid growth to apply the **[Maimed]** tag via bone spurs or tumors.
*   **T4 (10 Min):** *Biological Rewiring* - Graft physical limbs; permanently alter vocal cords.
*   **T5 (1 Hr):** *Hyper-Regen* - Gain 50% Resistance to Poison; automatically heal 1 HP per turn.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Rot:* Target takes -1 Max HP per round as rot spreads.
*   **T7 (24 Hr):** *Hive-Link* - Connect nervous systems, distributing and sharing health pools.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when healing an ally from the Zero-State.
*   **T9 (1 Wk):** *Evolutionary Override* - Devolve target into an unthinking, fleshy mass.

#### 6. NEXUS (Matter & Heat) - Fortitude
*   **T1 (1 Sec):** *Base Thermal* - Project heat. *Passive:* Thermal Plating (Immune to Heat/**[Burn]**). *Kicker:* Burn.
*   **T2 (1 Rnd):** *Thermal Excitation* - Shoot fire; boil water instantly.
*   **T3 (1 Min):** *Ignite* - Target or their gear catches continuous fire.
*   **T4 (10 Min):** *Atomic Bonds* - Melt solid stone walls; fuse iron locks together.
*   **T5 (1 Hr):** *Overheat* - Gain 50% Resistance to Fire; grapplers take automatic thermal damage.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Melt:* Apply the **[Broken Armor]** tag as metal plates turn to liquid slag.
*   **T7 (24 Hr):** *Radiation* - Irradiate a Zone, causing continuous nuclear decay.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when incinerating environmental cover or an enemy.
*   **T9 (1 Wk):** *Incinerate* - Bypasses melting; target flashes instantaneously to vapor.

#### 7. RATIO (Logic/Algorithm) - Logic
*   **T1 (1 Sec):** *Base Shock* - Direct shock. *Passive:* Calculated Mind (Immune to **[Surprised]**). *Kicker:* The Arc (Bounces to 1 target).
*   **T2 (1 Rnd):** *Electrical Impulse* - Command raw voltage; jumpstart disabled mechanisms.
*   **T3 (1 Min):** *The Network* - Targets linked; moving breaks the circuit and deals massive shock damage.
*   **T4 (10 Min):** *Geometric Vectors* - Calculate perfect ranged ricochets or crystal prisms.
*   **T5 (1 Hr):** *Faraday Cage* - Gain 50% Resistance to Lightning; recoil shock vs. metal weapons.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Feedback Loop:* Arc strikes target twice, applying **[Stunned]**.
*   **T7 (24 Hr):** *Conditional Triggers* - Program logical magic booby-traps with custom parameters.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when a programmed trigger or trap activates.
*   **T9 (1 Wk):** *The Grid* - Link all entities in the Zone into a single circuit to distribute and equalize damage.

#### 8. ANUMIS (Source Code) - Knowledge
*   **T1 (1 Sec):** *Base Code* - Edit parameters. *Passive:* The Index (Photographic memory). *Kicker:* The Edit (Add/remove 1 Minor Tag).
*   **T2 (1 Rnd):** *Raw Data* - Construct hard-light platforms or physical runes.
*   **T3 (1 Min):** *The Format* - Strip all Buffs from an enemy or all Debuffs from an ally.
*   **T4 (10 Min):** *Universal Lexicon* - Read dead languages; interface directly with ancient systems.
*   **T5 (1 Hr):** *Firewall* - Gain 50% Resistance to Arcane; your mind cannot be read.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *The Overwrite:* Change base material tags (e.g., change Steel to Glass).
*   **T7 (24 Hr):** *The Archive* - Access Save States; fold physical space; view the past of an object.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when your rewrite breaks armor or a trap.
*   **T9 (1 Wk):** *The Deletion* - Erase the target's underlying source code; removed from physical existence.

#### 9. LUX (Light/Perception) - Awareness
*   **T1 (1 Sec):** *Base Photon* - Emit light. *Passive:* Unblinking (Immune to **[Blinded]**). *Kicker:* Illuminate (Removes **[Hidden]**).
*   **T2 (1 Rnd):** *Photonic Projection* - Fire high-intensity lasers, flashes, and light lanterns.
*   **T3 (1 Min):** *The Spotlight* - Target physically cannot gain cover or enter the Hidden state.
*   **T4 (10 Min):** *Refraction* - Bend light around yourself to gain Invisibility or project mirages.
*   **T5 (1 Hr):** *Mirror-Shield* - Gain 50% Resistance to Radiant damage; see through all illusions.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Hard-Light:* Light projections gain kinetic weight and burn.
*   **T7 (24 Hr):** *The Observer* - Scry across continents and through lead lining.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when exposing a hidden environmental threat.
*   **T9 (1 Wk):** *Absolute Truth* - Permanently strip all deception, invisibility, and shapeshifting in the Zone.

#### 10. OMEN (Entropy/Time) - Intuition
*   **T1 (1 Sec):** *Base Chaos* - Apply entropy. *Passive:* Sixth Sense (Immune to **[Surprised]**). *Kicker:* The Jinx (Next roll gets Disadvantage).
*   **T2 (1 Rnd):** *Probability Shift* - Force mechanical locks to open, or a coin to land on its edge.
*   **T3 (1 Min):** *The Hex* - A failed Jinx check automatically jumps to an adjacent enemy.
*   **T4 (10 Min):** *Entropic Decay* - Rust solid iron doors; age organic materials to dust.
*   **T5 (1 Hr):** *Chrono-Anchor* - Gain 50% Resistance to Decay; receive absolute immunity to magical aging.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Time-Steal:* Steal the target's Action Beat.
*   **T7 (24 Hr):** *The Echo* - Speak to timeline ghosts; glimpse the immediate future.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when your Jinx causes an enemy to Critical Failure.
*   **T9 (1 Wk):** *Doom* - Sever the target's timeline, leading to absolute mechanical failure and decay.

#### 11. AURA (Charm/Spirit) - Charm
*   **T1 (1 Sec):** *Base Spirit* - Project aura. *Passive:* Iron Ego (Immune to **[Terrified]**/**[Charmed]**). *Kicker:* Dissonance (Composure damage).
*   **T2 (1 Rnd):** *Emotional Resonance* - Project raw feelings to force panic or absolute calm.
*   **T3 (1 Min):** *The Chorus* - Emotion broadcasts outward, damaging or healing adjacent targets.
*   **T4 (10 Min):** *Spiritual Tether* - Establish telepathic links; connect life-forces.
*   **T5 (1 Hr):** *Soul-Ward* - Gain 50% Resistance to Psychic damage; your mind cannot be read.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *Psychic Sever:* Target is paralyzed; suffers massive Composure trauma.
*   **T7 (24 Hr):** *The Zeitgeist* - Dictate cultural truths; perform mass memory erasure.
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when a target suffers a Psychic Break.
*   **T9 (1 Wk):** *Assimilation* - Destroy the target's ego; target becomes a mindless, obedient thrall.

#### 12. LEX (Willpower/Law) - Willpower
*   **T1 (1 Sec):** *Base Decree* - Force order. *Passive:* Unyielding (Immune to **[Compelled]**). *Kicker:* Suppress (Target loses Reactive beats).
*   **T2 (1 Rnd):** *The Command* - Speak a Power Word (Kneel, Stop, Drop).
*   **T3 (1 Min):** *The Edict* - Target is knocked **[Prone]**; must spend Stamina to stand.
*   **T4 (10 Min):** *The Contract* - Bind spirits or enemies to binding magical oaths and contracts.
*   **T5 (1 Hr):** *Sovereign* - Gain 50% Resistance to Command; receive absolute immunity to hexes and curses.
*   **T6 (8 Hr):** T1–T4 cost 0 to sustain. *The Verdict:* Target is **[Terrified]** and physically cannot attack you.
*   **T7 (24 Hr):** *The Axiom* - Write a new localized physics law (e.g., "Steel is soft", "Gravity pulls upward").
*   **T8 (3 Days):** *Flow State:* Restore 1 F-Die and 1 S-Die when a target violates your law and takes damage.
*   **T9 (1 Wk):** *Execution* - The target's heart stops if they fail a massive, contested Willpower check.

---

## SECTION 7: PROCEDURAL ENGINE & DUNGEON GENERATION

The **Contract Broker** procedurally builds encounters using the players' stats as the random seed, eliminating manual GM prep.

### 7.1 THE JOB BOARD (PROCEDURAL SEEDING)
1. **The Allocation:** The party rolls 12 stats exactly once (1d20 + Attribute). The 12 stats must be distributed as equally as possible among the players.
2. **The Contract Synergy Rule:** If a player must roll for a stat where their biological baseline is a 2 or lower, an ally can permanently burn **1 Stamina or 1 Focus** from their Reserve Pool to grant **Advantage** on the chart roll.
3. **The Contract Agency Matrix:**
    *   **1–10 (The Blind Draw):** The GM determines the parameter randomly or selects the most hostile option.
    *   **11–17 (The Standard Baseline):** The parameter defaults to the B.R.U.T.A.L. Engine's standard baseline.
    *   **18+ (The Specialist Clause):** For Body stats, the *player* chooses the parameter. For Mind stats, the GM reveals specific tactical *Intel*.

---

### 7.2 ARCHITECTURE & RECONNAISSANCE MATRIX

#### THE 6 BODY STATS (PHYSICAL BLUEPRINTS)
*   **1. MIGHT (The Enemy Faction):**
    *   *18+:* Player selects the specific Enemy Deck faction (e.g., Worm Cultists or Scute Confederacy).
    *   *11–17:* GM selects the faction.
    *   *1–10:* GM selects the faction and upgrades one Grunt Pack to an Elite.
*   **2. ENDURANCE (The Deck Length):**
    *   *18+:* The mission is direct. The Crawl Deck is exactly 10 cards.
    *   *11–17:* Standard baseline. The Crawl Deck is exactly 12 cards.
    *   *1–10:* The path is a slog. The Crawl Deck is exactly 14 cards.
*   **3. FINESSE (The Twist Deck):**
    *   *18+:* Player bans one specific Master Tag (e.g., Volatile or Conductive) from appearing in the Twist Deck.
    *   *11–17:* Standard randomized Twist Deck.
    *   *1–10:* GM guarantees a lethal Twist tag is layered onto the Climax encounter.
*   **4. REFLEX (The Topology / Layout):**
    *   *18+:* Player chooses the physical layout (e.g., Branching layout, allowing bypasses).
    *   *11–17:* Standard linear layout.
    *   *1–10:* GM selects the Tower Layout (straight Vertical descent; zero bypasses).
*   **5. VITALITY (The Environmental Biome):**
    *   *18+:* Player designates the primary environment as Normal terrain.
    *   *11–17:* Standard mix of terrain tags.
    *   *1–10:* The canyon is flooded with a severe hazard tag (e.g., Slowing mud or Corrosive smog).
*   **6. FORTITUDE (The Climax Goal):**
    *   *18+:* The Threat Tier 3 Titan has one of its targetable anatomical components start with the Brittle tag.
    *   *11–17:* Standard Threat Tier 3 Titan.
    *   *1–10:* The Titan begins the fight in a fortified position, possessing Advantage on its first round.

#### THE 6 MIND STATS (RECONNAISSANCE & INTEL)
*   **7. KNOWLEDGE (The Enemy Intel):**
    *   *18+:* GM reveals the exact Enemy Threat Matrix (e.g., "There are exactly 4 Elites and 6 Grunt Packs in this deck").
    *   *1–17:* Blind run.
*   **8. LOGIC (The Entrance Mapping):**
    *   *18+:* Player may secretly inspect the top 2 Room cards and return them in any order.
    *   *1–17:* Blind run.
*   **9. AWARENESS (The Tactical Radar):**
    *   *18+:* Player receives 1 "Radar Token." They may spend this to flip a face-down Room card face-up before entering.
    *   *1–17:* Blind run.
*   **10. INTUITION (The Hazard Forecast):**
    *   *18+:* GM reveals the most prominent Twist or Terrain tag in the deck, allowing the party to buy specific counter-gear during loadout.
    *   *1–17:* Blind run.
*   **11. CHARM (The Safe Zone Coordinates):**
    *   *18+:* Party learns the exact card depth of the Aetheric Anchor. Sealing an Anchor resets the Chaos Tracker to 0.
    *   *1–17:* Blind run.
*   **12. WILLPOWER (The Chaos Prediction):**
    *   *18+:* GM reveals exactly which Zone Envelopment will trigger if the Chaos Tracker hits 10 Ticks (e.g., Gravity Flip).
    *   *1–17:* Blind run. Completely random upon reaching 10 Ticks.

---

### 7.3 GOLDEN RATIO SEED POOL (THE ENCOUNTERS)
To guarantee the Trauma Pipeline functions perfectly over a standard 4-hour session, the GM builds a separate pile of 12 "Seeds" matching the length of the Room Deck, using the **Golden Ratio**:
*   **5 Hostile Seeds:** Triggers draws from the Enemy and Tactic decks.
*   **4 Twist Seeds:** Triggers environmental hazards from the Twist Deck (no enemies).
*   **2 Utility Seeds:** Triggers loot caches or Safe Zones (Aetheric Anchors).
*   **1 Climax Seed:** Triggers the Tier 3 Titan. Kept at the bottom of the stack.

#### THE EXPLORATION TAX
*   **Combat:** Drawing a Hostile Seed triggers combat. All combatants receive their 10/10 Active Battery to fuel the 3-Beat Pulse.
*   **The Exploration Tax:** Out-of-combat hazards do not trigger the adrenaline-fueled Active Battery. Traversing Unstable or Vertical terrain out of combat forces players to permanently burn S-Die from their **Reserve Pool**.
*   **The Efficiency Hack:** To survive, players must use mundane gear (ropes, planks) and Fictional Positioning to bypass the hazard without spending their Reserve points.

---

## SECTION 8: MASTER TAG DICTIONARY

Every atmospheric description in B.R.U.T.A.L. acts as "Source Code." The rules engine must parse these tags with absolute, rigid mechanical reality.

### 8.1 TERRAIN TAGS (MOVE BEAT MODIFIERS)
*   **Normal:** Standard cost (1 Move Beat). Requires matching anatomy (e.g., Biped for land, Ambulatory for water).
*   **Unstable / Slick:** Costs **1 extra S-Die** to cross safely. Moving at full speed requires a Balance check; failure results in falling **Prone**.
*   **Slowing / Difficult:** Costs 2 Move Beats (or 1 Move + 1 S-Die) to cross one grid space.
*   **Vertical:** Requires Climbing anatomy or a Might/Finesse check (costing 1 S-Die).
*   **Concealing / Obscuring:** Blocks Visual requirements; grants Advantage on Stealth.
*   **Loud / Echoing:** Amplifies Vocal and Sonic tags; renders Stealth impossible.
*   **Muted:** Disables all Vocal requirements (spells or commands).
*   **Ominous:** Drains Composure from occupants over time.
*   **Hazard:** Deals automatic damage upon entry.
*   **Sharp:** Applies **[Bleed]** (continuous HP drain).
*   **Hot:** Applies **[Burn]** (continuous HP drain; disabled by Ordo/Cold).
*   **Corrosive:** Destroys Armor Mods and Metal gear.
*   **Shocking:** Drains 1 **F-Die** and forces a Fortitude save.
*   **Chaos:** Adds +1 Tick to the Chaos Tracker.
*   **Sapped:** Absolute zero; drains active tokens.
*   **Stiff:** Cold-induced restriction; limits movement.

### 8.2 PROP & MATERIAL TAGS (ACTION BEAT MODIFIERS)
*   **Brittle:** Shatters into **Sharp** debris hazards if hit by a weapon with the **Brutal** or **Momentum** tag.
*   **Conductive:** Spreads electrical or Shocking damage to all touching.
*   **Volatile:** Triggers an immediate Area of Effect explosion if hit by Fire, Heat, or a Brutal strike.
*   **Incorporeal:** Physical attacks pass through; must use Anomaly magic.

### 8.3 KINETIC & ANATOMY TAGS (FORCE VECTORS)
*   **Momentum:** Gains power from movement; counters **Static**.
*   **Static:** Anchored/Braced; resists forced movement and displacement.
*   **Precise:** Ranged attacks ignore partial cover and Armor Mods.
*   **Brutal:** Massive force; risks hitting and destroying the environment on a miss.
*   **Cleaving / Piercing:** Deals AoE arcs or linear punch-through.
*   **Reactive:** Interrupts or counters enemy actions out of turn.
*   **Suppressive:** Removes the target's Move Beat.
*   **Faltering:** Off-balance; leaves target open to reactions.

### 8.4 DISRUPTION & STATUS TAGS (ACTION ECONOMY IMPACT)
*   **Flanked:** Grants Advantage on physical attacks to the flankers.
*   **Grappled / Held:** Target is **Entangled**; movement speed is reduced to 0.
*   **Staggered:** Target loses their Move Beat on their next turn.
*   **Stunned:** Target loses their Stamina Beat on their next turn.
*   **Surprised:** Target loses all Beats on their next turn.
*   **Confused:** Target must spend their Focus Beat to "reboot" their mind.
*   **Distracted:** Target is visually/mentally flickered; cannot execute Reactive actions.
*   **Terrified:** Deals direct Composure damage; target must move away.
*   **Compelled:** Forced to execute a specific action (e.g., Flee).
*   **Enraged:** Target is hard-locked to their Target Token; cannot Pivot, ignores hazards.
*   **Doubtful:** Target suffers Disadvantage on their next check.
