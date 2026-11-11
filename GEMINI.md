# AGENT RULES (read this first, every session)

These rules beat everything else in this repo, including `GEMINI.md`, `SYSTEM_OVERVIEW.md` and `.agents/skills/`. If anything conflicts with them, they win, and you report the conflict.

## What we are building (one paragraph)

A living Shatterlands world that a party can play B.R.U.T.A.L. in. The world runs on its own, one day per tick. Trouble grows out of real people and real places, and it reaches the party. The players act, B.R.U.T.A.L. resolves what they do, and the world remembers the result. **Every change must serve this loop:**

> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

If you can't say which step of the loop a change serves, don't build it. Add it to `PARKING_LOT.md` instead.

## The 10 rules

1. **Plan before code.** Before editing anything, reply with:
   - the loop step the change serves;
   - the files you will touch;
   - which of these rules apply;
   - what you will *not* do.
   Wait for approval.
2. **One task per session.** Keep changes small. Commit after each working step, with a message that names the loop step.
3. **Canon and rules live in the Shatterlands folder and are read-only.** Never restate them here; point to them.
   - Lore: `C:\Users\krazy\Desktop\Shatterlands\Canon\`, starting at `00_Index_and_Precedence.md`.
   - Rules: `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` (it holds Draft v4.9; the file name is historical). For the short version, read `Rules\Table_Test_Pack\players\Rules_Digest.md`.
   - If the code disagrees with them, the code is wrong.
4. **The game system is B.R.U.T.A.L., not "Concordia".** It uses a d12 plus a stat against a Guard. Don't add Concordia mechanics, 1d20 rolls or invented stats. Port existing Concordia code to B.R.U.T.A.L. only as a planned task.
5. **The world is Ostraka, in the Shatterlands.** "Aetheria" is a retired working name, so don't use it in new code or text.
6. **Code does the math; the LLM does the words.** Dice, pools, damage and clocks are deterministic code. The LLM only:
   - narrates;
   - voices NPCs;
   - parses player intent into structured actions;
   - proposes story meaning.
   It never decides a mechanical outcome.
7. **No invented entities.** Every NPC, place, item or faction the LLM names must already exist in the database (validate the ID). Reject the output if it doesn't. No generic spawns.
8. **Simulation and view stay separate.** Simulation modules are pure: state in, state out. The renderer reads; it never writes.
9. **A rule isn't real until it's a test.** When you add or fix a rule, add a test that fails if the rule breaks (see the list below). Don't add rules to docs as prose.
10. **Remove before you add.** If a fix needs new scaffolding, first check whether something existing can be cut or simplified. Report anything you find that no loop step uses.

## Rules that must be tests (write these first)

| Rule | Test |
|---|---|
| No phantom water | Every water cell connects to ocean, a lake or a river. |
| Discrete tick movement | Agents move only during a tick, and no further than one tick's range. |
| No invented entities | Every ID in director/LLM output exists in the database. |
| Zero generic spawns | Every spawned humanoid traces to demographics, the military or the paragons. |
| Pure simulation | Simulation modules import nothing from the UI or renderer. |
| B.R.U.T.A.L. math | A d12 roll against a Guard matches the rulebook's worked examples. |
| Canon calendar and Powers | The calendar, the 12 Powers and the prisons match `Canon/04` and `Canon/02`. |

Run all tests before every commit. A failing test blocks the commit.

## Current focus: one vertical slice

Make **one burg, one thread and one play session** work end to end through the loop before widening anything. Expanding other systems (new layers, factions, weather, rendering) is frozen until the slice works.

## Known contradictions to resolve (don't paper over them)

- ~~**Database:**~~ **Resolved 2026-11-11: PostgreSQL is the only database.** `aetheria.sqlite` is untracked and the sqlite migration scripts and `better-sqlite3` are removed.
- **Dice:** the skills say "1d12 Net Margin" and `SYSTEM_OVERVIEW.md` says "1d20". The answer is B.R.U.T.A.L. (rule 4).
- **Duplication:** `GEMINI.md` describes world mechanics that duplicate Canon. Trim it to architecture, and point to Canon for the world.
