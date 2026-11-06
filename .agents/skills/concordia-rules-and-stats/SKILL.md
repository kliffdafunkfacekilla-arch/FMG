---
name: concordia-rules-and-stats
description: >-
  Governs the Concordia TTRPG mechanical rules, 12-attribute system, 4 derived pools, opposed 1d20 resolution,
  skill progression trees, equipment catalogs, and the Universal Tag Matrix (physical triad, citizen persona/status, and event collision cascades).
  Use when calculating combat rolls, skill checks, derived character stats, physical damage cascades, or equipment modifiers.
---

# Concordia Rules & Stats Mechanics Skill

This skill governs Pillar 3 of the architecture: the deterministic, mechanical rules engine of Concordia and the Aetheria simulation.

## 1. Architectural Scope & Responsibilities
- **Zero Hallucination Mandate**:
  All combat, skill checks, physical damage, and health pool calculations are strictly deterministic mathematical computations executed by TypeScript functions. The AI Story Generator never invents dice rolls or overrides damage mechanics.
- **The Concordia 12-Attribute Matrix**:
  - **Physical**: Might (brute force), Endurance (stamina/breath), Finesse (precision/dexterity), Reflex (reaction speed/agility).
  - **Metabolic/Endurance**: Vitality (metabolism/recovery), Fortitude (body toughness/poison resistance).
  - **Mental**: Knowledge (memory/lore), Logic (reasoning/tactics), Awareness (perception/alertness), Intuition (instinct/reading intents).
  - **Social/Spiritual**: Charm (presence/persuasion), Willpower (discipline/resolve against corruption).
- **The 4 Derived Pools**:
  - **Health (HP)**: Physical life force ($f(\text{Vitality}, \text{Fortitude})$).
  - **Stamina**: Physical exertion pool ($f(\text{Endurance}, \text{Might})$).
  - **Composure**: Mental and emotional defense against terror, intimidation, and chaos madness ($f(\text{Willpower}, \text{Charm}, \text{Intuition})$).
  - **Focus**: Cognitive pool for channeling reality powers, tactical maneuvers, and precision aim ($f(\text{Logic}, \text{Knowledge}, \text{Awareness})$).
- **Opposed 1d20 Resolution**:
  $$\text{Action Roll} = 1d20 + \text{Attribute Modifier} + \text{Skill Rank} + \text{Equipment Modifier}$$
  Opposed by:
  $$\text{Defense Roll} = 1d20 + \text{Defense Modifier} + \text{Counter-Skill Rank} \quad \text{or Static DC}$$

---

## 2. THE UNIVERSAL TAG MATRIX (The Connective Tissue of Ostraka)
Tags are how everything in Ostraka interacts with everything else to create an emergent, living world. Every entity, citizen, prop, and event must carry semantic tags according to strict taxonomy rules:

### A. The Physical Entity Tag Triad
Every physical prop, item, obstacle, and structural entity in the tactical battle map must possess tags covering three mandatory dimensions:
1. **Type (Functional Archetype)**:
   `type:container`, `type:portal`, `type:furniture`, `type:workstation`, `type:mechanism`, `type:structure`, `type:hazard`, `type:waterway`, `type:weapon`, `type:armor`, `type:foliage`, `type:resource`.
2. **Material (Physical Substance)**:
   `material:stone`, `material:iron`, `material:steel`, `material:osmium`, `material:wood_oak`, `material:wood_pine`, `material:obsidian`, `material:dragonstone`, `material:leather`, `material:cloth`, `material:glass`, `material:flesh`, `material:bone`, `material:water`, `material:oil`, `material:ice`.
3. **Affordances, Capabilities & States (What it can do, or what can be done to it)**:
   - **Affordances** (Actions it accepts): `climbable`, `openable`, `lockable`, `locked`, `ignitable/flammable`, `fragile/breakable`, `conductive`, `buoyant`, `portable`, `throwable`, `edible`, `drinkable`, `siphonable`, `readable`, `dismantleable`, `restable`.
   - **Capabilities** (Forces it exerts): `cutting/sharp`, `blunt/crushing`, `piercing`, `corrosive`, `illuminating`, `incendiary`, `toxic/poisonous`, `restraining`, `shielding/cover`.
   - **Current Physical State**: `burning`, `wet`, `frozen`, `corroded`, `electrified`, `void_tainted`, `hallowed`, `decaying`, `collapsed`.

