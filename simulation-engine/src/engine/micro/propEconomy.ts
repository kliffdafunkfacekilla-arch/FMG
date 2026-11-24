import type { Delta, OverlayChange } from "../deltas/types.js";

/**
 * Pure mapping from burnt/destroyed/looted tactical map props to macro burg & infrastructure deltas.
 * Zero DB or UI imports (Rule 8).
 */
export function resolvePropEconomicImpact(
  propName: string,
  propTags: string[],
  change: OverlayChange,
  burgId: number | null
): Delta[] {
  if (!burgId || burgId <= 0) return [];

  const text = `${propName} ${propTags.join(" ")}`.toLowerCase();
  const isDestructive = change === "burnt" || change === "destroyed";
  const isTheft = change === "looted" || change === "destroyed";
  const deltas: Delta[] = [];

  if (isDestructive && /\b(granary|food[\s_-]*store|silo|grain|mill)\b/.test(text)) {
    deltas.push({ kind: "burg.adjust", burgId, food: -250 });
  } else if (isTheft && /\b(treasury|vault|bank|coffer|tax[\s_-]*chest)\b/.test(text)) {
    deltas.push({ kind: "burg.adjust", burgId, wealth: -500 });
  } else if (isDestructive && /\b(forge|smithy|foundry|kiln|smelter|quarry|mine)\b/.test(text)) {
    const infraType = /\bquarry\b/.test(text) ? "QUARRY" : /\bmine\b/.test(text) ? "MINE" : "FORGE";
    deltas.push({ kind: "infrastructure.adjust", burgId, infraType, levelDelta: -1, status: "DAMAGED" });
    deltas.push({ kind: "burg.adjust", burgId, rawMaterials: -100 });
  } else if (isDestructive && /\b(warehouse|market|dock|storehouse)\b/.test(text)) {
    deltas.push({ kind: "burg.adjust", burgId, wealth: -200, unrest: 6 });
  } else if (isDestructive && /\b(temple|shrine|altar)\b/.test(text)) {
    deltas.push({ kind: "burg.adjust", burgId, unrest: 10 });
  }

  return deltas;
}
