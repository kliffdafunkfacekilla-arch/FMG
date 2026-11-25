import type { Delta } from "../../deltas/types.js";
import type { FactionCollapseSnapshot } from "./load.js";

/**
 * Faction collapse (pure): a sovereign faction with no living burg and an empty treasury collapses (its
 * land returns to the wild and its wars end); one with no living burg and no land only has its wars ended.
 * Landless-of-towns factions that still have money are left alone. Neutrals (id 0) are never touched.
 */
export function stepFactionCollapse(snap: FactionCollapseSnapshot): Delta[] {
  const deltas: Delta[] = [];
  for (const f of snap.candidates) {
    const cells = f.cellIds.length;
    const bankrupt = f.treasury <= 0;
    const collapse = bankrupt && cells > 0;
    const landless = cells === 0;
    if (!collapse && !(landless && f.wars > 0)) continue;

    if (f.wars > 0) deltas.push({ kind: "diplomacy.endWars", factionId: f.id });
    if (collapse) {
      for (const cellId of f.cellIds) deltas.push({ kind: "cell.setFaction", cellId, factionId: null });
    }
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: collapse ? "FACTION_COLLAPSED" : "FACTION_WARS_ENDED",
      tier: "CRITICAL",
      factionId: f.id,
      loreDate: snap.loreDate,
      message: collapse
        ? `🏚️ THE FALL OF ${f.name.toUpperCase()}: with no town left and an empty treasury, ${f.name} has collapsed. Its ${cells} provinces return to the wild${f.wars ? ` and its ${f.wars} wars are over` : ""}.`
        : `🕊️ ${f.name}, holding neither town nor land, can no longer wage war; its ${f.wars} wars end.`,
    });
  }
  return deltas;
}
