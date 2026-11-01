import React, { useState } from 'react';
import { calculatePoolTier } from '../../utils/TacticalCombatHelper';

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'mental_weapon' | 'mental_armor' | 'offhand' | 'trinket';
  stat: string;
  rating: number; // Added to roll (+1, +2, +3)
  loadoutCost: number; // Fee deducted from stamina or focus
  isBodyStat: boolean;
  bonusValue: number; // damage bonus or damage reduction
  bonusEffects?: string[];
  description: string;
}

// Built-in 12-stat catalog representing the full physical and mental matrix
export const CATALOG_EQUIPMENT: EquipmentItem[] = [
  // Physical Weapons (Body Stats)
  {
    id: 'w_osmium_greatsword',
    name: 'Osmium Greatsword',
    category: 'weapon',
    stat: 'might',
    rating: 2,
    loadoutCost: 4,
    isBodyStat: true,
    bonusValue: 2,
    bonusEffects: ['Heavy Cleave', 'Armor Crush'],
    description: 'A colossal two-handed greatsword forged of dense bluish Osmium. Delivers devastating cleaving blows.'
  },
  {
    id: 'w_bastion_spear',
    name: 'Titanium Bastion Spear',
    category: 'weapon',
    stat: 'endurance',
    rating: 2,
    loadoutCost: 3,
    isBodyStat: true,
    bonusValue: 1,
    bonusEffects: ['Reach', 'Phalanx Stance'],
    description: 'An unyielding polearm tipped with cold Titanium, favored by phalanx wardens to hold ground.'
  },
  {
    id: 'w_duelist_rapier',
    name: 'Gilded Duelist Rapier',
    category: 'weapon',
    stat: 'finesse',
    rating: 3,
    loadoutCost: 3,
    isBodyStat: true,
    bonusValue: 1,
    bonusEffects: ['Armor Piercing', 'Swift Riposte'],
    description: 'A slender needle blade with an electro-gilded guard for precise lunges at vital seams.'
  },
  {
    id: 'w_recurve_bow',
    name: 'Composite Reflex Bow',
    category: 'weapon',
    stat: 'reflex',
    rating: 2,
    loadoutCost: 2,
    isBodyStat: true,
    bonusValue: 2,
    bonusEffects: ['Ranged 6', 'Quick Draw'],
    description: 'A composite recurve bow that looses arrows with explosive velocity.'
  },
  {
    id: 'w_workday_blade',
    name: 'Frontier Hunting Cleaver',
    category: 'weapon',
    stat: 'vitality',
    rating: 1,
    loadoutCost: 2,
    isBodyStat: true,
    bonusValue: 1,
    bonusEffects: ['Butcher', 'Lifesteal 1'],
    description: 'A rugged butcher blade seasoned by wilderness survival.'
  },
  {
    id: 'w_tower_shield',
    name: 'Spiked Pavise Bulwark',
    category: 'offhand',
    stat: 'fortitude',
    rating: 2,
    loadoutCost: 3,
    isBodyStat: true,
    bonusValue: 2,
    bonusEffects: ['Cover Heavy', 'Shield Bash'],
    description: 'A ground-anchored pavise shield that deflects incoming volleys and bludgeons.'
  },

  // Physical Armors (Body Stats)
  {
    id: 'a_osmium_plate',
    name: 'Juggernaut Osmium Plate',
    category: 'armor',
    stat: 'might',
    rating: 2,
    loadoutCost: 5,
    isBodyStat: true,
    bonusValue: 3,
    bonusEffects: ['Damage Reduction 3', 'Unyielding'],
    description: 'Massive plate armor that renders the wearer virtually impervious to glancing strikes.'
  },
  {
    id: 'a_iron_hauberk',
    name: 'Glacial Iron Hauberk',
    category: 'armor',
    stat: 'endurance',
    rating: 2,
    loadoutCost: 3,
    isBodyStat: true,
    bonusValue: 2,
    bonusEffects: ['Cold Ward', 'Damage Reduction 2'],
    description: 'Interlocking rings of tempered steel reinforced with chilled under-padding.'
  },
  {
    id: 'a_shadow_leathers',
    name: 'Stalker Shadow Leathers',
    category: 'armor',
    stat: 'finesse',
    rating: 3,
    loadoutCost: 2,
    isBodyStat: true,
    bonusValue: 1,
    bonusEffects: ['Stealth +3', 'Silent Footfalls'],
    description: 'Supple boiled leather tailored for silent stalking in dense vegetation.'
  },

  // Mental / Social Weapons (Mind Stats)
  {
    id: 'mw_warmaster_baton',
    name: 'Iron Warmaster Baton',
    category: 'mental_weapon',
    stat: 'willpower',
    rating: 2,
    loadoutCost: 3,
    isBodyStat: false,
    bonusValue: 2,
    bonusEffects: ['Commanding Presence', 'Morale Crush'],
    description: 'A baton of heavy black iron carried by veteran warlords. Intimidates insubordinate crowds.'
  },
  {
    id: 'mw_courtier_fan',
    name: "Gilded Courtier's Fan",
    category: 'mental_weapon',
    stat: 'charm',
    rating: 2,
    loadoutCost: 2,
    isBodyStat: false,
    bonusValue: 1,
    bonusEffects: ['Charm +2', 'Subtle Feint'],
    description: 'An articulated fan painted with imperial allegories. Distracts and lowers guard during negotiations.'
  },
  {
    id: 'mw_crystal_wand',
    name: 'Resonant Chaos Wand',
    category: 'mental_weapon',
    stat: 'knowledge',
    rating: 3,
    loadoutCost: 4,
    isBodyStat: false,
    bonusValue: 3,
    bonusEffects: ['Chaos Arc', 'Arcane Burst'],
    description: 'A focusing rod bound in copper wire, channeling raw chaos flows into mental assault.'
  },

  // Mental / Social Armors (Mind Stats)
  {
    id: 'ma_hearth_locket',
    name: 'Keepsake Locket of the Hearth',
    category: 'mental_armor',
    stat: 'intuition',
    rating: 2,
    loadoutCost: 2,
    isBodyStat: false,
    bonusValue: 2,
    bonusEffects: ['Composure Ward', 'Grounded Focus'],
    description: 'A tarnished silver locket holding a pinch of hearth ash. Fortifies the bearer against psychic dread.'
  },
  {
    id: 'ma_lion_pauldrons',
    name: "Champion's Lion Pauldrons",
    category: 'mental_armor',
    stat: 'awareness',
    rating: 2,
    loadoutCost: 3,
    isBodyStat: false,
    bonusValue: 2,
    bonusEffects: ['Perception +2', 'Anti-Ambush'],
    description: 'Polished brass mantle shaped like snarling lion heads, warning the wearer of hidden deceit.'
  }
];

