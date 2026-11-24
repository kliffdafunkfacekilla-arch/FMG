# Living World Build Guide

**The full instructional roadmap from today's build to the target design. Written 2026-11-24 at commit `2d15459` (tick 1 of the rebuilt world).**

This document replaces the earlier draft of the same name. It has five parts:

- **Part A:** what you are building and why the foundations change.
- **Part B:** the rules and warnings that apply to every task.
- **Part C:** the phases, in order. Every task has instructions, code and SQL sketches, tests, checks, rollback notes and warnings.
- **Part D:** the agent porting checklist.
- **Part E:** a glossary.

`AGENT_RULES.md` still governs every session: plan before code, one task per session, a test for every rule, remove before you add, and the widening gates. Paths are under `simulation-engine/src/` unless they start with the repo root.

---

# Part A. The target

## A.1 What the finished system does

1. **Macro.** The whole world simulates itself in the background, one day at a time, whether anyone is watching or not. It keeps running across server restarts and catches up any time it missed.
2. **Meso.** Focusing on a region (a cell and its neighbouring cells) runs that region in hours instead of days. The convoys, patrols, herds and workers in it are real entities, and what happens to them counts.
3. **Micro.** Focusing on one tile of the region gives a battle map. Every person, creature and notable object on it is a real entity that you can talk to, fight, move, steal or destroy. Combat runs in rounds of about 6 seconds.
4. **Story.** A single context builder gathers the focus area, the region around it, the world picture, the history and the party into one pack. Story sources use it to propose beats and storylines of four sizes: a scene, a thread, an arc and a saga. You choose which ones run.
5. **Consequences.** What the players actually do is recorded as actions. Storylines resolve from those actions, and the results are applied to the world through the same change path the simulation itself uses, so the world runs on from the changed state.

## A.2 The five foundation changes (and why)

| # | Today | Target | Why it's needed |
|---|---|---|---|
| F1 | A person can exist in 5 unlinked places: `population_demographics`, `sim_paragons`, `sim_agents`, `sim_npc_instances` and JSON copies in `sim_sector_layers.npcs` | **One entity registry.** Every named thing has one ID, used at every level of detail. | A battle-map death currently can't reach the citizen record: `BrutalGM.ts` ~2396 updates `sim_npc_instances`, where map NPCs have no row. |
| F2 | Agents run SQL inside their logic (477 query calls in `engine/agents`) | **Snapshot → pure step → deltas → one writer.** Every layer changes the world through the same delta types. | The simulation and play must change the world in identical ways. It also makes in-memory "what-if" previews possible, and lets the code be tested without a database. |
| F3 | Ticks run from a `setInterval` inside `api/observerRouter.ts`; autoplay resets on restart; play uses no world time | **A world-clock worker.** The clock is saved, runs at several rates (macro day, meso hour, micro round), and has a queue of scheduled events and session modes. | "Lives in the background by itself" requires the simulation to run outside the web server and survive restarts. |
| F4 | Meso is a throwaway in-memory copy (`RegionalInstance`); battle maps freeze NPC copies into JSON | **Levels of detail are views of one world.** Terrain is regenerated from a seed, entities and changed objects are stored as rows, player changes are overlays, and promote/demote moves entities between levels. | Detail must be produced from the world and folded back into it. Nothing may exist only in a cache. |
| F5 | About 8 overlapping story modules; threads pinned to one tile; preset outcomes; a narrow director context | **One storyline model with four sizes,** one context builder and outcomes computed from actions | Storylines of different sizes, grounded in everything around the focus, resolved by what players do. |

Supporting changes:

| # | Change | Why it's needed |
|---|---|---|
| S1 | Numbered migrations instead of `schemaPatches.ts` | Every phase changes the schema, and those changes need order and rollback. |
| S2 | A `facts.ts` module and a tag registry instead of 1,001 loose `#Tag` strings | So that one place decides what "famine" means. |
| S3 | Split the giant files when you touch them: `SectorMapGenerator.ts` 3,697 lines, `Dashboard.tsx` 3,106, `dmRouter.ts` 2,853, `BrutalGM.ts` 2,735 | Large mixed-purpose files are where bugs and duplicated logic hide. |

**Keep these, because they're already right:**

- PostgreSQL;
- per-agent savepoints;
- seeded, reproducible days (`engine/rng.ts`, `testTickReplay`);
- rolled-back test isolation (`scripts/testIsolation.ts`);
- the rule-7 validator (`directorBridge.validateDirectorMutations`, `threadEngine.validateActorIds`);
- `engine/llm.ts` and the "the LLM only writes words" boundary;
- the pure B.R.U.T.A.L. v5.0 engine;
- per-step query budgets.

## A.3 Target module layout

```
simulation-engine/src/
  db/
    migrations/0001_baseline.sql … NNNN_*.sql   (S1)
    migrate.ts                                    (S1)
  worker/
    simWorker.ts        world clock, tick loop, command queue, advisory lock   (F3)
    commands.ts         start/stop/speed/fast-forward/focus/session commands
  engine/
    rng.ts              (exists) seeded randomness
    deltas/             types.ts, validate.ts, apply.ts, log.ts            (F2)
    entities/           registry.ts, refs.ts, resolve.ts                   (F1)
    lod/                promote.ts, demote.ts, focus.ts                    (F4)
    facts/              facts.ts, tagRegistry.ts                           (S2)
    clock/              clock.ts, scheduler.ts                             (F3)
    macro/              one folder per ported agent: load.ts, step.ts      (F2)
    meso/               region.ts, mesoStep.ts                             (F4)
    micro/              encounter.ts, overlays.ts, mapCast.ts              (F4)
    story/              context.ts, storylines.ts, sources/*.ts, resolve.ts (F5)
    rules/              (today's pure B.R.U.T.A.L. engine files)
  api/                  thin routes only: read, or enqueue a command (S3)
  observer/             dashboard, split by panel (S3)
```

You don't need to move existing files into this layout up front. New code goes here, and old code moves when a task ports it.

## A.4 Runtime flow, once finished

```
            ┌──────────── sim-worker (one process, advisory lock) ────────────┐
commands ─▶ │ world_clock ─▶ macro day:  for each agent: load → step → deltas │
(API/UI)    │                 └ flush deltas per agent (in its savepoint)     │
            │ focused regions ─▶ meso hour sub-steps ─▶ deltas                │
            │ open encounter  ─▶ micro rounds (BrutalGM) ─▶ deltas            │
            │ scheduled_events due ─▶ deltas                                  │
            │ story sources ─▶ proposals ─▶ (you accept) ─▶ storylines        │
            └──────────────────────────────┬──────────────────────────────────┘
                                           ▼
                    PostgreSQL: entities, cohorts, burgs, cells, overlays,
                    storylines, actions, world_deltas, world_clock
                                           ▲
            API server: reads the state, enqueues commands, serves the dashboard
```

---

# Part B. Rules for every task

## B.1 Task workflow
1. **Plan** (rule 1). Write down the loop step, the files you'll touch, the rules that apply and what you won't do. Get approval.
2. **Branch:** `git switch -c <phase>-<task>`, for example `p2-deltas-core`.
3. **Back up the world before anything that migrates data:**
   `pg_dump -U postgres -Fc -f backups/pre-<task>.dump postgres`. Restore with `pg_restore -U postgres -c -d postgres backups/pre-<task>.dump`. Put `backups/` in `.gitignore`.
