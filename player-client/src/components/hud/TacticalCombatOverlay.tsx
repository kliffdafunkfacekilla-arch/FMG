import React from 'react';
import type { TacticalCombatState, CombatParticipant } from '../../types';
import type { LosResult } from '../../utils/TacticalCombatHelper';

interface TacticalCombatOverlayProps {
  combatState: TacticalCombatState;
  targetUnit: CombatParticipant | null;
  targetLos: LosResult | null;
  onExecuteCombatAction: (actionKey: 'attack' | 'composure' | 'guard' | 'item' | 'flee') => void;
  onEndTurn: () => void;
  onDismissRollCard: () => void;
}

export const TacticalCombatOverlay: React.FC<TacticalCombatOverlayProps> = ({
  combatState,
  targetUnit,
  targetLos,
  onExecuteCombatAction,
  onEndTurn,
  onDismissRollCard,
}) => {
  if (!combatState.inCombat) return null;

  const isPlayerTurn = combatState.activeTurnUnitId === 'player';
  const player = combatState.participants.get('player');

  const stamina = combatState.playerStamina ?? player?.currentStamina ?? 5;
  const maxStamina = combatState.playerMaxStaminaPool ?? player?.maxStaminaPool ?? 5;
  const staminaTier = combatState.playerStaminaTier ?? player?.staminaTier ?? 'MEDIUM';

  const focus = combatState.playerFocus ?? player?.currentFocus ?? 5;
  const maxFocus = combatState.playerMaxFocusPool ?? player?.maxFocusPool ?? 5;
  const focusTier = combatState.playerFocusTier ?? player?.focusTier ?? 'MEDIUM';

  const hasMoved = combatState.playerHasMoved ?? player?.hasMoved ?? false;
  const hasUsedStamina = combatState.playerHasUsedStaminaAction ?? player?.hasUsedStaminaAction ?? false;
  const hasUsedFocus = combatState.playerHasUsedFocusAction ?? player?.hasUsedFocusAction ?? false;

  const phase = combatState.phase || 'MOVEMENT';
  const roll = combatState.lastRollCard;

  // Active enemies that have declared actions in Declaration phase
  const declaredEnemies = Array.from(combatState.participants.values()).filter(
    p => !p.isPlayer && p.alive && p.declaredAction
  );

  return (
    <>
      {/* 1. TOP TACTICAL ROUND & 3-PHASE COMBAT BANNER */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
        <div className="bg-gray-950/95 border border-amber-600/70 shadow-2xl backdrop-blur-md rounded-2xl px-5 py-2.5 flex items-center gap-5 text-xs font-mono pointer-events-auto">
          {/* Round Indicator */}
          <div className="flex items-center gap-1.5 border-r border-gray-800 pr-4">
            <span className="text-amber-400 font-black text-sm tracking-wide">⚔️ ROUND {combatState.roundNumber}</span>
          </div>

          {/* 3-Phase Stepper */}
          <div className="flex items-center gap-2 border-r border-gray-800 pr-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Phase:</span>
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <span
                className={`px-2 py-0.5 rounded transition ${
                  phase === 'MOVEMENT'
                    ? 'bg-sky-950 text-sky-300 border border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]'
                    : 'text-gray-500'
                }`}
                title="Phase 1: Movement Phase (Speed Order: High -> Low)"
              >
                1. MOVE
              </span>
              <span className="text-gray-600">➔</span>
              <span
                className={`px-2 py-0.5 rounded transition ${
                  phase === 'DECLARATION'
                    ? 'bg-purple-950 text-purple-300 border border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                    : 'text-gray-500'
                }`}
                title="Phase 2: Declaration Phase (Perception Order: Low -> High)"
              >
                2. DECLARE
              </span>
              <span className="text-gray-600">➔</span>
              <span
                className={`px-2 py-0.5 rounded transition ${
                  phase === 'RESOLUTION'
                    ? 'bg-rose-950 text-rose-300 border border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                    : 'text-gray-500'
                }`}
                title="Phase 3: Resolution Phase (Speed Order: High -> Low)"
              >
                3. EXECUTE
              </span>
            </div>
          </div>

          {/* Active Turn Unit */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[10px] uppercase">Turn:</span>
            {isPlayerTurn ? (
              <span className="px-2.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-300 font-bold animate-pulse">
                HERO'S TURN
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded bg-rose-950/90 border border-rose-500 text-rose-300 font-bold animate-pulse">
                {combatState.participants.get(combatState.activeTurnUnitId || '')?.name || 'FOE'}
              </span>
            )}
          </div>

          {/* Turn Order Queue */}
          <div className="flex items-center gap-1 pl-3 border-l border-gray-800">
            <span className="text-gray-500 text-[10px] uppercase">Queue:</span>
            {(combatState.phaseTurnOrder && combatState.phaseTurnOrder.length > 0
              ? combatState.phaseTurnOrder
              : combatState.turnOrder
            ).slice(0, 4).map((uid, idx) => {
              const unit = combatState.participants.get(uid);
              const isActive = uid === combatState.activeTurnUnitId;
              return (
                <div
                  key={`${uid}-${idx}`}
                  title={`${unit?.name || 'Unit'} (Speed: ${unit?.movementSpeed || 10}, Percept: ${unit?.perception || 10})`}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                    isActive
                      ? 'bg-amber-500 text-black border-amber-300 shadow-md scale-105'
                      : unit?.isPlayer
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                      : 'bg-gray-850 text-gray-400 border-gray-750'
                  }`}
                >
                  {unit?.isPlayer ? 'You' : unit?.name.split(' ')[0] || 'Foe'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Perception Intelligence Callout (Declaration Phase Insight) */}
        {phase === 'DECLARATION' && declaredEnemies.length > 0 && (
          <div className="bg-purple-950/90 border border-purple-500/70 rounded-xl px-4 py-1.5 text-xs font-mono text-purple-200 shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-auto animate-fadeIn">
            <span className="text-purple-400 font-bold">👁️ PERCEPTION TELEMETRY:</span>
            {declaredEnemies.map(e => (
              <span key={e.id} className="text-amber-300 font-semibold">
                [{e.name}: {e.declaredAction?.actionName || 'Combat Action'}]
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. TARGET LOS & COVER TELEMETRY */}
      {targetUnit && (
        <div className="absolute top-32 right-6 z-30 bg-gray-950/90 border border-blue-500/60 rounded-xl p-3 shadow-xl backdrop-blur-md max-w-xs space-y-2 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-rose-400">🎯</span>
              <span className="font-bold text-xs text-gray-200">{targetUnit.name}</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              HP: {targetUnit.hp}/{targetUnit.maxHp}
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono">
            {targetLos && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Line of Sight:</span>
                <span className={`font-bold ${targetLos.hasLos ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {targetLos.hasLos ? 'CLEAR LINE' : 'OBSTRUCTED'}
                </span>
              </div>
            )}
            {targetLos && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Physical Cover:</span>
                <span className={`font-bold ${
                  targetLos.coverLevel === 'FULL' ? 'text-rose-400' : targetLos.coverLevel === 'HALF' ? 'text-amber-400' : 'text-gray-400'
                }`}>
                  {targetLos.coverLevel === 'FULL' ? 'FULL COVER (+4)' : targetLos.coverLevel === 'HALF' ? 'HALF COVER (+2)' : 'OPEN GROUND (0)'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-gray-850 text-[10px] text-gray-400">
              <span>Speed: <strong className="text-sky-300">{targetUnit.movementSpeed}</strong></span>
              <span>Perception: <strong className="text-purple-300">{targetUnit.perception}</strong></span>
              <span>Resilience: <strong className="text-emerald-300">{targetUnit.resilience}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 3. CENTER OPPOSED 1D20 CONCORDIA RESOLUTION CARD */}
      {roll && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-gray-950/95 border-2 border-amber-500 rounded-2xl p-5 shadow-2xl backdrop-blur-xl max-w-md w-full font-mono text-gray-100 flex flex-col gap-4 animate-scaleUp pointer-events-auto">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <span className="text-amber-400 font-black text-sm tracking-widest uppercase flex items-center gap-1.5">
              <span>🎲</span> OPPOSED CONCORDIA RESOLUTION
            </span>
            <button
              type="button"
              onClick={onDismissRollCard}
              className="text-gray-400 hover:text-white text-xs bg-gray-900 border border-gray-700 rounded-full px-2 py-0.5 transition"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-900/80 p-3 rounded-xl border border-gray-800">
            {/* Attacker Box */}
            <div className="flex flex-col gap-1 border-r border-gray-800 pr-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Attacker</span>
              <span className="text-xs font-bold text-amber-300 truncate">{roll.attackerName}</span>
              <div className="text-[11px] text-gray-300 flex items-center justify-between pt-1">
                <span>1d20 Roll:</span>
                <span className="font-bold text-white bg-gray-800 px-1.5 py-0.5 rounded">{roll.attackerRoll}</span>
              </div>
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>{roll.attackerStatKey.toUpperCase()}:</span>
                <span className="text-gray-200">+{roll.attackerStatVal}</span>
              </div>
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>Weapon Mod:</span>
                <span className="text-gray-200">+{roll.attackerMod}</span>
              </div>
              <div className="border-t border-gray-800 pt-1 mt-1 flex items-center justify-between font-bold text-amber-400 text-sm">
                <span>TOTAL:</span>
                <span>{roll.attackerTotal}</span>
              </div>
            </div>

            {/* Defender Box */}
            <div className="flex flex-col gap-1 pl-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Defender</span>
              <span className="text-xs font-bold text-blue-300 truncate">{roll.defenderName}</span>
              <div className="text-[11px] text-gray-300 flex items-center justify-between pt-1">
                <span>1d20 Roll:</span>
                <span className="font-bold text-white bg-gray-800 px-1.5 py-0.5 rounded">{roll.defenderRoll}</span>
              </div>
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>{roll.defenderStatKey.toUpperCase()}:</span>
                <span className="text-gray-200">+{roll.defenderStatVal}</span>
              </div>
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>Armor Mod:</span>
                <span className="text-gray-200">+{roll.defenderMod}</span>
              </div>
              {roll.coverBonus && roll.coverBonus > 0 && (
                <div className="text-[10px] text-sky-400 flex items-center justify-between">
                  <span>Cover ({roll.coverLevel}):</span>
                  <span>+{roll.coverBonus}</span>
                </div>
              )}
              <div className="border-t border-gray-800 pt-1 mt-1 flex items-center justify-between font-bold text-blue-400 text-sm">
                <span>TOTAL:</span>
                <span>{roll.defenderTotal}</span>
              </div>
            </div>
          </div>

          {/* Differential Margin Callout */}
          <div
            className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center ${
              roll.hit
                ? 'bg-rose-950/70 border-rose-600/80 text-rose-200'
                : 'bg-emerald-950/70 border-emerald-600/80 text-emerald-200'
            }`}
          >
            <div className="text-base font-black tracking-wider uppercase">
              {roll.difference >= 10
                ? '💥 CRITICAL OVERMATCH (+10 Margin)'
                : roll.difference >= 6
                ? '⚔️ MAJOR STRIKE (+6 Margin)'
                : roll.difference >= 3
                ? '🗡️ MINOR INJURY (+3 Margin)'
                : roll.difference >= 1
                ? '🩸 GRAZE (+1 Margin)'
                : '🛡️ ATTACK DEFLECTED / MISSED'}
            </div>
            <div className="text-xs text-gray-300">
              Differential Margin: <strong className="text-white">{roll.difference >= 0 ? `+${roll.difference}` : roll.difference}</strong> |
              Net Damage: <strong className="text-amber-300">{roll.injuryPoints * 4} HP</strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. BOTTOM TACTICAL ACTION BAR: STAMINA, FOCUS & ACTION SLOTS */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
        {/* Dual Resource Pools Bar (Stamina & Focus with Loadout Tiers) */}
        <div className="bg-gray-950/95 border border-gray-750 px-5 py-2 rounded-2xl backdrop-blur-md flex items-center gap-6 shadow-2xl pointer-events-auto">
          {/* Stamina Pool */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1">
              <span>⚡</span> STAMINA:
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: maxStamina }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm border transition-all ${
                    i < stamina
                      ? 'bg-amber-500 border-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                      : 'bg-gray-800 border-gray-700 opacity-40'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-gray-200">
              {stamina}/{maxStamina}
            </span>
            <span className="text-[9px] font-mono text-amber-400/90 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
              {staminaTier} ({staminaTier === 'LIGHT' ? '+1/rd' : staminaTier === 'MEDIUM' ? '+1/2rds' : '+1/3rds'})
            </span>
          </div>

          <div className="w-[1px] h-5 bg-gray-800" />

          {/* Focus Pool */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono font-bold text-sky-400 flex items-center gap-1">
              <span>🧠</span> FOCUS:
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: maxFocus }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm border transition-all ${
                    i < focus
                      ? 'bg-sky-500 border-sky-300 shadow-[0_0_6px_rgba(14,165,233,0.6)]'
                      : 'bg-gray-800 border-gray-700 opacity-40'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-gray-200">
              {focus}/{maxFocus}
            </span>
            <span className="text-[9px] font-mono text-sky-400/90 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded">
              {focusTier} ({focusTier === 'LIGHT' ? '+1/rd' : focusTier === 'MEDIUM' ? '+1/2rds' : '+1/3rds'})
            </span>
          </div>

          <div className="w-[1px] h-5 bg-gray-800" />

          {/* Action Slots Capacity Indicators */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`px-2 py-0.5 rounded border ${hasMoved ? 'bg-gray-900 border-gray-800 text-gray-500 line-through' : 'bg-emerald-950/70 border-emerald-600/70 text-emerald-300 font-bold'}`}>
              👟 Move
            </span>
            <span className={`px-2 py-0.5 rounded border ${hasUsedStamina ? 'bg-gray-900 border-gray-800 text-gray-500 line-through' : 'bg-amber-950/70 border-amber-600/70 text-amber-300 font-bold'}`}>
              ⚡ Stamina Act
            </span>
            <span className={`px-2 py-0.5 rounded border ${hasUsedFocus ? 'bg-gray-900 border-gray-800 text-gray-500 line-through' : 'bg-sky-950/70 border-sky-600/70 text-sky-300 font-bold'}`}>
              🧠 Focus Act
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-950/95 border border-amber-600/70 p-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-auto">
          {/* Physical Weapon Strike (1 Stamina Point & 1 Stamina Action) */}
          <button
            type="button"
            disabled={!isPlayerTurn || hasUsedStamina || stamina < 1}
            onClick={() => onExecuteCombatAction('attack')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isPlayerTurn && !hasUsedStamina && stamina >= 1
                ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-md active:scale-95'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
            title="Physical Weapon Strike: Costs 1 Stamina Point and consumes your Stamina Action"
          >
            <span>⚔️</span>
            <span>Physical Strike</span>
            <span className="text-[10px] px-1 py-0.2 bg-black/40 rounded text-amber-950 font-black">1 STAM</span>
          </button>

          {/* Composure / Mental Attack (1 Focus Point & 1 Focus Action) */}
          <button
            type="button"
            disabled={!isPlayerTurn || hasUsedFocus || focus < 1}
            onClick={() => onExecuteCombatAction('composure')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isPlayerTurn && !hasUsedFocus && focus >= 1
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-95'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
            title="Composure Attack / Focus Action: Costs 1 Focus Point and consumes your Focus Action"
          >
            <span>🧠</span>
            <span>Composure Strike</span>
            <span className="text-[10px] px-1 py-0.2 bg-black/40 rounded text-sky-200">1 FOC</span>
          </button>

          {/* Guard / Fortify (1 Stamina Point) */}
          <button
            type="button"
            disabled={!isPlayerTurn || (hasUsedStamina && hasUsedFocus) || stamina < 1}
            onClick={() => onExecuteCombatAction('guard')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isPlayerTurn && !hasUsedStamina && stamina >= 1
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
            title="Guard & Fortify Stance: Braces defense against incoming strikes"
          >
            <span>🛡️</span>
            <span>Guard</span>
            <span className="text-[10px] px-1 py-0.2 bg-black/40 rounded text-indigo-200">1 STAM</span>
          </button>

          {/* Use Item / Consumable (1 Stamina Action) */}
          <button
            type="button"
            disabled={!isPlayerTurn || hasUsedStamina || stamina < 1}
            onClick={() => onExecuteCombatAction('item')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isPlayerTurn && !hasUsedStamina && stamina >= 1
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
            title="Use field item or potion (1 Stamina Action)"
          >
            <span>🧪</span>
            <span>Use Item</span>
            <span className="text-[10px] px-1 py-0.2 bg-black/40 rounded text-emerald-200">1 STAM</span>
          </button>

          <div className="w-[1px] h-6 bg-gray-800 mx-1" />

          {/* End Turn / Pass */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={onEndTurn}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isPlayerTurn
                ? 'bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-600/50 active:scale-95'
                : 'bg-gray-900 text-gray-600 cursor-not-allowed'
            }`}
          >
            <span>⏩</span>
            <span>Pass / Next (Space)</span>
          </button>
        </div>
      </div>
    </>
  );
};
