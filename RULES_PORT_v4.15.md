# Rules Port: v4.14 → v4.15 (for the FMG simulation)

**Follows** `RULES_PORT_v4.14.md` (items 31–36). These are items 37–43. Source of truth: `Shatterlands/Rules/BRUTAL_Rulebook_v3.md` (Draft v4.15). Change the existing code; don't build beside it.

## 37. Pressed hard (§1.2)
- Track `attackers_this_round` per creature (distinct attackers).
- When the third distinct attacker attacks, the target may roll one extra free active defense, against that attack or a later one. Once a round.

## 38. Spent (§5.9)
- Active defenses roll **normally** while Spent. Remove the Disadvantage for Spent from defense rolls only.
- `rest_debt[pool]` is capped at that pool's daily maximum.
- Spent with a locked [BIPED] tag: a Move covers half a Zone.

## 39. Second Wind (§5.4)
- It restores one spent once-per-scene **Technique or trait**.
- If none is spent, it restores 1 energy (the creature's choice; the AI takes its lower pool).

## 40. One Shock of each type a round (§5.10)
- Per creature per round, track the Shock types already rolled. A second trigger of the same type that round is ignored.

## 41. Visible extra-action cards (§13.2)
- Any card whose effect grants other creatures actions (Command, war-horn, Rally) has `visible: true`, and nothing can override it.

## 42. Field Treatment and the bill (§10.2)
- Field Treatment (a kit and an hour) also restores 2 energy paid at the Come-Down, or clears 2 `rest_debt`.

## 43. Clerical
- The shakes at the Come-Down never take Composure below 1.
- Mend the Blow, used as a reduction, costs the patient no Stamina.
- Carrying by size: carry smaller alone; same size needs Might ≥ 5; bigger needs two carriers. A Small creature can't carry a strongbox.
- A hit on a stabilized downed creature restarts its dying count at 6, minus the hit's usual cost.
- UI: show Health as `now / max now` (capacity loss lowers the max).
