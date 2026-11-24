/**
 * Story Health Metrics (Phase 13.1): read-only telemetry queries over storylines,
 * storyline_actors, actions, map_overlays, and Rule-7 validator logs in world_deltas.
 */
import type { Db } from "../deltas/types.js";
import type { StorylineScale } from "../threads/threadEngine.js";

export interface StoryScaleMetrics {
  proposed: number;
  accepted: number;
  rejected: number;
  autoOpened: number;
  open: number;
  escalated: number;
  resolved: number;
  expired: number;
  failed: number;
  total: number;
}

export interface StoryHealthMetrics {
  tick: number;
  generatedAt: string;
  byScale: Record<StorylineScale, StoryScaleMetrics>;
  outcomes: {
    resolved: number;
    expired: number;
    failed: number;
    active: number;
    resolvedRatio: number;
  };
  actorOriginShare: {
    peopleCount: number;
    placesCount: number;
    peopleShare: number;
    placesShare: number;
  };
  rule7: {
    rejectedCount: number;
    totalChecked: number;
    rejectionRate: number;
  };
  partyEngagement: {
    engagedStorylines: number;
    totalStorylines: number;
    engagementRate: number;
    totalActions: number;
    actionsLinkedToStoryline: number;
  };
}

function emptyScaleMetrics(): StoryScaleMetrics {
  return {
    proposed: 0,
    accepted: 0,
    rejected: 0,
    autoOpened: 0,
    open: 0,
    escalated: 0,
    resolved: 0,
    expired: 0,
    failed: 0,
    total: 0,
  };
}

const SCALES: StorylineScale[] = ["scene", "thread", "arc", "saga"];
const PEOPLE_REF_RE = /^(?:citizen|paragon|agent|player|npc):/i;
const NUMERIC_ID_RE = /^\d+$/;

/**
 * Computes aggregated storyline health metrics directly from canonical PostgreSQL tables.
 */
