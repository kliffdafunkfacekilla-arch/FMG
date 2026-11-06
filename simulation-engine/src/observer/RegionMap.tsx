import React, { useState, useEffect, useRef, useCallback } from "react";

export interface BiomePalette {
  name: string;
  ground: string;
  lightVeg: string;
  denseVeg: string;
  crag: string;
}

// Authentic biome color palettes matching Okasha / FMG global layers
export const BIOME_PALETTES: Record<number, BiomePalette> = {
  0: { name: "Marine", ground: "#0369a1", lightVeg: "#0284c7", denseVeg: "#0c4a6e", crag: "#082f49" },
  1: { name: "Hot Desert", ground: "#fbe79f", lightVeg: "#ca8a04", denseVeg: "#a16207", crag: "#78350f" },
  2: { name: "Cold Desert", ground: "#b5b887", lightVeg: "#78716c", denseVeg: "#57534e", crag: "#44403c" },
  3: { name: "Savanna", ground: "#d2d082", lightVeg: "#a3e635", denseVeg: "#65a30d", crag: "#713f12" },
  4: { name: "Grassland", ground: "#c8d68f", lightVeg: "#84cc16", denseVeg: "#22c55e", crag: "#475569" },
  5: { name: "Tropical Seasonal Forest", ground: "#b6d95d", lightVeg: "#84cc16", denseVeg: "#15803d", crag: "#334155" },
  6: { name: "Temperate Deciduous Forest", ground: "#29bc56", lightVeg: "#16a34a", denseVeg: "#14532d", crag: "#475569" },
  7: { name: "Tropical Rainforest", ground: "#7dcb35", lightVeg: "#22c55e", denseVeg: "#052e16", crag: "#1e293b" },
  8: { name: "Temperate Rainforest", ground: "#409c43", lightVeg: "#16a34a", denseVeg: "#064e3b", crag: "#334155" },
  9: { name: "Taiga", ground: "#4b6b32", lightVeg: "#3f6212", denseVeg: "#14532d", crag: "#1e293b" },
  10: { name: "Tundra", ground: "#96784b", lightVeg: "#64748b", denseVeg: "#475569", crag: "#94a3b8" },
  11: { name: "Glacier", ground: "#d5e7eb", lightVeg: "#cbd5e1", denseVeg: "#94a3b8", crag: "#f8fafc" },
  12: { name: "Wetland", ground: "#0b9131", lightVeg: "#059669", denseVeg: "#064e3b", crag: "#1e293b" },
  13: { name: "Shallow Reef", ground: "#006994", lightVeg: "#0284c7", denseVeg: "#0369a1", crag: "#082f49" },
  14: { name: "Kelp Forest", ground: "#004b49", lightVeg: "#0f766e", denseVeg: "#134e4a", crag: "#042f2e" },
  15: { name: "Pelagic Ocean", ground: "#000080", lightVeg: "#1e3a8a", denseVeg: "#172554", crag: "#0f172a" },
  16: { name: "Abyssal Plain", ground: "#000033", lightVeg: "#020617", denseVeg: "#030712", crag: "#000000" },
  17: { name: "Oceanic Trench", ground: "#000011", lightVeg: "#020617", denseVeg: "#030712", crag: "#000000" },
  18: { name: "Chaos Land", ground: "#4b0082", lightVeg: "#6b21a8", denseVeg: "#3b0764", crag: "#2e1065" },
  19: { name: "Chaos Water", ground: "#190033", lightVeg: "#3b0764", denseVeg: "#1e1b4b", crag: "#090514" }
};

export function getTerrainColor(tile: number, biomeId: number): string {
  const palette = BIOME_PALETTES[biomeId] || BIOME_PALETTES[4] || {
    name: "Grassland",
    ground: "#c8d68f",
    lightVeg: "#84cc16",
    denseVeg: "#22c55e",
    crag: "#475569"
  };

  switch (tile) {
    case 0: return palette.ground;
    case 1: return palette.lightVeg;
    case 2: return palette.denseVeg;
    case 3: return "#0284c7"; // Authentic River / Ocean Water
    case 4: return "#475569"; // Burg Settlement Core
    case 5: return "#d97706"; // Paved Highway
    case 6: return "#a855f7"; // Covert Smuggler Trail
    case 7: return "#9333ea"; // Ancient Temple / POI
    case 8: return palette.crag; // Mountain rocky crag
    default: return palette.ground;
  }
}