interface PaperdollLoadoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: any;
  onEquipItem: (item: EquipmentItem) => void;
}

export const PaperdollLoadoutModal: React.FC<PaperdollLoadoutModalProps> = ({
  isOpen,
  onClose,
  character,
  onEquipItem
}) => {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentItem['category']>('weapon');

  if (!isOpen) return null;

  // Find currently equipped items
  const equippedWeaponName = character?.equipped_weapon || 'Osmium Greatsword';
  const equippedArmorName = character?.equipped_armor || 'Glacial Iron Hauberk';
  const equippedMentalWeaponName = character?.equipped_social_weapon || 'Iron Warmaster Baton';
  const equippedMentalArmorName = character?.equipped_social_armor || 'Keepsake Locket of the Hearth';

  const equippedWeapon = CATALOG_EQUIPMENT.find(e => e.name === equippedWeaponName) || CATALOG_EQUIPMENT[0];
  const equippedArmor = CATALOG_EQUIPMENT.find(e => e.name === equippedArmorName) || CATALOG_EQUIPMENT[7];
  const equippedMentalWeapon = CATALOG_EQUIPMENT.find(e => e.name === equippedMentalWeaponName) || CATALOG_EQUIPMENT[9];
  const equippedMentalArmor = CATALOG_EQUIPMENT.find(e => e.name === equippedMentalArmorName) || CATALOG_EQUIPMENT[12];

  // Calculate current total stamina / focus fees
  const totalStaminaFee = (equippedWeapon.isBodyStat ? equippedWeapon.loadoutCost : 0) +
                          (equippedArmor.isBodyStat ? equippedArmor.loadoutCost : 0);
  const totalFocusFee = (!equippedMentalWeapon.isBodyStat ? equippedMentalWeapon.loadoutCost : 0) +
                        (!equippedMentalArmor.isBodyStat ? equippedMentalArmor.loadoutCost : 0);

  const baseStamina = character?.derived?.maxStamina ?? character?.stats?.stamina ?? 10;
  const baseFocus = character?.derived?.maxFocus ?? character?.stats?.focus ?? 10;

  const staminaTierInfo = calculatePoolTier(totalStaminaFee, baseStamina);
  const focusTierInfo = calculatePoolTier(totalFocusFee, baseFocus);

  // Filter armory items matching selected slot
  const armoryItems = CATALOG_EQUIPMENT.filter(item => {
    if (selectedSlot === 'weapon') return item.category === 'weapon';
    if (selectedSlot === 'armor') return item.category === 'armor';
    if (selectedSlot === 'mental_weapon') return item.category === 'mental_weapon';
    if (selectedSlot === 'mental_armor') return item.category === 'mental_armor';
    return item.category === selectedSlot;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <h2 className="text-xl font-bold tracking-wide text-amber-400">Visual Paperdoll & Loadout Manager</h2>
              <p className="text-xs text-slate-400">Attune equipment to the 12 Primary Stats • Budget Stamina & Focus Pools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Dual Loadout Telemetry Gauges */}
        <div className="grid grid-cols-2 gap-4 my-4">
          {/* Stamina Loadout (Body Stats) */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-amber-600/40">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <span>⚡</span> STAMINA LOADOUT (BODY)
              </span>
              <span className="font-mono text-slate-300">
                Fee: <strong className="text-amber-300">{totalStaminaFee}</strong> / {baseStamina}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  staminaTierInfo.tier === 'LIGHT' ? 'bg-emerald-500' :
                  staminaTierInfo.tier === 'MEDIUM' ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (totalStaminaFee / baseStamina) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1.5 font-mono">
              <span className={`px-2 py-0.5 rounded font-bold ${
                staminaTierInfo.tier === 'LIGHT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                staminaTierInfo.tier === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                'bg-red-950 text-red-400 border border-red-800'
              }`}>
                {staminaTierInfo.tier} TIER
              </span>
              <span className="text-slate-400">
                Starting Pool: <strong className="text-white">{staminaTierInfo.pool} SP</strong> ({staminaTierInfo.regenDesc})
              </span>
            </div>
          </div>

          {/* Focus Loadout (Mind Stats) */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-purple-600/40">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-purple-400 flex items-center gap-1.5">
                <span>🧠</span> FOCUS LOADOUT (MIND)
              </span>
              <span className="font-mono text-slate-300">
                Fee: <strong className="text-purple-300">{totalFocusFee}</strong> / {baseFocus}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  focusTierInfo.tier === 'LIGHT' ? 'bg-emerald-500' :
                  focusTierInfo.tier === 'MEDIUM' ? 'bg-purple-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (totalFocusFee / baseFocus) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1.5 font-mono">
              <span className={`px-2 py-0.5 rounded font-bold ${
                focusTierInfo.tier === 'LIGHT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                focusTierInfo.tier === 'MEDIUM' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                'bg-red-950 text-red-400 border border-red-800'
              }`}>
                {focusTierInfo.tier} TIER
              </span>
              <span className="text-slate-400">
                Starting Pool: <strong className="text-white">{focusTierInfo.pool} FP</strong> ({focusTierInfo.regenDesc})
              </span>
            </div>
          </div>
        </div>

        {/* Paperdoll Body & Armory Drawer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Left: Paperdoll Slots */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Equipped Slots</span>
              <span className="text-[11px] text-amber-500 font-mono">Click slot to change</span>
            </div>

            <div className="space-y-2.5">
              {/* Primary Weapon */}
              <div
                onClick={() => setSelectedSlot('weapon')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSlot === 'weapon'
                    ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚔️</span>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">PHYSICAL WEAPON</span>
                      <span className="font-bold text-sm text-slate-100">{equippedWeapon.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-xs font-mono font-bold">
                      +{equippedWeapon.rating} ROLL
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Stat: <strong className="text-amber-400 uppercase">{equippedWeapon.stat}</strong> • Fee: {equippedWeapon.loadoutCost} SP
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Armor */}
              <div
                onClick={() => setSelectedSlot('armor')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSlot === 'armor'
                    ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">PHYSICAL ARMOR</span>
                      <span className="font-bold text-sm text-slate-100">{equippedArmor.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-xs font-mono font-bold">
                      +{equippedArmor.rating} DEF
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Stat: <strong className="text-blue-400 uppercase">{equippedArmor.stat}</strong> • Fee: {equippedArmor.loadoutCost} SP
                    </span>
                  </div>
                </div>
              </div>

              {/* Mental Weapon */}
              <div
                onClick={() => setSelectedSlot('mental_weapon')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSlot === 'mental_weapon'
                    ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📜</span>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">MENTAL WEAPON</span>
                      <span className="font-bold text-sm text-slate-100">{equippedMentalWeapon.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold">
                      +{equippedMentalWeapon.rating} ROLL
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Stat: <strong className="text-purple-400 uppercase">{equippedMentalWeapon.stat}</strong> • Fee: {equippedMentalWeapon.loadoutCost} FP
                    </span>
                  </div>
                </div>
              </div>

              {/* Mental Armor */}
              <div
                onClick={() => setSelectedSlot('mental_armor')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSlot === 'mental_armor'
                    ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔮</span>
                    <div>
                      <span className="text-xs text-slate-400 block font-mono">MENTAL ARMOR</span>
                      <span className="font-bold text-sm text-slate-100">{equippedMentalArmor.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-mono font-bold">
                      +{equippedMentalArmor.rating} DEF
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Stat: <strong className="text-indigo-400 uppercase">{equippedMentalArmor.stat}</strong> • Fee: {equippedMentalArmor.loadoutCost} FP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Armory Drawer for Selected Slot */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Available in Armory</span>
              <span className="text-[11px] text-emerald-400 font-mono">{armoryItems.length} options</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {armoryItems.map(item => {
                const isEquipped = item.name === equippedWeaponName ||
                                   item.name === equippedArmorName ||
                                   item.name === equippedMentalWeaponName ||
                                   item.name === equippedMentalArmorName;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isEquipped
                        ? 'bg-emerald-950/30 border-emerald-500/60'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100">{item.name}</span>
                          {isEquipped && (
                            <span className="text-[10px] bg-emerald-900 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                              EQUIPPED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                            Attuned: <strong className="uppercase">{item.stat}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                            Rating: +{item.rating}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Fee: {item.loadoutCost} {item.isBodyStat ? 'SP' : 'FP'}
                          </span>
                        </div>
                      </div>

                      <button
                        disabled={isEquipped}
                        onClick={() => onEquipItem(item)}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all shadow ${
                          isEquipped
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer active:scale-95'
                        }`}
                      >
                        {isEquipped ? 'In Use' : 'Equip'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-slate-300">
            Rules: Equipping costs fee from Stamina (Body) or Focus (Mind). Unused pool dictates starting points & regen rate.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold"
          >
            Close Armory
          </button>
        </div>
      </div>
    </div>
  );
};
