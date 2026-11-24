/**
 * Encounter Round Clock (Phase 12.2): wraps encounter turns cleanly without altering B.R.U.T.A.L.
 * rules modules (Rule 6), advancing world_clock.minute_of_day (6s/round) and scheduling nearby
 * meso alarms/reinforcements via scheduled_events.
 */
import { flushStepDeltas } from "../deltas/index.js";
import type { Db, Delta } from "../deltas/types.js";
import { advanceSessionMinutes, readWorldClock } from "./clock.js";

export const ROUND_SECONDS = 6;
export const ALARM_ROUND_INTERVAL = 3;
export const REINFORCEMENT_ROUND_INTERVAL = 5;

export interface NearbyMesoAgentRef {
  ref: string;
  name: string;
  role: string;
}

export interface EvaluateEncounterTriggersInput {
  round: number;
  cellId: number;
  rx: number;
  ry: number;
  z: number;
  tick: number;
  minute: number;
  combatLoud: boolean;
  nearbyAgents: NearbyMesoAgentRef[];
}

/**
 * Pure trigger evaluation converting round milestones during combat into scheduled.add deltas.
 */
export function evaluateEncounterMesoTriggers(
  input: EvaluateEncounterTriggersInput
): Delta[] {
  const deltas: Delta[] = [];
  if (input.round <= 0) return deltas;

  if (input.combatLoud && input.round % ALARM_ROUND_INTERVAL === 0) {
    deltas.push({
      kind: "scheduled.add",
      at: { tick: input.tick, minute: Math.min(1439, input.minute + 1) },
      event: {
        kind: "ENCOUNTER_ALARM",
        payload: {
          cellId: input.cellId,
          rx: input.rx,
          ry: input.ry,
          z: input.z,
          round: input.round,
          message: `Alarm raised in Cell #${input.cellId} (${input.rx},${input.ry} z=${input.z}) during round ${input.round} of combat.`,
        },
      },
    });
  }

  if (input.round % REINFORCEMENT_ROUND_INTERVAL === 0 && input.nearbyAgents.length > 0) {
    const responder = input.nearbyAgents[0]!;
    deltas.push({
      kind: "scheduled.add",
      at: { tick: input.tick, minute: Math.min(1439, input.minute + 2) },
      event: {
        kind: "MESO_REINFORCEMENTS",
        payload: {
          cellId: input.cellId,
          rx: input.rx,
          ry: input.ry,
          z: input.z,
          round: input.round,
          agentRef: responder.ref,
          agentName: responder.name,
          role: responder.role,
          message: `${responder.name} (${responder.role}, ${responder.ref}) converges on Cell #${input.cellId} (${input.rx},${input.ry}) as combat continues into round ${input.round}.`,
        },
      },
    });
  }

  return deltas;
}

export interface AdvanceEncounterRoundInput {
  round: number;
  accumulatedSeconds: number;
  cellId: number;
  rx: number;
  ry: number;
  z: number;
  combatLoud?: boolean | undefined;
  runMacroTick?: (() => Promise<any>) | undefined;
}

export interface AdvanceEncounterRoundResult {
  round: number;
  accumulatedSeconds: number;
  minutesAdvanced: number;
  scheduledCount: number;
  tick: number;
  minute_of_day: number;
}

/**
 * Advances encounter time by ROUND_SECONDS (6s). Whole minutes increment world_clock.minute_of_day
 * via advanceSessionMinutes, and periodic combat rounds schedule nearby verified agents/alarms.
 */
export async function advanceEncounterRound(
  db: Db,
  opts: AdvanceEncounterRoundInput
): Promise<AdvanceEncounterRoundResult> {
  const nextRound = Math.max(1, Math.round(opts.round));
  const totalSec = Math.max(0, Math.round(opts.accumulatedSeconds)) + ROUND_SECONDS;
  const wholeMinutes = Math.floor(totalSec / 60);
  const remainderSeconds = totalSec % 60;

  let clk = await readWorldClock(db);
  if (wholeMinutes > 0) {
    const adv = await advanceSessionMinutes(
      db,
      wholeMinutes,
      opts.runMacroTick || (async () => {})
    );
    clk = { ...clk, tick: adv.tick, minute_of_day: adv.minute_of_day };
  }

  let nearbyAgents: NearbyMesoAgentRef[] = [];
  if (nextRound % REINFORCEMENT_ROUND_INTERVAL === 0 && opts.cellId > 0) {
    const agRes = await db.query(
      `SELECT id, name, role
       FROM sim_agents
       WHERE location_cell_id = $1
         AND COALESCE(state, 'ACTIVE') <> 'ARRESTED'
       ORDER BY id ASC
       LIMIT 4`,
      [opts.cellId]
    );
    nearbyAgents = agRes.rows.map((r: any) => ({
      ref: `agent:${r.id}`,
      name: String(r.name || `Patrol #${r.id}`),
      role: String(r.role || "Agent"),
    }));
  }

  const deltas = evaluateEncounterMesoTriggers({
    round: nextRound,
    cellId: opts.cellId,
    rx: opts.rx,
    ry: opts.ry,
    z: opts.z,
    tick: clk.tick,
    minute: clk.minute_of_day,
    combatLoud: Boolean(opts.combatLoud),
    nearbyAgents,
  });

  let scheduledCount = 0;
  if (deltas.length > 0) {
    const flushed = await flushStepDeltas(db, "encounter_clock", clk.tick, deltas, clk.minute_of_day);
    scheduledCount = Number(flushed.counts.scheduled_events || 0);
  }

  return {
    round: nextRound,
    accumulatedSeconds: remainderSeconds,
    minutesAdvanced: wholeMinutes,
    scheduledCount,
    tick: clk.tick,
    minute_of_day: clk.minute_of_day,
  };
}
