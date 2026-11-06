---
name: concordia-rules-and-stats
description: >-
  Governs the Concordia TTRPG mechanical rules, 12-attribute system, 4 derived pools, opposed 1d20 resolution,
  skill progression trees, equipment catalogs, and deterministic Tag Matrix physical cascades.
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
- **Physical Tag Matrix Engine**:
  Every object, NPC, and prop carries semantic physical tags (`stone`, `wood`, `metal`, `fire`, `flammable`, `container`, `locked`, `beast`, `organic`, `blight`, `secret`).
  Interactions cascade deterministically:
  - `fire` applied to `flammable` triggers ignition, damage over time, and emits smoke tags.
  - `blunt` force against `stone` tests structural threshold.
  - `acid` against `metal` corrodes armor ratings.

## 2. Key Codebase Anchors
- Rules Engine: `simulation-engine/src/engine/rpg/RulesEngine.ts`
- Tag Matrix Cascade: `simulation-engine/src/engine/rpg/TagMatrixEngine.ts`, `TagRegistry.ts`
- Character Data & Attribute Math: `simulation-engine/src/engine/rpg/CharacterData.ts`
- Skill Progression Tracks: `simulation-engine/src/engine/rpg/MasterSkillProgression.ts`, `SocialSkillProgression.ts`
- Equipment & Gear Registries: `simulation-engine/src/engine/rpg/EquipmentRegistry.ts`, `SocialEquipmentRegistry.ts`, `gearCatalogExpanded.ts`
- Combat Engine: `simulation-engine/src/engine/combatEngine.ts`, `combatResolutionEngine.ts`

## 3. Mandatory Invariants
1. **Deterministic Execution**: Mathematical formulas in `RulesEngine.ts` are pure. They must never depend on network calls or external LLM tokens.
2. **Derived Stat Synchronization**: When any of the 12 base attributes change, all 4 derived pools (HP, Stamina, Composure, Focus) must be recomputed via `calcDerivedStats()`.
3. **Equipment Group Compatibility**: Weapons and armors must reference registered definitions in `EquipmentRegistry.ts` or `SocialEquipmentRegistry.ts`.
4. **Opposed Rolls Rule**: Combat actions always compute both attacker and defender modifiers rather than flat arbitrary successes.

## 4. Verification Workflow
When modifying attributes, skills, or combat math:
1. Run character generation and derivation checks:
   `npx --prefix simulation-engine tsx -e "import { calcDerivedStats } from './src/engine/rpg/CharacterData.js'; console.log(calcDerivedStats({ might: 15, endurance: 14, finesse: 12, reflex: 13, vitality: 14, fortitude: 15, knowledge: 10, logic: 10, awareness: 12, intuition: 11, charm: 10, willpower: 13 }));"`
2. Verify Tag Matrix cascades pass unit checks in `TagMatrixEngine.ts`.
3. Ensure zero TypeScript errors across `simulation-engine` (`npx tsc -p simulation-engine/tsconfig.json --noEmit`).
