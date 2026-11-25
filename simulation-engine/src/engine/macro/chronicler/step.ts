import { dateForTick } from "../../canon/calendar.js";
import type { Delta } from "../../deltas/types.js";

export interface ChroniclerDramaEvent {
  burgId: number | null;
  cellId: number | null;
  type: string;
  message: string;
}

export interface ChroniclerSnapshot {
  tick: number;
  loreDate: string;
  hasRecentRumor: boolean;
  dramaEvents: ChroniclerDramaEvent[];
}

/**
 * Pure Phase 2.3 chronicler step: emits monthly TURN_LOG markers and clusters 2+ recent
 * autonomous drama events into a deterministic REGIONAL_RUMOR.
 */
export function stepChronicler(snap: ChroniclerSnapshot): Delta[] {
  const deltas: Delta[] = [];

  if (dateForTick(snap.tick).dayOfMonth === 1) {
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "TURN_LOG",
      message: `The Chronos wheel turns. A new Dragon Month dawns across Ostraka: ${snap.loreDate}.`,
      tier: "MINOR",
      loreDate: snap.loreDate,
    });
  }

  if (!snap.hasRecentRumor && snap.dramaEvents.length >= 2) {
    const anchor = snap.dramaEvents[0]!;
    const summaryBits = snap.dramaEvents
      .map((r) => String(r.message || "").replace(/^\[[^\]]+\]\s*/, "").trim())
      .filter(Boolean);
    const rumorMsg = `[RUMOR] Travelers along the roads speak of recent upheavals: ${summaryBits.join(" Meanwhile, ")}`;

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "REGIONAL_RUMOR",
      message: rumorMsg.slice(0, 600),
      tier: "MINOR",
      burgId: anchor.burgId && anchor.burgId > 0 ? anchor.burgId : undefined,
      cellId: anchor.cellId && anchor.cellId > 0 ? anchor.cellId : undefined,
      loreDate: snap.loreDate,
    });
  }

  return deltas;
}
