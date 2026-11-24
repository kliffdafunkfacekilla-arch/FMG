# B.R.U.T.A.L. rules target for FMG: v4.9 → v5.0 in one step

**This file replaces every `RULES_PORT_v4.x` / `v5.0` note.** Those were a chain of patches written while the rules changed under them. Nobody built them, and later ones deleted what earlier ones asked for. **Ignore them. Build only this.**

**Where the code is now:** the engine is at **Draft v5.0 (complete)** (`simulation-engine/src/engine/combatResolutionEngine.ts`, `injuryEngine.ts`, `rpg/BrutalGM.ts`, `rpg/foeStack.ts`, `socialCombat.ts`, `customRulesEngine.ts`).
**Where it should be:** Draft **v5.0**. The source of truth is `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md`, and **§5.0 "The fight on one page"** is the whole combat loop. If this file and the rulebook disagree, the rulebook wins.

Follow `AGENT_RULES.md`. **Change the existing files. Don't build parallel ones.** One commit per numbered step. Each step comes with its tests in `scripts/testTTRPGRules.ts`.

---

## Step 1. The Clash (`combatResolutionEngine.ts`)
- **Delete** `CLASH_STANCE_STATS`. Stances no longer have stats.
- Each side rolls **d12 + its best stat** (the highest of the 12). No gear.
- **The wheel:** `['PRESS','TRICK','DISENGAGE','HOLD','FEINT','MANEUVER']`. A stance at index i **beats** i+1 and i+2 (mod 6). The same stance, or i+3, is **even**. The side whose stance beats the other's rolls with **Advantage**.
- A tie means the Clash continues next round, both sides pay 1 Stamina + 1 Focus, and both pick again.
- **A margin of 0 when attacker and target aren't within reach** is not a Clash. It's a **Graze**.
- Winner and loser effects are unchanged from v4.9 (rulebook §5.8 table).
- **Tests:** PRESS vs TRICK (Press has Advantage); PRESS vs HOLD (straight); PRESS vs FEINT (Feint has Advantage); TRICK vs TRICK (straight); a ranged tie becomes a Graze.

## Step 2. Stars and Painful Lessons (`combatResolutionEngine.ts`)
- Rename `isScar` to `isPainfulLesson`.
- A natural 12 is a Star **only on a roll that succeeded**. A natural 1 is a Painful Lesson **only on a roll that failed**.
- **Tests:** a nat 1 that still hits gives no pip; a nat 12 that misses gives no Star.

## Step 3. Reductions (`combatResolutionEngine.ts` or `injuryEngine.ts`, wherever tiers are applied)
- Each hit can drop **one tier from the target's own abilities** and **one from another creature's** (Mend the Blow, a Ward on them). That's two at most. There's no per-round counter.
- A Mend used as a reduction costs the patient nothing.
- **Test:** Major + own trait + ally Mend = Graze. Major + two of the target's own traits = Minor (only one counts).

## Step 4. The bill at the Come-Down (`injuryEngine.ts`)
- **A hit no longer removes energy tokens during the fight.** Add `owed: { stamina, focus }`. Graze 1, Minor 2, Major 4, Critical 6. Body injuries owe Stamina; Composure injuries owe Focus.
- **These still apply at once:** capacity (the max drops), a Minor's Disadvantage on the next roll, a Major's Bleed (1 token at the start of each of its turns), and Major and Critical cards.
- Add `payAtComeDown(entity)`. It subtracts what's owed from each pool. **A bill bigger than the pool takes it to 0, and the rest is lost.** It then flips face-down Minor cards and applies the **shakes**: a Composure Graze (never below 1) for anyone who took a Composure injury, a near miss, or a Minor or worse.
- **Test:** a Minor at S 7 leaves S 7 in the fight, S 5 after the Come-Down. Owing 9 at S 3 ends at S 0.

## Step 5. Spent (`injuryEngine.ts` and the roll helpers)
- A pool at 0 sets `spent.stamina` or `spent.focus` until rest.
- **Spent in Stamina:** no Techniques, Effort or Reactions that cost Stamina, and Disadvantage on **Body attacks and checks**. **Defenses roll normally.**
- **Spent in Focus:** the same for Focus and Mind rolls.
- **Test:** a Spent fighter's maul attack rolls at Disadvantage; their active defense doesn't.

