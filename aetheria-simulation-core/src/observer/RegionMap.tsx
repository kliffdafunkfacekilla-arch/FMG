import React, { useState, useEffect, useRef } from "react";

const BIOME_COLORS: Record<number, string> = {
  0: "#1E3D59", // Marine (Water)
  1: "#F5D061", // Hot desert
  2: "#E6B741", // Cold desert
  3: "#A4D4B4", // Savanna
  4: "#6EA171", // Grassland
  5: "#3C6E47", // Tropical seasonal forest
  6: "#2A4E34", // Temperate deciduous forest
  7: "#1A3622", // Tropical rainforest
  8: "#4F825C", // Temperate rainforest
  9: "#7C9B86", // Taiga
  10: "#E1E1E1", // Tundra
  11: "#FFFFFF", // Glacier
  12: "#2A2A2A", // Wetland
};

const LEGEND = [
  { label: "City Center", color: "#3b3633" },
  { label: "Suburbs", color: "#5c534d" },
  { label: "Roads", color: "#756758" },
  { label: "Water", color: "#1E3D59" },
  { label: "Hot Desert", color: "#F5D061" },
  { label: "Cold Desert", color: "#E6B741" },
  { label: "Savanna", color: "#A4D4B4" },
  { label: "Grassland", color: "#6EA171" },
  { label: "Trop. Seasonal Forest", color: "#3C6E47" },
  { label: "Temp. Deciduous", color: "#2A4E34" },
  { label: "Trop. Rainforest", color: "#1A3622" },
  { label: "Temp. Rainforest", color: "#4F825C" },
  { label: "Taiga", color: "#7C9B86" },
  { label: "Tundra", color: "#E1E1E1" },
  { label: "Glacier", color: "#FFFFFF" },
  { label: "Wetland", color: "#2A2A2A" },
];

export function RegionMap({ cellId: propCellId }: { cellId?: number }) {
  const [cellIdInput, setCellIdInput] = useState<string>(propCellId ? String(propCellId) : "9796");
  const [regionData, setRegionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (propCellId) {
      setCellIdInput(String(propCellId));
      fetchRegion(String(propCellId));
    }
  }, [propCellId]);

  const fetchRegion = async (idToFetch: string) => {
    if (!idToFetch) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/region/generate/${idToFetch}`);
      if (!res.ok) throw new Error("Failed to generate region");
      const data = await res.json();
      setRegionData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (regionData && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const size = regionData.grid_size;
      const cellSize = 2; // 400px / 200

      ctx.clearRect(0, 0, 400, 400);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const cell = regionData.grid[y][x];
          
          if (cell.type === 'CITY') {
            ctx.fillStyle = "#3b3633"; // Dark Stone
          } else if (cell.type === 'SUBURB') {
            ctx.fillStyle = "#5c534d"; // Lighter Stone
          } else if (cell.type === 'ROAD') {
            ctx.fillStyle = "#756758"; // Dirt/Gravel
          } else {
            const baseColor = BIOME_COLORS[cell.biome] || "#444444";
            ctx.fillStyle = baseColor;
          }
          
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          if (cell.type === 'WILDERNESS') {
             ctx.fillStyle = `rgba(0,0,0,${Math.max(0, cell.elevation * 0.2)})`;
             ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
             ctx.fillStyle = `rgba(255,255,255,${Math.max(0, -cell.elevation * 0.2)})`;
             ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
      
      // Draw POIs
      if (regionData.pois) {
        for (const poi of regionData.pois) {
          ctx.fillStyle = poi.color || "white";
          ctx.beginPath();
          ctx.arc(poi.x * cellSize + cellSize/2, poi.y * cellSize + cellSize/2, cellSize * 1.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = "black";
          ctx.stroke();
          
          ctx.fillStyle = "white";
          ctx.font = "bold 9px sans-serif";
          ctx.fillText(poi.label, poi.x * cellSize + cellSize*2, poi.y * cellSize);
          if (poi.population && poi.population.total > 0) {
              ctx.fillStyle = "#aaaaaa";
              ctx.font = "8px monospace";
              ctx.fillText(`Pop: ${poi.population.total} (${poi.population.faction})`, poi.x * cellSize + cellSize*2, poi.y * cellSize + 10);
              if (poi.population.leader) {
                 ctx.fillStyle = "#d0b084";
                 ctx.fillText(`${poi.population.leader.name} (${poi.population.leader.role})`, poi.x * cellSize + cellSize*2, poi.y * cellSize + 20);
                 ctx.fillStyle = "#888888";
                 ctx.fillText(`"${poi.population.leader.motive}"`, poi.x * cellSize + cellSize*2, poi.y * cellSize + 30);
              }
          }
        }
      }
    }
  }, [regionData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#161b22", padding: "12px", borderLeft: "1px solid #30363d", overflowY: "auto" }}>
      <div style={{ fontWeight: "bold", color: "#58a6ff", fontSize: "12px", letterSpacing: "0.05em", marginBottom: "8px" }}>REGION MAP (MESO LOD)</div>
      
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input 
          type="text" 
          value={cellIdInput} 
          onChange={e => setCellIdInput(e.target.value)} 
          placeholder="Enter Cell ID"
          style={{ flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "6px" }}
        />
        <button 
          onClick={() => fetchRegion(cellIdInput)}
          style={{ background: "#238636", color: "white", border: "none", borderRadius: "4px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}
        >
          {loading ? "Generating..." : "Generate Map"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "#010409", border: "1px solid #30363d", borderRadius: "4px", marginBottom: "12px", minHeight: "400px" }}>
        {regionData ? (
          <canvas ref={canvasRef} width={400} height={400} style={{ width: "100%", maxWidth: "400px", height: "auto", imageRendering: "pixelated" }} />
        ) : (
          <div style={{ color: "#888" }}>Enter Cell ID to generate map.</div>
        )}
      </div>

      {regionData && (
        <div style={{ marginBottom: "12px", fontSize: "12px", color: "#ccc", background: "#0d1117", padding: "8px", borderRadius: "4px", border: "1px solid #30363d" }}>
          <div style={{ marginBottom: "4px" }}><strong>Base Temp:</strong> {regionData.context.base_temp}°C &nbsp; | &nbsp; <strong>Current Temp:</strong> {regionData.context.temperature.toFixed(2)}°C</div>
          {regionData.pois.length > 0 && (
             <div style={{ color: "#fbbf24", fontWeight: "bold" }}>Local Burg Population: {regionData.pois[0].data?.pop_null || regionData.pois[0].population || 0}</div>
          )}
        </div>
      )}

      {/* LEGEND */}
      <div style={{ background: "#0d1117", padding: "10px", borderRadius: "4px", border: "1px solid #30363d" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", color: "#8b949e", marginBottom: "8px", textTransform: "uppercase" }}>Map Legend</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {LEGEND.map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", width: "calc(50% - 4px)", fontSize: "11px", color: "#c9d1d9" }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: item.color, marginRight: "6px", border: "1px solid #000", borderRadius: "2px" }}></div>
              {item.label}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
