import React from 'react';

interface NoticeBoardModalProps {
  showNoticeModal: boolean;
  bountyList: any[];
  onClose: () => void;
  onAcceptBounty: (bounty: any) => void;
}

export const NoticeBoardModal: React.FC<NoticeBoardModalProps> = ({
  showNoticeModal,
  bountyList,
  onClose,
  onAcceptBounty,
}) => {
  if (!showNoticeModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-amber-500/70 w-full max-w-2xl max-h-[88vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-amber-300 tracking-wide flex items-center gap-2">
              <span>📜</span> MUNICIPAL NOTICE BOARD & CIVIC BOUNTIES
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Emergency requisitions and civil warrants derived from nearest Burg economy telemetry.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg transition self-end sm:self-center"
          >
            ✕
          </button>
        </div>

        {/* Bounties List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bountyList.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 italic bg-gray-950/60 rounded-xl border border-gray-800">
              No active emergency decrees posted. The nearest settlement is currently stable.
            </div>
          ) : (
            bountyList.map((bounty: any) => (
              <div
                key={bounty.id}
                className="bg-gray-850 p-4 rounded-xl border border-gray-750 hover:border-amber-600/70 transition space-y-2.5 shadow-md"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📌</span>
                    <h4 className="font-bold text-sm text-amber-200">{bounty.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold uppercase">
                    {bounty.status || 'OPEN'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                  <span>Posted by: <strong className="text-gray-200">{bounty.giver}</strong></span>
                  <span className="text-amber-400 font-bold">Reward: {bounty.reward}</span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  {bounty.desc}
                </p>

                <div className="pt-1.5 border-t border-gray-800/80 flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">
                    Category: {bounty.targetType || 'CIVIC'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAcceptBounty(bounty)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
                  >
                    <span>✍️</span> Accept Decree
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 bg-gray-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-750 text-white rounded-lg text-xs font-bold transition"
          >
            Close Notice Board
          </button>
        </div>
      </div>
    </div>
  );
};
