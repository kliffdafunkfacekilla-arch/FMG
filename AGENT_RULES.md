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
   - Rules: `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` (it holds **Draft v5.0**; the file name is historical; §5.0 is the whole combat loop; the engine implements **Draft v5.0** per `RULES_TARGET_v5.0.md`). For the short version, read `Rules\Table_Test_Pack\players\Rules_Digest.md`.
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
| The loop works end to end | One burg, one thread and one play session go through every loop step (`testVerticalSlice`). |
| A day replays exactly | The same world state and tick give the same day (`testTickReplay`). |
| A tick stays cheap | Each tick step stays within its query budget (`testTickReplay`). |

Run all tests before every commit. A failing test blocks the commit.

## Current focus: widen from a certified loop

**The vertical slice is done (2026-11-24).** `testVerticalSlice` runs Burg 1 (Excelsis Citadel), one thread and one play session through the whole loop, and B.R.U.T.A.L. Draft v5.0 is complete (`RULES_TARGET_v5.0.md`). The `Ostraka_full.map` datasets (`PARKING_LOT.md`, Phase B) are wired into the tick, each with its own test.

Widening is allowed again, but every change must:

1. **Name its loop step** (above). If it serves none, it goes to `PARKING_LOT.md`.
2. **Keep the loop green:** `testVerticalSlice` and every other suite pass.
3. **Keep the tick reproducible and cheap:** `testTickReplay` passes, including the query budgets, and a day stays under the 1.5 s autoplay interval (`node dist/scripts/benchTick.js 3`). Raise a budget only with a reason in the commit message.
4. **Prove a new dataset matters:** a system that reads new data gets a test showing it changes an outcome.

**Still parked:** the items in `PARKING_LOT.md` ("Parked Items") and the parked story designs in `STORY_AUDIT.md` ("Still open"). Unpark one at a time, only when the user chooses it, and record the choice here as the new current focus.

## Session time policy

- The single `world_clock` row owned by the simulation worker is the only authoritative world clock (`tick` and `minute_of_day`).
- Opening a party play session pauses background macro ticks (`mode = 'session'`), holding the map steady while scenes advance `minute_of_day` (minutes, hours, or 6-second encounter rounds).
- Every time accumulated `minute_of_day` crosses `1,440`, the clock runs one macro day (firing any accumulated scheduled events for that day) before continuing. Closing the session restores `mode = 'live'`.

## Known contradictions to resolve (don't paper over them)

- ~~**Database:**~~ **Resolved 2026-11-11: PostgreSQL is the only database.** The old SQLite file, the sqlite migration scripts and `better-sqlite3` are removed.
- ~~**Dice:**~~ **Resolved 2026-11-24:** Docs (`SYSTEM_OVERVIEW.md`, `OSTRAKA_SYSTEM_ROADMAP.md`, `player_experience_audit.md`) now specify B.R.U.T.A.L. Draft v5.0 (`d12 + stat` against a Guard, pointing to `BRUTAL_Rulebook_v3.md`), with retired names and dice removed.
- ~~**Duplication:**~~ **Resolved 2026-11-24:** `GEMINI.md` is trimmed to architecture and rules only and points to `C:\Users\krazy\Desktop\Shatterlands\Canon\` and `Rules\`.
