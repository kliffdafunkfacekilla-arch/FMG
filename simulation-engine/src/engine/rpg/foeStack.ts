/**
 * B.R.U.T.A.L. TTRPG Foes as Cards & Resolve Stack Engine (v5.0)
 * ================================================================
 * - Non-boss foes use `cards` and `resolve` instead of hero Health/Composure pools.
 * - Bosses keep Health and Composure pools (`isBoss: true`).
 * - Body hits shred cards: Graze 0, Minor 2, Major 4, Critical 6.
 *   Trait and ability copies go first (at random); core goes last.
 * - Aimed attacks name a visible card, roll at Disadvantage, and shred that card first.
 * - `visible` defaults to true; cards granting other foes actions (Command, Rally, war-horn)
 *   are always visible.
 * - Resolve by stake: hireling 2, rank-and-file 4, veteran/leader 6, fanatic 8.
 *   Foes never roll Shocks; events directly cost Resolve.
 * - At half Resolve or below: emits a "wavering" narration line.
 * - At 0 Resolve: `seeking_exit` (accepts any offer of quarter), except `fanatic` -> `broken`.
 */

import {
  AttackRollParams,
  BrutalInjuryTier,
  ContestedCombatResult,
  DefenseParams,
  resolveContestedAttack
} from '../combatResolutionEngine.js';

export type FoeCardKind = 'core' | 'trait' | 'ability';

export type FoeStake = 'hireling' | 'rank-and-file' | 'veteran' | 'leader' | 'fanatic' | 'boss';

export const RESOLVE_BY_STAKE: Record<Exclude<FoeStake, 'boss'>, number> = {
  hireling: 2,
  'rank-and-file': 4,
  veteran: 6,
  leader: 6,
  fanatic: 8
};

export interface FoeCardInput {
  name: string;
  kind: FoeCardKind;
  copies: number;
  tags?: string[] | undefined;
  grants?: string[] | undefined;
  visible?: boolean | undefined;
  givesOtherFoesActions?: boolean | undefined;
  onLost?: ((foe: FoeStackState) => void) | undefined;
}

export interface FoeCard {
  name: string;
  kind: FoeCardKind;
  copies: number;
  maxCopies: number;
  tags: string[];
  grants: string[];
  visible: boolean;
  givesOtherFoesActions: boolean;
  onLost?: ((foe: FoeStackState) => void) | undefined;
}

export type FoeStatus = 'active' | 'wavering' | 'seeking_exit' | 'broken' | 'down';

export interface FoeStackState {
  id: string;
  name: string;
  stake: FoeStake;
  isBoss: boolean;
  cards: FoeCard[];
  resolve: number;
  maxResolve: number;
  activeGrants: string[];
  status: FoeStatus;
  acceptsQuarter: boolean;
  dyingRounds?: number | null | undefined;
  // Bosses keep Health & Composure instead of cards/resolve
  health?: number | undefined;
  maxHealth?: number | undefined;
  composure?: number | undefined;
  maxComposure?: number | undefined;
  narrationLog: string[];
}

export type FoeResolveLossReason =
  | 'GRAZE'
  | 'NEAR_MISS'
  | 'BLEED'
  | 'THROWN'
  | 'TRIPPED'
  | 'DISARMED'
  | 'MAJOR_HIT'
  | 'CRITICAL_HIT'
  | 'ADJACENT_ALLY_DROPPED'
  | 'FIRE_MAGIC_MONSTER'
  | 'COMPOSURE_ATTACK'
  | 'LEADER_DOWN';

function isCommandOrActionCard(card: FoeCardInput): boolean {
  if (card.givesOtherFoesActions) return true;
  if (/command|rally|war[- ]?horn/i.test(card.name)) return true;
  return (card.tags || []).some(t => /command|rally|war[- ]?horn/i.test(t));
}

function normalizeCard(input: FoeCardInput): FoeCard {
  const givesActions = isCommandOrActionCard(input);
  return {
    name: input.name,
    kind: input.kind,
    copies: Math.max(0, input.copies),
    maxCopies: Math.max(0, input.copies),
    tags: [...(input.tags || [])],
    grants: [...(input.grants || [])],
    visible: givesActions ? true : (input.visible ?? true),
    givesOtherFoesActions: givesActions,
    onLost: input.onLost
  };
}

/**
 * Creates a v5.0 card-stack foe (or Health/Composure boss).
 */
