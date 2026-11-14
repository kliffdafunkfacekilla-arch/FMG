# Rules Port: v4.15 → v5.0, the streamlining pass (for the FMG simulation)

**Read this first.** v5.0 **deletes** several systems that earlier port notes told you to build. Remove the code; don't leave it switched off. The source of truth is `Shatterlands/Rules/BRUTAL_Rulebook_v3.md` (Draft v5.0); §5.0 "The fight on one page" is the whole combat loop. The reasoning is in `Shatterlands/Rules/BRUTAL_v5_Streamlining.md`.

## Delete
| Remove | From port item | Replaced by |
|---|---|---|
| Under the Bow (check, flinch, wait-them-out, one-mover-per-shooter) | earlier port notes | **Ready**: a shooter's trigger "a foe comes at me across open ground". A hit of Minor or worse ends the charger's Move where it stands. |
| `reduction_used_this_round`, the ally-extra flag, the two-tier cap logic | 23, 32 | Per **hit**: at most one tier from the target's own abilities and one from another creature's. |
| Pressed hard | 37 | Nothing. |
| Second Wind | 33, 39 | Nothing. |
| Foe Shock rolls (all of them), the cause→type table, one-Shock-per-type | 21, 36, 40 | The foe **Resolve table** (below). |
| `last_legs` for foes, the Nerve field | 19, 20 | Resolve at 0. |
| Clash stance→stat pairs, the best-stat −2 fallback | 29, 31 | Roll d12 + `best_stat`. The stance only sets Advantage (the wheel) and the outcome. |
| `rest_debt` and its cap; the Field Treatment refund | 24, 38, 42 | A bill bigger than the pool just takes it to 0 (Spent). |
| Locked tag: double cost, free action costs 1 S; Spent + locked-leg half-Zone special case | earlier, 38 | A locked tag gives Disadvantage on rolls that need it. A locked [BIPED] halves Move (half a Zone). |

## Keep or change
- **Foe Resolve** by stake: hireling 2, rank_and_file 4, veteran/leader 6, fanatic 8. No rolls.
  - **−1:** a Graze or near miss on it; each Bleed tick; thrown, tripped or disarmed.
  - **−2:** a Major or worse on it; an ally adjacent to it drops; fire, magic or a monster acts on it.
  - **Composure attacks:** −tier (Graze 1, Minor 2, Major 4, Critical 6).
  - **Leader down:** hireling and rank_and_file Resolve goes to 0.
  - **At 0:** `seeking_exit` (a fanatic goes to `broken`). Emit a narration tell at ≤ half.
- **Heroes' Shocks:** one per creature per round, of any type.
- **Spent:** no abilities from that pool, Disadvantage on that pool's attacks and checks, and **defenses roll normally**.
- **Clash:** the wheel order `press, trick, disengage, hold, feint, maneuver`. A stance at index i beats i+1 and i+2. The same stance, or i+3, is even. The winner of the matchup rolls with Advantage. Both roll d12 + best stat. A margin of 0 outside reach is a Graze.
- **Deck-as-life**, visible cards, the dying countdown, the bill at the Come-Down, Ready with step and intercept, and Persuasion are all unchanged.

## Tests
- A shooter's Ready against a charging stoat: a Minor stops the stoat's Move. Two other stoats arrive.
- Harrow uses Hearth-Coat on a Major, and Wick's Mend lands on the same hit: the Major becomes a Graze. On his next hit that round, Roll With It is allowed (it's a different ability) if he still has it.
- A rank-and-file foe (Resolve 4) takes a Major (−2), then its neighbor drops (−2): Resolve 0, so it's `seeking_exit`. No dice rolled.
- Wick (best stat Vitality 8) Clashes in Feint: she rolls d12+8.
