import React, { useState, useEffect, useRef, useCallback } from "react";

const REGIONAL_TERRAIN_COLORS: Record<number, string> = {
  0: "#22c55e", // Plains / Grassland
  1: "#16a34a", // Light Vegetation
  2: "#15803d", // Dense Forest
  3: "#0284c7", // Water (Lake / River)
  4: "#475569", // Settlement / Burg Core
  5: "#78716c", // Highway / Paved Road
  6: "#a8a29e", // Smuggler / Trail Path
  7: "#9333ea", // Ancient Temple / POI
};

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
  Anomaly: "#ec4899",
};

export interface RegionAgent {
  id: number;
  type: string;
  speciesName: string;
  category: string;
  color?: string;
  speed: number;
  disposition: number;
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
  onClose,
  isFloating = true
}: {
  cellId: number;
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

  // 1. Initial full fetch of 10,000-cell terrain + metadata
  const fetchFullRegion = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/regional/live/${id}`);
      if (!res.ok) throw new Error("Failed to load regional instance");
      const data: RegionLiveState = await res.json();
      setRegionData(data);
      setAgents(data.agents || []);

      // Pre-render terrain layer into offscreen canvas for fast 60fps rendering
      const offscreen = document.createElement("canvas");
      offscreen.width = data.width || 100;
      offscreen.height = data.height || 100;
      const offCtx = offscreen.getContext("2d");
      if (offCtx && data.mapData) {
        const imgData = offCtx.createImageData(data.width, data.height);
        const map = data.mapData;
        const infra = data.infraMap || [];

        for (let i = 0; i < map.length; i++) {
          const t = map[i] || 0;
          const inf = infra[i] || 0;
          let hex = REGIONAL_TERRAIN_COLORS[t] || "#22c55e";

          if (inf === 128) hex = "#334155"; // Battlefield
          else if (inf === 64) hex = "#64748b"; // Refugee camp
          else if (inf === 32) hex = "#7f1d1d"; // Macabre camp
          else if (inf === 8) hex = "#7e22ce"; // Main Temple

          // Hex to RGB
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

  // 2. High-speed polling for live agent movement (every 250ms)
  useEffect(() => {
    if (!cellId || isMinimized) return;
    let active = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/regional/agents/${cellId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.agents) {
          setAgents(data.agents);
        }
      } catch (err) {
        // silent catch during polling
      }
    }, 250);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cellId, isMinimized]);

  // 3. Render Canvas
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

    // Render live roaming agents
    if (showAgents) {
      for (const a of agents) {
        const px = a.x * cellW;
        const py = a.y * cellH;
        const color = AGENT_COLORS[a.type] || a.color || "#ffffff";

        // Agent Halo
        ctx.beginPath();
        ctx.arc(px, py, a.type === "Predator" ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Direction indicator toward target
        if (a.tx !== undefined && a.ty !== undefined) {
          const tpx = a.tx * cellW;
          const tpy = a.ty * cellH;
          const angle = Math.atan2(tpy - py, tpx - px);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(angle) * 6, py + Math.sin(angle) * 6);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
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

    // Check if hovering near an agent
    const agentW = rect.width / 100;
    const found = agents.find(a => Math.hypot(a.x * agentW - mx, a.y * agentW - my) < 8);
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
                • {hoveredAgent.category} • Speed {hoveredAgent.speed}
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
                Focused Micro Grid:{" "}
                <strong style={{ color: "#38bdf8" }}>
                  rx: {selectedLocalCell?.rx ?? 50}, ry: {selectedLocalCell?.ry ?? 50}
                </strong>{" "}
                (Tactical 256x256 Z=0)
              </span>
              <span style={{ color: "#64748b" }}>Click on grid to refocus</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RegionMap;
