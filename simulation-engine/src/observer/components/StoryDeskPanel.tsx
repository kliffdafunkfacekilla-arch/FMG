import React from "react";

export interface StoryDeskPanelProps {
  storyDeskData: { cellId: number; proposals: any[]; openStorylines: any[] } | null;
  defaultCellId: number;
  deskBusyId: number | null;
  onAutoAccept: (cellId: number) => void;
  onDecision: (proposalId: number, cellId: number, decision: "accept" | "reject") => void;
}

export const StoryDeskPanel: React.FC<StoryDeskPanelProps> = ({
  storyDeskData,
  defaultCellId,
  deskBusyId,
  onAutoAccept,
  onDecision,
}) => {
  const cid = storyDeskData?.cellId ?? defaultCellId;
  return (
    <div style={{ background: "#0b111a", border: "1px solid #334155", borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>
            🗂️ Story Desk Proposals (Cell #{cid})
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>
            Grounded proposals from simulation facts. Accepting places clue overlays &amp; rumours on the map; rejecting enforces an actor cooldown.
          </div>
        </div>
        <button
          onClick={() => onAutoAccept(cid)}
          style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
        >
          Auto-Accept Top
        </button>
      </div>
      {(storyDeskData?.proposals || []).length === 0 ? (
        <div style={{ fontSize: 11, color: "#64748b" }}>No pending proposals for this focus cell.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(storyDeskData?.proposals || []).slice(0, 4).map((p: any) => (
            <div key={`prop-${p.id}`} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{p.question}</div>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                  {p.scale} · {p.source}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 3 }}>{p.stakes}</div>
              {p.why && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>Why: {p.why}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 7, justifyContent: "flex-end" }}>
                <button
                  disabled={deskBusyId === p.id}
                  onClick={() => onDecision(p.id, cid, "accept")}
                  style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                >
                  Accept &amp; Place Hook
                </button>
                <button
                  disabled={deskBusyId === p.id}
                  onClick={() => onDecision(p.id, cid, "reject")}
                  style={{ background: "#991b1b", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                >
                  Reject (Cooldown)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
