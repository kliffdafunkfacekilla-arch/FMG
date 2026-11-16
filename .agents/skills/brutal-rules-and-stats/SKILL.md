---
name: brutal-rules-and-stats
description: >-
  Governs the canonical B.R.U.T.A.L. TTRPG mechanical rules (Draft v5.0), 12-attribute system, 4 derived pools (Health, Composure, Stamina, Focus),
  4 derived senses (Perception, Speed/Dodge, Stealth, Balance/Footing), opposed 1d12 Net Margin resolution, Guard vs Active Defense,
  the 6 Clash stances, foe cards & Resolve, owed energy at the Come-Down, and Persuasion.
---

# B.R.U.T.A.L. TTRPG Rules & Stats Mechanics Skill (Draft v5.0)

This skill governs Pillar 3 of the architecture: the deterministic, mechanical rules engine of B.R.U.T.A.L. and the Ostraka simulation, aligned 100% with `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` and `RULES_TARGET_v5.0.md`.

## 1. Architectural Scope & Core Resolution (The d12 Engine)
- **Zero Hallucination Mandate**: All combat, checks, damage, and health calculations are strictly deterministic mathematical computations executed in TypeScript.
- **The Core Die**: Everything uses a **d12**.
- **Contested Rolls**:
  $$\text{Net Margin} = (\text{Attacker } 1d12 + \text{Stat} + \text{Weapon Value}) - (\text{Defender } 1d12 + \text{Stat} + \text{Armor Value})$$
  - $\text{Margin} < 0$: Defender wins (parried/dodged).
  - $\text{Margin} = 0$ (within reach): **The Clash** (locked weapons). Out of reach -> **Graze**.
  - $\text{Margin} \ge 1$: Attacker wins; margin determines the injury tier.
- **Advantage / Disadvantage**: Roll $2d12$, keep higher / lower (they cancel 1-for-1).
- **Stars & Painful Lessons**: Natural 12 on a **succeeded** roll = **Star** (growth pip). Natural 1 on a **failed** roll = **Painful Lesson**.
- **Uncontested Checks**: $1d12 + \text{Stat} (+ \text{Prop})$ vs Easy 8, Standard 11, Hard 14, Extreme 17.
- **Persuasion (§6.3)**: Difficulty = target's current Composure (`7+` yes and more, `3-6` yes, `0-2` yes for a price, `<0` no; asks against orders cannot succeed; One Voice per target per round; deals `0` wounds). Talk in a fight is free and wounds nobody.
- **Defending & Guard**:
  - Each round: **one active defense** (rolled $1d12$) against physical, and one against Composure.
  - Every other attack hits **Guard**: $\text{Defense Stat} + \text{Armor Value}$ (static, **NO die rolled**).
  - Being **Spent** (0 tokens) blocks Stamina/Focus Techniques, Effort, and Reactions and gives Disadvantage on matching attacks/checks; Defenses still roll normally.

---

## 2. The 12 Attributes, 4 Derived Pools & 4 Senses (v4.2+ Rebuild)
Every attribute feeds exactly two derived stats: one pool and one sense.

| Derived Stat | Type | Canonical Formula | Operational Role |
|---|---|---|---|
| **Health** | Pool | $\text{Vitality} + \text{Fortitude} + \text{Intuition}$ | Physical body integrity. Wounds reduce max capacity. |
| **Composure** | Pool | $\text{Willpower} + \text{Awareness} + \text{Endurance}$ | Mental resilience against dread, anxiety, and social attacks. |
| **Stamina** | Pool | $\text{Might} + \text{Reflex} + \text{Charm}$ | Physical energy for techniques, doubling beats, and healing. |
| **Focus** | Pool | $\text{Logic} + \text{Knowledge} + \text{Finesse}$ | Mental energy for spellcasting workings, overwatch, and tactics. |
| **Perception** | Sense | $\text{Awareness} + \text{Intuition} + \text{Finesse}$ | Hearing, seeing traps; sets round declaration order (lowest first). |
| **Speed** | Sense | $\text{Reflex} + \text{Vitality} + \text{Logic}$ | Action resolution order (highest first). Move = 1 space / 5 Speed. **Dodge Guard** = $\lfloor \text{Speed}/2 \rfloor + 5$. |
| **Stealth** | Sense | $\text{Knowledge} + \text{Charm} + \text{Endurance}$ | Hiding: $1d12 + \lfloor \text{Stealth}/2 \rfloor$ vs $\lfloor \text{Perception}/2 \rfloor + 5$. |
| **Balance** | Sense | $\text{Might} + \text{Fortitude} + \text{Willpower}$ | Shoves/trips roll against **Footing Guard** = $\lfloor \text{Balance}/2 \rfloor + 5$. |

