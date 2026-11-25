import { PoolClient, Pool } from "pg";
import { flushStepDeltas } from "../deltas/index.js";
import { loadBackgroundDirector } from "../macro/backgroundDirector/load.js";
import { BLEED_TAG, stepBackgroundDirector } from "../macro/backgroundDirector/step.js";
import { advanceThreadClocks } from "../threads/threadEngine.js";
import { openWorldEventThreads } from "../threads/worldThreads.js";
import { advanceArcForThread } from "../threads/storyArcs.js";

// =============================================================
// HEADLESS BACKGROUND DIRECTOR AGENT
// =============================================================
// Simulates the organic progression of distant sectors while the player is away:
// 1. Advances existing thread clocks + fails expired story arcs
// 2. Loads cached sector layers & evaluates deterministic reaction rules via deltas
// 3. Opens world threads straight from this tick's major events

export { BLEED_TAG };

export interface BackgroundDirectorSummary {
  sectorsEvaluated: number;
  sectorsMutated: number;
  reactionsFired: number;
  eventsLogged: number;
  threadsOpened: number;
  worldThreadsOpened?: number;
  sectorsFailed?: number;
  threadsTicked?: number;
  threadsResolved?: number;
}

/**
 * Runs `fn` inside a savepoint when the client is in a transaction (the tick), so one bad step
 * rolls back alone instead of aborting the whole tick.
 */
async function isolated<T>(
  client: PoolClient | Pool,
  name: string,
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: any }> {
  let savepoint = true;
  try { await client.query(`SAVEPOINT ${name}`); } catch { savepoint = false; }
  try {
    const value = await fn();
    if (savepoint) await client.query(`RELEASE SAVEPOINT ${name}`);
    return { ok: true, value };
  } catch (error) {
    if (savepoint) await client.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => {});
    return { ok: false, error };
  }
}

export async function runBackgroundDirectorAgent(
  client: PoolClient | Pool,
  currentTick: number,
  loreDate?: string
): Promise<BackgroundDirectorSummary> {
  const summary: BackgroundDirectorSummary = {
    sectorsEvaluated: 0,
    sectorsMutated: 0,
    reactionsFired: 0,
    eventsLogged: 0,
    threadsOpened: 0,
    sectorsFailed: 0,
  };

  // 0. Advance existing open thread clocks (STORY_AUDIT Step 3)
  const clockSummary = await advanceThreadClocks(client, currentTick, loreDate);
  summary.threadsTicked = clockSummary.threadsTicked;
  summary.threadsResolved = clockSummary.threadsResolved;
  for (const expired of clockSummary.worldDeltasApplied) {
    await advanceArcForThread(client, expired.threadId, "expired");
  }

  // 1. Evaluate sector layers via snapshot -> pure step -> validated deltas
  const snap = await loadBackgroundDirector(client, currentTick, loreDate);
  const out = stepBackgroundDirector(snap);
  summary.sectorsEvaluated = out.sectorsEvaluated;
  summary.sectorsMutated = out.sectorsMutated;
  summary.reactionsFired = out.reactionsFired;
  summary.eventsLogged = out.eventsLogged;
  summary.sectorsFailed = out.sectorsFailed;

  if (out.deltas.length > 0) {
    const flushed = await flushStepDeltas(client, "agent:backgroundDirector", currentTick, out.deltas);
    summary.threadsOpened = flushed.counts.sim_threads || 0;
  }

  // 2. Stories from this tick's world events, wherever they happened
  const world = await isolated(client, "bd_world", () => openWorldEventThreads(client, currentTick));
  if (world.ok) summary.worldThreadsOpened = world.value;
  else console.warn(`[Background Director] World threads skipped: ${world.error?.message || world.error}`);

  return summary;
}
