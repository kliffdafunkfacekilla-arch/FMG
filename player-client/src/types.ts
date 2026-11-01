export interface InjectedProp {
  id: string;
  name: string;
  pos: [number, number];
  tags: string[];
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
  inventory?: string[];
}

export interface InjectedNPC {
  id: string;
  name: string;
  role: string;
  pos: [number, number];
  tags: string[];
  faction: string;
  hp: number;
  maxHp: number;
  disposition: number;
  alive: boolean;
  stats?: Record<string, number>;
  statAffinity?: string;
  kingdom?: string;
  species?: string;
  inventory?: string[];
  equippedWeapon?: string;
  equippedArmor?: string;
  moveRange?: number;
  currentStamina?: number;
  maxStaminaPool?: number;
  currentFocus?: number;
  maxFocusPool?: number;
  stealth?: number;
  perception?: number;
  isStealthed?: boolean;
  herdId?: string;
  aiState?: 'GRAZING' | 'DRINKING' | 'STALKING' | 'HUNTING' | 'FLEEING' | 'IDLE';
  alertTimer?: number;
  preyTargetId?: string;
  homePos?: [number, number];
  workPos?: [number, number];
  currentTask?: string;
  scheduleState?: 'WORK' | 'LEISURE' | 'SLEEP' | 'AMBUSH';
}

export interface QuestObjective {
  id: string;
  type: string;
  description: string;
  targetId: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
}

export interface StoryBeat {
  beatId: string;
  category: string;
  title: string;
  hook: string;
  questGiver: { name: string; role: string; faction?: string };
  opposingFaction?: string;
  objectives: QuestObjective[];
  rewards: { xp: number; gold: number; item?: string };
  pivotDecision: string;
  variants: Array<{
    name: string;
    description: string;
    preferredStat: string;
  }>;
}

export interface SaveSlot {
  id: number;
  name: string;
  kingdom: string;
  lineage: string;
  level: number;
  gold: number;
  difficulty?: string;
  current_cell_id?: number;
  saved_at: string;
}

export const BODY_STAT_KEYS: string[] = ['might', 'endurance', 'finesse', 'reflex', 'vitality', 'fortitude'];
export const MIND_STAT_KEYS: string[] = ['knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];


export interface QuickPreset {
  name: string;
  tagline: string;
  desc: string;
  icon: string;
  kingdom: string;
  lineage: string;
  institution: string;
  body7: string;
  body4: string;
  body6: string;
  body3: string;
  mind7: string;
  mind4: string;
  dualTrack: boolean;
  powerBranchChoice: 'OFFENSE' | 'DEFENSE';
  powerBranchChoice2?: 'OFFENSE' | 'DEFENSE';
  trackId: string;
  trackId2?: string;
  offenseSkillId: string;
  offenseBranchChoice: 'SPECIALIZATION' | 'VERSATILITY';
  defenseSkillId: string;
  defenseBranchChoice: 'SPECIALIZATION' | 'VERSATILITY';
  weapon: string;
  armor: string;
}

export interface TacticalRollCard {
  id: string;
  timestamp: number;
  attackerName: string;
  attackerRoll: number;
  attackerStatKey: string;
  attackerStatVal: number;
  attackerMod: number;
  attackerTotal: number;
  defenderName: string;
  defenderRoll: number;
  defenderStatKey: string;
  defenderStatVal: number;
  defenderMod: number;
  defenderTotal: number;
  difference: number;
  injuryPoints: number;
  hit: boolean;
  coverBonus?: number;
  coverLevel?: 'NONE' | 'HALF' | 'FULL';
  weaponName?: string;
  armorName?: string;
  notes?: string;
}

export type CombatPhase = 'MOVEMENT' | 'DECLARATION' | 'RESOLUTION';
export type LoadoutTier = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export interface CombatParticipant {
  id: string;
  name: string;
  pos: [number, number];
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  composure?: number;
  maxComposure?: number;
  movementSpeed: number;
  perception: number;
  stealth: number;
  resilience: number;
  moveRange: number; // Tiles allowed per move action
  hasMoved: boolean;
  hasUsedStaminaAction: boolean;
  hasUsedFocusAction: boolean;
  currentStamina: number;
  maxStaminaPool: number; // 10, 5, or 3 based on loadout fee
  staminaTier: LoadoutTier;
  staminaRegenRate: number; // 1, 0.5, or 0.33
  currentFocus: number;
  maxFocusPool: number; // 10, 5, or 3 based on loadout fee
  focusTier: LoadoutTier;
  focusRegenRate: number; // 1, 0.5, or 0.33
  declaredAction?: {
    actionType: 'stamina' | 'focus' | 'both' | 'guard';
    actionName: string;
    targetId?: string;
    targetName?: string;
    staminaCost: number;
    focusCost: number;
  } | null;
  // Backwards compatibility fields
  ap: number;
  maxAp: number;
  initiative: number;
  statAffinity?: string;
  equippedWeapon?: string;
  equippedArmor?: string;
  disposition?: number;
  alive: boolean;
  isStealthed?: boolean;
}

export interface TacticalCombatState {
  inCombat: boolean;
  roundNumber: number;
  turnIndex: number;
  phase: CombatPhase;
  phaseTurnOrder: string[];
  activeTurnUnitId: string | null;
  playerStamina: number;
  playerMaxStaminaPool: number;
  playerStaminaTier: LoadoutTier;
  playerFocus: number;
  playerMaxFocusPool: number;
  playerFocusTier: LoadoutTier;
  playerHasMoved: boolean;
  playerHasUsedStaminaAction: boolean;
  playerHasUsedFocusAction: boolean;
  playerIsStealthed?: boolean;
  // Backwards compatibility fields
  playerAp: number;
  playerMaxAp: number;
  turnOrder: string[];
  participants: Map<string, CombatParticipant>;
  lastRollCard: TacticalRollCard | null;
}