4. **Write the test first** whenever the task adds a rule or moves state (W2).
5. **Implement.**
6. **Verify:**
   ```
   cd simulation-engine
   npm test                                   # every suite (rebuilds dist/)
   node dist/scripts/benchTick.js 3           # speed, query counts, replay
   $env:TICK_PROFILE="1"; node dist/scripts/benchTick.js 2; $env:TICK_PROFILE=""
   ```
7. **Commit** with the loop step in the message (rule 2), merge, push.

## B.2 Warnings (read these before each phase)

| # | Warning | What to do about it |
|---|---|---|
| W1 | **Determinism.** Any new step can break exact replay. | Draw randomness only from `Math.random()` inside the tick's seeded context, or from `rng.ts` helpers. Never use `ORDER BY RANDOM()`; use `sqlShuffle(key)` / `sqlChance(key, p)`. Give every iterated query an `ORDER BY`. No `Date.now()` in simulation code. Extend `testTickReplay` to every new step. |
| W2 | **Conservation.** Moving things between layers can create or destroy people, food or money. | For each boundary, write a test that totals are unchanged. The model is `testSettlement`, which checks that the parent lost exactly what the satellite gained. |
| W3 | **Lost updates.** Two writers of one row in one step overwrite each other. | **Per-agent rule:** inside one agent's step, a table is written *either* by its leftover SQL *or* by its deltas, never both. Flush deltas at the end of each agent's step, so that the next agent sees them (today's ordering is kept). |
| W4 | **Performance.** Detail costs time. | Every new step gets a query budget in `testTickReplay`. The macro day stays under the 1.5 s autoplay interval, and meso and micro steps get their own budgets. Re-run `benchTick` after every task. |
| W5 | **Invented entities (rule 7).** A bigger context gives the LLM more names to misuse. | Validate every ID and name the LLM outputs against the entity registry, and reject the rest. Never loosen this to "make it work". |
| W6 | **Saves and caches.** Migrations and generator changes can invalidate saved worlds and cached maps. | Version every generator (`TERRAIN_VERSION` and its siblings). Keep `resetWorld` working through every phase. Keep old tables readable through views until their last reader has moved. |
| W7 | **Big tables.** `population_demographics` (~320k rows) and `sim_cells` (58k) lock during `ALTER`. | Run heavy migrations with autoplay off. Build indexes with `CREATE INDEX CONCURRENTLY`, outside a transaction. Backfill in batches of about 10k rows. |
| W8 | **Half-migrations.** Two representations of the same thing drift apart. | Use the adapter pattern: the new representation is the source of truth, the old one is a view or a write-through copy, and a test checks that they agree until the old one is deleted. |
| W9 | **Scope creep.** Each phase is big. | Finish a phase's "done when" before starting the next. New ideas go in `PARKING_LOT.md`. |
| W10 | **Time desync.** The world clock, sessions and meso sub-steps must add up. | One clock, owned by the worker. Every layer advances it; nothing keeps private time. The session policy is written in `AGENT_RULES.md` (task 3.4). |

## B.3 The phases at a glance

| Phase | Name | Depends on | Size | Playable result |
|---|---|---|---|---|
| 0 | Safety net | — | S | Backups and a baseline you can compare against |
| 1 | Migrations (S1) | 0 | S | Schema changes in order, with rollback |
| 2 | Delta layer (F2) | 1 | M (core) + L (porting track) | One change path for the whole world |
| 3 | World clock worker (F3) | 1, 2 | M | The world lives on its own across restarts |
| 4 | Entity registry (F1, part 1) | 1 | M | Every named thing has one ID |
| 5 | Close the loop | 2, 4 | M | Play changes the world |
| 6 | Facts and tags (S2) | 2 | M (track) | One meaning per condition |
| 7 | Story context builder (F5, part 1) | 4 | M | Grounded story beats |
| 8 | Cohorts, notables, promote/demote (F1 part 2, F4 part 1) | 4, 5 | L | No double-booked people; zoom without loss |
| 9 | Storyline model and story desk (F5, part 2) | 7 | L | Storylines of every size; you choose what runs |
| 10 | Real meso layer (F4, part 2) | 3, 8 | L | A living region at hour resolution |
| 11 | Actions → consequences, standing, previews | 2, 9 | L | Different choices give different worlds, previewed first |
| 12 | Micro completion and file splits (S3) | 5, 8 | M | Everything on the map is real; clean GM layers |
| 13 | Quality, saves, scale | all | M | Metrics, branches, several focus areas |

Phases 2 (agent porting), 6 and 12 (file splits) are also **ongoing tracks**: do one item per session, alongside the other phases.

---

# Part C. Phases and tasks

Each task has a **loop step**, **files**, **steps**, **tests**, **done when**, **rollback** and **warnings**.

## Phase 0. Safety net (size S)

### 0.1 A baseline to compare against
- **Loop step:** none (infrastructure).
- **Steps:**
  1. `git tag baseline-2026-11-24`, then `pg_dump -U postgres -Fc -f backups/baseline.dump postgres`.
  2. Save a fingerprint: run `node dist/scripts/benchTick.js 3 > backups/baseline-bench.txt`. That records the timings, query counts and replay result.
  3. Add a `db:backup` script to `package.json`: `pg_dump -U postgres -Fc -f backups/$(date).dump postgres`. On Windows use a small `scripts/backup.cjs`.
- **Done when:** a restore from `baseline.dump` followed by `npm test` passes.

### 0.2 A "golden day" regression test
- **Steps:** add `scripts/testGoldenDay.ts`. It runs the next day in isolation and compares the fingerprint from `tickFingerprint.ts` against a stored expected value for a fixed seed and a fixed world. Re-record it with `--record` **only** when a change is meant to alter outcomes, and say why in the commit.
- **Why:** `testTickReplay` proves that a day is reproducible. The golden day also proves that a refactor (Phase 2) didn't change *what* happens.
- **Warning:** the golden value is tied to a world state. Store the seed and tick with it, and re-record after `resetWorld`.

---

## Phase 1. Numbered migrations (S1, size S)

### 1.1 A migration runner
- **Loop step:** tick (infrastructure).
- **Files:** new `db/migrate.ts`, new `db/migrations/`; `server.ts` line 52 (`applySchemaPatches` call); `engine/masterOrchestrator.ts` (`schemaPatched`).
- **Steps:**
  1. Create the version table:
     ```sql
     CREATE TABLE IF NOT EXISTS schema_version (
       version     INT PRIMARY KEY,
       name        TEXT NOT NULL,
       applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
     );
     ```
  2. `migrate(db)` reads `db/migrations/*.sql` in number order and applies each missing version in its own transaction. Files that need `CONCURRENTLY` are marked `-- no-transaction` on their first line and run outside a transaction.
  3. Write `0001_baseline.sql` from the current `schemaPatches.ts` statements (all `IF NOT EXISTS`, so they're safe on the live world).
  4. Replace the `applySchemaPatches` calls with `migrate`, in `server.ts`, the orchestrator and every test or script that calls `applySchemaPatches`: `grep -rn applySchemaPatches src`.
  5. `resetWorld.ts` creates the base tables and then runs `migrate`.
  6. Delete `schemaPatches.ts` once nothing imports it (rule 10).
- **Tests:** `testMigrations.ts` checks that a fresh reset and the live world end at the same `MAX(version)`, and that running `migrate` twice does nothing.
- **Done when:** every suite passes, and `schema_version` shows `0001`.
- **Rollback:** `git revert`. The baseline migration only uses `IF NOT EXISTS`, so the database needs no rollback.
- **Warning:** the copies of `applySchemaPatches` in test scripts exist because of the savepoint problem (a patch applied inside a run gets rolled back with it). Keep calling `migrate` *before* the first savepoint.

### 1.2 Down migrations, for the big phases
- **Steps:** for every later migration that creates or changes tables, add a matching `NNNN_*.down.sql`. `migrate.ts --down N` rolls back to version N. It's for development; in production, restore a backup.

---

## Phase 2. The delta layer (F2)

### 2.1 Core types, validation and the writer (size M)
- **Loop step:** consequences written back.
- **Files:** new `engine/deltas/types.ts`, `validate.ts`, `apply.ts`, `log.ts`; migration `0002_world_deltas.sql`.
- **Steps:**
  1. Define the delta union. Start with the kinds that today's agents already perform:
     ```ts
     export type Delta =
       | { kind: 'burg.adjust'; burgId: number; food?: number; wealth?: number; unrest?: number; health?: number; crime?: number; rawMaterials?: number }
       | { kind: 'burg.set'; burgId: number; fields: Partial<BurgRow> }          // for absolute values
       | { kind: 'cell.adjust'; cellId: number; ecoHealth?: number; ecoMax?: number; ecoBlight?: number; ecoPrey?: number; ecoPredators?: number }
       | { kind: 'cell.setFaction'; cellId: number; factionId: number | null }
       | { kind: 'citizen.status'; citizenId: number; status: 'DECEASED' | 'DEPARTED' | string; cause?: string; motivation?: string }
       | { kind: 'citizen.move'; citizenId: number; settlementId: number; homeCellId: number }
       | { kind: 'agent.update'; agentId: number; fields: Partial<AgentRow> }
       | { kind: 'agent.remove'; agentId: number; reason: string }
       | { kind: 'tags.add'; target: TagTarget; tags: string[] }                    // cell / npc / burg
       | { kind: 'event.log'; tick: number; type: string; message: string; tier: 'MINOR' | 'MAJOR' | 'CRITICAL'; burgId?: number; cellId?: number; factionId?: number; outlawId?: number }
       | { kind: 'thread.open'; spec: ThreadSpec }
       | { kind: 'scheduled.add'; at: ClockTime; event: ScheduledEventSpec };      // used in Phase 3
     ```
     Keep `adjust` (relative) separate from `set` (absolute). Relative changes from several sources add up; absolute ones conflict.
  2. `validate(deltas, db)` checks that IDs exist (one `WHERE id = ANY($1)` query per kind), clamps values to the ranges the agents already use (unrest 0–100, and so on), and rejects unknown kinds. It returns `{ ok, rejected[] }`.
  3. `apply(deltas, db)`:
     - group by table;
     - **merge `adjust` deltas for the same row by summing** them;
     - write each table once with `UPDATE … FROM (SELECT unnest($1::int[]) …)`, the pattern already used in `burgOperationsAgent.ts`;
     - insert events in one multi-row insert.

     Return per-table row counts.
  4. Migration `0002`:
     ```sql
     CREATE TABLE world_deltas (
       id BIGSERIAL PRIMARY KEY,
       tick INT NOT NULL,
       minute INT NOT NULL DEFAULT 0,     -- minute of day, for Phase 3
       source TEXT NOT NULL,              -- 'agent:weather', 'micro:BrutalGM', 'story:resolve', …
       kind TEXT NOT NULL,
       payload JSONB NOT NULL
     );
     CREATE INDEX idx_world_deltas_tick ON world_deltas(tick);
     ```
     `log(deltas, source)` writes every applied delta here, except high-volume kinds you list as unlogged (`cell.adjust` from ecology, for example).
  5. Add delta retention to the `eventRetention` step: keep 1 game month in full, and older days only for the logged kinds.
- **Tests:** `testDeltas.ts`:
  - adjusts add up;
  - a `set` after an `adjust` wins;
  - an invalid burg ID is rejected;
  - values are clamped;
  - a batch of 1,000 deltas costs fewer than 10 queries.
- **Done when:** the tests pass. Nothing uses the layer yet.
- **Warning:** don't model every column up front. Add delta kinds as the agents are ported, and remove ones nothing emits (rule 10).

### 2.2 Wire deltas into the tick
- **Files:** `engine/masterOrchestrator.ts` (the `step()` helper).
- **Steps:** each step gets an emitter, and its deltas are applied **at the end of that step, inside its savepoint**:
  ```ts
  await step('weather', async (emit) => {
    const snap = await loadWeather(client, tick);
    for (const d of stepWeather(snap, ctx)) emit(d);   // pure
  });
  // inside step(): after fn() resolves → validate → apply → log, then RELEASE SAVEPOINT
  ```
  A failure during validate or apply rolls back that agent only, as it does today.
- **Tests:** a test agent that emits one delta of each kind, and a check that the next agent sees the result.
- **Warning:** W3. Today agents read the results of earlier agents during the same tick, and the per-step flush keeps that working. Don't batch all agents' deltas to the end of the tick until every agent is pure; see 2.4.

### 2.3 Porting track: one agent per session (size L in total)
Follow the checklist in **Part D**. The order below runs from simplest to most coupled; each later agent depends on lessons from the earlier ones.

| # | Agent | Tables it writes today | Notes |
|---|---|---|---|
| 1 | `encounterAgent.ts` | `sim_agents` | A single statement; practise the pattern here |
| 2 | `weatherAgent.ts` | `sim_burg_economy`, `sim_cells`, `sim_chaos_zones`, `sim_events`, `sim_weather_fronts` | Already optimised; `testWeatherHealth` exists |
| 3 | `trophicEcologyAgent.ts` | `sim_burg_economy`, `sim_cells`, `sim_events` | Pure numbers over cells |
| 4 | `calendarAgent.ts` | `sim_calendar`, `sim_burg_economy` | Must stay a required step |
| 5 | `marketAgent.ts` | `sim_markets`, `sim_commodity_prices` | Weekly |
| 6 | `factionCollapse.ts` | `sim_cells`, `sim_diplomacy`, `sim_events` | Small |
| 7 | `chaosFlowAgent.ts` | `sim_cells`, `sim_cell_tags`, `sim_chaos_flows`, `sim_chaos_zones`, `sim_agents`, `sim_player_character`, `sim_player_mutations` | Touches player tables, so check that with care |
| 8 | `grindCanyonAgent.ts` | `sim_grind_canyons`, `sim_fringe_lairs`, `sim_outlaw_factions`, `sim_burg_economy` | |
| 9 | `wardenAgent.ts`, `cultistAgent.ts`, `mandateAgent.ts` | `sim_agents`, `population_demographics`, `sim_sacred_groves`, `sim_cells`, `sim_burg_economy` | `persistAgentStates` already batches; turn it into `agent.update` deltas |
| 10 | `cartelAgent.ts` (1,360 lines) | many | Split by cartel type while porting |
| 11 | `factionPlanningAgent.ts`, `ai/factionActions.ts` | `sim_factions`, `sim_faction_units`, `sim_diplomacy`, `sim_cells`, `sim_burg_economy` | Actions return deltas instead of writing |
| 12 | `interFactionTradeEngine.ts` (1,258) | trade, shipments, stockpiles, citizens | Convoys become entities in Phase 8 |
| 13 | `paragonPlanningAgent.ts` | `sim_paragons`, `sim_burg_economy`, `sim_events` | |
| 14 | `backgroundDirector.ts`, `autonomousDramaAgent.ts`, `cultureReligionAgent.ts`, `npcRoutineAgent.ts` | story and NPC tables | Their story output becomes `thread.open` deltas; story sources move to Phase 9 |
| 15 | `burgExpansionAgent.ts` | burgs, citizens, roads, cells | `settleSatellite` becomes deltas plus a conservation test |
| 16 | `burgOperationsAgent.ts` (1,507) | the most tables | Last: split it into production, food, health, population ledger and infrastructure as you port |

- **Done when (track):** `engine/agents` makes only reads in `load()`, and `testGoldenDay` is unchanged except where a commit says otherwise.
- **Warning:** porting must not change behaviour. If `testGoldenDay` changes, you either found a bug (fix it in its own commit and re-record) or introduced one.

### 2.4 Later: snapshot-wide, in-memory days
Once every agent is pure, a day can run entirely in memory: load one snapshot, run every step over a working copy, and apply everything once. That's what makes Phase 11's previews cheap. Don't start it before 2.3 is finished.

---

## Phase 3. World clock worker (F3, size M)

### 3.1 The clock table and commands
- **Loop step:** tick.
- **Migration `0003_world_clock.sql`:**
  ```sql
  CREATE TABLE world_clock (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tick INT NOT NULL,                 -- mirrors MAX(sim_calendar.tick)
    minute_of_day INT NOT NULL DEFAULT 0,
    running BOOLEAN NOT NULL DEFAULT false,
    speed_ms INT NOT NULL DEFAULT 1500, -- wall-clock ms per macro day in live mode
    mode TEXT NOT NULL DEFAULT 'live',  -- 'live' | 'session' | 'paused'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE sim_commands (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL,                -- 'start','stop','speed','fast_forward','focus','unfocus','session_open','session_close'
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    done_at TIMESTAMPTZ, result JSONB
  );
  CREATE TABLE scheduled_events (
    id BIGSERIAL PRIMARY KEY,
    due_tick INT NOT NULL, due_minute INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL, payload JSONB NOT NULL,
    created_tick INT NOT NULL, fired_tick INT
  );
  CREATE INDEX idx_sched_due ON scheduled_events(due_tick, due_minute) WHERE fired_tick IS NULL;
  ```

### 3.2 The worker process
- **Files:** new `worker/simWorker.ts`, `worker/commands.ts`; `package.json` (`"worker": "node dist/worker/simWorker.js"`); `api/observerRouter.ts`.
- **Steps:**
  1. At start: `SELECT pg_try_advisory_lock(424242)`. If that fails, another worker is running, so exit with a clear message.
  2. Loop:
     - read and execute pending `sim_commands`, in order;
     - if `running` and `mode = 'live'`, run `executeMasterTick()`, then sleep for `speed_ms` minus the tick's duration (never below 0);
     - repeat.
  3. **Catch-up:** `fast_forward { days }` runs N ticks back to back and reports progress in `result`.
  4. **Scheduled events:** at the start of each tick (and each meso sub-step later), fire the due rows as deltas and set `fired_tick`.
  5. In the API:
     - `POST /autoplay` inserts a `start` or `stop` command;
     - `/status` reads `world_clock` and the latest `TickResult` (save it to a `last_tick` row or to `world_clock`);
     - remove the `setInterval` and the in-process `tickInProgress` lock from `observerRouter.ts`.
  6. Run the worker and the server together. During development use two terminals, or a `concurrently` script; later, a Windows service or `pm2`.
- **Tests:** `testWorker.ts` (in isolation):
  - a `start` command sets `running`;
  - a `fast_forward 3` runs 3 days;
  - a second worker can't get the lock;
  - a scheduled event due on the next tick fires exactly once.
- **Done when:**
  - restarting the server **and** the worker resumes the running world;
  - `/status` answers instantly during a tick;
  - autoplay survives a restart.
- **Rollback:** keep the old `setInterval` path behind `SIM_WORKER=off` for one release, then delete it.
- **Warnings:**
  - **Two workers:** the advisory lock is the protection, so never skip it.
  - **Runaway catch-up:** cap `fast_forward` (for example at 589 days, one year) and make it stoppable.
  - **Never tick from the HTTP process.** Anything that ticks outside the worker breaks determinism (W1) and the lock.

### 3.3 Turn "every N ticks" checks into scheduled events (ongoing)
- **Steps:** when porting an agent (2.3), timed *future* consequences become `scheduled.add` deltas instead of modulo checks: a convoy arrival, a ritual completion, a siege ending. Pure cadences ("weekly market") can stay as modulo checks.
- **Warning:** scheduled events must be part of the replay fingerprint. Add `scheduled_events` to `tickFingerprint.ts`.

### 3.4 Session time policy
- **Steps:**
  1. Decide the policy and write it into `AGENT_RULES.md`. **Recommended:** a session holds macro ticks for the whole world (`mode = 'session'`), and play advances `minute_of_day` (scenes advance by minutes or hours, encounters by rounds). When `minute_of_day` passes 1,440, run the macro tick, which fires whatever accumulated, then carry on.
  2. Add the `session_open` and `session_close` commands.
- **Done when:** an 8-hour session moves the clock by 8 hours, and the 24th hour triggers exactly one macro day.
- **Warning:** the alternative, keeping the world live during play, makes the map change under the players and breaks W1 during encounters. If you want it, slow the speed instead.

---

## Phase 4. Entity registry (F1, part 1, size M)

### 4.1 The registry table
- **Loop step:** all of them (foundation).
- **Migration `0004_entities.sql`:**
  ```sql
  CREATE TABLE entities (
    id BIGSERIAL PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,          -- stable external id: 'citizen:123', 'paragon:5', 'agent:7', 'npcinst:npc_outlaw_1_1', 'squad:12:militia:0', 'object:…'
    kind TEXT NOT NULL,                -- 'person','group','creature','structure','object','place'
    name TEXT NOT NULL,
    alive BOOLEAN NOT NULL DEFAULT true,
    lod TEXT NOT NULL DEFAULT 'macro', -- 'macro' | 'meso' | 'micro'
    cell_id INT, rx INT, ry INT, z INT, x INT, y INT,   -- finest known location
    source_table TEXT NOT NULL,        -- where its detail lives today
    source_id TEXT NOT NULL,
    created_tick INT NOT NULL DEFAULT 0,
    died_tick INT
  );
  CREATE INDEX idx_entities_loc ON entities(cell_id, rx, ry) WHERE alive;
  CREATE INDEX idx_entities_source ON entities(source_table, source_id);
  ```
- **Why `ref`:** the code already speaks typed IDs (`threadEngine.validateActorIds` matches `^(paragon|citizen|agent|faction):(\d+)$`; `npcIsActor` maps `npc_paragon_12` → `paragon:12` and `npc_citizen_345` → `citizen:345`). The registry adopts that scheme, so existing threads and story rows keep working unchanged.

### 4.2 Backfill and keep it in sync
- **Files:** new `engine/entities/registry.ts`, `refs.ts`; the agents that create or remove paragons, agents and NPC instances.
- **Steps:**
  1. Backfill one entity for every row of `sim_paragons`, `sim_agents`, `sim_npc_instances` and `sim_player_character`. **For citizens, only notables:** records referenced by any `sim_threads.actor_ids`, `sim_story_arcs.actor_id`, any cached map NPC (`npc_citizen_*`), or any `population_demographics` row whose status or tags were changed by the simulation (not by generation). Leave the rest for Phase 8.
  2. `ensureEntity(ref)` creates the entity on demand. Call it from map generation (every NPC placed on a map), from thread creation, and from `settleSatellite`.
  3. Write-through: wherever an agent creates or deletes a paragon, agent or NPC instance, call `registry.create` or `registry.markDead`. After Phase 2, these become `entity.create` / `entity.die` deltas.
- **Tests:** `testEntityRegistry.ts`:
  - every `actor_ids` entry in `sim_threads` resolves to an entity;
  - every cached map NPC has `entity_ref`;
  - deleting a paragon through the agent marks its entity dead.

### 4.3 Map NPCs carry `entity_ref`
- **Files:** `engine/maps/SectorMapGenerator.ts` (~810, 838, 886, 1040) and `engine/maps/WardDistrict.ts` (~408), where NPC IDs are built.
- **Steps:** every generated NPC gets `entity_ref`: `citizen:<id>`, `paragon:<id>`, `squad:<burg>:<type>:<n>`, or `creature:<cell>:<rx>:<ry>:<n>`. Generated creatures and squads get registry rows too: kind `group` or `creature`, with their source.
- **Done when:** `validateActorIds` and `npcIsActor` resolve through the registry (`refs.ts`), and the per-table special cases in `threadEngine.ts` ~110–143 are deleted.
- **Warning:** keep the old `npc_*` IDs on the maps. Other code (the renderer, `BrutalGM`) uses them; the registry maps old to new.

---

## Phase 5. Close the loop (size M)

### 5.1 Battle-map deaths reach the world
- **Loop step:** consequences written back.
- **Files:** `engine/rpg/BrutalGM.ts` ~2371–2410 (where NPC death is handled and saved).
- **Steps:**
  1. When an NPC dies, look up its `entity_ref` and emit deltas through `engine/deltas` (source `micro:BrutalGM`):
     - **citizen:** `citizen.status DECEASED` with a cause, plus the population ledger:

       | Situation | Delta |
       |---|---|
       | The record stands for more than 1 person (`unit_size > 1`) | Decrement `unit_size` and the burg counter by 1; the record stays alive |
       | `unit_size = 1` | Mark the record `DECEASED` |

     - **paragon:** mark it dead (`entity.die`), remove it from office, and log an event;
     - **squad:** `burg.adjust military_forces[type] −1`;
     - **agent:** `agent.remove`;
     - **NPC instance:** the existing update.
  2. Make it **idempotent:** before applying, check `entities.alive`. A retried turn must not kill twice.
  3. Keep the existing `sim_npc_instances` update for outlaws.
- **Tests:** `testMicroWriteBack.ts`, in isolation:
  - kill a citizen, a paragon and a squad member on a fixture map;
  - assert the macro records changed;
  - run a tick and assert nothing came back to life.
- **Done when:** the test passes and `testVerticalSlice` still passes.
- **Warning:** a citizen record is a group of about 10 people (`unit_size`). Killing the named face kills **one** person, not the record. Phase 8 removes this awkwardness.

### 5.2 Object changes and overlays
- **Migration `0005_map_overlays.sql`:**
  ```sql
  CREATE TABLE map_overlays (
    id BIGSERIAL PRIMARY KEY,
    cell_id INT NOT NULL, rx INT NOT NULL, ry INT NOT NULL, z INT NOT NULL,
    x INT, y INT,
    object_ref TEXT,                    -- the prop id or entity ref it changes
    change TEXT NOT NULL,               -- 'destroyed','burnt','opened','moved','looted','placed'
    payload JSONB NOT NULL DEFAULT '{}',
    tick INT NOT NULL, minute INT NOT NULL DEFAULT 0, source TEXT NOT NULL
  );
  CREATE INDEX idx_overlays_tile ON map_overlays(cell_id, rx, ry, z);
  ```
- **Steps:**
  1. In `BrutalGM.ts` (props destroyed or looted, ~2367) and in the Tag Matrix interaction results, emit an `overlay.add` delta (add the kind).
  2. Map economically meaningful props to burg deltas. Granary burnt: `burg.adjust food −X`. Treasury looted: `wealth`. Forge wrecked: an infrastructure level. Keep the mapping in one table, `engine/micro/propEconomy.ts`, so there's one place to tune it.
  3. When a map is loaded (`api/dmRouter.ts` `/sector_layer`), apply the tile's overlays after generating or loading it.
- **Tests:** burn a fixture building, regenerate the tile (force the version), check it's still burnt, and check the burg's food fell once.
- **Warning:** overlays have to be small. One row per changed object; never write a map snapshot into an overlay.

### 5.3 Reopened maps re-sync their cast
- **Files:** `api/dmRouter.ts` (the cached-layer branch near the existing "town surface cached empty" rule), plus a new `engine/micro/mapCast.ts`.
- **Steps:**
  1. On load, compare the map's NPC `entity_ref`s with the registry:
     - **dead or departed:** remove them from the map; add a corpse prop if they died here (`map_overlays`);
     - **residents who arrived since:** place them using the generator's own placement function;
     - **NPCs with party history:** keep them in place (Phase 11's `actions`, or the GM memories, show who has history).
  2. Save the refreshed cast.
- **Done when:** a citizen killed by famine (a macro tick) disappears from their tile on the next visit.
- **Warning:** never re-sync while an encounter is open on that tile; only on load.

### 5.4 Session time
Implement the policy from 3.4 in the party-session endpoints (`dmRouter.ts` `/party_session/*`).

**Phase 5 checkpoint (play it):** open a tile, kill a guard, burn the granary and loot the treasury. Close the map and run 5 days. Then check:
- the citizen record shows the death;
- the burg's food and wealth reflect the damage;
- the reopened map still shows the burnt building and the missing guard.

---

## Phase 6. Facts and the tag registry (S2, ongoing track, size M)

### 6.1 `facts.ts`
- **Files:** new `engine/facts/facts.ts`.
- **Steps:**
  1. Define derived conditions in one place, each a pure function of state:
     ```ts
     export const facts = {
       famine:       (b: BurgRow) => b.food < (b.pop_null + b.pop_attuned) * FAMINE_FOOD_PER_HEAD,
       grainShortage:(b: BurgRow) => !facts.famine(b) && b.food < (b.pop_null + b.pop_attuned) * SHORTAGE_FOOD_PER_HEAD,
       martialLaw:   (b: BurgRow) => b.unrest > 60,
       blockaded:    (cellTags: string[]) => cellTags.some(t => t.includes('Blockade') || t.includes('Embargo')),
       // …
     };
     export function factTags(b: BurgRow, …): string[]   // derived tags for presentation and the LLM
     ```
  2. Replace each duplicated threshold as you meet it. The first one is `directorBridge.ts` ~207–217, including the hard-coded `#GuildDominance`.
- **Warning:** the thresholds today differ between files. Pick one value per fact, record any behaviour change in the commit, and re-record the golden day.

### 6.2 A registry test for every tag
- **Files:** `engine/rpg/TagRegistry.ts` (exists), new `scripts/testTagRegistry.ts`.
- **Steps:** scan the source for `'#Tag'` literals (1,001 distinct today), and fail on any tag the registry doesn't declare. Declare the existing ones in bulk first, in groups (derived, history, motive, reaction), then remove unused ones over time.
- **Done when:** every new tag needs a registry entry, and derived tags are never stored. Stored tags are history only (`#DockStrikeFailed`).

---

## Phase 7. Story context builder (F5, part 1, size M)

### 7.1 `buildStoryContext(focus, party, budget)`
- **Loop step:** trouble → hook.
- **Files:** new `engine/story/context.ts`; it replaces `engine/rpg/directorBridge.ts` `buildDirectorInputPayload` (~181–289) and the GM's own context assembly in `BrutalGM.ts`, including the `sim_gm_memories` read at ~2836.
- **Output (every item carries its ID):**
  ```ts
  interface StoryContext {
    focus:   { tile; entities: EntityBrief[]; objects: ObjectBrief[]; overlays: OverlayBrief[] };   // micro
    region:  { burgs: BurgBrief[]; openStorylines: StorylineBrief[]; convoys; borders; wildlife };   // meso
    world:   { date; season; wars; diplomacy; marketExtremes; chaosFlows; factionFinances };        // macro
    history: { recentEvents; resolvedHere: StorylineBrief[]; deltasTouching: DeltaBrief[] };
    party:   { characters: PartyBrief[]; recentActions; standing; gmMemories: string[] };
    meta:    { tokenEstimate; dropped: { section: string; count: number }[] };
  }
  // EntityBrief = { ref, name, role, want, flaw, lineWontCross, tags, relationshipsToParty }
  ```
- **Steps:**
  1. Write one loader per section, each with a fixed number of queries (W4). Sources:

     | Section | Tables |
     |---|---|
     | focus | entities, the map layer, `paragonMotives` |
     | region | neighbouring cells by geometry; `sim_threads` / storylines by scope; `sim_trade_shipments`; `sim_faction_borders` |
     | world | `sim_calendar`, `sim_diplomacy`, `sim_markets`, `sim_chaos_flows`, `sim_factions` |
     | history | `sim_events`, resolved storylines, `world_deltas` |
     | party | `sim_player_character`, `sim_gm_memories`, actions and standing (empty until Phase 11) |

  2. **Rank:** score each item = w_dist·proximity + w_actor·(shares actors with open storylines or the party) + w_recency + w_stakes. Keep the weights in one config object.
  3. **Budget:** estimate about 4 characters per token. Fill sections in priority order (focus > party > region > history > world) until the budget is used, and record what was dropped in `meta`.
  4. **Serialise** to short labelled lines with IDs for the LLM (`render(ctx)`). Never send raw JSON dumps.
- **Tests:** `testStoryContext.ts`, using a fixture tile with a neighbouring burg that has an open thread, a war, a party action and an NPC with a want. Assert that all four appear, that the token estimate is within budget, and that no ID in the pack is missing from the registry.
- **Done when:** the director, the aftermath writer and GM narration all take `StoryContext`, and the off-grid defaults (`rx = 112, ry = 112` at `directorBridge.ts` ~183) are gone.
- **Warnings:**
  - **W5:** validate every ID the model outputs against the registry, not just the tile's assets. More context means more names to misuse.
  - **Small models:** `gemma2:9b` and `llama3.2` work well up to about 6–8k tokens. Measure beat quality at 2k, 4k and 6k with `runOllamaPartySession.ts`, and pick the smallest budget that works.
  - **No mechanics from the model** (rule 6). The context informs the words, never the numbers.

---

## Phase 8. Cohorts, notables, promote/demote (F1 part 2, F4 part 1, size L)

### 8.1 Population cohorts
- **Loop step:** tick.
- **Migration `0006_population_cohorts.sql`:**
  ```sql
  CREATE TABLE population_cohorts (
    burg_id INT NOT NULL,
    species TEXT NOT NULL,
    profession TEXT NOT NULL,
    age_band TEXT NOT NULL,             -- 'CHILD','ADULT','ELDER'
    spark_tier TEXT NOT NULL,
    is_null BOOLEAN NOT NULL,
    allegiance TEXT NOT NULL DEFAULT 'CIVILIAN',
    count INT NOT NULL CHECK (count >= 0),
    PRIMARY KEY (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
  );
  ```
- **Steps:**
  1. Backfill from `population_demographics`. For each living, non-notable record, add `unit_size` to the matching cohort. Notables (4.2's rule) stay as records **and** count as 1 in their cohort's total (see W2 below).
  2. **Conservation invariant:** for every burg, `SUM(cohorts.count) + living notables = pop_null + pop_attuned`, within the rounding the ledger already allows. Write `testCohorts.ts` **before** the backfill.
  3. Move the readers one at a time, behind an adapter (`engine/entities/population.ts`):
     - workforce counts (`burgOperationsAgent.ts` ~262–310 `workforce`);
     - births, deaths and departures (the record ledger);
     - `settleSatellite` (moves cohort counts plus any notables);
     - cultist, zealot and warden recruitment (promotes a notable out of a cohort);
     - `tagBurgCitizens` (tags notables only, or promotes some).
  4. When nothing reads non-notable rows any more, delete them in batches (W7). `population_demographics` remains the detail table for notables.
- **Done when:** `testCohorts`, `testPopulationLedger`, `testCitizenEconomy`, `testSettlement` and `testGoldenDay` pass (the golden day re-recorded with a written explanation), and the table holds thousands of rows, not about 320k.
- **Warnings:**
  - **Names already used** in event text or GM memories belong to people who must stay notables. Before deleting, scan `sim_events.message` and `sim_gm_memories.summary` for record names, and promote every match.
  - **Wants, flaws and limits** come from fields (`paragonMotives.ts` `deriveCitizenMotives` reads temper, instinct, profession and allegiance), so they regenerate exactly. Names and childhood backgrounds don't: they're stored random text. That's why the previous warning matters.
  - **Biggest migration in the plan.** Take a backup (B.1.3), and keep the adapter until every suite passes on cohorts alone.

### 8.2 Promote a notable out of a cohort
- **Files:** new `engine/lod/promote.ts`.
- **Steps:** `promoteFromCohort(burgId, filter, slotKey)`:
  1. decrement the cohort by 1;
  2. create a `population_demographics` record and an entity;
  3. generate name, temper, instinct and childhood from a stream seeded by `hash(burgId, cohortKey, slotKey)`, so that the same request gives the same person;
  4. derive motives with `deriveCitizenMotives`.

  Use it wherever a view or a story needs a face: map placement, story casting, recruitment.
- **Tests:** promoting twice with the same slot key returns the same person and decrements only once. Promoting with a new slot key gives a different person.

### 8.3 Focus and unfocus
- **Files:** new `engine/lod/focus.ts`, `demote.ts`.
- **Steps:**
  - `focus(area, lod)` sets `entities.lod` for everything located in the area and promotes the faces the view needs.
  - `unfocus(area)`:
    1. fold the area's meso and micro deltas since focus into a summary (`world_deltas` already holds them);
    2. return untouched promoted people to their cohort (count +1, record deleted);
    3. keep anyone the party interacted with or a storyline references.
- **Tests:** `testLodRoundTrip.ts`, where focus → unfocus with no activity leaves `tickFingerprint` identical, and focus → kill 1 → unfocus leaves the population one lower and nothing else changed.

---

## Phase 9. Storyline model and the story desk (F5, part 2, size L)

### 9.1 One storyline model
- **Migration `0007_storylines.sql`:**
  ```sql
  CREATE TABLE storylines (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES storylines(id),
    scale TEXT NOT NULL,                     -- 'scene','thread','arc','saga'
    scope_cells INT[] NOT NULL,              -- area it covers
    question TEXT NOT NULL, stakes TEXT NOT NULL,
    clock INT NOT NULL DEFAULT 0, clock_max INT NOT NULL DEFAULT 6,
    state TEXT NOT NULL DEFAULT 'proposed',  -- 'proposed','open','escalated','resolved','expired','rejected'
    source TEXT NOT NULL,                    -- 'reaction','drama','world','director','gm'
    rule_id TEXT, created_tick INT NOT NULL, resolved_tick INT,
    resolution JSONB                         -- computed in Phase 11
  );
  CREATE TABLE storyline_actors (storyline_id BIGINT REFERENCES storylines(id), entity_ref TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (storyline_id, entity_ref));
  CREATE TABLE storyline_beats  (id BIGSERIAL PRIMARY KEY, storyline_id BIGINT REFERENCES storylines(id), phase INT NOT NULL, objective TEXT NOT NULL, discovery TEXT, hook JSONB, state TEXT NOT NULL DEFAULT 'pending');
  ```
- **Steps:**
  1. Migrate `sim_threads` rows to `scale = 'thread'`.
  2. Migrate `sim_story_arcs` to `scale = 'arc'`, with their beat threads as children.
  3. Replace `sim_threads` with a **view** over `storylines`, so existing readers keep working (W8). Move the writers first: `threadEngine.createThread`, `storyArcs.createManagedArc`, `advanceThreadClocks`, `resolveThreadByParty`.
- **Done when:** `testThreadActors`, `testThreadClocks`, `testStoryPipeline`, `testQuestChainResolution`, `testAutonomousDrama` and `testVerticalSlice` pass with storylines as the source of truth.

### 9.2 Story sources (consolidating the eight modules)
- **Steps:**
  1. Each existing generator becomes a **source** under `engine/story/sources/`. A source returns *proposals* (`state = 'proposed'`, with their supporting facts as IDs); it doesn't write storylines directly:
     - `narrativeReactionEngine` (reaction rules);
     - `backgroundDirector`;
     - `autonomousDramaAgent`;
     - `worldThreads`;
     - `directorBridge` (the LLM);
     - the GM.
  2. Remove `WhatElseStoryEngine.ts` code paths that nothing calls (its legacy stubs were retired on 2026-11-24).
  3. Fold `questChainEngine.ts` into `engine/story/resolve.ts`.
- **Warning:** autonomous mode, with nobody accepting, must keep working: automatic sources may still open `scale = 'thread'` storylines directly when `world_clock.mode = 'live'` and nobody is playing, which is today's behaviour.

### 9.3 Growth and escalation
- **Steps:**
  - An expired thread with its actors still alive escalates: create a parent `arc` with the same actors, higher stakes and a wider scope (the region's cells).
  - Several open threads in a region with actors in common propose an `arc`. Several arcs across regions involving the same faction propose a `saga`.
  - Build on the existing grudge and arc-escalation logic from commit `e2b6962`.
- **Caps (config):** open storylines per region per scale, for example 3 threads, 1 arc, and 1 saga in the world, plus a cooldown per actor.
- **Tests:** an expired thread produces exactly one parent arc, and caps stop a flood of proposals.

### 9.4 The story desk
- **Files:** new `api/storyRouter.ts` (thin), a dashboard panel in `observer/`.
- **Steps:**
  1. `GET /api/story/desk?cell=&rx=&ry=` returns the proposals for the focus area. Each comes with its sources (facts, entities, past events) and a short "why".
  2. `POST /api/story/desk/:id` accepts, edits or rejects. Accepting places hooks through deltas: a dialogue line on an entity, a clue on an object (an overlay), a rumour (`event.log`).
  3. The AI party can auto-accept the top-ranked proposal.
- **Done when:** for a focused tile you see 2–3 grounded proposals, accepting one puts a hook you can find on the battle map, and rejecting one stops it from coming back for that actor during the cooldown.

---

## Phase 10. Real meso layer (F4, part 2, size L)

### 10.1 A region is the focus cell plus its ring
- **Files:** `regional/RegionalInstance.ts` (1,071 lines), `api/regionalRouter.ts` (`/neighbor`, `/live`, `/start`, `/stop`); new `engine/meso/region.ts`.
- **Steps:**
  1. `buildRegion(focusCell)` finds the neighbouring cells (shared borders from `sim_cells` geometry, or `cell_dist2` below a threshold).
  2. Generate each cell's 100×100 grid with the existing generator, keyed by `(seed, cell, version)`, and stitch the borders: roads and rivers must line up.
  3. Starting a region issues a `focus` command to the worker (Phase 3). The worker owns the regions, not the API process.
- **Warning:** cap active regions (for example 3) and the cells per region (for example 7) to keep within W4.

### 10.2 Meso agents are entities
- **Steps:** replace `spawnAgents()` (~846) with entity-backed agents:
  - convoys from `sim_trade_shipments` and the route graph;
  - roaming `sim_agents`;
  - facility workers promoted from cohorts (8.2);
  - wildlife groups sized by the cell's `eco_prey` / `eco_predators` (`group` entities that hold a count).

  Delete the class's private random-number generator (~852); use the seeded tick stream.

### 10.3 Hourly sub-steps that change things
- **Files:** new `engine/meso/mesoStep.ts`, a pure function per the Phase 2 pattern.
- **Steps:**
  1. While a region is focused, the worker runs 24 hourly sub-steps per day, advancing `minute_of_day` by 60 each time. Interactions emit deltas:

     | Event | Deltas |
     |---|---|
     | Predation | `cell.adjust ecoPrey −` |
     | An ambush on a convoy | lost cargo, an `event.log`, and possibly a `thread.open` |
     | A patrol meets a cultist | a fight, or an arrest |
     | Farm work | harvest progress |

  2. **Avoid double counting:** the macro step must **skip** the economy and ecology of focused cells for that day, or reconcile them against the meso results. Pick one and test it.
  3. **Calibration:** one meso day's totals per cell must match the macro formula for that cell within tolerance (for example ±5%), when no special events occur.
- **Tests:**
  - `testMesoCalibration.ts`: focus a quiet region for a day and compare against an unfocused replay.
  - `testMesoReplay.ts`: identical when replayed.

### 10.4 Persistence
- **Steps:** a region is rebuilt from `(seed, cells, version)` + entities + overlays + `scheduled_events`. Delete the in-memory-only state, so a worker restart rebuilds the same region.

**Phase 10 checkpoint:** focus a region and watch a day. A convoy travels, gets ambushed, and the ambush becomes a proposal on the story desk. After unfocusing, the macro data shows the lost cargo.

---

## Phase 11. Actions, computed consequences, standing, previews (size L)

### 11.1 The action ledger
- **Migration `0008_actions.sql`:**
  ```sql
  CREATE TABLE actions (
    id BIGSERIAL PRIMARY KEY,
    tick INT NOT NULL, minute INT NOT NULL,
    actor_ref TEXT NOT NULL,               -- player character entity
    verb TEXT NOT NULL,                    -- 'attack','persuade','steal','free','burn','bribe','deliver',…
    target_ref TEXT, location JSONB NOT NULL,
    method TEXT, result TEXT NOT NULL,     -- from the rules engine: success / fail / margin
    storyline_id BIGINT, witnesses TEXT[] NOT NULL DEFAULT '{}'
  );
  ```
- **Steps:** after B.R.U.T.A.L. resolves an action, `BrutalGM` writes one row from the structured action it already has: the intent parse plus the rules result.

### 11.2 Resolution from actions
- **Files:** `engine/story/resolve.ts` (from 9.2).
- **Steps:**
  1. Each storyline type declares **answer conditions** over actions and state. "Will the reeve be deposed?" resolves on `entity.die(reeve)`, on a `persuade`/`bribe` success against the council, or on a burg fact.
  2. Consequences are computed from **who did what to whom, and who saw it**:
     - standing changes for the target's faction;
     - unrest and wealth changes in the burg;
     - grudge tags on witnesses;
     - rumours spreading across the region (`event.log`, or a scheduled event a few days later);
     - follow-up proposals.
  3. Remove the preset `on_resolved_by_party` / `on_expire` payloads for each storyline type once it has a computed resolution. Keep the expiry payloads only as the "nobody acted" path.
- **Tests:** resolve the same fixture thread **diplomatically** and **violently**, and assert visibly different delta sets. Both are pinned by the test.

### 11.3 Standing and reputation
- **Migration `0009_standing.sql`:**
  ```sql
  CREATE TABLE standing (
    subject_ref TEXT NOT NULL,   -- entity or 'faction:<id>'
    party_ref TEXT NOT NULL,     -- player character entity
    value INT NOT NULL DEFAULT 0,
    reasons JSONB NOT NULL DEFAULT '[]',
    PRIMARY KEY (subject_ref, party_ref)
  );
  ```
- **Steps:** action consequences emit `standing.adjust` deltas. The context builder (Phase 7) includes standing, so NPCs remember the party.

### 11.4 "What-if" previews
- **Steps:** `POST /api/story/preview { proposalId | resolutionOptions[], days }` runs the next N days for each option:
  - **before 2.4 is done:** in a rolled-back transaction, using the `benchTick` / `isolateTest` tooling;
  - **after 2.4:** purely in memory.

  It returns the difference per option ("in 7 days: Moft unrest +18; the Gilded Compass gains the salt route"), computed from `tickFingerprint`-style summaries.
- **Warnings:**
  - a preview must **never** write anything: always run it inside a transaction that's rolled back, or in memory;
  - cap previews at about 10 days and 3 options, the macro layer only (about 0.7 s per day);
  - previews use the same seed as the real day, so the preview of the option you choose matches what then happens. That's a feature; keep it.

---

## Phase 12. Micro completion and file splits (S3, size M, ongoing track)

### 12.1 Notable objects are entities
- **Steps:** objects that the economy or a story cares about (treasuries, granaries, gates, altars, cages) become `object` entities, linked to burg stocks or infrastructure through `propEconomy.ts` (5.2). Decoration stays procedural.

### 12.2 The encounter clock
- **Steps:** an open encounter advances `world_clock.minute_of_day` by one round (about 6 s) per round. Meso agents near the tile act every N rounds (alarms, reinforcements, fleeing witnesses) through scheduled events. Keep the B.R.U.T.A.L. engine pure and wrap it; never modify it (rule 6).

### 12.3 Split `BrutalGM.ts` along the rule-6 line
- **Steps:** turn `engine/rpg/BrutalGM.ts` (2,735 lines) into four parts:
  1. **intent:** LLM parse into a structured action;
  2. **resolve:** the pure rules engine;
  3. **narrate:** LLM text from the context pack and the result;
  4. **consequences:** deltas and an `actions` row.

  `testStrictPartyLlm`, `testBrutalGMVisual`, `testTTRPGRules` and `testVerticalSlice` must pass after each part.

### 12.4 Split `dmRouter.ts`, `SectorMapGenerator.ts` and `Dashboard.tsx`
- **Steps:**
  - **`dmRouter.ts` (2,853 lines):** routes become thin. Map loading moves to `engine/micro/`, party sessions to `engine/story/` or the worker commands.
  - **`SectorMapGenerator.ts` (3,697 lines):** split by map kind (town ward, outlying, canyon, facility). It already has no database access; keep it that way.
  - **`Dashboard.tsx` (3,106 lines):** one component per panel.
- **Rule:** split only the part a task touches, and never mix a split with a behaviour change in one commit.

---

## Phase 13. Quality, saves, scale (size M)

- **13.1 Story health metrics.** These are queries over storylines, actions and the validator logs, shown on a dashboard panel:
  - proposals accepted / rejected / auto-opened per scale;
  - resolved vs expired;
  - share from people vs places;
  - rule-7 rejection rate;
  - storylines the party engaged with.
- **13.2 Saves and branches.** A save is a custom-format `pg_dump` of the world tables plus `world_clock`. A branch restores the dump into a new database. Thanks to replay, "what if we had sided with the reeve" is cheap. Store saves outside the repo.
- **13.3 Several focus areas.** Allow 2–3 focused regions at once (several parties, or one party plus a watched war), each with its own meso budget, and test their interaction at shared borders.
- **13.4 Scale gates.** With everything above in place, the macro day stays under 1.5 s on the full map. Re-baseline the query budgets in `testTickReplay` after each phase, with a reason in the commit message.

---

# Part D. Agent porting checklist (Phase 2.3, one agent per session)

1. **Read** the agent and list every table it reads and writes. The writers are in the Phase 2.3 table; re-check them with `grep -nE "(UPDATE|INSERT INTO|DELETE FROM) " engine/agents/<agent>.ts`.
2. **Snapshot:** write `load(client, tick)`. A few large reads, **all ordered** (W1), returning plain objects.
3. **Step:** move the logic into `step(snapshot, ctx) → Delta[]`.
   - **No I/O.** Use `Math.random()` (seeded in the tick) or `rng.ts` helpers.
   - **In-loop reads of your own writes become working copies.** If the old code updated a burg and read it back later in the same loop, update the snapshot object in memory as you emit the delta.
   - **Order-dependent SQL picks** (`ORDER BY sqlShuffle(...) LIMIT 1`) become picks over the snapshot, made with a seeded shuffle.
4. **Emit** through the step's emitter (2.2). The writer applies at the end of the step.
5. **Delete** the old SQL writes (W3: never both).
6. **Test:**
   - a unit test of `step()` with a hand-made snapshot (no database);
   - `testTickReplay` (identical);
   - `testGoldenDay` (unchanged, or re-recorded with a reason);
   - query budget lowered to the new count.
7. **Bench:** `benchTick` before and after; the step should be the same speed or faster.
8. **Commit:** `tick: port <agent> to snapshot → step → deltas`.

---

# Part E. Glossary

| Term | Meaning |
|---|---|
| **Macro / meso / micro** | World (days, all cells) / region (hours, a focus cell and its ring) / battle map (rounds, one tile) |
| **Entity** | Anything that can be named, met, killed, owned or moved. It has one ID (`ref`) across every layer. |
| **Cohort** | A count of similar unnamed people in a burg (species × profession × age × spark × allegiance) |
| **Notable** | An individual entity promoted out of a cohort because someone needed them; kept forever |
| **Promote / demote** | Move an entity to finer or coarser detail. Demote folds detailed history back into macro state. |
| **Delta** | One change to the world, such as `burg.adjust`, `citizen.status` or `event.log`. Every layer changes the world only through deltas. |
| **Overlay** | A small row recording a player-caused change to a map, applied on top of regenerated terrain |
| **Storyline** | One model for a scene, thread, arc or saga, with a parent, an area, actors, beats, a clock and a state |
| **Story source** | Anything that proposes storylines: reaction rules, drama, world events, the LLM director, the GM |
| **Context pack** | The ranked, size-limited `StoryContext` that every story source and narration step reads |
| **Golden day** | A stored fingerprint of one day's results, used to prove a refactor didn't change behaviour |
| **Replay** | Running the same day from the same state; it must give an identical world (`testTickReplay`) |
