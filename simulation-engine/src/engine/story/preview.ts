/**
 * "What-if" Story Previews (Phase 11.4): runs each option over the next N days inside an
 * isolated rolled-back transaction (with nested BEGIN/COMMIT/ROLLBACK rewritten to SAVEPOINTs)
 * using the exact same seeded simulation step, never persisting any database mutation.
 */
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import type { Delta } from "../deltas/types.js";
import { flushStepDeltas } from "../deltas/index.js";
import { executeMasterTick } from "../masterOrchestrator.js";
import { decideProposal } from "./storylines.js";
import { resolveStorylineFromActions } from "./resolve.js";

export const MAX_PREVIEW_DAYS = 10;
export const MAX_PREVIEW_OPTIONS = 3;

export interface PreviewOptionInput {
  label?: string | undefined;
  action?: "accept_proposal" | "reject_proposal" | "resolve_diplomatic" | "resolve_violent" | "do_nothing" | undefined;
  proposalId?: number | undefined;
  storylineId?: number | undefined;
  deltas?: Delta[] | undefined;
  partyRef?: string | undefined;
}

export interface PreviewBurgDiff {
  burgId: number;
  name: string;
  unrestDelta: number;
  wealthDelta: number;
  foodDelta: number;
  crimeDelta: number;
}

export interface PreviewOptionOutcome {
  label: string;
  action: string;
  daysSimulated: number;
  startTick: number;
  endTick: number;
  burgDiffs: PreviewBurgDiff[];
  majorEvents: Array<{ tick: number; type: string; message: string }>;
  fingerprintHash: string;
  summary: string;
}

export interface PreviewStoryResult {
  startTick: number;
  days: number;
  options: PreviewOptionOutcome[];
}

let previewMutex: Promise<void> = Promise.resolve();

function withPreviewLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = previewMutex.then(fn, fn);
  previewMutex = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function previewStoryOptions(input: {
  proposalId?: number | undefined;
  resolutionOptions?: PreviewOptionInput[] | undefined;
  days?: number | undefined;
}): Promise<PreviewStoryResult> {
  const days = Math.min(MAX_PREVIEW_DAYS, Math.max(1, Math.round(input.days ?? 3)));
  let rawOptions: PreviewOptionInput[] = Array.isArray(input.resolutionOptions) ? input.resolutionOptions.slice(0, MAX_PREVIEW_OPTIONS) : [];
  if (rawOptions.length === 0 && input.proposalId) {
    rawOptions = [
      { label: "Accept proposal", action: "accept_proposal", proposalId: input.proposalId },
      { label: "Reject proposal", action: "reject_proposal", proposalId: input.proposalId },
    ];
  } else if (rawOptions.length === 0) {
    rawOptions = [{ label: "Baseline (no intervention)", action: "do_nothing" }];
  }

  return withPreviewLock(async () => {
    const client = await pool.connect();
    const p = pool as any;
    const orig = { query: p.query, connect: p.connect };
    const savepoints: string[] = [];
    let counter = 0;

    const rewrite = (text: string): string => {
      const t = text.trim().replace(/;$/, "").toUpperCase();
      if (t === "BEGIN" || t === "START TRANSACTION") {
        const sp = `prv_iso_${++counter}`;
        savepoints.push(sp);
        return `SAVEPOINT ${sp}`;
      }
      if (t === "COMMIT" || t === "END") {
        const sp = savepoints.pop();
        return sp ? `RELEASE SAVEPOINT ${sp}` : "SELECT 1";
      }
      if (t === "ROLLBACK") {
        const sp = savepoints.pop();
        return sp ? `ROLLBACK TO SAVEPOINT ${sp}` : "SELECT 1";
      }
      return text;
    };

    const routedQuery = (text: any, params?: any) =>
      typeof text === "string" ? client.query(rewrite(text), params) : client.query(text, params);

    const prevLlm = process.env.STORY_LLM;
    process.env.STORY_LLM = "off";

    await client.query("BEGIN");
    p.query = routedQuery;
    p.connect = async () => ({ query: routedQuery, release: () => {} });

    try {
      const startTickRes = await routedQuery(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`);
      const startTick = Number(startTickRes.rows[0]?.t || 0);

      const baseBurgsRes = await routedQuery(
        `SELECT burg_id, name, unrest, wealth, food, crime_rate FROM sim_burg_economy ORDER BY burg_id ASC`
      );
      const baseBurgs = new Map<number, { name: string; unrest: number; wealth: number; food: number; crime: number }>();
      for (const r of baseBurgsRes.rows) {
        baseBurgs.set(Number(r.burg_id), {
          name: String(r.name),
          unrest: Number(r.unrest || 0),
          wealth: Number(r.wealth || 0),
          food: Number(r.food || 0),
          crime: Number(r.crime_rate || 0),
        });
      }

      const outcomes: PreviewOptionOutcome[] = [];

      for (let i = 0; i < rawOptions.length; i++) {
        const opt = rawOptions[i]!;
        const spName = `preview_opt_${i}`;
        await client.query(`SAVEPOINT ${spName}`);
        try {
          if (opt.action === "accept_proposal" && (opt.proposalId ?? input.proposalId)) {
            await decideProposal(client as any, Number(opt.proposalId ?? input.proposalId), {
              decision: "accept",
              tick: startTick || 1,
            });
          } else if (opt.action === "reject_proposal" && (opt.proposalId ?? input.proposalId)) {
            await decideProposal(client as any, Number(opt.proposalId ?? input.proposalId), {
              decision: "reject",
              tick: startTick || 1,
            });
          } else if ((opt.action === "resolve_diplomatic" || opt.action === "resolve_violent") && opt.storylineId) {
            const partyRef = opt.partyRef || "player:1";
            const verb = opt.action === "resolve_diplomatic" ? "persuade" : "attack";
            const stRow = await routedQuery(`SELECT cell_id, rx, ry, actor_ids FROM storylines WHERE id = $1 LIMIT 1`, [opt.storylineId]);
            const st = stRow.rows[0];
            if (st) {
              const targetRef = Array.isArray(st.actor_ids) && st.actor_ids[0] ? String(st.actor_ids[0]) : null;
              await routedQuery(
                `INSERT INTO actions (tick, minute, actor_ref, verb, target_ref, location, method, result, storyline_id, witnesses)
                 VALUES ($1, 0, $2, $3, $4, $5::jsonb, 'PREVIEW', 'success:margin=4', $6, $7::text[])`,
                [
                  startTick || 1,
                  partyRef,
                  verb,
                  targetRef,
                  JSON.stringify({ cellId: Number(st.cell_id || 0), rx: Number(st.rx || 50), ry: Number(st.ry || 50) }),
                  opt.storylineId,
                  st.actor_ids || [],
                ]
              );
              await resolveStorylineFromActions(client as any, {
                storylineId: opt.storylineId,
                partyRef,
                tick: startTick || 1,
              });
            }
          }

          if (Array.isArray(opt.deltas) && opt.deltas.length > 0) {
            await flushStepDeltas(client as any, "story_preview", startTick || 1, opt.deltas, 0);
          }

          let endTick = startTick;
          for (let d = 0; d < days; d++) {
            const tr = await executeMasterTick();
            endTick = tr.currentTick;
          }

          const endBurgsRes = await routedQuery(
            `SELECT burg_id, name, unrest, wealth, food, crime_rate FROM sim_burg_economy ORDER BY burg_id ASC`
          );
          const burgDiffs: PreviewBurgDiff[] = [];
          for (const r of endBurgsRes.rows) {
            const b = baseBurgs.get(Number(r.burg_id));
            if (!b) continue;
            const unrestDelta = Number((Number(r.unrest || 0) - b.unrest).toFixed(2));
            const wealthDelta = Number((Number(r.wealth || 0) - b.wealth).toFixed(2));
            const foodDelta = Number((Number(r.food || 0) - b.food).toFixed(2));
            const crimeDelta = Number((Number(r.crime_rate || 0) - b.crime).toFixed(2));
            if (unrestDelta !== 0 || wealthDelta !== 0 || foodDelta !== 0 || crimeDelta !== 0) {
              burgDiffs.push({
                burgId: Number(r.burg_id),
                name: b.name,
                unrestDelta,
                wealthDelta,
                foodDelta,
                crimeDelta,
              });
            }
          }
          burgDiffs.sort((a, b) => Math.abs(b.unrestDelta) + Math.abs(b.wealthDelta) - (Math.abs(a.unrestDelta) + Math.abs(a.wealthDelta)));

          const evRes = await routedQuery(
            `SELECT tick, type, message FROM sim_events WHERE tick > $1 ORDER BY tick ASC, id ASC LIMIT 20`,
            [startTick]
          );
          const majorEvents = evRes.rows.map((e: any) => ({
            tick: Number(e.tick),
            type: String(e.type),
            message: String(e.message),
          }));

          const digest = crypto
            .createHash("md5")
            .update(JSON.stringify({ endTick, burgDiffs, majorEvents }))
            .digest("hex");

          const topParts = burgDiffs.slice(0, 3).map(
            (bd) => `${bd.name}: unrest ${bd.unrestDelta >= 0 ? "+" : ""}${bd.unrestDelta}, wealth ${bd.wealthDelta >= 0 ? "+" : ""}${bd.wealthDelta}`
          );
          outcomes.push({
            label: opt.label || `Option ${i + 1}`,
            action: opt.action || "custom",
            daysSimulated: days,
            startTick,
            endTick,
            burgDiffs: burgDiffs.slice(0, 12),
            majorEvents,
            fingerprintHash: digest,
            summary: `In ${days}d: ${topParts.length > 0 ? topParts.join("; ") : "no burg metric shift"}`,
          });
        } finally {
          await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
          await client.query(`RELEASE SAVEPOINT ${spName}`);
        }
      }

      return { startTick, days, options: outcomes };
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      p.query = orig.query;
      p.connect = orig.connect;
      if (prevLlm === undefined) delete process.env.STORY_LLM;
      else process.env.STORY_LLM = prevLlm;
      client.release();
    }
  });
}
