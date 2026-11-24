import { flushStepDeltas } from "../deltas/index.js";
import { loadCalendar } from "../macro/calendar/load.js";
import {
  CHAOS_FLOWS,
  DRAGON_MONTHS,
  stepCalendar,
  type ChaosFlowInfo,
  type DragonMonthDef,
} from "../macro/calendar/step.js";

export { DRAGON_MONTHS, CHAOS_FLOWS, type ChaosFlowInfo, type DragonMonthDef };
export { DAYS_PER_YEAR, SHADOWFALL_DAYS, DAYS_PER_MONTH as DAYS_PER_DRAGON_MONTH } from "../canon/calendar.js";

/**
 * Compatibility wrapper around the pure calendar macro step (Phase 2.3 #4).
 */
export async function runCalendarAgent(client: any, tick: number) {
  const snap = await loadCalendar(client, tick);
  const { calendar, deltas } = stepCalendar(snap);
  await flushStepDeltas(client, "agent:calendar", tick, deltas);
  return calendar;
}
