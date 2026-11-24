import type { Db } from "../deltas/types.js";
import { promoteFromCohort, type PromotedPersonResult } from "./promote.js";

export interface FocusAreaOptions {
  cellIds: number[];
  burgId?: number | undefined;
  lod?: "meso" | "micro" | undefined;
  desiredFaces?: number | undefined;
  tick?: number | undefined;
}

export interface FocusAreaResult {
  focusedEntities: number;
  promoted: PromotedPersonResult[];
}

/**
 * Transitions entities inside the focused area to higher detail (`meso` or `micro`) and promotes
 * deterministic citizen faces out of `population_cohorts` for view/scene casting.
 */
export async function focusArea(db: Db, opts: FocusAreaOptions): Promise<FocusAreaResult> {
  const cellIds = opts.cellIds.filter((c) => Number.isFinite(c) && c > 0);
  const lod = opts.lod ?? "micro";
  const tick = opts.tick ?? 1;

  let focusedEntities = 0;
  if (cellIds.length > 0) {
    const res = await db.query(
      `UPDATE entities
       SET lod = $2
       WHERE cell_id = ANY($1::int[]) AND alive = true`,
      [cellIds, lod]
    );
    focusedEntities = res.rowCount || 0;
  }

  const promoted: PromotedPersonResult[] = [];
  const desired = Math.max(0, Math.round(opts.desiredFaces ?? 0));
  if (opts.burgId && opts.burgId > 0 && desired > 0) {
    for (let i = 0; i < desired; i++) {
      const p = await promoteFromCohort(
        db,
        opts.burgId,
        { ageBand: "ADULT", allegiance: "CIVILIAN" },
        `focus:${opts.burgId}:${i}`,
        tick
      );
      if (p) promoted.push(p);
    }
  }

  return { focusedEntities, promoted };
}
