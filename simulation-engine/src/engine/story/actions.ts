/**
 * Action Ledger & Standing queries (Phase 11.1 & 11.3).
 */
import type { Db } from "../deltas/types.js";

export interface ActionLocation {
  cellId: number;
  rx?: number | undefined;
  ry?: number | undefined;
  z?: number | undefined;
  x?: number | undefined;
  y?: number | undefined;
}

export interface ActionRecord {
  id: number;
  tick: number;
  minute: number;
  actor_ref: string;
  verb: string;
  target_ref: string | null;
  location: ActionLocation;
  method: string | null;
  result: string;
  storyline_id: number | null;
  witnesses: string[];
}

export interface LogActionInput {
  tick: number;
  minute?: number | undefined;
  actorRef: string;
  verb: string;
  targetRef?: string | null | undefined;
  location: ActionLocation;
  method?: string | null | undefined;
  result: string;
  storylineId?: number | null | undefined;
  witnesses?: string[] | undefined;
}

export interface StandingReason {
  tick: number;
  delta: number;
  reason: string;
}

export interface StandingRecord {
  subject_ref: string;
  party_ref: string;
  value: number;
  reasons: StandingReason[];
}

export function normalizeActionVerb(rawVerb: string, category?: string): string {
  const v = String(rawVerb || "").toLowerCase().trim();
  const c = String(category || "").toUpperCase();

  if (/(burn|ignite|torch|arson|fire)/.test(v)) return "burn";
  if (/(kill|slay|execute|assassinate|murder)/.test(v)) return "kill";
  if (/(attack|strike|slash|shoot|smash|break|shatter|fight|hit|sabotage)/.test(v) || c === "MARTIAL") return "attack";
  if (/(free|liberate|release|unlock|rescue)/.test(v)) return "free";
  if (/(bribe|pay off|payoff)/.test(v)) return "bribe";
  if (/(intimidate|threaten|coerce)/.test(v)) return "intimidate";
  if (/(persuade|convince|negotiate|plead|talk|speak|mediate|parley|reason)/.test(v) || c === "SOCIAL") return "persuade";
  if (/(steal|pickpocket|loot|pilfer|thieve|sneak)/.test(v) || c === "SUBTERFUGE") return "steal";
  if (/(deliver|escort|supply)/.test(v)) return "deliver";
  if (/(aid|heal|help|repair|protect)/.test(v)) return "aid";
  if (/(inspect|examine|search|investigate|read)/.test(v)) return "inspect";
  return v || "act";
}

function mapActionRow(r: any): ActionRecord {
  return {
    id: Number(r.id),
    tick: Number(r.tick || 0),
    minute: Number(r.minute || 0),
    actor_ref: String(r.actor_ref),
    verb: String(r.verb),
    target_ref: r.target_ref ? String(r.target_ref) : null,
    location: r.location && typeof r.location === "object" ? r.location : { cellId: 0 },
    method: r.method ? String(r.method) : null,
    result: String(r.result),
    storyline_id: r.storyline_id !== null && r.storyline_id !== undefined ? Number(r.storyline_id) : null,
    witnesses: Array.isArray(r.witnesses) ? r.witnesses.map(String) : [],
  };
}

export async function recordAction(db: Db, input: LogActionInput): Promise<ActionRecord> {
  const witnesses = Array.from(
    new Set((input.witnesses || []).map((w) => String(w).trim()).filter(Boolean))
  ).sort();
  const res = await db.query(
    `INSERT INTO actions (
       tick, minute, actor_ref, verb, target_ref, location, method, result, storyline_id, witnesses
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::text[])
     RETURNING *`,
    [
      Math.max(0, Math.round(input.tick)),
      Math.max(0, Math.round(input.minute ?? 0)),
      input.actorRef,
      input.verb,
      input.targetRef ?? null,
      JSON.stringify(input.location || { cellId: 0 }),
      input.method ?? null,
      input.result,
      input.storylineId ?? null,
      witnesses,
    ]
  );
  return mapActionRow(res.rows[0]);
}

export async function listRecentActionsForParty(
  db: Db,
  actorRefs: string[],
  limit: number = 10
): Promise<ActionRecord[]> {
  if (actorRefs.length === 0) return [];
  const res = await db.query(
    `SELECT * FROM actions
     WHERE actor_ref = ANY($1::text[])
     ORDER BY tick DESC, id DESC
     LIMIT $2`,
    [actorRefs, Math.max(1, limit)]
  );
  return res.rows.map(mapActionRow);
}

export async function listActionsForStoryline(
  db: Db,
  storylineId: number
): Promise<ActionRecord[]> {
  const res = await db.query(
    `SELECT * FROM actions
     WHERE storyline_id = $1
     ORDER BY tick ASC, id ASC`,
    [storylineId]
  );
  return res.rows.map(mapActionRow);
}

export async function listStandingForParty(
  db: Db,
  partyRefs: string[],
  limit: number = 16
): Promise<StandingRecord[]> {
  if (partyRefs.length === 0) return [];
  const res = await db.query(
    `SELECT subject_ref, party_ref, value, reasons
     FROM standing
     WHERE party_ref = ANY($1::text[])
     ORDER BY ABS(value) DESC, subject_ref ASC
     LIMIT $2`,
    [partyRefs, Math.max(1, limit)]
  );
  return res.rows.map((r: any) => ({
    subject_ref: String(r.subject_ref),
    party_ref: String(r.party_ref),
    value: Number(r.value || 0),
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
  }));
}
