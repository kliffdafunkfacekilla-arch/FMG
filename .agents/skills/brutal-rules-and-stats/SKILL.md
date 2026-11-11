---
name: brutal-rules-and-stats
description: >-
  Governs the canonical B.R.U.T.A.L. TTRPG mechanical rules (v4.9), 12-attribute system, 4 derived pools (Health, Composure, Stamina, Focus),
  4 derived senses (Perception, Speed/Dodge, Stealth, Balance/Footing), opposed 1d12 Net Margin resolution, Guard vs Active Defense,
  the 6 Clash stances, injury capacity loss & energy shredding, and magical healing stamina tradeoffs.
---

# B.R.U.T.A.L. TTRPG Rules & Stats Mechanics Skill (v4.9)

This skill governs Pillar 3 of the architecture: the deterministic, mechanical rules engine of B.R.U.T.A.L. and the Ostraka simulation, aligned 100% with `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` and `Rules_Digest.md`.

## 1. Architectural Scope & Core Resolution (The d12 Engine)
- **Zero Hallucination Mandate**: All combat, checks, damage, and health calculations are strictly deterministic mathematical computations executed in TypeScript.
- **The Core Die**: Everything uses a **d12**.
- **Contested Rolls**:
  $$\text{Net Margin} = (\text{Attacker } 1d12 + \text{Stat} + \text{Weapon Value}) - (\text{Defender } 1d12 + \text{Stat} + \text{Armor Value})$$
  - $\text{Margin} < 0$: Defender wins (parried/dodged).
  - $\text{Margin} = 0$: **The Clash** (locked weapons).
  - $\text{Margin} \ge 1$: Attacker wins; margin determines the injury tier.
- **Advantage / Disadvantage**: Roll $2d12$, keep higher / lower.
- **Stars & Scars**: Natural 12 on a success = **Star** (growth pip). Natural 1 = **Scar** (failure learning pip).
- **Uncontested Checks**: $1d12 + \text{Stat} (+ \text{Tool})$ vs Easy 8, Standard 11, Hard 14, Extreme 17. Margin 1–2 is Success at a Cost.
- **Defending & Guard**:
  - Each round: **one active defense** (rolled $1d12$) against physical, and one against Composure.
  - Every other attack hits **Guard**: $\text{Defense Stat} + \text{Armor Value}$ (static, **NO die rolled**).

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

## 3. Injury Tiers & Energy Shredding

| Margin | Tier | Capacity Lost | Energy Shredded | Mechanical Effect |
|---|---|---|---|---|
| **1** | **Graze** | 0 | 1 | Near miss: $-2$ Composure (Anxiety). |
| **2–5** | **Minor** | 4 | 2 | Disadvantage on next roll. Hidden wound card. |
| **6–9** | **Major** | 8 | 4 | **Bleed**: lose 1 token at start of each turn. Wound card revealed. |
| **10+** | **Critical** | 12 | 6 | Staggered! Body part destroyed until proper treatment; needs stabilizing. |

- **Capacity Loss**: Comes off Health (or Composure) **maximum** until treated.
- **Energy Shredded**: Body injuries shred Stamina; Composure injuries shred Focus.
- **Magical Healing Tradeoff (§8.2, v4.6)**:
  - Healing costs the healer's Focus **and the patient's Stamina**: **2 Stamina to knit a Minor, 4 Stamina for a Major**.
  - Leaves a **Knitted wound**: capacity is restored, but a Major+ strike to that location tears it open.

---

## 4. The Clash (Margin = 0)
Both combatants secretly choose a stance and roll $1d12 + \text{stat}$ (no gear).

| Stance | Stat Pair | Winner Benefit | Loser Penalty |
|---|---|---|---|
| **Press** | Might / Knowledge | Pushes 1 space forward, lands a Minor | Next hit on them is $+1$ tier |
| **Hold** | Endurance / Logic | Strikes from fixed stance (Minor) | Channeled power detonates |
| **Maneuver** | Reflex / Intuition | Shifts and lands flanking strike (Minor) | Takes a Graze |
| **Trick** | Finesse / Awareness | Next hit ignores armor value | `[STUNNED]`: loses next Body beat |
| **Feint** | Fortitude / Willpower | Swaps places with target | `[STAGGERED]`: next strike is unopposed |
| **Disengage** | Vitality / Charm | Parting Graze + leaps 1 space back | `[OFF-BALANCE]`: thrown 1 space |

---

## 5. Key Codebase Anchors
- Rules Engine: `simulation-engine/src/engine/customRulesEngine.ts`
- Combat & Clash Resolution: `simulation-engine/src/engine/combatResolutionEngine.ts`
- Injury & Healing: `simulation-engine/src/engine/injuryEngine.ts`
- Social & Dread: `simulation-engine/src/engine/socialCombat.ts`
- REST API Router: `simulation-engine/src/api/rulesRouter.ts`
- Observer Dashboard UI: `simulation-engine/src/observer/RulesLabTab.tsx`
- Verification Script: `simulation-engine/src/scripts/testTTRPGRules.ts`
