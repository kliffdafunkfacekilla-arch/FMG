/**
 * Unified storyline lifecycle, growth/escalation, caps, and Story Desk operations (Phase 9.3–9.4).
 * Single source of truth in PostgreSQL `storylines`, `storyline_actors`, and `storyline_beats`.
 */
import type { Db, Delta } from "../deltas/types.js";
import { flushStepDeltas } from "../deltas/index.js";
import { validateActorIds, type StorylineScale } from "../threads/threadEngine.js";
import { collectStoryProposals } from "./sources/collectProposals.js";
import type { StoryHookSpec, StoryProposalSpec } from "./sources/types.js";

export const STORYLINE_CAPS = {
  maxOpenPerRegionPerScale: {
    scene: 3,
    thread: 3,
    arc: 1,
    saga: 1,
  } as Record<StorylineScale, number>,
  maxOpenSagasWorld: 1,
  maxProposedPerFocus: 8,
  actorRejectionCooldownTicks: 14,
} as const;

export interface StorylineRow {
  id: number;
  parent_id: number | null;
  scale: StorylineScale;
  scope_cells: number[];
  cell_id: number;
  rx: number;
  ry: number;
  z: number;
  question: string;
  stakes: string;
  actor_ids: string[];
  clock: number;
  clock_max: number;
  state: string;
  origin: string;
  source: string;
  rule_id: string | null;
  arc_key: string | null;
  active_phase: number;
  why: string | null;
  facts: any[];
  hook: StoryHookSpec;
  rank_score: number;
  cooldown_until_tick: number | null;
  created_tick: number;
  resolved_tick: number | null;
  resolution_text: string | null;
  resolution: any;
}

function mapStorylineRow(r: any): StorylineRow {
  return {
    id: Number(r.id),
    parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
    scale: r.scale as StorylineScale,
    scope_cells: Array.isArray(r.scope_cells) ? r.scope_cells.map(Number) : [],
    cell_id: Number(r.cell_id ?? r.scope_cells?.[0] ?? 0),
    rx: Number(r.rx ?? 50),
    ry: Number(r.ry ?? 50),
    z: Number(r.z ?? 0),
    question: String(r.question),
    stakes: String(r.stakes),
    actor_ids: Array.isArray(r.actor_ids) ? r.actor_ids.map(String) : [],
    clock: Number(r.clock ?? 0),
    clock_max: Number(r.clock_max ?? 6),
    state: String(r.state),
    origin: String(r.origin || r.source || "reaction"),
    source: String(r.source || "reaction"),
    rule_id: r.rule_id ? String(r.rule_id) : null,
    arc_key: r.arc_key ? String(r.arc_key) : null,
    active_phase: Number(r.active_phase ?? 1),
    why: r.why ? String(r.why) : null,
    facts: Array.isArray(r.facts) ? r.facts : [],
    hook: r.hook && typeof r.hook === "object" ? r.hook : {},
    rank_score: Number(r.rank_score ?? 0),
    cooldown_until_tick:
      r.cooldown_until_tick !== null && r.cooldown_until_tick !== undefined ? Number(r.cooldown_until_tick) : null,
    created_tick: Number(r.created_tick ?? 0),
    resolved_tick: r.resolved_tick !== null && r.resolved_tick !== undefined ? Number(r.resolved_tick) : null,
    resolution_text: r.resolution_text ? String(r.resolution_text) : null,
    resolution: r.resolution ?? null,
  };
}

export async function isAutonomousMode(db: Db): Promise<boolean> {
  try {
    const res = await db.query(`SELECT mode FROM world_clock WHERE id = 1 LIMIT 1`);
    return !res.rows[0] || String(res.rows[0].mode || "live") === "live";
  } catch {
    return true;
  }
}

async function getCurrentTick(db: Db): Promise<number> {
  const r = await db.query(`SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1`);
  return Number(r.rows[0]?.tick || 1);
}

async function isActorOnCooldown(
  db: Db,
  actorIds: string[],
  currentTick: number
): Promise<boolean> {
  if (actorIds.length === 0) return false;
  const res = await db.query(
    `SELECT 1
     FROM storylines s
     JOIN storyline_actors sa ON sa.storyline_id = s.id
     WHERE s.state = 'rejected'
       AND s.cooldown_until_tick IS NOT NULL
       AND s.cooldown_until_tick > $1
       AND sa.entity_ref = ANY($2::text[])
     LIMIT 1`,
    [currentTick, actorIds]
  );
  return res.rows.length > 0;
}

