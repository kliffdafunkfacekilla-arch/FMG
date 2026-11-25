/**
 * "What-if" Story Previews (Phase 11.4, after 2.4): runs each option over the next N days purely
 * in memory over a cloned world snapshot using the exact same seeded simulation step, never
 * opening a PostgreSQL transaction or writing any row.
 */
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import type { Delta } from "../deltas/types.js";
import { applyDeltasInMemory } from "../macro/inMemoryDay/applyMemory.js";
import { cloneWorldSnapshot } from "../macro/inMemoryDay/cloneWorld.js";
import { loadWorldSnapshot } from "../macro/inMemoryDay/loadWorld.js";
import { runInMemoryDay } from "../macro/inMemoryDay/runDay.js";
import type { InMemoryBurg, WorldSnapshot } from "../macro/inMemoryDay/types.js";
import { LIVE_TRADE_ROUTER } from "../macro/trade/load.js";
import { mulberry32, tickSeed } from "../rng.js";
import { computeStorylineConsequences } from "./resolve.js";

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

function findPrimaryBurgAtCell(world: WorldSnapshot, cellId: number): InMemoryBurg | null {
  let match: InMemoryBurg | null = null;
  for (const b of world.mutable.burgs.values()) {
    if (b.cellId === cellId && (!match || b.burgId < match.burgId)) {
      match = b;
    }
  }
  return match;
}

