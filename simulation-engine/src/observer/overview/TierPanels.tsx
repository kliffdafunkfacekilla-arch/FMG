/**
 * Health panels under each map tier: global (whole world, macro), region (focus cell + ring, meso) and
 * ground (one sector + its neighbours, micro). Each refetches when the tick or its selection changes.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Stat, StatusPill, VIZ, fmt } from "./charts";

export interface HistoryRow { tick: number; ms: number; status: string; failed: number; m: any }
export interface Overview {
  tick: number;
  recordedTicks: number;
  latest: any;
  ago10: any | null;
  ago100: any | null;
  alarms: { id: string; level: "warn" | "critical"; area: string; title: string; detail: string }[];
  lastTick: { tick: number; ms: number; status: string } | null;
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

const box: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 6 };
const h4: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: VIZ.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 4px" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${VIZ.grid}` };

const series = (rows: HistoryRow[], f: (m: any) => number) => rows.map((r) => Number(f(r.m)) || 0);
const delta = (now: any, then: any, f: (m: any) => number) => (now && then ? f(now) - f(then) : null);

// ---------------------------------------------------------------------------------------------------------
export function GlobalHealth({ overview, history }: { overview: Overview | null; history: HistoryRow[] }) {
  if (!overview) return <div style={{ fontSize: 11, color: VIZ.textMuted }}>Loading world health…</div>;
  const m = overview.latest || {};
  const a = overview.ago100 ?? overview.ago10;
  const span = overview.ago100 ? "100t" : "10t";
  const crit = overview.alarms.filter((x) => x.level === "critical").length;
  const warn = overview.alarms.length - crit;
  const recent = history.slice(-100);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        {crit === 0 && warn === 0 && <StatusPill level="good">No alarms</StatusPill>}
        {crit > 0 && <StatusPill level="critical">{crit} critical</StatusPill>}
        {warn > 0 && <StatusPill level="warning">{warn} warning{warn > 1 ? "s" : ""}</StatusPill>}
        <span style={{ fontSize: 10, color: VIZ.textMuted }}>change over {span} · {overview.recordedTicks} ticks recorded</span>
      </div>
      <div style={box}>
        <Stat label="Population" value={m.popTotal} trend={series(recent, (x) => x.popTotal)} delta={delta(m, a, (x) => x.popTotal)} />
        <Stat label="Nulls" value={m.popNull} trend={series(recent, (x) => x.popNull)} delta={delta(m, a, (x) => x.popNull)} />
        <Stat label="Towns" value={m.burgs} sub={`${m.emptyBurgs} empty · ${m.ruins} ruins`} delta={delta(m, a, (x) => x.burgs)} />
        <Stat label="Towns w/o food" value={m.food0} bad="up" trend={series(recent, (x) => x.food0)} delta={delta(m, a, (x) => x.food0)} />
        <Stat label="Unrest avg" value={m.unrestAvg} digits={1} bad="up" trend={series(recent, (x) => x.unrestAvg)} delta={delta(m, a, (x) => x.unrestAvg)} />
        <Stat label="Crime avg" value={m.crimeAvg} digits={1} bad="up" trend={series(recent, (x) => x.crimeAvg)} delta={delta(m, a, (x) => x.crimeAvg)} />
        <Stat label="Health avg" value={m.healthAvg} digits={1} trend={series(recent, (x) => x.healthAvg)} delta={delta(m, a, (x) => x.healthAvg)} />
        <Stat label="Live stories" value={(m.storiesOpen || 0) + (m.storiesProposed || 0)} bad="none" sub={`${m.arcsOpen ?? 0} arcs`} trend={series(recent, (x) => x.storiesOpen + x.storiesProposed)} />
        <Stat label="Factions" value={m.factions} delta={delta(m, a, (x) => x.factions)} />
        <Stat label="Predators avg" value={m.ecoPredators} digits={1} trend={series(recent, (x) => x.ecoPredators)} delta={delta(m, a, (x) => x.ecoPredators)} />
      </div>
      {overview.alarms.length > 0 && (
        <>
          <div style={h4}>Alarms</div>
          {overview.alarms.slice(0, 4).map((al) => (
            <div key={al.id} style={{ ...row, justifyContent: "flex-start", alignItems: "center" }}>
              <StatusPill level={al.level === "critical" ? "critical" : "warning"}>{al.area}</StatusPill>
              <span style={{ color: VIZ.textPrimary }}>{al.title}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
export function RegionHealth({ cellId, tick, onPickCell }: { cellId: number | null; tick: number | undefined; onPickCell: (cellId: number) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (cellId === null) return;
    try {
      setData(await getJson(`/api/health/region/${cellId}`));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [cellId]);
  useEffect(() => { load(); }, [load, tick]);

  const toggleFocus = async () => {
    if (cellId === null || !data) return;
    setBusy(true);
    try {
      await getJson(`/api/regional/${data.focused ? "stop" : "start"}/${cellId}`, { method: "POST" });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (cellId === null) return <div style={{ fontSize: 11, color: VIZ.textMuted }}>Click a cell on the world map.</div>;
  if (!data) return <div style={{ fontSize: 11, color: error ? VIZ.status.critical : VIZ.textMuted }}>{error || "Loading region…"}</div>;
  const m = data.metrics;
  const h: any[] = data.history || [];
  const first = h.length > 1 ? h[0] : null;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        {data.focused
          ? <StatusPill level="good">Sim focused here · meso since tick {data.focusedTick}</StatusPill>
          : <span style={{ fontSize: 10, color: VIZ.textMuted }}>Macro only. Focus it to step this ring in meso detail.</span>}
        <button
          onClick={toggleFocus}
          disabled={busy || (!data.focused && data.focusedRegions.length >= 3)}
          title={!data.focused && data.focusedRegions.length >= 3 ? "Three regions are focused already: unfocus one first." : ""}
          style={{ marginLeft: "auto", background: data.focused ? "#334155" : "#0284c7", color: "#fff", border: "none", borderRadius: 4, padding: "3px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "…" : data.focused ? "Unfocus" : "Focus sim here"}
        </button>
      </div>
      {data.focusedRegions.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6, fontSize: 10, color: VIZ.textSecondary }}>
          Focused:
          {data.focusedRegions.map((id: number) => (
            <button key={id} onClick={() => onPickCell(id)} style={{ background: id === cellId ? "#1e293b" : "transparent", color: VIZ.textPrimary, border: `1px solid ${VIZ.border}`, borderRadius: 4, padding: "0 6px", fontSize: 10, cursor: "pointer" }}>
              #{id}
            </button>
          ))}
        </div>
      )}
      {error && <div style={{ fontSize: 10.5, color: VIZ.status.critical, marginBottom: 4 }}>{error}</div>}
      <div style={box}>
        <Stat label={`People (${m.cells} cells)`} value={m.pop} trend={h.map((r) => r.pop)} delta={first ? m.pop - first.pop : null} />
        <Stat label="Towns" value={m.burgs} sub={m.food0 ? `${m.food0} without food` : ""} />
        <Stat label="Unrest avg" value={m.unrestAvg} digits={1} bad="up" trend={h.map((r) => r.unrestAvg)} delta={first ? m.unrestAvg - first.unrestAvg : null} />
        <Stat label="Crime avg" value={m.crimeAvg} digits={1} bad="up" />
        <Stat label="Prey / predators" value={m.ecoPrey} digits={1} sub={`/ ${fmt(m.ecoPredators, 1)}`} trend={h.map((r) => r.ecoPrey)} />
        <Stat label="Agents · stories" value={m.agents} bad="none" sub={`· ${m.stories} stories`} />
      </div>
      {data.burgs.length > 0 && (
        <>
          <div style={h4}>Towns in this ring</div>
          {data.burgs.slice(0, 6).map((b: any) => (
            <div key={b.burg_id} style={row}>
              <span style={{ color: VIZ.textPrimary, cursor: "pointer" }} onClick={() => onPickCell(Number(b.cell_id))}>{b.is_capital ? "★ " : ""}{b.name}</span>
              <span style={{ color: VIZ.textSecondary }}>
                {fmt(b.pop)} · food {fmt(Number(b.food))} · unrest {Math.round(b.unrest)}
              </span>
            </div>
          ))}
        </>
      )}
      {data.stories.length > 0 && (
        <>
          <div style={h4}>Stories here</div>
          {data.stories.slice(0, 4).map((s: any) => (
            <div key={s.id} style={row}>
              <span style={{ color: VIZ.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.question}</span>
              <span style={{ color: VIZ.textMuted, whiteSpace: "nowrap" }}>{s.scale} {s.clock}/{s.clock_max}</span>
            </div>
          ))}
        </>
      )}
      {data.events.length > 0 && (
        <>
          <div style={h4}>Recent events</div>
          {data.events.slice(0, 4).map((e: any, i: number) => (
            <div key={i} style={{ ...row, justifyContent: "flex-start" }}>
              <span style={{ color: VIZ.textMuted, whiteSpace: "nowrap" }}>t{e.tick}</span>
              <span style={{ color: VIZ.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.message}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
export function GroundHealth({ cellId, rx, ry, tick }: { cellId: number | null; rx: number; ry: number; tick: number | undefined }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cellId === null) return;
    let live = true;
    getJson(`/api/health/ground/${cellId}?x=${rx}&y=${ry}`)
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [cellId, rx, ry, tick]);

  if (cellId === null) return <div style={{ fontSize: 11, color: VIZ.textMuted }}>Pick a square on the regional map.</div>;
  if (!data) return <div style={{ fontSize: 11, color: error ? VIZ.status.critical : VIZ.textMuted }}>{error || "Loading ground…"}</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        {data.sector
          ? <StatusPill level="good">Sector built · {data.sector.poi || "sector"}</StatusPill>
          : <StatusPill level="warning">Not built yet: generated when opened</StatusPill>}
        <span style={{ fontSize: 10, color: VIZ.textMuted }}>{data.neighbourSectorsBuilt}/9 sectors around it built</span>
      </div>
      <div style={box}>
        <Stat label="NPCs placed" value={data.sector?.npcs ?? 0} bad="none" />
        <Stat label="Props" value={data.sector?.props ?? 0} bad="none" />
        <Stat label="Entities (3×3)" value={data.entitiesTotal} bad="none" sub={`${data.entitiesMicro} at micro`} />
        <Stat label="Stories in cell" value={data.stories.length} bad="none" />
        {data.burg && <Stat label={data.burg.name} value={data.burg.pop} sub={`unrest ${Math.round(data.burg.unrest)}`} bad="none" />}
      </div>
      {data.entities.length > 0 && (
        <>
          <div style={h4}>Who is here</div>
          {data.entities.slice(0, 5).map((e: any, i: number) => (
            <div key={i} style={row}><span style={{ color: VIZ.textPrimary }}>{e.kind}</span><span style={{ color: VIZ.textSecondary }}>{e.n} · {e.lod}</span></div>
          ))}
        </>
      )}
      {data.stories.length > 0 && (
        <>
          <div style={h4}>Nearest stories</div>
          {data.stories.slice(0, 3).map((s: any) => (
            <div key={s.id} style={row}>
              <span style={{ color: VIZ.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.question}</span>
              <span style={{ color: VIZ.textMuted, whiteSpace: "nowrap" }}>{s.clock}/{s.clock_max}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