export function createFoeStack(params: {
  id: string;
  name: string;
  stake: FoeStake;
  isBoss?: boolean | undefined;
  cards?: FoeCardInput[] | undefined;
  v49Health?: number | undefined;
  v49Composure?: number | undefined;
}): FoeStackState {
  const isBoss = !!params.isBoss || params.stake === 'boss';
  if (isBoss) {
    const maxHealth = params.v49Health ?? 20;
    const maxComposure = params.v49Composure ?? 14;
    return {
      id: params.id,
      name: params.name,
      stake: 'boss',
      isBoss: true,
      cards: [],
      resolve: 0,
      maxResolve: 0,
      activeGrants: [],
      status: 'active',
      acceptsQuarter: false,
      health: maxHealth,
      maxHealth,
      composure: maxComposure,
      maxComposure,
      narrationLog: []
    };
  }

  const stackSize = Math.max(1, Math.ceil((params.v49Health ?? 10) / 2));
  const rawCards: FoeCardInput[] = params.cards && params.cards.length > 0
    ? params.cards
    : [{ name: 'Core', kind: 'core', copies: stackSize }];
  const cards = rawCards.map(normalizeCard);
  const activeGrants = Array.from(
    new Set(cards.filter(c => c.copies > 0).flatMap(c => c.grants))
  );
  const maxResolve = RESOLVE_BY_STAKE[params.stake as Exclude<FoeStake, 'boss'>] ?? 4;

  return {
    id: params.id,
    name: params.name,
    stake: params.stake,
    isBoss: false,
    cards,
    resolve: maxResolve,
    maxResolve,
    activeGrants,
    status: 'active',
    acceptsQuarter: false,
    dyingRounds: null,
    narrationLog: []
  };
}

/**
 * Migrates legacy v4.9 foe data into v5.0 cards + resolve (`stackSize = ceil(health / 2)`).
 * Bosses preserve their Health & Composure pools.
 */
export function migrateFoeToStack(legacy: {
  id: string;
  name: string;
  health: number;
  composure?: number | undefined;
  stake?: FoeStake | undefined;
  isBoss?: boolean | undefined;
  traits?: FoeCardInput[] | undefined;
}): FoeStackState {
  const stake = legacy.stake ?? 'rank-and-file';
  if (legacy.isBoss || stake === 'boss') {
    return createFoeStack({
      id: legacy.id,
      name: legacy.name,
      stake: 'boss',
      isBoss: true,
      v49Health: legacy.health,
      v49Composure: legacy.composure ?? 14
    });
  }

  const stackSize = Math.max(1, Math.ceil(legacy.health / 2));
  const extraCards: FoeCardInput[] = [];
  let used = 0;

  for (const t of legacy.traits || []) {
    if (used >= stackSize - 1) break;
    const take = Math.min(Math.max(1, t.copies || 1), stackSize - 1 - used);
    extraCards.push({ ...t, copies: take });
    used += take;
  }

  const coreCopies = Math.max(1, stackSize - used);
  const cards: FoeCardInput[] = [
    { name: 'Core', kind: 'core', copies: coreCopies },
    ...extraCards
  ];

  return createFoeStack({
    id: legacy.id,
    name: legacy.name,
    stake,
    isBoss: false,
    cards
  });
}

export function getTotalFoeCards(foe: FoeStackState): number {
  return foe.cards.reduce((sum, c) => sum + Math.max(0, c.copies), 0);
}

function getShredCountForTier(tier: BrutalInjuryTier): number {
  switch (tier) {
    case 'MINOR':
      return 2;
    case 'MAJOR':
      return 4;
    case 'CRITICAL':
      return 6;
    case 'GRAZE':
    default:
      return 0;
  }
}

export interface ShredCardsResult {
  foe: FoeStackState;
  shreddedCount: number;
  shreddedByCard: Record<string, number>;
  lostCardNames: string[];
  removedGrants: string[];
  droppedDown: boolean;
}

/**
 * Shreds foe cards from a Body hit (Minor 2, Major 4, Critical 6).
 * If `aimedCardName` is given (and visible), that card is shredded first.
 * Otherwise trait and ability copies go first (randomly), and core goes last.
 */
