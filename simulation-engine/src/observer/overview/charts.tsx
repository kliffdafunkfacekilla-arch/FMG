/**
 * Small, dependency-free SVG charts for the health console.
 * Colors: the dataviz reference palette's dark steps, validated on this dashboard's surface (#0b111a):
 * three categorical slots in fixed order, plus the fixed status palette (always shown with a label or icon).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";

export const VIZ = {
  surface: "#0b111a",
  panel: "#0f1623",
  border: "#1e293b",
  grid: "#1a2332",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  series: ["#3987e5", "#d95926", "#199e70"] as const,
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
};

export const fmt = (v: number | null | undefined, digits = 0): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "k";
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
};

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(300);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(120, Math.floor(e[0]!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Rounds an axis range out to tidy numbers. Not forced to zero: these charts watch drift, not magnitude. */
function niceRange(min: number, max: number, zero: boolean): [number, number] {
  if (zero) min = Math.min(0, min);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max === min) { const pad = Math.abs(max) * 0.05 || 1; return [min - (zero ? 0 : pad), max + pad]; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span))) / 2;
  return [zero ? min : Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

export interface Series { label: string; values: (number | null)[] }

/** Multi-line chart (max 3 series), one y-axis, crosshair + tooltip, legend for 2+ series. */
export function LineChart({
  title, x, series, height = 130, zero = false, unit = "", digits = 0,
}: { title: string; x: number[]; series: Series[]; height?: number; zero?: boolean; unit?: string; digits?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.slice(0, 3);
  const pad = { l: 44, r: 10, t: 6, b: 18 };
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;

  const [y0, y1] = useMemo(() => {
    const all = shown.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
    return all.length ? niceRange(Math.min(...all), Math.max(...all), zero) : [0, 1];
  }, [shown, zero]);
  const xMin = x[0] ?? 0;
  const xMax = x[x.length - 1] ?? 1;
  const sx = (v: number) => pad.l + (xMax === xMin ? iw / 2 : ((v - xMin) / (xMax - xMin)) * iw);
  const sy = (v: number) => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  const paths = shown.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${sx(x[i]!).toFixed(1)},${sy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (x.length === 0) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = xMin + (px / rect.width) * (xMax - xMin);
    let best = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i]! - t) < Math.abs(x[best]! - t)) best = i;
    setHover(best);
  };

  const ticksY = [y0, (y0 + y1) / 2, y1];
  const last = x.length - 1;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: VIZ.textPrimary }}>{title}</span>
        {shown.length > 1 && (
          <span style={{ display: "flex", gap: 10, fontSize: 10, color: VIZ.textSecondary }}>
            {shown.map((s, i) => (
              <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: VIZ.series[i], display: "inline-block", borderRadius: 1 }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </div>
      {x.length < 2 ? (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: VIZ.textMuted, border: `1px dashed ${VIZ.border}`, borderRadius: 6 }}>
          Run a few ticks to start the trend.
        </div>
      ) : (
        <svg width={width} height={height} style={{ display: "block" }}>
          {ticksY.map((v, i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + iw} y1={sy(v)} y2={sy(v)} stroke={VIZ.grid} strokeWidth={1} />
              <text x={pad.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} fill={VIZ.textMuted}>{fmt(v, digits)}</text>
            </g>
          ))}
          <text x={pad.l} y={height - 4} fontSize={9} fill={VIZ.textMuted}>{xMin}</text>
          <text x={pad.l + iw} y={height - 4} fontSize={9} fill={VIZ.textMuted} textAnchor="end">tick {xMax}</text>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={VIZ.series[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && (
            <g>
              <line x1={sx(x[hover]!)} x2={sx(x[hover]!)} y1={pad.t} y2={pad.t + ih} stroke={VIZ.textMuted} strokeWidth={1} strokeDasharray="3 3" />
              {shown.map((s, i) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : (
                  <circle key={i} cx={sx(x[hover]!)} cy={sy(v)} r={4} fill={VIZ.series[i]} stroke={VIZ.surface} strokeWidth={2} />
                );
              })}
            </g>
          )}
          {hover === null && shown.map((s, i) => {
            const v = s.values[last];
            return v === null || v === undefined ? null : (
              <circle key={i} cx={sx(x[last]!)} cy={sy(v)} r={3} fill={VIZ.series[i]} stroke={VIZ.surface} strokeWidth={2} />
            );
          })}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && x.length >= 2 && (
        <div style={{
          position: "absolute", pointerEvents: "none", top: 18,
          left: Math.min(Math.max(0, sx(x[hover]!) + 10), Math.max(0, width - 150)),
          background: "#020617", border: `1px solid ${VIZ.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 10, color: VIZ.textPrimary, minWidth: 110, zIndex: 5,
        }}>
          <div style={{ color: VIZ.textSecondary, marginBottom: 2 }}>tick {x[hover]}</div>
          {shown.map((s, i) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: VIZ.series[i], display: "inline-block" }} />
                {s.label}
              </span>
              <b>{fmt(s.values[hover] ?? null, digits)}{unit}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A tiny trend line with no axes, for stat tiles. */
export function Sparkline({ values, width = 90, height = 22 }: { values: number[]; width?: number; height?: number }) {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const sy = (n: number) => height - 2 - ((n - min) / (max - min || 1)) * (height - 4);
  const d = v.map((n, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * (width - 4) + 2).toFixed(1)},${sy(n).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={VIZ.series[0]} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width - 2} cy={sy(v[v.length - 1]!)} r={2.5} fill={VIZ.series[0]} />
    </svg>
  );
}

/** A labelled number with optional trend and change; `bad` picks which direction of change is a warning. */
export function Stat({
  label, value, digits = 0, unit = "", trend, delta, bad = "down", sub,
}: { label: string; value: number | null | undefined; digits?: number; unit?: string; trend?: number[]; delta?: number | null | undefined; bad?: "up" | "down" | "none"; sub?: string | undefined }) {
  const showDelta = delta !== null && delta !== undefined && Number.isFinite(delta) && delta !== 0;
  const worse = showDelta && ((bad === "down" && delta! < 0) || (bad === "up" && delta! > 0));
  return (
    <div style={{ background: VIZ.panel, border: `1px solid ${VIZ.border}`, borderRadius: 8, padding: "6px 9px", minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: VIZ.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: VIZ.textPrimary, lineHeight: 1.2 }}>{fmt(value, digits)}{unit}</div>
          {(showDelta || sub) && (
            <div style={{ fontSize: 9.5, color: VIZ.textSecondary, whiteSpace: "nowrap" }}>
              {showDelta && (
                <span style={{ color: worse ? VIZ.status.serious : VIZ.textSecondary }}>
                  {delta! > 0 ? "▲" : "▼"} {fmt(Math.abs(delta!), digits)}
                </span>
              )}
              {sub && <span> {sub}</span>}
            </div>
          )}
        </div>
        {trend && trend.length > 1 && <Sparkline values={trend} width={60} height={20} />}
      </div>
    </div>
  );
}

export function StatusPill({ level, children }: { level: "good" | "warning" | "serious" | "critical"; children: React.ReactNode }) {
  const icon = { good: "✓", warning: "!", serious: "!", critical: "✕" }[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      color: VIZ.status[level], border: `1px solid ${VIZ.status[level]}`, whiteSpace: "nowrap",
    }}>
      <span>{icon}</span>{children}
    </span>
  );
}