export async function computeStoryHealthMetrics(db: Db): Promise<StoryHealthMetrics> {
  const [tickRes, scaleRes, actorsRes, rule7Res, actionsRes] = await Promise.all([
    db.query(`SELECT COALESCE(MAX(tick), 0)::int AS tick FROM sim_calendar`),
    db.query(`
      WITH desk_accepted AS (
        SELECT DISTINCT (mo.payload->>'storylineId')::bigint AS storyline_id
        FROM map_overlays mo
        WHERE mo.source = 'story_desk'
          AND mo.payload ? 'storylineId'
          AND (mo.payload->>'storylineId') ~ '^[0-9]+$'
      )
      SELECT
        s.scale,
        COUNT(*) FILTER (WHERE s.state = 'proposed')::int AS proposed,
        COUNT(*) FILTER (
          WHERE s.state NOT IN ('proposed', 'rejected')
            AND (da.storyline_id IS NOT NULL OR s.source = 'desk' OR s.origin = 'desk')
        )::int AS accepted,
        COUNT(*) FILTER (WHERE s.state = 'rejected')::int AS rejected,
        COUNT(*) FILTER (
          WHERE s.state NOT IN ('proposed', 'rejected')
            AND da.storyline_id IS NULL
            AND COALESCE(s.source, '') <> 'desk'
            AND COALESCE(s.origin, '') <> 'desk'
        )::int AS auto_opened,
        COUNT(*) FILTER (WHERE s.state = 'open')::int AS open,
        COUNT(*) FILTER (WHERE s.state = 'escalated')::int AS escalated,
        COUNT(*) FILTER (WHERE s.state = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE s.state = 'expired')::int AS expired,
        COUNT(*) FILTER (WHERE s.state = 'failed')::int AS failed,
        COUNT(*)::int AS total
      FROM storylines s
      LEFT JOIN desk_accepted da ON da.storyline_id = s.id
      GROUP BY s.scale
      ORDER BY s.scale ASC
    `),
    db.query(`
      SELECT DISTINCT storyline_id, entity_ref
      FROM storyline_actors
      ORDER BY storyline_id ASC, entity_ref ASC
    `),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE kind IN ('delta.rejected', 'rule7.rejected'))::int AS rejected_count,
        COUNT(*) FILTER (WHERE kind NOT IN ('delta.rejected', 'rule7.rejected'))::int AS accepted_count
      FROM world_deltas
    `),
    db.query(`
      WITH engaged AS (
        SELECT DISTINCT storyline_id AS id
        FROM actions
        WHERE storyline_id IS NOT NULL
        UNION
        SELECT id
        FROM storylines
        WHERE resolution IS NOT NULL AND (resolution->>'resolvedBy') = 'party'
      )
      SELECT
        (SELECT COUNT(*)::int FROM engaged) AS engaged_storylines,
        (SELECT COUNT(*)::int FROM storylines WHERE state <> 'rejected') AS total_storylines,
        (SELECT COUNT(*)::int FROM actions) AS total_actions,
        (SELECT COUNT(*)::int FROM actions WHERE storyline_id IS NOT NULL) AS linked_actions
    `),
  ]);

  const tick = Number(tickRes.rows[0]?.tick || 0);

  const byScale: Record<StorylineScale, StoryScaleMetrics> = {
    scene: emptyScaleMetrics(),
    thread: emptyScaleMetrics(),
    arc: emptyScaleMetrics(),
    saga: emptyScaleMetrics(),
  };

  let resolved = 0;
  let expired = 0;
  let failed = 0;
  let active = 0;

  for (const r of scaleRes.rows) {
    const scale = String(r.scale) as StorylineScale;
    if (!SCALES.includes(scale)) continue;
    const entry: StoryScaleMetrics = {
      proposed: Number(r.proposed || 0),
      accepted: Number(r.accepted || 0),
      rejected: Number(r.rejected || 0),
      autoOpened: Number(r.auto_opened || 0),
      open: Number(r.open || 0),
      escalated: Number(r.escalated || 0),
      resolved: Number(r.resolved || 0),
      expired: Number(r.expired || 0),
      failed: Number(r.failed || 0),
      total: Number(r.total || 0),
    };
    byScale[scale] = entry;
    resolved += entry.resolved;
    expired += entry.expired;
    failed += entry.failed;
    active += entry.open + entry.escalated;
  }

  const settledTotal = resolved + expired;
  const resolvedRatio = settledTotal > 0 ? Number((resolved / settledTotal).toFixed(4)) : 0;

  let peopleCount = 0;
  let placesCount = 0;
  for (const row of actorsRes.rows) {
    const ref = String(row.entity_ref || "").trim();
    if (!ref) continue;
    if (PEOPLE_REF_RE.test(ref) || NUMERIC_ID_RE.test(ref)) {
      peopleCount++;
    } else {
      placesCount++;
    }
  }
  const actorTotal = peopleCount + placesCount;
  const peopleShare = actorTotal > 0 ? Number((peopleCount / actorTotal).toFixed(4)) : 0;
  const placesShare = actorTotal > 0 ? Number((placesCount / actorTotal).toFixed(4)) : 0;

  const rejectedCount = Number(rule7Res.rows[0]?.rejected_count || 0);
  const acceptedCount = Number(rule7Res.rows[0]?.accepted_count || 0);
  const totalChecked = rejectedCount + acceptedCount;
  const rejectionRate = totalChecked > 0 ? Number((rejectedCount / totalChecked).toFixed(4)) : 0;

  const actRow = actionsRes.rows[0] || {};
  const engagedStorylines = Number(actRow.engaged_storylines || 0);
  const totalStorylines = Number(actRow.total_storylines || 0);
  const engagementRate = totalStorylines > 0 ? Number((engagedStorylines / totalStorylines).toFixed(4)) : 0;

  return {
    tick,
    generatedAt: new Date().toISOString(),
    byScale,
    outcomes: {
      resolved,
      expired,
      failed,
      active,
      resolvedRatio,
    },
    actorOriginShare: {
      peopleCount,
      placesCount,
      peopleShare,
      placesShare,
    },
    rule7: {
      rejectedCount,
      totalChecked,
      rejectionRate,
    },
    partyEngagement: {
      engagedStorylines,
      totalStorylines,
      engagementRate,
      totalActions: Number(actRow.total_actions || 0),
      actionsLinkedToStoryline: Number(actRow.linked_actions || 0),
    },
  };
}