### B. Citizen Persona, Traits & Current Status Tags
Citizens are never generic placeholders; their tags govern their psychological and physiological presence:
1. **Personality Traits**: `pious`, `greedy`, `cowardly`, `brave`, `cynical`, `loyal`, `rebellious`, `suspicious`, `superstitious`, `fanatical`, `generous`.
2. **Temperament & Instinct**: `temper:choleric`, `temper:phlegmatic`, `temper:melancholic`, `temper:sanguine`, `instinct:fight`, `instinct:flight`, `instinct:herd`, `instinct:hoard`, `instinct:scheme`.
3. **Motivation & Allegiance**: `motivation:wealth`, `motivation:faith`, `motivation:duty`, `motivation:family`, `motivation:vengeance`, `motivation:survival`, `allegiance:loyalist`, `allegiance:cartel`, `allegiance:rebel`.
4. **Current Status & Emotional Condition**: `starving`, `exhausted`, `injured`, `panicked`, `drunk`, `frenzied`, `corrupted_by_void`, `mourning`, `celebrating`, `sheltered`, `alert`, `imprisoned`, `fugitive`.

### C. Simulated Event Tags & Data Collision Reactions
Macro and regional events inject active event tags into sectors (e.g. `#MartialLawCurfew`, `#FamineCrisis`, `#FullBloodStorm`, `#CultistWhisper`, `#DebtJubilee`, `#PublicExecution`, `#TavernBrawl`, `#PlagueOutbreak`, `#DragonSurge`, `#FestivalRevelry`).
- In `narrativeReactionEngine.ts`, **Event Tags collide with Citizen Tags** to produce systemic, emergent reactions without LLM hallucinations:
  - `#MartialLawCurfew` + `rebellious` $\rightarrow$ defies curfew, frequents black market, gains `#Fugitive` if spotted.
  - `#MartialLawCurfew` + `cowardly` $\rightarrow$ shutters home, gains `sheltered` and `panicked`.
  - `#CultistWhisper` + `pious` $\rightarrow$ reports heresy to temple or joins an Inquisition vigil.
  - `#CultistWhisper` + `desperate` / `corrupted_by_void` $\rightarrow$ sneaks out to midnight void gathering.
  - `#FamineCrisis` + `greedy` merchant $\rightarrow$ hoards grain, raises prices, siphons food to cartel.
  - `#FamineCrisis` + `starving` laborer $\rightarrow$ joins riots, loots storehouse, or flees to the woods as bandit.

---

## 3. Key Codebase Anchors
- Rules Engine: `simulation-engine/src/engine/rpg/RulesEngine.ts`
- Tag Reaction Cascade Engine: `simulation-engine/src/engine/rpg/TagMatrixEngine.ts`
- Universal Tag Registry: `simulation-engine/src/engine/rpg/TagRegistry.ts`, `tagRegistry.ts`
- Narrative Collision Engine: `simulation-engine/src/engine/rpg/narrativeReactionEngine.ts`, `narrativeTagEngine.ts`
- Character Data & Attribute Math: `simulation-engine/src/engine/rpg/CharacterData.ts`
- Skill Progression Tracks: `simulation-engine/src/engine/rpg/MasterSkillProgression.ts`, `SocialSkillProgression.ts`
- Equipment & Gear Registries: `simulation-engine/src/engine/rpg/EquipmentRegistry.ts`, `SocialEquipmentRegistry.ts`

## 4. Mandatory Invariants
1. **The Triad Invariant**: Every interactive prop must carry at least one `type`, one `material`, and relevant `affordance/capability` tags.
2. **Citizen Persona Invariant**: Every spawned NPC must carry authentic personality tags derived from their `population_demographics` record (`temper`, `instinct`, `motivation`, `allegiance`).
3. **Deterministic Cascades**: Physical cascades (fire + flammable = burning; blunt + fragile = broken) and event collisions must be computed mathematically through `TagMatrixEngine.ts` and `narrativeReactionEngine.ts`.
4. **Derived Stat Synchronization**: When base attributes change, all 4 derived pools (HP, Stamina, Composure, Focus) must be recomputed via `calcDerivedStats()`.

## 5. Verification Workflow
1. Verify Tag Matrix cascades pass unit checks in `TagMatrixEngine.ts`.
2. Verify narrative collision reactions trigger correctly:
   `npx --prefix simulation-engine tsx -e "import { NarrativeReactionTable } from './src/engine/rpg/narrativeReactionEngine.js'; console.log('Reaction rules loaded:', NarrativeReactionTable.length);"`
3. Ensure zero TypeScript errors across `simulation-engine` (`npx tsc -p simulation-engine/tsconfig.json --noEmit`).
