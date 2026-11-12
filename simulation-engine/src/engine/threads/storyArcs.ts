/**
 * Managed story arcs: a generated arc (story director: local Ollama or the procedural fallback) is
 * stored with its beats and current phase, and each beat is played out as a real thread.
 *
 *   arc created         -> thread for beat 1 (actor: the NPC the director tagged, else one on the map)
 *   beat thread resolved by a party -> next beat's thread opens; after the last beat the arc resolves
 *   beat thread runs out (expires)  -> the arc fails
 *
 * Before this, an arc wrote one event and some tags and was never seen again: nothing tracked its
 * beats, so it never advanced or ended.
 */
import { Pool, PoolClient } from "pg";
import { createThread } from "./threadEngine.js";

type Db = Pool | PoolClient;

export interface ArcBeat { phase: number; objective: string; discovery_method?: string }
export interface ManagedArc {
  id: number; arc_key: string; cell_id: number; rx: number; ry: number; z: number;
  inciting_incident: string; beats: ArcBeat[]; active_phase: number; state: "active" | "resolved" | "failed";
  thread_ids: number[]; actor_id: string | null; source: string; created_tick: number; resolved_tick: number | null;
}

let arcTableReady = false;
export async function ensureArcTable(db: Db): Promise<void> {
  if (arcTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS sim_story_arcs (
      id                SERIAL PRIMARY KEY,
      arc_key           VARCHAR(160) NOT NULL,
      cell_id           INT NOT NULL,
      rx                INT NOT NULL,
      ry                INT NOT NULL,
      z                 INT NOT NULL DEFAULT 0,
      inciting_incident TEXT NOT NULL,
      beats             JSONB NOT NULL DEFAULT '[]'::jsonb,
      active_phase      INT NOT NULL DEFAULT 1,
      state             VARCHAR(16) NOT NULL DEFAULT 'active',
      thread_ids        INT[] NOT NULL DEFAULT '{}',
      actor_id          TEXT,
      source            VARCHAR(16) NOT NULL DEFAULT 'procedural',
      created_tick      INT NOT NULL DEFAULT 0,
      resolved_tick     INT
    );
    CREATE INDEX IF NOT EXISTS idx_story_arcs_loc ON sim_story_arcs(cell_id, rx, ry);
  `);
  arcTableReady = true;
}

const lowerFirst = (s: string) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

async function currentTick(db: Db): Promise<number> {
  const r = await db.query(`SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1`);
  return Number(r.rows[0]?.tick) || 0;
}

/** Picks a real actor for the arc: the NPC the director tagged, else any NPC on that surface map. */
async function resolveActor(db: Db, cellId: number, rx: number, ry: number, preferred?: string | null): Promise<string | null> {
  const r = await db.query(`SELECT npcs FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`, [cellId, rx, ry]);
  const npcs: any[] = Array.isArray(r.rows[0]?.npcs) ? r.rows[0].npcs : [];
  if (preferred && npcs.some(n => String(n.id) === preferred)) return preferred;
  const living = npcs.find(n => n.alive !== false && !(n.tags || []).includes("beast"));
  if (living) return String(living.id);
  // Nobody on that map: the burg's own records (its paragon, else a resident), so the arc still gets a
  // thread the party can pick up. Typed ids match those people when they appear on a map.
  const records = await db.query(
    `SELECT (SELECT p.id FROM sim_paragons p WHERE p.burg_id = b.burg_id AND p.outlaw_id IS NULL ORDER BY p.id LIMIT 1) AS paragon_id,
            (SELECT d.citizen_id FROM population_demographics d WHERE d.settlement_id = b.burg_id AND d.life_stage = 'ADULT' AND d.allegiance_status = 'CIVILIAN' ORDER BY d.citizen_id LIMIT 1) AS citizen_id
     FROM sim_burg_economy b WHERE b.cell_id = $1 LIMIT 1`,
    [cellId]
  );
  const rec = records.rows[0];
  if (rec?.paragon_id) return `paragon:${rec.paragon_id}`;
  if (rec?.citizen_id) return `citizen:${rec.citizen_id}`;
  return null;
}

async function openBeatThread(db: Db, arc: ManagedArc, tick: number): Promise<number | null> {
  const beat = arc.beats[arc.active_phase - 1];
  if (!beat || !arc.actor_id) return null;
  const thread = await createThread(db, {
    question: `Will the party ${lowerFirst(beat.objective.replace(/[.!]+$/, ""))}?`,
    stakes: arc.inciting_incident,
    actor_ids: [arc.actor_id],
    cell_id: arc.cell_id, rx: arc.rx, ry: arc.ry,
    clock_max: 6,
    origin: "arc",
    rule_id: `ARC_${arc.id}_P${arc.active_phase}`,
    created_tick: tick,
    on_expire: { unrestDelta: 6, narrativeSummary: `The trail went cold before anyone acted: ${arc.inciting_incident}` },
    on_resolved_by_party: { unrestDelta: -4, wealthDelta: 80, narrativeSummary: `The party saw it through: ${beat.objective}.` },
  });
  await db.query(`UPDATE sim_story_arcs SET thread_ids = array_append(thread_ids, $1) WHERE id = $2`, [thread.id, arc.id]);
  return thread.id;
}

export interface CreateArcInput {
  cellId: number; rx: number; ry: number; z?: number;
  arcKey: string; incitingIncident: string; beats: ArcBeat[];
  /** NPC the director tagged as the arc's focus; used as the beat threads' actor if it is on the map. */
  focusNpcId?: string | null;
  source: string;
}

export async function createManagedArc(db: Db, input: CreateArcInput): Promise<{ arc: ManagedArc; threadId: number | null }> {
  await ensureArcTable(db);
  const tick = await currentTick(db);
  const beats = (input.beats || []).filter(b => b && b.objective).map((b, i) => ({ ...b, phase: i + 1 }));
  const actor = await resolveActor(db, input.cellId, input.rx, input.ry, input.focusNpcId);
  const res = await db.query(
    `INSERT INTO sim_story_arcs (arc_key, cell_id, rx, ry, z, inciting_incident, beats, active_phase, state, actor_id, source, created_tick)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'active', $8, $9, $10) RETURNING *`,
    [input.arcKey.slice(0, 160), input.cellId, input.rx, input.ry, input.z ?? 0, input.incitingIncident, JSON.stringify(beats), actor, input.source, tick]
  );
  const arc: ManagedArc = res.rows[0];
  const threadId = beats.length ? await openBeatThread(db, arc, tick) : null;
  return { arc: { ...arc, thread_ids: threadId ? [threadId] : [] }, threadId };
}

/**
 * Called when a thread resolves. If it was an arc's beat: a party success opens the next beat (or
 * completes the arc); an expiry fails the arc. Returns what happened, or null if the thread is no beat.
 */
export async function advanceArcForThread(
  db: Db, threadId: number, outcome: "party" | "expired"
): Promise<{ arcId: number; state: string; phase: number; nextThreadId: number | null } | null> {
  await ensureArcTable(db);
  const r = await db.query(`SELECT * FROM sim_story_arcs WHERE state = 'active' AND $1 = ANY(thread_ids) LIMIT 1`, [threadId]);
  const arc: ManagedArc | undefined = r.rows[0];
  if (!arc) return null;
  const tick = await currentTick(db);
  const beats: ArcBeat[] = Array.isArray(arc.beats) ? arc.beats : JSON.parse(String(arc.beats || "[]"));

  if (outcome === "expired") {
    await db.query(`UPDATE sim_story_arcs SET state = 'failed', resolved_tick = $1 WHERE id = $2`, [tick, arc.id]);
    await logArcEvent(db, arc, tick, "ARC_FAILED", `📜 [ARC FAILED] Nobody followed it up in time: ${arc.inciting_incident}`);
    return { arcId: arc.id, state: "failed", phase: arc.active_phase, nextThreadId: null };
  }
  if (arc.active_phase >= beats.length) {
    await db.query(`UPDATE sim_story_arcs SET state = 'resolved', resolved_tick = $1 WHERE id = $2`, [tick, arc.id]);
    await logArcEvent(db, arc, tick, "ARC_RESOLVED", `📜 [ARC RESOLVED] ${arc.inciting_incident} The matter is closed.`);
    return { arcId: arc.id, state: "resolved", phase: arc.active_phase, nextThreadId: null };
  }
  const next = { ...arc, beats, active_phase: arc.active_phase + 1 };
  await db.query(`UPDATE sim_story_arcs SET active_phase = $1 WHERE id = $2`, [next.active_phase, arc.id]);
  const nextThreadId = await openBeatThread(db, next, tick);
  await logArcEvent(db, arc, tick, "ARC_ADVANCED", `📜 [ARC] Next: ${beats[next.active_phase - 1]?.objective}`);
  return { arcId: arc.id, state: "active", phase: next.active_phase, nextThreadId };
}

async function logArcEvent(db: Db, arc: ManagedArc, tick: number, type: string, message: string) {
  const burg = await db.query(`SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`, [arc.cell_id]);
  await db.query(
    `INSERT INTO sim_events (tick, burg_id, cell_id, lore_date, type, message, tier) VALUES ($1, $2, $3, $4, $5, $6, 'MAJOR')`,
    [tick, burg.rows[0]?.burg_id ?? null, arc.cell_id, `Tick ${tick}`, type, message]
  );
}

export async function listArcs(db: Db, cellId?: number): Promise<ManagedArc[]> {
  await ensureArcTable(db);
  const r = cellId !== undefined
    ? await db.query(`SELECT * FROM sim_story_arcs WHERE cell_id = $1 ORDER BY id DESC LIMIT 50`, [cellId])
    : await db.query(`SELECT * FROM sim_story_arcs ORDER BY id DESC LIMIT 50`);
  return r.rows;
}
