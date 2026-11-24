import type { StorylineScale, ThreadWorldDelta } from "../../threads/threadEngine.js";

export type StorySourceName = "reaction" | "drama" | "world" | "director" | "gm" | "escalation";

export interface StoryFactRef {
  kind: string;
  id: string;
  summary: string;
}

export interface StoryHookSpec {
  dialogueLine?: string | undefined;
  clueName?: string | undefined;
  clueDescription?: string | undefined;
  targetObjectRef?: string | null | undefined;
  rumor?: string | undefined;
}

export interface StoryProposalBeatSpec {
  phase: number;
  objective: string;
  discovery?: string | undefined;
}

export interface StoryProposalSpec {
  scale: StorylineScale;
  parent_id?: number | null | undefined;
  scope_cells: number[];
  cell_id: number;
  rx: number;
  ry: number;
  z?: number | undefined;
  question: string;
  stakes: string;
  actor_ids: string[];
  clock_max?: number | undefined;
  source: StorySourceName;
  origin?: string | undefined;
  rule_id?: string | null | undefined;
  arc_key?: string | null | undefined;
  why: string;
  facts: StoryFactRef[];
  hook?: StoryHookSpec | undefined;
  rank_score?: number | undefined;
  beats?: StoryProposalBeatSpec[] | undefined;
  on_expire?: ThreadWorldDelta | undefined;
  on_resolved_by_party?: ThreadWorldDelta | undefined;
}