function applyPreviewOptionInMemory(
  branch: WorldSnapshot,
  opt: PreviewOptionInput,
  fallbackProposalId: number | undefined,
  actionTick: number
): void {
  const proposalId = opt.proposalId ?? fallbackProposalId;

  if (opt.action === "accept_proposal" && proposalId) {
    const st = branch.mutable.storylines.get(Number(proposalId));
    if (st) {
      st.state = "open";
      const hook = st.hook || {};
      const clueName = String(hook.clueName || `Hook Clue: ${st.question.slice(0, 48)}`);
      const clueDesc = String(hook.clueDescription || st.stakes);
      const rumorMsg = String(hook.rumor || `Rumor spreads regarding "${st.question}": ${st.stakes}`);
      const burg = findPrimaryBurgAtCell(branch, st.cellId);
      const deltas: Delta[] = [
        {
          kind: "overlay.add",
          cellId: st.cellId,
          rx: st.rx,
          ry: st.ry,
          z: st.z,
          x: 128,
          y: 128,
          objectRef: hook.targetObjectRef ?? null,
          change: "placed",
          payload: {
            storylineId: st.id,
            dialogueLine: hook.dialogueLine || null,
            prop: {
              id: `prop_story_clue_${st.id}`,
              name: clueName,
              pos: [128, 128],
              tags: ["clue", "inspectable", "story_hook"],
              hp: 10,
              description: clueDesc,
              storylineId: st.id,
            },
          },
          tick: actionTick,
          minute: 0,
          source: "story_desk",
        },
        {
          kind: "event.log",
          tick: actionTick,
          type: "STORY_HOOK_RUMOR",
          message: rumorMsg,
          tier: "MINOR",
          burgId: burg?.burgId,
          cellId: st.cellId,
        },
      ];
      applyDeltasInMemory(branch, deltas);
    }
  } else if (opt.action === "reject_proposal" && proposalId) {
    const st = branch.mutable.storylines.get(Number(proposalId));
    if (st) {
      st.state = "rejected";
    }
  } else if ((opt.action === "resolve_diplomatic" || opt.action === "resolve_violent") && opt.storylineId) {
    const st = branch.mutable.storylines.get(Number(opt.storylineId));
    if (st) {
      const partyRef = opt.partyRef || "player:1";
      const burg = findPrimaryBurgAtCell(branch, st.cellId);
      const cellIdx = branch.static.cellIndexById.get(st.cellId);
      const rawFactionId = cellIdx !== undefined ? (branch.mutable.factionId[cellIdx] ?? 0) : 0;
      const targetFactionId = rawFactionId > 0 ? rawFactionId : null;
      const witnessRefs = st.actorIds.map(String);
      const targetRef = witnessRefs[0] ?? null;
      const citizenWitnessIds: number[] = [];
      for (const wRef of witnessRefs) {
        const m = /^citizen:(\d+)$/.exec(wRef);
        if (m) citizenWitnessIds.push(Number(m[1]));
      }

      const computed = computeStorylineConsequences({
        storylineId: st.id,
        question: st.question,
        cellId: st.cellId,
        rx: st.rx,
        ry: st.ry,
        burgId: burg?.burgId ?? null,
        burgName: burg?.name || `Cell #${st.cellId}`,
        targetRef,
        targetFactionId,
        partyRef,
        tick: actionTick,
        mode: opt.action === "resolve_diplomatic" ? "diplomatic" : "violent",
        witnessRefs,
        citizenWitnessIds,
      });

      if (computed.deltas.length > 0) {
        applyDeltasInMemory(branch, computed.deltas);
      }
      st.state = "resolved";

      if (computed.followUpProposal) {
        const fu = computed.followUpProposal;
        const nextId = branch.mutable.nextStorylineId++;
        branch.mutable.storylines.set(nextId, {
          id: nextId,
          scale: fu.scale,
          state: "proposed",
          cellId: Number(fu.cell_id ?? st.cellId),
          rx: Number(fu.rx ?? st.rx),
          ry: Number(fu.ry ?? st.ry),
          z: Number(fu.z ?? st.z),
          ruleId: fu.rule_id ?? null,
          question: fu.question,
          stakes: fu.stakes,
          actorIds: Array.isArray(fu.actor_ids) ? fu.actor_ids.map(String) : [],
          hook: fu.hook || {},
          clock: 0,
          clockMax: Number(fu.clock_max ?? 6),
        });
      }
    }
  }

  if (Array.isArray(opt.deltas) && opt.deltas.length > 0) {
    applyDeltasInMemory(branch, opt.deltas);
  }
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

  const baseWorld = await loadWorldSnapshot(pool);
  const startTick = Number(baseWorld.mutable.calendar.tick || 0);
  const actionTick = startTick || 1;

  const baseBurgs = new Map<number, { name: string; unrest: number; wealth: number; food: number; crime: number }>();
  for (const b of baseWorld.mutable.burgs.values()) {
    baseBurgs.set(b.burgId, {
      name: b.name,
      unrest: Number(b.unrest || 0),
      wealth: Number(b.wealth || 0),
      food: Number(b.food || 0),
      crime: Number(b.crimeRate || 0),
    });
  }

  const outcomes: PreviewOptionOutcome[] = [];

  for (let i = 0; i < rawOptions.length; i++) {
    const opt = rawOptions[i]!;
    const branch = cloneWorldSnapshot(baseWorld);
    applyPreviewOptionInMemory(branch, opt, input.proposalId, actionTick);

    let endTick = startTick;
    for (let d = 0; d < days; d++) {
      endTick += 1;
      runInMemoryDay(branch, endTick, {
        random: mulberry32(tickSeed(endTick)),
        tradeRouter: LIVE_TRADE_ROUTER,
      });
    }

    const sortedBurgs = Array.from(branch.mutable.burgs.values()).sort((a, b) => a.burgId - b.burgId);
    const burgDiffs: PreviewBurgDiff[] = [];
    for (const endBurg of sortedBurgs) {
      const b = baseBurgs.get(endBurg.burgId);
      if (!b) continue;
      const unrestDelta = Number((Number(endBurg.unrest || 0) - b.unrest).toFixed(2));
      const wealthDelta = Number((Number(endBurg.wealth || 0) - b.wealth).toFixed(2));
      const foodDelta = Number((Number(endBurg.food || 0) - b.food).toFixed(2));
      const crimeDelta = Number((Number(endBurg.crimeRate || 0) - b.crime).toFixed(2));
      if (unrestDelta !== 0 || wealthDelta !== 0 || foodDelta !== 0 || crimeDelta !== 0) {
        burgDiffs.push({
          burgId: endBurg.burgId,
          name: b.name,
          unrestDelta,
          wealthDelta,
          foodDelta,
          crimeDelta,
        });
      }
    }
    burgDiffs.sort((a, b) => Math.abs(b.unrestDelta) + Math.abs(b.wealthDelta) - (Math.abs(a.unrestDelta) + Math.abs(a.wealthDelta)));

    const majorEvents = branch.mutable.events
      .filter((e) => e.tick > startTick)
      .sort((a, b) => a.tick - b.tick || a.id - b.id)
      .slice(0, 20)
      .map((e) => ({
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
  }

  return { startTick, days, options: outcomes };
}