## Step 6. Down and dying (`injuryEngine.ts`)
- 0 Health means down: `dyingRounds = 6`, which drops by 1 at the end of each round. At 0 the creature dies. Emit a narration line every round ("X is down: N rounds").
- **Hits on the downed:** a Graze or Minor costs 1 round, a Major 2, and a Critical kills.
- **Stabilize** (an adjacent creature's Body beat, 1 S + 1 F, or 1 token with a field kit) stops the count. A hit on someone already stabilized restarts the count at 6 minus the hit's cost.
- 0 Composure works the same way: a Psychic Break with its own count, stopped by grounding (1 S + 1 F) or a Rally.
- **Delete** any "Adrenaline check to get back up" logic.

## Step 7. Locked tags (`injuryEngine.ts`)
- A locked tag gives **Disadvantage** on rolls that need it. A locked [BIPED] halves Move.
- **Delete** the v4.9 doubled-cost and "a free action costs 1 Stamina" logic, if it exists.

## Step 8. Foes as cards (new, `engine/rpg/foeStack.ts`, used by `BrutalGM.ts` / `RulesEngine.ts`)
- Every foe **except bosses** has `cards: [{ name, kind: 'core'|'trait'|'ability', copies, tags, grants, visible, onLost }]` and `resolve` in place of health and composure. Bosses keep health and composure.
- **Stack size** = ceil(v4.9 health / 2). Use it to migrate existing foe data.
- **Body hits shred cards:** Minor 2, Major 4, Critical 6. Trait and ability copies go first, at random; core goes last. When a card's last copy goes, remove its `grants` and fire `onLost`. When no cards are left, the foe is down (Step 6).
- **Aimed attack:** the attacker names a visible card, rolls at Disadvantage, and a hit shreds that card first.
- `visible` defaults to true. Poisons and tricks can be hidden. **A card that gives other foes actions (Command, Rally, a war-horn) is always visible.**
- **Resolve by stake:** hireling 2, rank-and-file 4, veteran/leader 6, fanatic 8. **Foes never roll Shocks.** These events cost Resolve:
  - **−1:** a Graze or near miss on it, each Bleed tick, being thrown, tripped or disarmed.
  - **−2:** a Major or worse on it, an adjacent ally dropping, or fire, magic or a monster acting on it.
  - **Composure attacks:** minus the tier cost (1/2/4/6).
  - **Leader down** (drops, breaks, flees or yields): every hireling and rank-and-file on its side goes to 0.
- **At 0 Resolve:** `seeking_exit` (flee, surrender, beg, play dead), and it accepts any offer of quarter. A fanatic goes to `broken` (out of the fight) instead. At half Resolve or below, emit a "wavering" narration line.
- **Tests:**
  - A 7-card cutthroat (core ×3, knife ×2, quick ×2) takes a Major: all its knife and quick copies go.
  - A rank-and-file foe takes a Major and then an adjacent ally drops: Resolve 4 → 0, seeking exit, and no dice were rolled.
  - Killing the leader puts every hireling at 0.

## Step 9. Heroes' Shocks (wherever Composure is handled)
- When something terrible happens in sight, a hero rolls d12 + the better stat of the type's pair + their Anchor, against 10. A fail is a Composure Minor of that type. The triggers and types are in rulebook §5.10.
- **One Shock per creature per round**, of any type.

## Step 10. Ready, intercept, shooting a charger (`combatEngine.ts` / `BrutalGM.ts`)
- **Ready:** give up the Body beat to name a trigger. It fires at once, **before** the triggering attack's roll, and it uses the round's one Reaction. It may include a 1-space step into reach, which spends the Move.
- **Intercept trigger:** "a foe attacks an ally next to me". The attack comes at the interceptor instead.
- **A shooter's Ready against a charger:** if the hit is a Minor or worse, the charger's Move stops where it is.
- **Delete** any "Under the Bow" logic if any was written.

## Step 11. Talk (`socialCombat.ts`)
- **Persuasion** is a skill check. Its Difficulty is the **target's current Composure**. Margins: 7+ yes and more, 3–6 yes, 0–2 yes for a price, below 0 no. An ask against the target's orders can't be won by Persuasion.
- **One voice:** one speaker per target per round. Other speakers give Advantage.
- In a fight, talk is free and wounds nobody. Hostile social attacks out of a fight still deal Composure injuries (§6.2).

## Step 12. Building characters (`customRulesEngine.ts` / the character builder)
- **The Doubling Fee:** for each stat, count its jobs (weapon, armor, Path, Prop, Anchor). Each job past the first costs +1, +1, +2, +2 (totals 1/2/4/6), taken from that stat's pool (Body stats from Stamina, Mind stats from Focus).
- **Techniques are paid by what they do:** strikes, shots, physical defenses and moves cost Stamina; social attacks and Mind defenses cost Focus.

## Done when
- [x] `npm test` (or `node run-tests.cjs`) passes with all Steps 1–12 tests in `simulation-engine/src/scripts/testTTRPGRules.ts`.
- [x] The headers of the changed files say **v5.0**.
- [x] `AGENT_RULES.md` and `GEMINI.md` point at Draft v5.0.
- [x] A worked example of one full round (§5.0 + §13.2 Stoat Cutthroat), run through `BrutalGameMaster` and `combatResolutionEngine`, matches rulebook §5.0 (`testTTRPGRules.ts` and `testCanonMandates.ts`).
