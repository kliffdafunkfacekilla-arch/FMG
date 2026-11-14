# Rules Port: v4.11 → v4.13 (for the FMG simulation)

**For:** the agent porting B.R.U.T.A.L. rules into the FMG world simulation.
**Source of truth:** `Shatterlands/Rules/BRUTAL_Rulebook_v3.md` (Draft v4.13). If this note and the rulebook disagree, the rulebook wins.
**Follows:** `RULES_PORT_v4.11.md`, items 1–18. These are items 19–30. Port them in order; 19–21 and 30 change data, the rest change resolution. **Do 30 (deck-as-life) after 19–22**: it supersedes foe Composure and last legs, so port the Shock and leader logic first and point it at Resolve.

Follow `AGENT_RULES.md`. Change the existing combat and morale code; don't build a parallel system beside it. Delete what's retired.

---

## 19. Retire the Nerve check (§5.10)
- **Remove** the `nerve` / `nerve_difficulty` field from foe data and every code path that rolls a Nerve check after a Major or Critical.
- **Remove** any mindset → Nerve-number table (hireling 14 / rank-and-file 11 / veteran 8).
- Migration: existing foe records drop the field. Nothing reads it after this item.

## 20. Last legs by stake (§5.10)
- Add `stake` to every foe: `hireling | rank_and_file | veteran | fanatic`. Leaders use `veteran`. Default from the Anchor if missing: none → hireling, Light → rank_and_file, Medium → veteran, Heavy → fanatic.
- `last_legs = ceil(max_composure * F)` where F = hireling 1/2, rank_and_file 1/3, veteran 1/4. Fanatics have no last legs (they break only at 0 Composure).
- Compute it **when the foe is built** and store it. Don't recompute in a fight.
- When `composure <= last_legs`, the foe's state becomes `seeking_exit` (flee, surrender, beg, play dead: the AI picks). A foe in `seeking_exit` accepts an offer of quarter.
- Heroes keep a quarter. They're told, never forced.

## 21. Shocks on what happens to a foe (§5.10)
When an event happens **to** a foe, it makes one Shock roll. The event picks the type:

| Event on the foe | Shock type | Stat pair |
|---|---|---|
| takes a Major or Critical injury | Fear | Fortitude / Willpower |
| thrown, tripped, disarmed, knocked prone, mocked | Rage | Might / Knowledge |
| feinted, bluffed, out-argued | Doubt | Endurance / Logic |
| ambushed, near miss (Graze), shot by an unseen shooter | Anxiety | Reflex / Intuition |
| an ally drops or dies | Grief | Vitality / Charm |
| magic, a monster, the impossible | Madness | Finesse / Awareness |