async function countOpenInScope(
  db: Db,
  scale: StorylineScale,
  scopeCells: number[]
): Promise<number> {
  if (scale === "saga") {
    const r = await db.query(
      `SELECT COUNT(*)::int AS c FROM storylines WHERE scale = 'saga' AND state IN ('open', 'escalated')`
    );
    return Number(r.rows[0]?.c || 0);
  }
  const r = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM storylines
     WHERE scale = $1
       AND state IN ('open', 'escalated')
       AND (scope_cells && $2::int[] OR cell_id = ANY($2::int[]))`,
    [scale, scopeCells]
  );
  return Number(r.rows[0]?.c || 0);
}

/**
 * Inserts a new storyline (`proposed` or `open`) enforcing Rule 7, actor cooldowns, and scale caps.
 */
export async function createStoryline(
  db: Db,
  spec: StoryProposalSpec & { state?: "proposed" | "open"; createdTick?: number | undefined }
): Promise<StorylineRow | null> {
  const tick = spec.createdTick ?? (await getCurrentTick(db));
  const actorValidation = await validateActorIds(db, spec.actor_ids);
  if (!actorValidation.valid) {
    await db
      .query(
        `INSERT INTO world_deltas (tick, minute, source, kind, payload)
         VALUES ($1, 0, 'storyline_guard', 'rule7.rejected', $2::jsonb)`,
        [
          tick,
          JSON.stringify({
            invalidIds: actorValidation.invalidIds,
            question: spec.question,
            source: spec.source,
          }),
        ]
      )
      .catch(() => {});
    throw new Error(
      `[Storyline Guard] Rejected unknown/invented actors: [${actorValidation.invalidIds.join(", ")}] (Rule 7).`
    );
  }

  const state = spec.state ?? "proposed";
  const scopeCells = spec.scope_cells && spec.scope_cells.length > 0 ? spec.scope_cells : [spec.cell_id];

  if (await isActorOnCooldown(db, spec.actor_ids, tick)) {
    return null;
  }

  if (state === "open") {
    const cap =
      spec.scale === "saga"
        ? STORYLINE_CAPS.maxOpenSagasWorld
        : STORYLINE_CAPS.maxOpenPerRegionPerScale[spec.scale] ?? 3;
    const currentOpen = await countOpenInScope(db, spec.scale, scopeCells);
    if (currentOpen >= cap) {
      return null;
    }
  }

  const ins = await db.query(
    `INSERT INTO storylines (
       parent_id, scale, scope_cells, cell_id, rx, ry, z,
       question, stakes, actor_ids, clock, clock_max, state,
       origin, source, rule_id, arc_key, active_phase, why, facts, hook, rank_score,
       created_tick, on_expire, on_resolved_by_party
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, 0, $11, $12,
       $13, $14, $15, $16, 1, $17, $18::jsonb, $19::jsonb, $20,
       $21, $22::jsonb, $23::jsonb
     )
     RETURNING *`,
    [
      spec.parent_id ?? null,
      spec.scale,
      scopeCells,
      spec.cell_id,
      spec.rx,
      spec.ry,
      spec.z ?? 0,
      spec.question,
      spec.stakes,
      spec.actor_ids,
      spec.clock_max ?? 6,
      state,
      spec.origin ?? (spec.scale === "arc" ? "arc" : "reaction"),
      spec.source,
      spec.rule_id || null,
      spec.arc_key || null,
      spec.why,
      JSON.stringify(spec.facts || []),
      JSON.stringify(spec.hook || {}),
      spec.rank_score ?? 50,
      tick,
      JSON.stringify(spec.on_expire || {}),
      JSON.stringify(spec.on_resolved_by_party || {}),
    ]
  );

  const row = mapStorylineRow(ins.rows[0]);
  for (const ref of spec.actor_ids) {
    await db.query(
      `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
      [row.id, ref]
    );
  }
  for (const beat of spec.beats || []) {
    await db.query(
      `INSERT INTO storyline_beats (storyline_id, phase, objective, discovery, state)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, beat.phase, beat.objective, beat.discovery || null, state === "open" && beat.phase === 1 ? "open" : "pending"]
    );
  }
  return row;
}

export interface EscalationSummary {
  parentArcsCreated: number;
  arcProposalsCreated: number;
  sagaProposalsCreated: number;
}

/**
 * Checks expired threads with living actors for parent arc escalation, converging regional threads
 * for arc proposals, and converging faction arcs for world saga proposals, all bounded by STORYLINE_CAPS.
 */
export async function checkStoryEscalations(
  db: Db,
  currentTick: number
): Promise<EscalationSummary> {
  const summary: EscalationSummary = {
    parentArcsCreated: 0,
    arcProposalsCreated: 0,
    sagaProposalsCreated: 0,
  };

  // 1. Expired threads whose primary actor is still alive -> create exactly one parent arc
  const expiredRes = await db.query(
    `SELECT s.*
     FROM storylines s
     WHERE s.scale = 'thread'
       AND s.parent_id IS NULL
       AND (s.state = 'expired' OR (s.state = 'resolved' AND (s.resolution->>'expired')::boolean IS TRUE))
       AND array_length(s.actor_ids, 1) > 0
       AND EXISTS (
         SELECT 1 FROM entities e WHERE e.ref = ANY(s.actor_ids) AND e.alive = true
       )
     ORDER BY s.id ASC
     LIMIT 10`
  );

  for (const row of expiredRes.rows) {
    const actors: string[] = Array.isArray(row.actor_ids) ? row.actor_ids.map(String) : [];

    // Expand scope to region ring around cell_id
    const neighborRes = await db.query(
      `WITH target AS (SELECT center_x, center_y FROM sim_cells WHERE id = $1 LIMIT 1)
       SELECT c.id
       FROM sim_cells c, target t
       WHERE ((c.center_x - t.center_x) * (c.center_x - t.center_x) + (c.center_y - t.center_y) * (c.center_y - t.center_y)) <= 1600
       ORDER BY ((c.center_x - t.center_x) * (c.center_x - t.center_x) + (c.center_y - t.center_y) * (c.center_y - t.center_y)) ASC, c.id ASC
       LIMIT 7`,
      [Number(row.cell_id)]
    );
    const scopeCells = Array.from(
      new Set([Number(row.cell_id), ...neighborRes.rows.map((n: any) => Number(n.id))])
    );

    const openArcs = await countOpenInScope(db, "arc", scopeCells);
    if (openArcs >= STORYLINE_CAPS.maxOpenPerRegionPerScale.arc) continue;

    const arcQuestion = `Regional Escalation: ${String(row.question).replace(/^Regional Escalation:\s*/i, "")}`;
    const arcStakes = `Left unanswered (${row.stakes}), the crisis widens across ${scopeCells.length} neighboring cells.`;
    const arcIns = await db.query(
      `INSERT INTO storylines (
         scale, scope_cells, cell_id, rx, ry, z,
         question, stakes, actor_ids, clock, clock_max, state,
         origin, source, rule_id, arc_key, active_phase, why, facts, created_tick
       )
       VALUES (
         'arc', $1, $2, $3, $4, 0,
         $5, $6, $7, 0, 8, 'open',
         'arc', 'escalation', $8, $9, 1, $10, $11::jsonb, $12
       )
       RETURNING id`,
      [
        scopeCells,
        Number(row.cell_id),
        Number(row.rx ?? 50),
        Number(row.ry ?? 50),
        arcQuestion,
        arcStakes,
        actors,
        `ESCALATED_FROM_${row.id}`,
        `escalated_${row.id}`,
        `Escalated from unanswered thread #${row.id} with living actors.`,
        JSON.stringify([{ kind: "storyline", id: `storyline:${row.id}`, summary: String(row.question) }]),
        currentTick,
      ]
    );
    const arcId = Number(arcIns.rows[0].id);
    await db.query(`UPDATE storylines SET parent_id = $1 WHERE id = $2`, [arcId, Number(row.id)]);
    await db.query(
      `INSERT INTO storyline_actors (storyline_id, entity_ref, role)
       SELECT $1::bigint, unnest($2::text[]), 'actor'
       ON CONFLICT DO NOTHING`,
      [arcId, actors]
    );
    await db.query(
      `INSERT INTO storyline_beats (storyline_id, phase, objective, discovery, state)
       VALUES ($1, 1, $2, $3, 'open'), ($1, 2, $4, $5, 'pending')`,
      [
        arcId,
        `Contain the aftermath of "${String(row.question)}"`,
        "Regional rumors and witness accounts",
        `Confront the surviving principals across neighboring cells`,
        "Direct confrontation or diplomatic settlement",
      ]
    );
    summary.parentArcsCreated++;
  }

  // 2. Converging open threads sharing a verified actor -> propose an arc (capped per region) in 1 query
  const sharedRes = await db.query(
    `SELECT sa.entity_ref,
            array_agg(DISTINCT s.id ORDER BY s.id ASC) AS thread_ids,
            MIN(s.cell_id)::int AS cell_id,
            array_agg(DISTINCT s.cell_id ORDER BY s.cell_id ASC) AS cells
     FROM storylines s
     JOIN storyline_actors sa ON sa.storyline_id = s.id
     JOIN entities e ON e.ref = sa.entity_ref AND e.alive = true
     WHERE s.scale = 'thread' AND s.state IN ('open', 'escalated')
       AND NOT EXISTS (
         SELECT 1 FROM storylines s2
         JOIN storyline_actors sa2 ON sa2.storyline_id = s2.id
         WHERE s2.scale = 'arc' AND s2.state IN ('proposed', 'open', 'escalated') AND sa2.entity_ref = sa.entity_ref
       )
       AND NOT EXISTS (
         SELECT 1 FROM storylines sr
         JOIN storyline_actors sar ON sar.storyline_id = sr.id
         WHERE sr.state = 'rejected'
           AND sr.cooldown_until_tick IS NOT NULL
           AND sr.cooldown_until_tick > $1
           AND sar.entity_ref = sa.entity_ref
       )
     GROUP BY sa.entity_ref
     HAVING COUNT(DISTINCT s.id) >= 2
       AND (
         SELECT COUNT(*)::int FROM storylines s3
         WHERE s3.scale = 'arc' AND s3.state IN ('open', 'escalated')
           AND (s3.scope_cells && array_agg(DISTINCT s.cell_id) OR s3.cell_id = ANY(array_agg(DISTINCT s.cell_id)))
       ) < $2
       AND (
         SELECT COUNT(*)::int FROM storylines s4
         WHERE s4.scale = 'arc' AND s4.state = 'proposed'
           AND s4.scope_cells && array_agg(DISTINCT s.cell_id)
       ) < $3
     ORDER BY MIN(s.id) ASC
     LIMIT 1`,
    [currentTick, STORYLINE_CAPS.maxOpenPerRegionPerScale.arc, STORYLINE_CAPS.maxProposedPerFocus]
  );
  for (const g of sharedRes.rows) {
    const scopeCells: number[] = Array.isArray(g.cells) ? g.cells.map(Number) : [Number(g.cell_id)];
    const insArc = await db.query(
      `INSERT INTO storylines (
         scale, scope_cells, cell_id, rx, ry, z,
         question, stakes, actor_ids, clock, clock_max, state,
         origin, source, rule_id, why, facts, rank_score, created_tick
       )
       VALUES (
         'arc', $1, $2, 50, 50, 0,
         $3, $4, $5, 0, 8, 'proposed',
         'arc', 'escalation', $6, $7, $8::jsonb, 82, $9
       )
       RETURNING id`,
      [
        scopeCells,
        Number(g.cell_id),
        `What conspiracy connects the multiple crises around ${g.entity_ref}?`,
        `Multiple open threads (${g.thread_ids.join(", ")}) converge on ${g.entity_ref}.`,
        [String(g.entity_ref)],
        `CONVERGING_ARC_${g.entity_ref}`,
        `Open threads ${g.thread_ids.join(", ")} share actor ${g.entity_ref}.`,
        JSON.stringify(g.thread_ids.map((tid: number) => ({ kind: "storyline", id: `storyline:${tid}`, summary: `Open thread #${tid}` }))),
        currentTick,
      ]
    );
    await db.query(
      `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
      [insArc.rows[0].id, String(g.entity_ref)]
    );
    summary.arcProposalsCreated++;
  }

  // 3. Converging arcs across regions sharing a faction -> propose a world saga (capped at 1) in 1 query
  const factionArcs = await db.query(
    `SELECT c.faction_id,
            array_agg(DISTINCT s.id ORDER BY s.id ASC) AS arc_ids,
            array_agg(DISTINCT s.cell_id ORDER BY s.cell_id ASC) AS cells,
            (array_agg(s.actor_ids[1] ORDER BY s.id ASC))[1] AS lead_actor
     FROM storylines s
     JOIN sim_cells c ON c.id = s.cell_id
     WHERE s.scale = 'arc' AND s.state IN ('open', 'escalated') AND c.faction_id IS NOT NULL AND c.faction_id > 0
       AND (SELECT COUNT(*)::int FROM storylines WHERE scale = 'saga' AND state IN ('open', 'escalated')) < $1
       AND (SELECT COUNT(*)::int FROM storylines WHERE scale = 'saga' AND state = 'proposed') < 1
     GROUP BY c.faction_id
     HAVING COUNT(DISTINCT s.cell_id) >= 2
     ORDER BY MIN(s.id) ASC
     LIMIT 1`,
    [STORYLINE_CAPS.maxOpenSagasWorld]
  );
  const fa = factionArcs.rows[0];
  if (fa && fa.lead_actor) {
    const actorCheck = await validateActorIds(db, [String(fa.lead_actor)]);
    if (actorCheck.valid) {
      const cells = Array.isArray(fa.cells) ? fa.cells.map(Number) : [];
      const insSaga = await db.query(
        `INSERT INTO storylines (
           scale, scope_cells, cell_id, rx, ry, z,
           question, stakes, actor_ids, clock, clock_max, state,
           origin, source, rule_id, why, facts, rank_score, created_tick
         )
         VALUES (
           'saga', $1, $2, 50, 50, 0,
           $3, $4, $5, 0, 10, 'proposed',
           'arc', 'escalation', $6, $7, $8::jsonb, 90, $9
         )
         RETURNING id`,
        [
          cells,
          cells[0] || 0,
          `Can Faction #${fa.faction_id} survive the simultaneous crises across ${cells.length} regions?`,
          `Multiple active arcs (${fa.arc_ids.join(", ")}) strain the realm's cohesion.`,
          [String(fa.lead_actor)],
          `FACTION_SAGA_${fa.faction_id}`,
          `Arcs ${fa.arc_ids.join(", ")} span ${cells.length} regions under faction #${fa.faction_id}.`,
          JSON.stringify(fa.arc_ids.map((aid: number) => ({ kind: "storyline", id: `storyline:${aid}`, summary: `Active arc #${aid}` }))),
          currentTick,
        ]
      );
      await db.query(
        `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
        [insSaga.rows[0].id, String(fa.lead_actor)]
      );
      summary.sagaProposalsCreated++;
    }
  }

  return summary;
}

export interface DeskQuery {
  cellId: number;
  rx?: number | undefined;
  ry?: number | undefined;
  z?: number | undefined;
  tick?: number | undefined;
}

/**
 * Lists ranked Story Desk proposals for a focus tile, generating grounded proposals from consolidated
 * sources if needed while enforcing actor cooldowns and focus proposal caps.
 */
export async function listDeskProposals(
  db: Db,
  query: DeskQuery
): Promise<{
  proposals: StorylineRow[];
  openStorylines: StorylineRow[];
  tick: number;
}> {
  const tick = query.tick ?? (await getCurrentTick(db));
  const rx = query.rx ?? 50;
  const ry = query.ry ?? 50;
  const z = query.z ?? 0;

  // Load existing non-stale proposals touching this cell
  const existingPropRes = await db.query(
    `SELECT * FROM storylines
     WHERE state = 'proposed' AND ($1 = cell_id OR $1 = ANY(scope_cells))
     ORDER BY rank_score DESC, id ASC`,
    [query.cellId]
  );

  let proposals = existingPropRes.rows.map(mapStorylineRow);
  if (proposals.length < 3) {
    const candidates = await collectStoryProposals(db, { cellId: query.cellId, rx, ry, z, tick });
    for (const c of candidates) {
      if (proposals.length >= STORYLINE_CAPS.maxProposedPerFocus) break;
      const dup = proposals.some(
        (p: StorylineRow) => p.rule_id && c.rule_id && p.rule_id === c.rule_id && p.source === c.source
      );
      if (dup) continue;
      // Avoid proposing the exact rule_id+actor if already open
      const openDup = await db.query(
        `SELECT 1 FROM storylines
         WHERE state IN ('open', 'escalated')
           AND ($1 = cell_id OR $1 = ANY(scope_cells))
           AND rule_id = $2
         LIMIT 1`,
        [query.cellId, c.rule_id || ""]
      );
      if (openDup.rows.length > 0) continue;

      const inserted = await createStoryline(db, { ...c, state: "proposed", createdTick: tick });
      if (inserted) {
        proposals.push(inserted);
      }
    }
  }

  proposals.sort((a: StorylineRow, b: StorylineRow) => b.rank_score - a.rank_score || a.id - b.id);

  const openRes = await db.query(
    `SELECT * FROM storylines
     WHERE state IN ('open', 'escalated') AND ($1 = cell_id OR $1 = ANY(scope_cells))
     ORDER BY scale DESC, id ASC`,
    [query.cellId]
  );

  return {
    proposals: proposals.slice(0, STORYLINE_CAPS.maxProposedPerFocus),
    openStorylines: openRes.rows.map(mapStorylineRow),
    tick,
  };
}

export interface DeskDecisionInput {
  decision: "accept" | "edit" | "reject";
  question?: string | undefined;
  stakes?: string | undefined;
  clock_max?: number | undefined;
  hook?: StoryHookSpec | undefined;
  acceptAfterEdit?: boolean | undefined;
  tick?: number | undefined;
  minute?: number | undefined;
}

export interface DeskDecisionResult {
  storyline: StorylineRow;
  hooksPlaced: {
    overlayCount: number;
    eventLogged: boolean;
    dialogueApplied: boolean;
    deltaCounts: Record<string, number>;
  };
}

/**
 * Applies a Story Desk decision (`accept`, `edit`, or `reject`). Accepting promotes the proposal to
 * `open` and places grounded map hooks via deltas (`overlay.add`, `event.log`, and entity dialogue).
 * Rejecting sets an actor cooldown window so the rejected hook does not immediately return.
 */
export async function decideProposal(
  db: Db,
  proposalId: number,
  input: DeskDecisionInput
): Promise<DeskDecisionResult> {
  const tick = input.tick ?? (await getCurrentTick(db));
  const minute = input.minute ?? 0;

  const curRes = await db.query(`SELECT * FROM storylines WHERE id = $1 LIMIT 1`, [proposalId]);
  if (curRes.rows.length === 0) {
    throw new Error(`[StoryDesk] Proposal #${proposalId} not found.`);
  }
  let row = mapStorylineRow(curRes.rows[0]);

  if (input.decision === "reject") {
    const cooldownUntil = tick + STORYLINE_CAPS.actorRejectionCooldownTicks;
    const upd = await db.query(
      `UPDATE storylines
       SET state = 'rejected',
           resolved_tick = $1,
           cooldown_until_tick = $2
       WHERE id = $3
       RETURNING *`,
      [tick, cooldownUntil, proposalId]
    );
    return {
      storyline: mapStorylineRow(upd.rows[0]),
      hooksPlaced: { overlayCount: 0, eventLogged: false, dialogueApplied: false, deltaCounts: {} },
    };
  }

  const nextQuestion = input.question ?? row.question;
  const nextStakes = input.stakes ?? row.stakes;
  const nextClockMax = input.clock_max ?? row.clock_max;
  const nextHook: StoryHookSpec = { ...row.hook, ...(input.hook || {}) };

  const shouldAccept = input.decision === "accept" || input.acceptAfterEdit === true;
  if (!shouldAccept) {
    const upd = await db.query(
      `UPDATE storylines
       SET question = $1, stakes = $2, clock_max = $3, hook = $4::jsonb
       WHERE id = $5
       RETURNING *`,
      [nextQuestion, nextStakes, nextClockMax, JSON.stringify(nextHook), proposalId]
    );
    return {
      storyline: mapStorylineRow(upd.rows[0]),
      hooksPlaced: { overlayCount: 0, eventLogged: false, dialogueApplied: false, deltaCounts: {} },
    };
  }

  const openCount = await countOpenInScope(db, row.scale, row.scope_cells.length ? row.scope_cells : [row.cell_id]);
  const cap = row.scale === "saga" ? STORYLINE_CAPS.maxOpenSagasWorld : STORYLINE_CAPS.maxOpenPerRegionPerScale[row.scale] ?? 3;
  if (row.state === "proposed" && openCount >= cap) {
    throw new Error(`[StoryDesk] Cannot accept ${row.scale} #${proposalId}: region cap (${cap}) reached.`);
  }

  const upd = await db.query(
    `UPDATE storylines
     SET question = $1,
         stakes = $2,
         clock_max = $3,
         hook = $4::jsonb,
         state = 'open'
     WHERE id = $5
     RETURNING *`,
    [nextQuestion, nextStakes, nextClockMax, JSON.stringify(nextHook), proposalId]
  );
  row = mapStorylineRow(upd.rows[0]);

  if (row.scale === "arc") {
    await db.query(
      `UPDATE storyline_beats SET state = 'open' WHERE storyline_id = $1 AND phase = 1 AND state = 'pending'`,
      [row.id]
    );
  }

  // Place hooks through deltas: clue overlay + rumour event.log (+ dialogue hook on tile entity)
  const deltas: Delta[] = [];
  const clueName = nextHook.clueName || `Hook Clue: ${nextQuestion.slice(0, 48)}`;
  const clueDesc = nextHook.clueDescription || nextStakes;
  deltas.push({
    kind: "overlay.add",
    cellId: row.cell_id,
    rx: row.rx,
    ry: row.ry,
    z: row.z,
    x: 128,
    y: 128,
    objectRef: nextHook.targetObjectRef ?? null,
    change: "placed",
    payload: {
      storylineId: row.id,
      dialogueLine: nextHook.dialogueLine || null,
      prop: {
        id: `prop_story_clue_${row.id}`,
        name: clueName,
        pos: [128, 128],
        tags: ["clue", "inspectable", "story_hook"],
        hp: 10,
        description: clueDesc,
        storylineId: row.id,
      },
    },
    tick,
    minute,
    source: "story_desk",
  });

  const burgRes = await db.query(`SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`, [row.cell_id]);
  const burgId = burgRes.rows[0]?.burg_id !== undefined ? Number(burgRes.rows[0].burg_id) : undefined;
  const rumorMsg = nextHook.rumor || `Rumor spreads regarding "${nextQuestion}": ${nextStakes}`;
  deltas.push({
    kind: "event.log",
    tick,
    type: "STORY_HOOK_RUMOR",
    message: rumorMsg,
    tier: "MINOR",
    burgId,
    cellId: row.cell_id,
  });

  const flushRes = await flushStepDeltas(db, "story_desk", tick, deltas, minute);

  // Stamp dialogue line directly onto cached entity in sim_sector_layers if tile is already cached
  let dialogueApplied = false;
  if (nextHook.dialogueLine && row.actor_ids.length > 0) {
    const layerRes = await db.query(
      `SELECT npcs FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4 LIMIT 1`,
      [row.cell_id, row.rx, row.ry, row.z]
    );
    if (layerRes.rows[0] && Array.isArray(layerRes.rows[0].npcs)) {
      const npcs = layerRes.rows[0].npcs.map((n: any) => {
        const matches = row.actor_ids.some((aid) => String(n.entity_ref || "") === aid || String(n.id) === aid);
        if (!matches) return n;
        dialogueApplied = true;
        const notes = Array.isArray(n.memoryNotes) ? [...n.memoryNotes] : [];
        if (!notes.includes(nextHook.dialogueLine)) notes.push(nextHook.dialogueLine);
        return { ...n, dialogueHook: nextHook.dialogueLine, memoryNotes: notes };
      });
      if (dialogueApplied) {
        await db.query(
          `UPDATE sim_sector_layers SET npcs = $1::jsonb WHERE cell_id = $2 AND rx = $3 AND ry = $4 AND z_layer = $5`,
          [JSON.stringify(npcs), row.cell_id, row.rx, row.ry, row.z]
        );
      }
    }
  }

  return {
    storyline: row,
    hooksPlaced: {
      overlayCount: flushRes.counts.map_overlays || 0,
      eventLogged: (flushRes.counts.sim_events || 0) > 0,
      dialogueApplied,
      deltaCounts: flushRes.counts,
    },
  };
}

export async function autoAcceptTopProposal(
  db: Db,
  query: DeskQuery
): Promise<DeskDecisionResult | null> {
  const { proposals, tick } = await listDeskProposals(db, query);
  const top = proposals[0];
  if (!top) return null;
  return decideProposal(db, top.id, { decision: "accept", tick });
}
