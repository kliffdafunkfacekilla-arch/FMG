/**
 * The three map tiers side by side, linked: clicking a cell on the world map opens its region; clicking a
 * square on the regional map opens that ground sector. Each tier has its own health panel underneath, and
 * the sim-wide console runs below all three.
 */
import React, { useEffect, useState } from "react";
import { RegionMap } from "../RegionMap";
import { TacticalSandboxModal } from "../TacticalSandboxModal";
import { VIZ } from "./charts";
import { GlobalHealth, GroundHealth, RegionHealth, type HistoryRow, type Overview } from "./TierPanels";
import { SimConsole } from "./SimConsole";

async function getJson(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

function Pane({ tier, title, subtitle, map, health }: { tier: string; title: string; subtitle: React.ReactNode; map: React.ReactNode; health: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: VIZ.surface, border: `1px solid ${VIZ.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "7px 10px", borderBottom: `1px solid ${VIZ.border}`, display: "flex", alignItems: "baseline", gap: 8, background: VIZ.panel }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: VIZ.series[0], letterSpacing: 0.6 }}>{tier}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: VIZ.textPrimary }}>{title}</span>
        <span style={{ fontSize: 10.5, color: VIZ.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
      </div>
      <div style={{ flex: "1 1 55%", minHeight: 0, overflow: "auto", position: "relative", display: "flex", justifyContent: "center" }}>{map}</div>
      <div style={{ flex: "0 1 45%", minHeight: 120, overflow: "auto", padding: 10, borderTop: `1px solid ${VIZ.border}` }}>{health}</div>
    </div>
  );
}

export function OverviewTab({
  tick, regionCellId, onRegionCell, groundCell, onGroundCell, renderWorldMap, cellLabel, onOpenTactical,
}: {
  tick: number | undefined;
  regionCellId: number | null;
  onRegionCell: (cellId: number) => void;
  groundCell: { rx: number; ry: number } | null;
  onGroundCell: (cell: { rx: number; ry: number }) => void;
  renderWorldMap: () => React.ReactNode;
  cellLabel: (cellId: number) => string;
  onOpenTactical: (cellId: number, rx: number, ry: number) => void;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([getJson("/api/health/overview"), getJson("/api/health/history?limit=100&points=100")])
      .then(([o, h]) => { if (live) { setOverview(o); setHistory(h.rows || []); } })
      .catch(() => {});
    return () => { live = false; };
  }, [tick]);

  const g = groundCell ?? { rx: 50, ry: 50 };
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#05080f" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, padding: 10, height: "calc(100vh - 120px)", minHeight: 620 }}>
        <Pane
          tier="MACRO"
          title="World"
          subtitle="every town and faction, one day per tick"
          map={<div style={{ position: "absolute", inset: 0, display: "flex" }}>{renderWorldMap()}</div>}
          health={<GlobalHealth overview={overview} history={history} />}
        />
        <Pane
          tier="MESO"
          title={regionCellId !== null ? cellLabel(regionCellId) : "Region"}
          subtitle={regionCellId !== null ? `cell #${regionCellId} and its ring of neighbours` : "click the world map"}
          map={regionCellId !== null
            ? <RegionMap key={regionCellId} cellId={regionCellId} {...(tick !== undefined ? { tick } : {})} isFloating={false} selectedCell={g} onSelectCell={onGroundCell} />
            : <Empty text="Click a cell on the world map to open its region." />}
          health={<RegionHealth cellId={regionCellId} tick={tick} onPickCell={onRegionCell} />}
        />
        <Pane
          tier="MICRO"
          title="Ground"
          subtitle={regionCellId !== null ? `sector (${g.rx}, ${g.ry}) of cell #${regionCellId} and the 8 around it` : "pick a square on the regional map"}
          map={regionCellId !== null
            ? <TacticalSandboxModal key={`${regionCellId}:${g.rx}:${g.ry}`} embedded cellId={regionCellId} rx={g.rx} ry={g.ry} onClose={() => onOpenTactical(regionCellId, g.rx, g.ry)} />
            : <Empty text="Pick a square on the regional map to see the ground." />}
          health={<GroundHealth cellId={regionCellId} rx={g.rx} ry={g.ry} tick={tick} />}
        />
      </div>
      <SimConsole tick={tick} overview={overview} onPickCell={onRegionCell} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ margin: "auto", fontSize: 12, color: VIZ.textMuted, padding: 20, textAlign: "center" }}>{text}</div>;
}