export function shredFoeCards(
  foe: FoeStackState,
  tier: BrutalInjuryTier,
  options: {
    aimedCardName?: string | undefined;
    rng?: (() => number) | undefined;
  } = {}
): ShredCardsResult {
  if (foe.isBoss) {
    return {
      foe,
      shreddedCount: 0,
      shreddedByCard: {},
      lostCardNames: [],
      removedGrants: [],
      droppedDown: false
    };
  }

  const rng = options.rng ?? Math.random;
  let toShred = getShredCountForTier(tier);
  const cards: FoeCard[] = foe.cards.map(c => ({
    ...c,
    tags: [...c.tags],
    grants: [...c.grants]
  }));

  const shreddedByCard: Record<string, number> = {};
  const newlyExhausted: FoeCard[] = [];

  const decrementCard = (card: FoeCard) => {
    card.copies = Math.max(0, card.copies - 1);
    shreddedByCard[card.name] = (shreddedByCard[card.name] ?? 0) + 1;
    toShred--;
    if (card.copies === 0) {
      newlyExhausted.push(card);
    }
  };

  // 1. Aimed attack shreds named visible card first
  if (options.aimedCardName && toShred > 0) {
    const aimed = cards.find(
      c => c.visible && c.copies > 0 && c.name.toLowerCase() === options.aimedCardName!.toLowerCase()
    );
    while (aimed && aimed.copies > 0 && toShred > 0) {
      decrementCard(aimed);
    }
  }

  // 2. Remaining hits shred trait and ability copies first at random, core last
  while (toShred > 0) {
    const nonCore = cards.filter(c => c.kind !== 'core' && c.copies > 0);
    if (nonCore.length > 0) {
      const pick = nonCore[Math.floor(rng() * nonCore.length)]!;
      decrementCard(pick);
      continue;
    }

    const core = cards.filter(c => c.kind === 'core' && c.copies > 0);
    if (core.length > 0) {
      const pick = core[Math.floor(rng() * core.length)]!;
      decrementCard(pick);
      continue;
    }

    break;
  }

  // Remove lost grants and record lost cards
  const activeGrants = Array.from(
    new Set(cards.filter(c => c.copies > 0).flatMap(c => c.grants))
  );
  const removedGrants = foe.activeGrants.filter(g => !activeGrants.includes(g));
  const lostCardNames = newlyExhausted.map(c => c.name);

  const remainingTotal = cards.reduce((s, c) => s + c.copies, 0);
  const droppedDown = remainingTotal === 0;

  const updatedFoe: FoeStackState = {
    ...foe,
    cards,
    activeGrants,
    status: droppedDown ? 'down' : foe.status,
    dyingRounds: droppedDown ? (foe.dyingRounds ?? 6) : foe.dyingRounds,
    narrationLog: droppedDown
      ? [...foe.narrationLog, `${foe.name} is out of cards and goes down (6 rounds).`]
      : [...foe.narrationLog]
  };

  for (const lostCard of newlyExhausted) {
    lostCard.onLost?.(updatedFoe);
  }

  return {
    foe: updatedFoe,
    shreddedCount: Object.values(shreddedByCard).reduce((a, b) => a + b, 0),
    shreddedByCard,
    lostCardNames,
    removedGrants,
    droppedDown
  };
}

export interface ResolveLossResult {
  foe: FoeStackState;
  squad: FoeStackState[];
  resolveLost: number;
  narration: string | null;
}

const CHECK_TIER_COST: Record<BrutalInjuryTier, number> = {
  NONE: 0,
  GRAZE: 1,
  MINOR: 2,
  MAJOR: 4,
  CRITICAL: 6
};

/**
 * Applies deterministic Resolve loss to a foe (v5.0 Step 8).
 * Foes never roll Shocks. Zero dice are rolled here.
 */
export function applyFoeResolveLoss(
  foe: FoeStackState,
  reason: FoeResolveLossReason,
  options: {
    composureTier?: BrutalInjuryTier | undefined;
    squad?: FoeStackState[] | undefined;
  } = {}
): ResolveLossResult {
  let squad = (options.squad || []).map(member => ({
    ...member,
    cards: member.cards.map(c => ({ ...c })),
    activeGrants: [...member.activeGrants],
    narrationLog: [...member.narrationLog]
  }));

  if (foe.isBoss && reason !== 'LEADER_DOWN') {
    return { foe, squad, resolveLost: 0, narration: null };
  }

  let loss = 0;
  switch (reason) {
    case 'GRAZE':
    case 'NEAR_MISS':
    case 'BLEED':
    case 'THROWN':
    case 'TRIPPED':
    case 'DISARMED':
      loss = 1;
      break;
    case 'MAJOR_HIT':
    case 'CRITICAL_HIT':
    case 'ADJACENT_ALLY_DROPPED':
    case 'FIRE_MAGIC_MONSTER':
      loss = 2;
      break;
    case 'COMPOSURE_ATTACK':
      loss = CHECK_TIER_COST[options.composureTier ?? 'MINOR'];
      break;
    case 'LEADER_DOWN':
      loss = foe.stake === 'hireling' || foe.stake === 'rank-and-file' ? foe.resolve : 0;
      break;
  }

  let updatedFoe = foe;
  let narration: string | null = null;

  if (!foe.isBoss) {
    const nextResolve = Math.max(0, foe.resolve - loss);
    const halfResolve = Math.floor(foe.maxResolve / 2);
    const narrationLog = [...foe.narrationLog];
    let status: FoeStatus = foe.status;
    let acceptsQuarter = foe.acceptsQuarter;

    if (nextResolve === 0) {
      if (foe.stake === 'fanatic') {
        status = foe.status === 'down' ? 'down' : 'broken';
        acceptsQuarter = false;
        narration = `${foe.name} breaks completely (0/${foe.maxResolve} Resolve, out of the fight).`;
      } else {
        status = foe.status === 'down' ? 'down' : 'seeking_exit';
        acceptsQuarter = true;
        narration = `${foe.name} is seeking exit (0/${foe.maxResolve} Resolve, will accept quarter).`;
      }
      narrationLog.push(narration);
    } else if (nextResolve <= halfResolve) {
      if (status === 'active') status = 'wavering';
      narration = `${foe.name} is wavering (${nextResolve}/${foe.maxResolve} Resolve).`;
      narrationLog.push(narration);
    }

    updatedFoe = {
      ...foe,
      resolve: nextResolve,
      status,
      acceptsQuarter,
      narrationLog
    };
  }

  // When a leader drops/breaks or LEADER_DOWN is triggered, every hireling and rank-and-file goes to 0 Resolve
  if (reason === 'LEADER_DOWN' || (foe.stake === 'leader' && (updatedFoe.status === 'down' || updatedFoe.resolve === 0))) {
    squad = squad.map(member => {
      if (!member.isBoss && (member.stake === 'hireling' || member.stake === 'rank-and-file')) {
        const line = `${member.name} loses heart as leader falls (0/${member.maxResolve} Resolve, seeking exit).`;
        return {
          ...member,
          resolve: 0,
          status: member.status === 'down' ? 'down' : 'seeking_exit',
          acceptsQuarter: true,
          narrationLog: [...member.narrationLog, line]
        };
      }
      return member;
    });
  }

  return {
    foe: updatedFoe,
    squad,
    resolveLost: loss,
    narration
  };
}

