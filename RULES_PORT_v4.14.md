# Rules Port: v4.13 → v4.14 (for the FMG simulation)

**Follows** `RULES_PORT_v4.13.md` (items 19–30). These are items 31–36. Source of truth: `Shatterlands/Rules/BRUTAL_Rulebook_v3.md` (Draft v4.14). Change the existing code; don't build beside it.

## 31. Clash: best stat at −2, mirrors (§5.8)
- A Clash pick is `(stance, stat)`, where stat is one of the stance's two stats **or** `best_stat` with a −2 modifier.
- Foe AI: use the habit stance at 0.5; when its two stats are both below its best stat − 2, use the best stat at −2.
- The same stance on both sides is even: no Advantage.
- Log both stances in the combat log every Clash (the table needs them named aloud).

## 32. Ally reductions are extra (§5.4)
- `reduction_used_this_round` (item 23) counts only the target's **own** reductions.
- A reduction from another creature (Mend the Blow on an ally, a Ward on an ally) doesn't set it, and may apply to the same hit.
- Cap: a single hit drops at most **two** tiers in total.
- Order: the target picks first; then allies are offered.

## 33. Second Wind (§5.4)
- Per creature per scene, track `second_wind_used`.
- The first time a **Major or Critical lands** (after reductions), restore one spent once-per-scene Technique (the player picks; the AI picks its best defensive one).

## 34. Deck-as-life visibility (§13.2)
- Each card gets `visible: bool` (default true; poisons and tricks false).
- Expose visible cards and the current card count to the player UI.
- When `resolve <= ceil(resolve_max / 2)`, emit a "wavering" tell to the narration layer.

## 35. Balanced (§12.1)
- Balanced's Advantage triggers after a **miss or a Graze** on that foe.

## 36. Clerical
- A margin of 0 when the two sides are not within reach of each other: a **Graze**, not a Clash.
- [GRAPPLED]: the held creature may attack its holder normally, anyone else at Disadvantage. Remove any "may attack only the holder" logic from item 26.
- The shakes at the Come-Down: a near miss's Composure loss counts as a Composure injury.

## Tests
- Wick (Vitality 8, Fortitude 3, Willpower 4) picks Feint: she may roll Vitality at 6.
- Harrow takes a Major with Hearth-Coat available, and Wick's Mend is held: Hearth-Coat drops it to a Minor, then Mend to a Graze. Not to nothing (two-tier cap).
- Harrow's first Major of the scene, with Brace spent: Brace comes back. His second Major: nothing comes back.
- An arrow at margin 0 against a target two Zones away: a Graze.
