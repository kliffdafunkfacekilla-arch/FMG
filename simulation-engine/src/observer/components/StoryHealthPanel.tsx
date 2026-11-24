import React from "react";

export interface StoryHealthPanelProps {
  metrics: any | null;
}

export const StoryHealthPanel: React.FC<StoryHealthPanelProps> = ({ metrics }) => {
  if (!metrics) return null;
  return (
    <div style={{ background: "#0b111a", border: "1px solid #1e293b", borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#a855f7" }}>
          📊 Story Health Metrics (Tick {metrics.tick ?? 0})
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>
          Rule-7 Rejection: <strong style={{ color: (metrics.rule7?.rejectedCount || 0) > 0 ? "#f59e0b" : "#10b981" }}>
            {((metrics.rule7?.rejectionRate || 0) * 100).toFixed(2)}%
          </strong> ({metrics.rule7?.rejectedCount ?? 0}/{metrics.rule7?.totalChecked ?? 0})
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>RESOLVED vs EXPIRED</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981", marginTop: 2 }}>
            {metrics.outcomes?.resolved ?? 0} / {metrics.outcomes?.expired ?? 0}
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>
            {((metrics.outcomes?.resolvedRatio || 0) * 100).toFixed(1)}% resolved · {metrics.outcomes?.active ?? 0} active
          </div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>PEOPLE vs PLACES</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
            {Math.round((metrics.actorOriginShare?.peopleShare || 0) * 100)}% / {Math.round((metrics.actorOriginShare?.placesShare || 0) * 100)}%
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>
            {metrics.actorOriginShare?.peopleCount ?? 0} people · {metrics.actorOriginShare?.placesCount ?? 0} places
          </div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>PARTY ENGAGEMENT</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#c084fc", marginTop: 2 }}>
            {metrics.partyEngagement?.engagedStorylines ?? 0} / {metrics.partyEngagement?.totalStorylines ?? 0}
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>
            {metrics.partyEngagement?.actionsLinkedToStoryline ?? 0}/{metrics.partyEngagement?.totalActions ?? 0} actions linked
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {(["scene", "thread", "arc", "saga"] as const).map((sc) => {
          const row = metrics.byScale?.[sc] || {};
          return (
            <div key={sc} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 5, padding: "6px 8px", fontSize: 10 }}>
              <div style={{ fontWeight: 700, color: "#e2e8f0", textTransform: "uppercase", marginBottom: 2 }}>{sc}</div>
              <div style={{ color: "#94a3b8" }}>Acc: <strong style={{ color: "#10b981" }}>{row.accepted ?? 0}</strong> · Rej: <strong style={{ color: "#ef4444" }}>{row.rejected ?? 0}</strong></div>
              <div style={{ color: "#94a3b8" }}>Auto: <strong style={{ color: "#38bdf8" }}>{row.autoOpened ?? 0}</strong> · Res: <strong style={{ color: "#c084fc" }}>{row.resolved ?? 0}</strong></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