- Roll: `d12 + max(pair) + anchor_value` vs 10. A fail is a Composure **Minor** of that type (normal injury table).
- **One Shock per foe per event.** If one event fits several rows, use the first that applies in table order.
- The existing witness Shocks (an ally drops, an ally's Critical, ambush, the leader breaks) stay. Don't double-roll if the same event already triggered a witness Shock of that type.

## 22. Leader down (§5.10)
- When a foe flagged `leader` drops, breaks, flees or yields: every `hireling` and `rank_and_file` on its side is set straight to `seeking_exit` (no roll).
- `veteran` foes on that side roll the Fear Shock (the existing "leader breaks" witness Shock).
- Needs a `side` or `group_id` on foes, and a `leader` flag.

## 23. One reduction a round (§5.4)
- Replace "one reduction per hit" with **one per creature per round**. Track `reduction_used_this_round` on each combatant; reset at the start of the round.
- Every tier-dropping effect checks and sets it: armor traits, Roll With It, Covering traits, Wards, an ally's Mend the Blow.
- **Several creatures hit at once:** resolve one injury at a time. The target's own reduction is offered first, then allies' reductions, and only to hits nobody has reduced.

## 24. Spent at 0 (§5.9, §10.1)
- A pool at 0 sets `spent_stamina` or `spent_focus` until the next rest.
- Spent in a pool: no Techniques, no Effort and no Reactions that cost that pool. Move, basic strikes and active defenses stay. Disadvantage on rolls with that pool's stats (Body for Stamina, Mind for Focus). Workings can still overreach (§8.5).
- **At the Come-Down:** if the bill is more than the pool, drop it to 0 and store the remainder as `rest_debt[pool]`. The next rest restores `normal - rest_debt`, then clears it.

## 25. React Effect timing (§8.2)
- A React Effect uses the caster's Mind beat **this round if it's unspent, otherwise next round's**. Store it as a `mind_beat_owed_next_round` flag only when this round's is already spent.

## 26. Grapples (§5.7)
- Holding is free (no beat, no token).
- The held creature may: break free (a Body beat; its roll vs the holder's; **it wins ties**), or attack only its holder.
- The hold ends if the holder Moves without dragging, takes an intercept elsewhere, is [PRONE] or [STUNNED], or lets go.
- Re-grab: a Grab (1 S), or free on a hit from anything that grapples on a hit (Wrap, Lockjaw).
- **A tie on a Grab, shove or trip** is a Clash (§5.8), as with attacks.

## 27. Painful Lesson (§11)
- Award the pip only on a natural 1 on a roll that **failed**. A natural 1 that still succeeds gives nothing.

## 28. Small table rulings (§13.4, Sim 29)
- An involuntary push or throw isn't a Move (Brace, planted plate and Under the Bow ignore it).
- A Ready or intercept resolves on its trigger, **before** the attack roll.
- Thrown into deep water: [PRONE]; a downed creature there loses 2 from its dying count each round.
- A lost Clash's "+1 tier on the next hit" expires at the end of the loser's next turn.
- Weather a trait ignores (Weatherproof in rain) gives that creature neither Advantage nor Disadvantage.
- Stabilizing with a field kit costs 1 token of either pool (else 1 S + 1 F).
- Parry is unchanged: it affects the first melee attack on its wielder each round, from anyone.

## 29. The Clash wheel (§5.8, v4.13)
- Stance order: `["press","trick","disengage","hold","feint","maneuver"]`. Stance at index i **beats** i+1 and i+2 (mod 6); i+3 is **even**; the other two beat it.
- The side whose stance beats the other's rolls with **Advantage** (roll 2d12, keep the higher). Even: straight.
- Each round of a tied Clash, both sides pick again.
- Foes get a `habit_stance`. The AI picks the habit with probability 0.5; otherwise it picks the stance that would beat the opponent's most-used stance so far this scene (track counts per opponent). Heroes controlled by players pick freely.
- A lost Press's "+1 tier on the next hit" lasts until the end of the loser's next turn.

## 30. Deck-as-life foes (§13.2, v4.13)
- **Every foe except bosses** is a card stack. Remove `health` and `composure` from non-boss foe data; add:
  - `cards: [{name, kind: core|trait|ability, copies, tags[], grants{stats, armor, weapon, speed, anchor, traits}, on_lost}]`
  - `resolve: int` from stake: hireling 2, rank_and_file 4, veteran 6, fanatic 8.
  - `habit_stance`.
- **Stack size:** ceil(old_health / 2) total copies. Use it to migrate existing foe data.
- **Body injuries shred cards:** Minor 2, Major 4, Critical 6. Order: Trait and Ability copies first, chosen at random; Core copies last. A Graze on the body shreds 1 **Resolve**, not a card.
- **Aimed attack:** the attacker names a card; roll at Disadvantage; on a hit the shred comes off that card first, then the normal order.
- When a card's last copy goes, remove its `grants` and fire its `on_lost` (a weaker weapon, lower speed, a lost flight). When all cards are gone: `down`, and start the dying countdown (item 9 of the v4.11 port).
- **Composure injuries shred Resolve:** Graze 1, Minor 2, Major 4, Critical 6. A failed Shock is a Composure Minor (2). **Bleeding:** −1 Resolve at the start of each of the foe's turns (not a card).
- `resolve == 0` → `seeking_exit` (fanatic: `broken`, out of the fight). The leader rule (item 22) sets hireling and rank_and_file Resolve to 0.
- Mind defense: unchanged (the better of the Anchor's stat or Willpower, plus the Anchor).
- **Bosses** keep `health` and `composure` and the existing boss rules.
- Delete the per-foe `last_legs` field from item 20 for card-stack foes; it only applies to bosses (never: they don't seek exit) and heroes.

---

## Tests to add
- A 12-Composure rank-and-file foe: last legs = 4; one failed Fear Shock (a Minor, −4) puts it in `seeking_exit`.
- A veteran (Willpower 6, Medium Anchor +2): the Fear Shock is d12+8 vs 10, so it fails only on a natural 1. (This is intended: veterans hold.)
- Kill the leader: every hireling and rank_and_file on its side is in `seeking_exit` the same tick.
- A hero with Roll With It and Weatherproof takes two Minors in one round: only the first is reduced.
- Bill 5 Stamina, pool 3: pool → 0, `spent_stamina`, `rest_debt.stamina = 2`; the next short rest restores 2 fewer.
- A Grab tie → Clash. A break-free tie → the held creature escapes.
- Clash: press vs trick → press has Advantage; press vs hold → straight; press vs feint → feint has Advantage.
- A 7-card cutthroat (Core ×3, Knife ×2, Quick ×2) takes a Major: 4 cards go, all Knife and Quick copies, so it fights with claws at Speed 6 and has 3 Core left.
- A rank-and-file foe (Resolve 4) fails two Shocks → Resolve 0 → `seeking_exit`.
- A Bleeding hireling (Resolve 2) with no other harm is `seeking_exit` after its second turn.
