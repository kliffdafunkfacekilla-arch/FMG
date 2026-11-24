/**
 * Shared types and helpers for the Rule-6 split of BrutalGameMaster (Phase 12.3):
 * intent -> resolve -> narrate -> consequences.
 */
import type { ClashStance, BrutalInjuryTier } from "../../combatResolutionEngine.js";
import type { EntityInjuryState } from "../../injuryEngine.js";
import type { StatKey } from "../EquipmentRegistry.js";
import type { TagInteractionResult, TaggedObject } from "../TagMatrixEngine.js";
import type { InjectedNPC, SectorContext } from "../WhatElseStoryEngine.js";
import { migrateFoeToStack, type FoeStackState, type FoeStake } from "../foeStack.js";

export interface ActionInput {
  actionText: string;
  playerId: number;
  playerPos: [number, number];
  coverBonus?: number | undefined;
  coverLevel?: ("NONE" | "HALF" | "FULL") | undefined;
  combatType?: ("melee" | "ranged") | undefined;
  isStealthed?: boolean | undefined;
  sneakAttack?: boolean | undefined;
  stance?: ClashStance | undefined;
  otherSpeakersCount?: number | undefined;
  alreadySpokenToTargetThisRound?: boolean | undefined;
  playerStats?: {
    stamina?: number | undefined;
    focus?: number | undefined;
    composure?: number | undefined;
    owed?: { stamina: number; focus: number } | undefined;
  } | undefined;
  grid?: number[] | Uint8Array | undefined;
  zLayer?: number | undefined;
  spokenDialogue?: string | undefined;
  recentContext?: string[] | undefined;
  playerName?: string | undefined;
  playerSpecies?: string | undefined;
  /** When true, fail loudly (LlmError) if Ollama is down, returns invalid JSON/empty, or breaks character instead of faking output. */
  strictLlm?: boolean | undefined;
}

export type ActionCategory =
  | "COMBAT"
  | "MAGIC"
  | "SOCIAL"
  | "SUBTERFUGE"
  | "EXPLORATION"
  | "SURVIVAL"
  | "CREATIVE_CHECK";

export interface ParsedIntent {
  category: ActionCategory;
  verb: string;
  targetId: string;
  targetName: string;
  statUsed: string;
  isCombat: boolean;
}

export interface GMResolutionOutput {
  success: boolean;
  intent: ParsedIntent;
  rollOutcome: {
    playerRoll: number;
    playerStatVal: number;
    dcOrDefenderRoll: number;
    difference: number;
    injuryPoints: number;
    hit: boolean;
    attackerRoll?: number;
    attackerStatKey?: string;
    attackerStatVal?: number;
    attackerMod?: number;
    attackerTotal?: number;
    defenderRoll?: number;
    defenderStatKey?: string;
    defenderStatVal?: number;
    defenderMod?: number;
    defenderTotal?: number;
    coverBonus?: number;
    coverLevel?: string;
    weaponName?: string;
    armorName?: string;
  };
  tagResult?: TagInteractionResult | undefined;
  systemLog: string;
  narrativeResponse: string;
  dialogue?: string | undefined;
  lootAwarded?: {
    gold: number;
    item?: string | undefined;
  } | undefined;
  playerInjuryState?: EntityInjuryState | undefined;
  foeStackState?: FoeStackState | undefined;
  activeBeat: any;
  openThreads?: any[];
  worldDelta: {
    propsDestroyed: string[];
    npcsDefeated: string[];
  };
}

export type ModelCaller = (
  contents: any,
  systemInstruction: string,
  maxOutputTokens?: number,
  temperature?: number
) => Promise<string | null>;

export type StrictModelCaller = (
  stage: string,
  contents: any,
  systemInstruction: string,
  maxOutputTokens?: number,
  temperature?: number
) => Promise<string>;

export interface SocialDialogueRequest {
  npcName: string;
  npcRole: string;
  npcFaction: string;
  targetNPC: InjectedNPC | undefined;
  targetFactionRep: number;
  actionText: string;
  hit: boolean;
  socialOutcomeNote: string;
  isMoraleBroken: boolean;
}

export interface GmMechanicsResult {
  earlyReturn?: GMResolutionOutput | undefined;
  playerRoll: number;
  dcOrDefenderRoll: number;
  difference: number;
  hit: boolean;
  injuryPoints: number;
  detailedRollOutcome: any;
  tagResult?: TagInteractionResult | undefined;
  lootAwarded?: { gold: number; item?: string | undefined } | undefined;
  propLooted: boolean;
  xpGained: number;
  playerComposure: number;
  systemLog: string;
  customNarrative?: string | undefined;
  socialDialogueRequest?: SocialDialogueRequest | undefined;
}

export interface GmTurnContextSlice {
  activeContext: SectorContext | null;
  activeProps: Map<string, TaggedObject>;
  activeNPCs: Map<string, InjectedNPC>;
}

export const STAT_KEYS: readonly StatKey[] = [
  "might", "endurance", "finesse", "reflex", "vitality", "fortitude",
  "knowledge", "logic", "awareness", "intuition", "charm", "willpower"
];

export function extractStatsMap(entity: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of STAT_KEYS) {
    out[k] = Number(entity?.[k]) || 5;
  }
  return out;
}

export function inferFoeStake(npc: InjectedNPC): FoeStake {
  if (npc.stake) return npc.stake;
  const hay = `${npc.role || ""} ${npc.name || ""} ${(npc.tags || []).join(" ")}`.toLowerCase();
  if (npc.isBoss || /#boss|\b(dragon|colossus|leviathan|archon)\b/.test(hay)) return "boss";
  if (/\b(captain|commander|leader|chief|burgomaster|reeve|marshal|warlord|paragon|boss)\b/.test(hay)) return "leader";
  if (/\b(zealot|fanatic|cultist|inquisitor|mandate)\b/.test(hay)) return "fanatic";
  if (/\b(guard|warden|sentinel|knight|veteran|soldier|watch|outlaw|raider)\b/.test(hay)) return "veteran";
  if (/\b(thug|bandit|smuggler|cutthroat|brigand|pickpocket)\b/.test(hay)) return "hireling";
  return "rank-and-file";
}

export function ensureNpcFoeStack(npc: InjectedNPC): FoeStackState {
  if (npc.foeStack) return npc.foeStack;
  const stake = inferFoeStake(npc);
  const maxHp = Math.max(4, npc.maxHp || npc.hp || 10);
  const stackSize = Math.max(1, Math.ceil(maxHp / 2));
  const traits: Array<{ name: string; kind: "core" | "trait" | "ability"; copies: number; grants?: string[] }> = [];
  if (stake !== "boss" && stackSize >= 3) {
    if (stake === "leader") {
      traits.push({ name: "Command", kind: "ability", copies: 1, grants: ["Rally Allies"] });
    } else if (stake === "fanatic") {
      traits.push({ name: "Zealotry", kind: "trait", copies: 1 });
    } else if (stake === "veteran") {
      traits.push({ name: "Shield Wall", kind: "trait", copies: 1 });
    } else {
      traits.push({ name: "Skirmish", kind: "trait", copies: 1 });
    }
  }
  npc.stake = stake;
  npc.isBoss = stake === "boss";
  npc.foeStack = migrateFoeToStack({
    id: npc.id,
    name: npc.name,
    health: maxHp,
    composure: npc.composure ?? 12,
    stake,
    isBoss: npc.isBoss,
    traits
  });
  return npc.foeStack;
}
