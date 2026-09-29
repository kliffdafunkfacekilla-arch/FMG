import type { StatKey } from './data';

// Ouroboros Loop Path (Clockwise)
export const OUROBOROS_PATH: StatKey[] = [
  'willpower', 'might', 'fortitude', 'finesse', 'vitality', 'reflex', 
  'intuition', 'endurance', 'logic', 'knowledge', 'awareness', 'charm'
];

export interface MasteryPerk {
  stat: StatKey;
  level: number;
  name: string;
  desc: string;
}

export const MASTERY_PERKS: MasteryPerk[] = [
  { stat: 'might', level: 3, name: 'Heavy Lifter', desc: 'No movement penalties from encumbrance.' },
  { stat: 'might', level: 5, name: "Titan's Grip", desc: 'Wield 2H weapons in 1H.' },
  { stat: 'endurance', level: 3, name: 'Iron Lung', desc: 'Hold breath 1 hour; Immune to Suffocation.' },
  { stat: 'endurance', level: 5, name: 'Juggernaut', desc: 'Cannot be Pushed or Restrained.' },
  { stat: 'finesse', level: 3, name: 'Needle Threader', desc: 'Ignore Partial Cover penalties.' },
  { stat: 'finesse', level: 5, name: 'Perfect Balance', desc: 'Walk on liquids or smoke.' },
  { stat: 'reflex', level: 3, name: 'Catfall', desc: '0 Fall damage up to 50ft.' },
  { stat: 'reflex', level: 5, name: 'Bullet Time', desc: 'Gain 2 Reactions per round.' },
  { stat: 'vitality', level: 3, name: 'Fast Metabolism', desc: 'Healing applied is always maximized.' },
  { stat: 'vitality', level: 5, name: 'Troll Blood', desc: 'Regain 1 HP at start of every turn.' },
  { stat: 'fortitude', level: 3, name: 'Iron Stomach', desc: 'Immune to Ingested Poison/Disease.' },
  { stat: 'fortitude', level: 5, name: 'Unstoppable', desc: 'Downgrade Stun to Slow.' },
  { stat: 'knowledge', level: 3, name: 'Warding Ward', desc: '+2 Defense vs Spells.' },
  { stat: 'knowledge', level: 5, name: 'Master of All', desc: 'Use any Magic/Tech regardless of restriction.' },
  { stat: 'logic', level: 3, name: 'Geometry', desc: 'Ranged ignore penalty for shooting into melee.' },
  { stat: 'logic', level: 5, name: 'Cold Calculator', desc: 'Immune to Confusion and Chaos surges.' },
  { stat: 'awareness', level: 3, name: 'Sleepless', desc: 'Cannot be Surprised.' },
  { stat: 'awareness', level: 5, name: 'Blindsight', desc: 'See 30ft without eyes.' },
  { stat: 'intuition', level: 3, name: 'Danger Sense', desc: '+5 to Initiative.' },
  { stat: 'intuition', level: 5, name: 'Sixth Sense', desc: 'GM warns before traps/ambush.' },
  { stat: 'charm', level: 3, name: 'Silver Tongue', desc: 'Loot sold at 100% value.' },
  { stat: 'charm', level: 5, name: 'Cult Personality', desc: 'NPCs won\'t attack unless provoked.' },
  { stat: 'willpower', level: 3, name: 'Die Hard', desc: 'Death Save 10+ succeeds.' },
  { stat: 'willpower', level: 5, name: 'Mind Over Matter', desc: 'Spend Composure as Stamina/Focus.' }
];

export interface GearDef {
  id: string;
  name: string;
  type: 'physical' | 'mental';
  tax: number;
  armor_mod: number;
}

export const GEAR_DB: GearDef[] = [
  { id: 'g1', name: 'Heavy Melee / Thrown', type: 'physical', tax: 3, armor_mod: 0 },
  { id: 'g2', name: 'Polearms / Heavy Siege', type: 'physical', tax: 3, armor_mod: 0 },
  { id: 'g3', name: 'Light Blades / Thrown', type: 'physical', tax: 1, armor_mod: 0 },
  { id: 'g4', name: 'Long Blades / Ranged', type: 'physical', tax: 2, armor_mod: 0 },
  { id: 'g5', name: 'Natural / Blowguns', type: 'physical', tax: 0, armor_mod: 0 },
  { id: 'g6', name: 'Exotic / Black-Powder', type: 'physical', tax: 2, armor_mod: 0 },
  { id: 'g7', name: 'Anumis (Arcane Trophies)', type: 'mental', tax: 2, armor_mod: 0 },
  { id: 'g8', name: 'Ratio (Death-Whistles)', type: 'mental', tax: 2, armor_mod: 0 },
  { id: 'g9', name: 'Lux (Flash-Powders)', type: 'mental', tax: 2, armor_mod: 0 },
  { id: 'g10', name: 'Omen (Cursed Tokens)', type: 'mental', tax: 2, armor_mod: 0 },
  { id: 'g11', name: 'Aura (Majestic Regalia)', type: 'mental', tax: 2, armor_mod: 0 },
  { id: 'g12', name: 'Lex (Visceral Execution)', type: 'mental', tax: 2, armor_mod: 0 }
];

export interface SkillDef {
  id: string;
  name: string;
  type: string;
  cost: string;
  desc: string;
}

export const SKILL_DB: SkillDef[] = [
  { id: 's1', name: 'Tactician', type: 'General', cost: 'Action', desc: 'Give Ally +1d4 to next Attack roll.' },
  { id: 's2', name: 'Command', type: 'General', cost: 'Action', desc: 'Forgo attack; Ally makes immediate attack.' },
  { id: 's3', name: 'Kinetic Punch', type: 'Active (Stamina)', cost: '2 S', desc: 'Push target 10ft in any direction.' },
  { id: 's4', name: 'Anchor', type: 'Active (Stamina)', cost: '1 S', desc: 'Reaction: Ignore Push/Prone; +2 Def.' },
  { id: 's5', name: 'Telekinetic Shove', type: 'Active (Focus)', cost: '2 F', desc: '1d4 Force; Push 5ft.' },
  { id: 's6', name: 'Scan', type: 'Active (Focus)', cost: '1 F', desc: 'Learn one Stat/Attribute of target.' }
];

export const ADRENALINE_LIST: string[] = [
  "Surge of Strength: +1d4 to next physical attack.",
  "Desperate Evasion: Reroll a failed dodge/reflex save.",
  "Ignore Pain: Temporarily ignore wound penalties for 1 round.",
  "Sudden Clarity: Instantly recharge 1 Focus or Stamina token.",
  "Furious Strike: Your next attack causes Bleed."
];
