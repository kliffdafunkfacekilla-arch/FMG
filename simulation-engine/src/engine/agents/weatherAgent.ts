import { flushStepDeltas } from "../deltas/index.js";
import { frontToMapCircle, loadWeather, type MapBounds } from "../macro/weather/load.js";
import { stepWeather } from "../macro/weather/step.js";

export { frontToMapCircle, type MapBounds };

/**
 * Compatibility wrapper around the pure weather macro step (Phase 2.3 #2).
 */
export async function runWeatherAgent(
  client: any,
  tick: number,
  season: string,
  dayOfMonth: number,
  loreDate: string,
  isShadowWeek?: boolean
) {
  const snap = await loadWeather(client, tick, season, dayOfMonth, loreDate, isShadowWeek);
  const deltas = stepWeather(snap, { random: Math.random });
  await flushStepDeltas(client, "agent:weather", tick, deltas);
}