const AGENT_COLORS: Record<string, string> = {
  Predator: "#ef4444",
  Prey: "#22c55e",
  Merchant: "#f59e0b",
  DraftBeast: "#d97706",
  Patrol: "#3b82f6",
  Smuggler: "#a855f7",
  Cultist: "#c026d3",
  Refugee: "#94a3b8",
  Refugees: "#94a3b8",
  Cannibal: "#991b1b",
  Bandit: "#e11d48",
  Trapper: "#854d0e",
  Hermit: "#d97706",
  Scholar: "#6366f1",
  Pilgrim: "#38bdf8",
  Anomaly: "#ec4899"
};

export interface RegionAgent {
  id: number;
  type: string;
  speciesName: string;
  category: string;
  color?: string;
  speed: number;
  disposition: number;
  rx: number;
  ry: number;
  targetRx: number;
  targetRy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface RegionLiveState {
  success: boolean;
  cellId: number;
  width: number;
  height: number;
  biome: string;
  biomeId: number;
  elevation: number;
  currentTemp: number;
  isWarzone: boolean;
  isFamine: boolean;
  burg: any;
  factionName: string;
  mapData: number[];
  infraMap: number[];
  agents: RegionAgent[];
}

export function RegionMap({
  cellId,
  tick,
  onClose,
  isFloating = true
}: {
  cellId: number;
  tick?: number;
  onClose?: () => void;
  isFloating?: boolean;
}) {
  const [regionData, setRegionData] = useState<RegionLiveState | null>(null);
  const [agents, setAgents] = useState<RegionAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredPos, setHoveredPos] = useState<{ rx: number; ry: number } | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<RegionAgent | null>(null);
  const [selectedLocalCell, setSelectedLocalCell] = useState<{ rx: number; ry: number } | null>({ rx: 50, ry: 50 });
  const [showAgents, setShowAgents] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initial fetch of full 10,000-cell terrain + metadata
  const fetchFullRegion = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/regional/live/${id}`);
      if (!res.ok) throw new Error("Failed to load regional instance");
      const data: RegionLiveState = await res.json();
      setRegionData(data);
      setAgents(data.agents || []);

      // Pre-render terrain layer into offscreen canvas using authentic biome colors
      const offscreen = document.createElement("canvas");
      offscreen.width = data.width || 100;
      offscreen.height = data.height || 100;
      const offCtx = offscreen.getContext("2d");
      if (offCtx && data.mapData) {
        const imgData = offCtx.createImageData(data.width, data.height);
        const map = data.mapData;
        const infra = data.infraMap || [];
        const biomeId = data.biomeId ?? 4;

        for (let i = 0; i < map.length; i++) {
          const t = map[i] || 0;
          const inf = infra[i] || 0;
          let hex = getTerrainColor(t, biomeId);

          if (inf === 128) hex = "#334155"; // Battlefield
          else if (inf === 64) hex = "#64748b"; // Refugee camp
          else if (inf === 32) hex = "#0284c7"; // River waterway
          else if (inf === 8) hex = "#7e22ce"; // Main Temple

          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);

          const pixelIdx = i * 4;
          imgData.data[pixelIdx] = r;
          imgData.data[pixelIdx + 1] = g;
          imgData.data[pixelIdx + 2] = b;
          imgData.data[pixelIdx + 3] = 255;
        }
        offCtx.putImageData(imgData, 0, 0);
        terrainCanvasRef.current = offscreen;
      }
    } catch (e) {
      console.error("Error fetching regional instance:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFullRegion(cellId);
  }, [cellId, fetchFullRegion]);

  // 2. Discrete Simulation Step: update agents ONLY when simulation tick advances (1 Tick = 1 Day)
  useEffect(() => {
    if (!cellId || tick === undefined) return;
    let active = true;

    async function fetchAgentsForTick() {
      try {
        const res = await fetch(`/api/regional/agents/${cellId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.agents) {
          setAgents(data.agents);
        }
      } catch (err) {
        // silent catch during tick updates
      }
    }

    fetchAgentsForTick();
    return () => { active = false; };
  }, [cellId, tick]);

  // 3. Render Canvas (Discrete 100x100 Grid Cells)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !regionData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pre-rendered terrain
    if (terrainCanvasRef.current) {
      ctx.drawImage(terrainCanvasRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Grid size constants
    const cellW = canvas.width / 100;
    const cellH = canvas.height / 100;

    // Highlight selected local cell (Micro LOD indicator)
    if (selectedLocalCell) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedLocalCell.rx * cellW - 1,
        selectedLocalCell.ry * cellH - 1,
        cellW + 2,
        cellH + 2
      );
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.fillRect(
        selectedLocalCell.rx * cellW,
        selectedLocalCell.ry * cellH,
        cellW,
        cellH
      );
    }

    // Highlight hovered cell
    if (hoveredPos) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1;
      ctx.strokeRect(hoveredPos.rx * cellW, hoveredPos.ry * cellH, cellW, cellH);
    }

    // Render discrete agents stationed on cells
    if (showAgents) {
      for (const a of agents) {
        const rx = a.rx ?? Math.round(a.x);
        const ry = a.ry ?? Math.round(a.y);
        const px = (rx + 0.5) * cellW;
        const py = (ry + 0.5) * cellH;
        const color = AGENT_COLORS[a.type] || a.color || "#ffffff";

        // Agent Halo marker
        ctx.beginPath();
        ctx.arc(px, py, a.type === "Predator" ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Discrete direction vector towards target cell
        if (a.targetRx !== undefined && a.targetRy !== undefined) {
          const tpx = (a.targetRx + 0.5) * cellW;
          const tpy = (a.targetRy + 0.5) * cellH;
          const angle = Math.atan2(tpy - py, tpx - px);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(angle) * 5, py + Math.sin(angle) * 5);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }
  }, [regionData, agents, selectedLocalCell, hoveredPos, showAgents]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const rx = Math.max(0, Math.min(99, Math.floor((mx / rect.width) * 100)));
    const ry = Math.max(0, Math.min(99, Math.floor((my / rect.height) * 100)));
    setHoveredPos({ rx, ry });

    // Check if hovering near an agent's cell
    const found = agents.find(a => {
      const arx = a.rx ?? Math.round(a.x);
      const ary = a.ry ?? Math.round(a.y);
      return Math.abs(arx - rx) <= 1 && Math.abs(ary - ry) <= 1;
    });
    setHoveredAgent(found || null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const rx = Math.max(0, Math.min(99, Math.floor((mx / rect.width) * 100)));
    const ry = Math.max(0, Math.min(99, Math.floor((my / rect.height) * 100)));
    setSelectedLocalCell({ rx, ry });
  };

  const predatorCount = agents.filter(a => a.type === "Predator").length;
  const preyCount = agents.filter(a => a.type === "Prey").length;
  const civilCount = agents.filter(a => !["Predator", "Prey"].includes(a.type)).length;

  return (
    <div
      style={{
        position: isFloating ? "absolute" : "relative",
        bottom: isFloating ? 20 : "auto",
        right: isFloating ? 20 : "auto",
        zIndex: 50,
        width: 440,
        background: "#090d14",
        border: "1px solid #1e293b",
        borderRadius: 10,
        boxShadow: "0 20px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(56, 189, 248, 0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 14px",
          background: "#0d1522",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", letterSpacing: "-0.3px" }}>
            REGIONAL MESO LOD
          </span>
          <span
            style={{
              fontSize: 10,
              background: "#0284c7",
              color: "#f0f9ff",
              padding: "1px 6px",
              borderRadius: 4,
              fontWeight: 700
            }}
          >
            Cell #{cellId}
          </span>
          <span
            style={{
              fontSize: 10,
              background: "#1e293b",
              color: "#94a3b8",
              padding: "1px 6px",
              borderRadius: 4
            }}
          >
            Tick {tick ?? 0}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: "#1e293b",
              border: "none",
              color: "#94a3b8",
              borderRadius: 4,
              width: 22,
              height: 22,
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "▲" : "▼"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "#1e293b",
                border: "none",
                color: "#f87171",
                borderRadius: 4,
                width: 22,
                height: 22,
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Close Region Window"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* ── METADATA SUBHEADER ──────────────────────────────────── */}
          <div
            style={{
              padding: "8px 14px",
              background: "#080c13",
              borderBottom: "1px solid #1e293b",
              fontSize: 11,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div style={{ display: "flex", gap: 12, color: "#94a3b8" }}>
              <span>
                Biome: <strong style={{ color: "#e2e8f0" }}>{regionData?.biome || "Analyzing..."}</strong>
              </span>
              <span>
                Elev: <strong style={{ color: "#38bdf8" }}>{regionData?.elevation ?? 0}m</strong>
              </span>
              <span>
                Temp: <strong style={{ color: "#facc15" }}>{regionData?.currentTemp ?? 15}°C</strong>
              </span>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {regionData?.isWarzone && (
                <span style={{ fontSize: 9, background: "#dc2626", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                  WARZONE
                </span>
              )}
              {regionData?.isFamine && (
                <span style={{ fontSize: 9, background: "#ea580c", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                  FAMINE
                </span>
              )}
              {regionData?.burg && (
                <span style={{ fontSize: 9, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                  {regionData.burg.name} (T{regionData.burg.urban_tier || 1})
                </span>
              )}
            </div>
          </div>

          {/* ── CANVAS DISPLAY (10,000 CELLS) ───────────────────────── */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 380,
              background: "#020617",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}
          >
            {loading ? (
              <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600 }}>
                Generating 10,000-cell regional simulation mesh...
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={380}
                height={380}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => {
                  setHoveredPos(null);
                  setHoveredAgent(null);
                }}
                onClick={handleCanvasClick}
                style={{
                  width: 380,
                  height: 380,
                  cursor: "crosshair",
                  border: "1px solid #1e293b",
                  borderRadius: 4
                }}
              />
            )}

            {/* Hover Tooltip */}
            {hoveredAgent && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid #38bdf8",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  color: "#f1f5f9",
                  pointerEvents: "none"
                }}
              >
                <span style={{ color: AGENT_COLORS[hoveredAgent.type] || "#38bdf8", fontWeight: 700 }}>
                  {hoveredAgent.speciesName || hoveredAgent.type}
                </span>{" "}
                • Cell ({hoveredAgent.rx}, {hoveredAgent.ry}) • Speed {hoveredAgent.speed} c/day
              </div>
            )}
          </div>

          {/* ── FOOTER: LIVE TELEMETRY & TACTICAL LOCAL COORDINATE ──── */}
          <div
            style={{
              padding: "10px 14px",
              background: "#0a1019",
              borderTop: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            {/* Live Agents Telemetry */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#ef4444", fontWeight: 700 }}>
                  Predators: {predatorCount}
                </span>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>
                  Prey: {preyCount}
                </span>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                  Civil/Guards: {civilCount}
                </span>
              </div>
              <button
                onClick={() => setShowAgents(!showAgents)}
                style={{
                  background: showAgents ? "#0369a1" : "#1e293b",
                  border: "none",
                  color: "#f0f9ff",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                {showAgents ? "Agents Visible" : "Hide Agents"}
              </button>
            </div>

            {/* Focused Tactical Micro Cell Link */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 8px",
                background: "#0f172a",
                borderRadius: 4,
                fontSize: 10,
                color: "#94a3b8"
              }}
            >
              <span>
                Focused Micro Cell:{" "}
                <strong style={{ color: "#38bdf8" }}>
                  rx: {selectedLocalCell?.rx ?? 50}, ry: {selectedLocalCell?.ry ?? 50}
                </strong>{" "}
                (Tactical 256x256 Z=0)
              </span>
              <span style={{ color: "#64748b" }}>Discrete Step Simulation (1 Tick = 1 Day)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RegionMap;
