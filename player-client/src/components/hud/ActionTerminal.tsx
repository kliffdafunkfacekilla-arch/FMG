import React from 'react';
import { getActionsForTarget } from '../../utils/TagRegistry';

interface ActionTerminalProps {
  messages: any[];
  chatInput: string;
  isActing: boolean;
  encounterTarget: any;
  character: any;
  onChatInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onTriggerAction: (prompt: string) => void;
  onOpenBarterModal: () => void;
  onOpenNoticeModal: () => void;
}

export const ActionTerminal: React.FC<ActionTerminalProps> = ({
  messages,
  chatInput,
  isActing,
  encounterTarget,
  character,
  onChatInputChange,
  onSubmit,
  onTriggerAction,
  onOpenBarterModal,
  onOpenNoticeModal,
}) => {
  return (
    <div className="w-[420px] bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-850">
        <h2 className="text-base font-bold text-blue-400 flex items-center gap-2">
          <span>CHRONICLER OF OSTRAKA</span>
        </h2>
        <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">
          PROCEDURAL TTRPG
        </span>
      </div>

      {/* Narrative Log */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-serif text-sm flex flex-col">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${
              m.type === 'info'
                ? 'text-amber-300 italic text-xs bg-amber-950/30 p-2 rounded border border-amber-800/40'
                : m.type === 'error'
                ? 'text-red-400 font-bold text-xs bg-red-950/40 p-2 rounded border border-red-800'
                : m.type === 'player'
                ? 'text-amber-200 text-right bg-amber-950/20 p-2 rounded border border-amber-900/40'
                : m.type === 'dialogue'
                ? 'text-amber-100 bg-amber-950/40 p-3 rounded border border-amber-700/60 shadow italic text-sm'
                : m.type === 'system'
                ? ''
                : 'text-gray-100 bg-gray-900/80 p-3 rounded border border-gray-700/80 shadow'
            }`}
          >
            {m.type === 'player' && <span className="font-bold mr-2 text-amber-500 font-sans text-xs not-italic">YOU:</span>}
            {m.type === 'dialogue' && <span className="font-bold text-amber-400 mr-2 font-sans text-xs not-italic uppercase tracking-wider">{m.sender}:</span>}
            {m.type === 'narrative' && <span className="font-bold text-blue-400 mr-2 font-sans text-xs not-italic">DM:</span>}
            {m.type === 'system' ? (
              <div className="font-mono text-xs text-green-400 bg-black/90 px-2 py-1.5 rounded border border-green-800/60 shadow">
                {m.text}
              </div>
            ) : (
              <>
                {m.text}
                {m.isStreaming && (
                  <span className="inline-block w-2 h-3.5 bg-amber-400 ml-1 animate-pulse align-middle" />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Action Chips & Input Section */}
      <div className="p-3 border-t border-gray-700 bg-gray-900 space-y-2">
        {/* Quick Action Suggestion Chips based on universal Tag-to-Stat Action Matrix */}
        <div className="flex flex-wrap gap-1.5">
          {/* Primary combat strike if target is an alive NPC */}
          {encounterTarget && 'role' in encounterTarget && encounterTarget.alive && (
            <button
              type="button"
              disabled={isActing}
              onClick={() => onTriggerAction(`I strike ${encounterTarget.name} with my ${character?.equipped_weapon || 'blade'} (${character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})`)}
              className="text-xs bg-red-950/70 hover:bg-red-800 text-red-300 border border-red-700/60 px-2.5 py-1 rounded transition flex items-center gap-1 font-semibold"
            >
              <span>⚔️</span> Attack ({character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})
            </button>
          )}

          {/* Dynamic Tag-to-Stat Actions from Universal Matrix */}
          {getActionsForTarget(encounterTarget, Array.isArray(character?.inventory) ? character.inventory : []).map((action) => {
            const isSpecialMerchant = action.verb === 'BARTER';
            const isSpecialNotice = action.verb === 'READ_NOTICES';
            const statVal = character ? Number(character[action.stat]) || 5 : 5;
            const isHighStat = statVal >= 7;

            let badgeStyle = "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-750";
            if (action.category === 'SURVIVAL') badgeStyle = "bg-emerald-950/70 hover:bg-emerald-800 text-emerald-200 border-emerald-700/60";
            else if (action.category === 'SUBTERFUGE') badgeStyle = "bg-sky-950/70 hover:bg-sky-800 text-sky-200 border-sky-700/60";
            else if (action.category === 'SOCIAL') badgeStyle = "bg-amber-950/70 hover:bg-amber-800 text-amber-200 border-amber-700/60";
            else if (action.category === 'MAGIC') badgeStyle = "bg-purple-950/70 hover:bg-purple-800 text-purple-200 border-purple-700/60";
            else if (action.category === 'EXPLORATION') badgeStyle = "bg-teal-950/70 hover:bg-teal-800 text-teal-200 border-teal-700/60";

            return (
              <button
                key={action.id}
                type="button"
                disabled={isActing}
                onClick={() => {
                  if (isSpecialMerchant) {
                    onOpenBarterModal();
                  } else if (isSpecialNotice) {
                    onOpenNoticeModal();
                  }
                  onTriggerAction(action.formulatedPrompt);
                }}
                title={`${action.description} (${action.stat.toUpperCase()} vs DC ${action.finalDC}${action.toolBonus > 0 ? `, +${action.toolBonus} Tool Bonus` : ''})`}
                className={`text-xs px-2.5 py-1 rounded transition flex items-center gap-1.5 border ${badgeStyle} ${isHighStat ? 'ring-1 ring-amber-400/50 font-bold' : ''}`}
              >
                <span>{action.actionTitle}</span>
                <span className="text-[9px] px-1 rounded bg-black/60 text-gray-300 font-mono">
                  {action.stat.slice(0, 3).toUpperCase()} {action.finalDC}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Resolving Banner */}
        {isActing && (
          <div className="flex items-center justify-between text-xs font-mono text-amber-300 bg-amber-950/80 border border-amber-600/80 px-3 py-1.5 rounded-lg animate-pulse shadow">
            <span className="flex items-center gap-2">
              <span className="text-base animate-spin inline-block">🎲</span>
              <span>The Chronicler weaves fate... Resolving opposed rolls & world tags</span>
            </span>
            <span className="text-[10px] text-amber-400 bg-black/60 px-2 py-0.5 rounded font-bold">1d20 CONTEST</span>
          </div>
        )}

        {/* Freeform Prompt Form */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            disabled={isActing}
            className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
            placeholder={isActing ? 'Concordia GM resolving turn...' : 'What do you do? (e.g. "I smash the wooden barricade")'}
            value={chatInput}
            onChange={e => onChatInputChange(e.target.value)}
          />
          <button
            type="submit"
            disabled={isActing || !chatInput.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold transition flex items-center justify-center min-w-[70px]"
          >
            {isActing ? '...' : 'Act'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface BottomKeyBarProps {
  encounterTarget: any;
  character: any;
  isActing: boolean;
  onTriggerAction: (prompt: string) => void;
  isTorchLit?: boolean;
  onToggleTorch?: () => void;
}

export const BottomKeyBar: React.FC<BottomKeyBarProps> = ({
  encounterTarget,
  character,
  isActing,
  onTriggerAction,
  isTorchLit,
  onToggleTorch,
}) => {
  return (
    <div className="h-16 bg-gray-950 border-t border-gray-700 flex items-center justify-center gap-3 px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
      {[
        { label: 'Attack', key: '1', icon: '⚔️', text: `I strike ${encounterTarget ? encounterTarget.name : 'the enemy'} with my ${character?.equipped_weapon || 'blade'} (${character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})` },
        { label: 'Stealth', key: '2', icon: '👤', text: 'I slip into the shadows and scout unseen' },
        { label: 'Inspect', key: '3', icon: '🔍', text: 'I inspect the ground and props for hidden mechanisms' },
        { label: 'Negotiate', key: '4', icon: '🗣️', text: 'I call out and attempt to negotiate terms' },
        { label: 'Rest', key: '5', icon: '⛺', text: 'I take a tactical pause to assess my wounds and environment' },
        { label: isTorchLit ? 'Snuff' : 'Torch', key: 'T', icon: '🔥', text: 'TORCH_TOGGLE' }
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => {
            if (item.key === 'T' && onToggleTorch) {
              onToggleTorch();
            } else {
              onTriggerAction(item.text);
            }
          }}
          disabled={isActing}
          className={`h-11 px-4 border rounded flex items-center gap-2 group transition ${
            item.key === 'T' && isTorchLit
              ? 'bg-amber-950/80 border-amber-500 shadow-md shadow-amber-500/20'
              : 'bg-gray-850 border-gray-700 hover:border-amber-500'
          }`}
        >
          <span className="text-gray-400 group-hover:text-amber-400 font-mono font-bold text-xs bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">
            {item.key}
          </span>
          <span className="text-sm">{item.icon}</span>
          <span className="text-xs text-gray-300 group-hover:text-white uppercase font-bold tracking-wider">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