/**
 * Applies a hit's tier to a foe stack: shreds Body cards AND applies Resolve loss for Graze/Major/Critical.
 */
export function applyHitToFoe(
  foe: FoeStackState,
  tier: BrutalInjuryTier,
  options: {
    aimedCardName?: string | undefined;
    rng?: (() => number) | undefined;
    squad?: FoeStackState[] | undefined;
  } = {}
): {
  shred: ShredCardsResult;
  resolveResult: ResolveLossResult;
  foe: FoeStackState;
  squad: FoeStackState[];
} {
  const shred = shredFoeCards(foe, tier, {
    aimedCardName: options.aimedCardName,
    rng: options.rng
  });

  let resolveReason: FoeResolveLossReason | null = null;
  if (tier === 'GRAZE') resolveReason = 'GRAZE';
  else if (tier === 'MAJOR') resolveReason = 'MAJOR_HIT';
  else if (tier === 'CRITICAL') resolveReason = 'CRITICAL_HIT';

  const resolveResult = resolveReason
    ? applyFoeResolveLoss(shred.foe, resolveReason, { squad: options.squad })
    : { foe: shred.foe, squad: options.squad || [], resolveLost: 0, narration: null };

  return {
    shred,
    resolveResult,
    foe: resolveResult.foe,
    squad: resolveResult.squad
  };
}

/**
 * Resolves an aimed attack naming a visible card on a foe (v5.0 Step 8):
 * - Attacker MUST name a visible card.
 * - Rolls at Disadvantage.
 * - On hit, shreds that named card first.
 */
export function resolveAimedAttackOnFoe(
  attacker: AttackRollParams,
  defender: DefenseParams,
  foe: FoeStackState,
  aimedCardName: string,
  rng?: () => number
): {
  validAimedTarget: boolean;
  reason?: string | undefined;
  combat: ContestedCombatResult | null;
  foe: FoeStackState;
  shred: ShredCardsResult | null;
} {
  const targetCard = foe.cards.find(
    c => c.name.toLowerCase() === aimedCardName.toLowerCase() && c.copies > 0
  );

  if (!targetCard) {
    return {
      validAimedTarget: false,
      reason: `Card "${aimedCardName}" has no remaining copies on ${foe.name}.`,
      combat: null,
      foe,
      shred: null
    };
  }

  if (!targetCard.visible) {
    return {
      validAimedTarget: false,
      reason: `Card "${aimedCardName}" is hidden and cannot be targeted by an aimed attack.`,
      combat: null,
      foe,
      shred: null
    };
  }

  const combat = resolveContestedAttack(
    { ...attacker, hasDisadvantage: true },
    defender
  );

  if (combat.outcome !== 'ATTACKER_SUCCESS' || combat.tier === 'NONE') {
    return {
      validAimedTarget: true,
      combat,
      foe,
      shred: null
    };
  }

  const applied = applyHitToFoe(foe, combat.tier, {
    aimedCardName: targetCard.name,
    rng
  });

  return {
    validAimedTarget: true,
    combat,
    foe: applied.foe,
    shred: applied.shred
  };
}