---

## 3. Injury Tiers, Owed Energy & Foe Stacks (Draft v5.0)

| Margin | Tier | Capacity Lost | Energy Owed | Mechanical Effect |
|---|---|---|---|---|
| **1** (or ranged tie) | **Graze** | 0 | 1 | Near miss: $-2$ Composure (Anxiety). |
| **2–5** | **Minor** | 4 | 2 | Disadvantage on next roll. Hidden wound card. |
| **6–9** | **Major** | 8 | 4 | **Bleed**: lose 1 token at start of each turn. Wound card revealed; location tag locked. |
| **10+** | **Critical** | 12 | 6 | Staggered! Body part destroyed until treated; needs stabilizing; location tag locked. |

- **Capacity & Owed Energy (§5.4, §10.1)**: Capacity loss applies at once. Hits do NOT remove energy mid-fight; energy is recorded in `owed: { stamina, focus }` and settled at the Come-Down via `payAtComeDown` (excess beyond pool floors at 0 and sets `Spent`, then applies **the shakes**: Composure Graze floor 1).
- **Reductions (§5.4)**: Max 1 tier from own abilities + 1 tier from an ally (a Mend costs the patient 0 Stamina).
- **Down / Psychic Break**: Reaching 0 Health or 0 Composure starts a 6-round countdown (`stabilizeDowned` / `groundBroken`). No Adrenaline check to stand.
- **Foes as Cards & Resolve (`foeStack.ts`)**: Non-boss foes use `cards` (`ceil(health/2)`) and `resolve` (`2/4/6/8` by stake); hits shred cards (Minor 2, Major 4, Critical 6; traits/abilities first, core last) and drop Resolve without Shock rolls (`0` Resolve -> `seeking_exit` or `broken`). Bosses keep Health & Composure pools.

---

## 4. The Clash (Margin = 0 within reach)
Both combatants secretly choose a stance from the 6-position wheel (`['PRESS', 'TRICK', 'DISENGAGE', 'HOLD', 'FEINT', 'MANEUVER']`) and roll $1d12 + \text{best stat}$ (no gear). Index $i$ beats $i+1$ and $i+2 \pmod 6$, granting **Advantage** on the Clash roll; a tie continues next round at `1 Stamina + 1 Focus` each.

| Stance | Winner Benefit | Loser Penalty |
|---|---|---|
| **Press** | Pushes 1 space forward, lands a Minor | Next hit on them is $+1$ tier |
| **Trick** | Next hit ignores armor value | `[STUNNED]`: loses next Body beat |
| **Disengage** | Parting Graze + leaps 1 space back | `[OFF-BALANCE]`: thrown 1 space |
| **Hold** | Strikes from fixed stance (Minor) | Channeled power detonates |
| **Feint** | Swaps places with target | `[STAGGERED]`: next strike is unopposed |
| **Maneuver** | Shifts and lands flanking strike (Minor) | Takes a Graze |

---

## 5. Key Codebase Anchors
- Rules Engine: `simulation-engine/src/engine/customRulesEngine.ts`
- Combat & Clash Resolution: `simulation-engine/src/engine/combatResolutionEngine.ts`
- Injury & Come-Down: `simulation-engine/src/engine/injuryEngine.ts`
- Foe Stacks & Resolve: `simulation-engine/src/engine/rpg/foeStack.ts`
- Social & Persuasion: `simulation-engine/src/engine/socialCombat.ts`
- REST API Router: `simulation-engine/src/api/rulesRouter.ts`
- Observer Dashboard UI: `simulation-engine/src/observer/RulesLabTab.tsx`
- Verification Script: `simulation-engine/src/scripts/testTTRPGRules.ts`
