# Rules to port into BrutalGM (B.R.U.T.A.L. v4.10–4.11)

The source of truth is `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` (Draft v4.11). See Appendix D, sections v4.10 and v4.11. Each item below needs code **and a test** (AGENT_RULES rule 9).

**Character and loadout**
1. **Doubling Fee** (Step 13). Count the jobs per stat: weapon, armor, Path, Prop, Anchor. The extra fee is +1/+2/+3/+4, taken from Stamina for a Body stat and Focus for a Mind stat. The 4-energy floor still holds.

**Energy and injuries**
2. **Techniques are paid by what they do** (Appendix E). Strikes, shots, physical defenses and Moves cost Stamina. Social attacks, defenses against Composure attacks and clearing a mind status cost Focus.
3. **The bill at the Come-Down** (§5.4, §10.1). Injuries record energy as *owed* (1/2/4/6), paid when the fight ends. Capacity, Adrenaline Shock, Bleed and Major/Critical cards still apply at once.

**Talk**
4. **Persuasion** (§6.3). An unopposed check against the target's *current Composure*. Margins: 7+ yes and more; 3–6 yes; 0–2 yes for a price; below 0 no. An ask against orders is blocked. One speaker; helpers give Advantage.
5. **One voice** (Part Six). One social attack per target per round.
6. **Foe Mind defense:** the better of the Anchor's stat or Willpower, plus the Anchor's value.

**Combat**
7. **Last legs by nerve** (§5.10). A foe looks for a way out at a quarter of its Composure, or after a Major or Critical if it fails a Nerve check (d12 + the better of Fortitude or Willpower + Anchor, vs 14/11/8 by mindset; fanatics are immune). Health no longer triggers it.
8. **Under the Bow** (§5.7). A fail means half the distance (the middle of the next Zone), and there's no check once the shooter has loosed this round.
9. **Ready** (§5.7). It may include a 1-space step if the Move is unused. Intercept: "a foe attacks an ally next to me" redirects that attack to the readier.
10. **Bolts** (§8.1). Silent, elemental, and they leave a status by element (table in §8.1).
11. **Locked tags:** a free action that needs one costs 1 Stamina.

**Growth and names**
12. **Stars** no track can take fill one segment of that stat's Growth Bar.
13. **Renames:** First Read, Nail Down, Margin of Error.

**Dying**
14. **The dying countdown** (§5.9). At 0 Health a creature is down with **6 rounds** left. Stabilizing or healing stops the count. A hit on the downed: Graze or Minor −1 round, Major −2, Critical kills. The Adrenaline checks and getting back up are gone. Zero Composure counts down the same way.
