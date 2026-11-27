/**
 * Sim-wide console under the three map tiers: alarms, trends over the recorded history, towns at risk,
 * story health and engine cost. Everything here reads /api/health/*.
 */
import React, { useEffect, useState } from "react";
import { LineChart, StatusPill, VIZ, fmt } from "./charts";
import type { HistoryRow, Overview } from "./TierPanels";

async function getJson(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

const card: React.CSSProperties = { background: VIZ.panel, border: `1px solid ${VIZ.border}`, borderRadius: 10, padding: 12, minWidth: 0 };
const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: VIZ.textPrimary, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const th: React.CSSProperties = { textAlign: "left", fontSize: 10, color: VIZ.textSecondary, fontWeight: 600, padding: "3px 6px", borderBottom: `1px solid ${VIZ.border}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { fontSize: 11, color: VIZ.textPrimary, padding: "3px 6px", borderBottom: `1px solid ${VIZ.grid}`, whiteSpace: "nowrap" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

type Window = 100 | 1000 | 0;

export function SimConsole({
  tick, overview, onPickCell,
}: { tick: number | undefined; overview: Overview | null; onPickCell: (cellId: number) => void }) {
  const [win, setWin] = useState<Window>(100);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [towns, setTowns] = useState<any[]>([]);
  const [stories, setStories] = useState<any>(null);
  const [engine, setEngine] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      getJson(`/api/health/history?limit=${win}&points=400`),
      getJson(`/api/health/towns?limit=15`),
      getJson(`/api/health/stories`),
      getJson(`/api/health/engine?window=50`),
    ])
      .then(([h, t, s, e]) => {
        if (!live) return;
        setRows(h.rows || []);
        setTowns(t.towns || []);
        setStories(s);
        setEngine(e);
        setError(null);
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [tick, win]);

  const x = rows.map((r) => r.tick);
  const s = (label: string, f: (m: any) => number) => ({ label, values: rows.map((r) => (r.m ? Number(f(r.m)) : null)) });

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, color: VIZ.textPrimary }}>Sim health</h2>
        <span style={{ fontSize: 11, color: VIZ.textMuted }}>
          {overview?.lastTick ? `last tick ${overview.lastTick.tick} took ${fmt(overview.lastTick.ms)} ms` : "no ticks recorded yet"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {([100, 1000, 0] as Window[]).map((w) => (
            <button key={w} onClick={() => setWin(w)} style={{
              background: win === w ? "#1e293b" : "transparent", color: win === w ? VIZ.textPrimary : VIZ.textSecondary,
              border: `1px solid ${VIZ.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer",
            }}>{w === 0 ? "All" : `Last ${w}`}</button>
          ))}
        </div>
      </div>
      {error && <div style={{ fontSize: 11, color: VIZ.status.critical }}>Health API: {error}</div>}

      {/* Alarms */}
      <div style={card}>
        <div style={cardTitle}><span>Alarms</span><span style={{ fontSize: 10, color: VIZ.textMuted, fontWeight: 400 }}>rules over the recorded history</span></div>
        {!overview || overview.alarms.length === 0 ? (
          <StatusPill level="good">Nothing is drifting: no alarm rule fires</StatusPill>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 6 }}>
            {overview.alarms.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 6, border: `1px solid ${VIZ.grid}`, borderRadius: 6 }}>
                <StatusPill level={a.level === "critical" ? "critical" : "warning"}>{a.level}</StatusPill>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: VIZ.textPrimary, fontWeight: 600 }}>{a.title}</div>
                  {a.detail && <div style={{ fontSize: 10.5, color: VIZ.textSecondary }}>{a.area} · {a.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trends */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
        <div style={card}><LineChart title="People" x={x} series={[s("Nulls", (m) => m.popNull), s("Attuned", (m) => m.popAttuned)]} /></div>
        <div style={card}><LineChart title="Towns in trouble (count)" zero x={x} series={[s("No food", (m) => m.food0), s("Unrest 70+", (m) => m.unrest70), s("Max crime", (m) => m.crime100)]} /></div>
        <div style={card}><LineChart title="Town averages (0–100)" x={x} digits={1} series={[s("Unrest", (m) => m.unrestAvg), s("Crime", (m) => m.crimeAvg), s("Health", (m) => m.healthAvg)]} /></div>
        <div style={card}><LineChart title="Live stories" zero x={x} series={[s("Open", (m) => m.storiesOpen), s("Proposed", (m) => m.storiesProposed), s("Arcs", (m) => m.arcsOpen)]} /></div>
        <div style={card}><LineChart title="Ecology (world average)" x={x} digits={1} series={[s("Plants", (m) => m.ecoPlants), s("Prey", (m) => m.ecoPrey), s("Predators", (m) => m.ecoPredators)]} /></div>
        <div style={card}><LineChart title="Towns" zero x={x} series={[s("All", (m) => m.burgs), s("Empty", (m) => m.emptyBurgs), s("Ruins", (m) => m.ruins)]} /></div>
        <div style={card}><LineChart title="Events per tick" zero x={x} series={[s("All", (m) => m.eventsTick), s("Major", (m) => m.eventsMajorTick)]} /></div>
        <div style={card}><LineChart title="Tick time (ms)" zero x={x} series={[{ label: "ms", values: rows.map((r) => r.ms) }]} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 12 }}>
        {/* Towns at risk */}
        <div style={card}>
          <div style={cardTitle}><span>Towns at risk</span><span style={{ fontSize: 10, color: VIZ.textMuted, fontWeight: 400 }}>click one to open it on the maps</span></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Town</th><th style={{ ...th, textAlign: "right" }}>People</th><th style={{ ...th, textAlign: "right" }}>Food</th><th style={{ ...th, textAlign: "right" }}>Unrest</th><th style={{ ...th, textAlign: "right" }}>Crime</th><th style={{ ...th, textAlign: "right" }}>Health</th><th style={{ ...th, textAlign: "right" }}>Risk</th></tr></thead>
              <tbody>
                {towns.map((t) => (
                  <tr key={t.burg_id} onClick={() => onPickCell(Number(t.cell_id))} style={{ cursor: "pointer" }}>
                    <td style={td}>{t.is_capital ? "★ " : ""}{t.name}</td>
                    <td style={tdNum}>{fmt(t.pop)}</td>
                    <td style={{ ...tdNum, color: Number(t.food) <= 0 ? VIZ.status.serious : VIZ.textPrimary }}>{fmt(Number(t.food))}</td>
                    <td style={tdNum}>{Math.round(t.unrest)}</td>
                    <td style={tdNum}>{Math.round(t.crime_rate)}</td>
                    <td style={tdNum}>{Math.round(t.health)}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{t.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Story health */}
        <div style={card}>
          <div style={cardTitle}><span>Story health</span><span style={{ fontSize: 10, color: VIZ.textMuted, fontWeight: 400 }}>last {stories?.window ?? 200} ticks</span></div>
          {stories && (
            <>
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: VIZ.textSecondary, marginBottom: 8, flexWrap: "wrap" }}>
                <span><b style={{ color: VIZ.textPrimary }}>{stories.coverage.cells}</b> places</span>
                <span><b style={{ color: VIZ.textPrimary }}>{stories.coverage.actors}</b> actors</span>
                <span><b style={{ color: VIZ.textPrimary }}>{stories.coverage.kinds}</b> kinds of crisis</span>
                {stories.outcomes.map((o: any) => (
                  <span key={o.scale + o.state}>{o.scale} {o.state} <b style={{ color: VIZ.textPrimary }}>{o.c}</b></span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Most repeated</th><th style={{ ...th, textAlign: "right" }}>×</th></tr></thead>
                  <tbody>
                    {stories.repeats.map((r: any) => (
                      <tr key={r.cell_id + r.rule_id} onClick={() => onPickCell(Number(r.cell_id))} style={{ cursor: "pointer" }}>
                        <td style={{ ...td, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{r.rule_id} · {r.place || `cell ${r.cell_id}`}</td>
                        <td style={{ ...tdNum, color: r.c >= 5 ? VIZ.status.warning : VIZ.textPrimary }}>{r.c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Busiest actors</th><th style={{ ...th, textAlign: "right" }}>stories</th></tr></thead>
                  <tbody>
                    {stories.actors.map((a: any) => (
                      <tr key={a.actor}><td style={{ ...td, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{a.actor}</td><td style={tdNum}>{a.c}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Engine */}
        <div style={card}>
          <div style={cardTitle}>
            <span>Engine cost per step</span>
            <span style={{ fontSize: 10, color: VIZ.textMuted, fontWeight: 400 }}>{engine ? `${engine.window} ticks · avg ${fmt(engine.avgMs)} ms/tick` : ""}</span>
          </div>
          {engine && (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Step</th><th style={{ ...th, textAlign: "right" }}>avg ms</th><th style={{ ...th, textAlign: "right" }}>max ms</th><th style={{ ...th, textAlign: "right" }}>queries</th><th style={{ ...th, width: "35%" }}></th></tr></thead>
                <tbody>
                  {engine.steps.slice(0, 10).map((st: any) => {
                    const top = engine.steps[0]?.avgMs || 1;
                    return (
                      <tr key={st.step}>
                        <td style={td}>{st.step}</td>
                        <td style={tdNum}>{st.avgMs}</td>
                        <td style={tdNum}>{st.maxMs}</td>
                        <td style={tdNum}>{st.avgQueries}</td>
                        <td style={td}><div style={{ height: 6, width: `${Math.max(2, (100 * st.avgMs) / top)}%`, background: VIZ.series[0], borderRadius: 3 }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {engine.failures.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {engine.failures.slice(0, 4).map((f: any, i: number) => (
                    <div key={i} style={{ fontSize: 10.5, color: VIZ.textSecondary, display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                      <StatusPill level="critical">t{f.tick}</StatusPill>
                      <span style={{ color: VIZ.textPrimary }}>{f.agent}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
