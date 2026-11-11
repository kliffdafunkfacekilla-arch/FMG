import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RegionMap } from "./RegionMap";
import { TacticalSandboxModal } from "./TacticalSandboxModal";
import { RulesLabTab } from "./RulesLabTab";

interface Faction {
  id: number;
  name: string;
  color: string;
  wealth?: number;
  trait_aggression?: number;
}

interface FringeFaction {
  id: number;
  name: string;
  type: string;
  wealth?: number;
  manpower?: number;
  lair_manpower?: number;
  total_manpower?: number;
  worker_groups?: number;
  heat?: number;
  description?: string;
  contraband_types?: string[];
  origin_cell_id?: number;
}

interface FringeLair {
  id: number;
  faction_id: number;
  cell_id: number;
  burg_id: number;
  burg_name?: string;
  lair_type: string;
  manpower: number;
  heat: number;
}

interface Cell {
  id: number;
  faction_id: number | null;
  biome: number;
  geometry: any;
  eco_plants: number;
  eco_prey: number;
  eco_predators: number;
  elevation: number;
  center_x?: number;
  center_y?: number;
}

interface SimEvent {
  id: number;
  tick: number;
  type: string;
  message: string;
  tier: string;
  lore_date: string;
  burg_id: number | null;
  faction_id: number | null;
  z_layer: number;
}

interface BurgItem {
  burg_id: number;
  name: string;
  cell_id: number;
  food: number;
  wealth: number;
  unrest: number;
  urban_tier: number;
  pop_null: number;
  crime_rate: number;
  occupier_faction_id: number | null;
  faction_id: number | null;
  faction_name?: string;
  faction_color?: string;
}

interface ParagonItem {
  id: number;
  burg_id: number;
  name: string;
  title: string;
  traits: any;
  corruption_score: number;
}

interface PrisonItem {
  id: number;
  cell_id: number;
  dragon_name: string;
  power_domain: string;
  seal_strength: number;
}

interface ObserverState {
  factions: Faction[];
  fringeFactions: FringeFaction[];
  cells: Cell[];
  events: SimEvent[];
  calendar: any;
  tickInProgress: boolean;
  economy: any[];
}

type MainTab = "MAP" | "SECTORS" | "FRINGE" | "ECOLOGY_CHAOS" | "EVENTS" | "ECONOMY" | "RULES_LAB";
type ViewMode = "Political" | "Biome" | "Ecology" | "Unrest";
type SectorCategory = "ALL_BURGS" | "PRISONS" | "CONVERGENCE";

const BIOME_COLORS: Record<number, string> = {
  0: "#1e3a8a", 1: "#fde047", 2: "#d6d3d1", 3: "#fcd34d", 4: "#a3e635", 5: "#65a30d",
  6: "#4d7c0f", 7: "#166534", 8: "#0f766e", 9: "#334155", 10: "#94a3b8", 11: "#f8fafc",
  12: "#3f6212", 101: "#0f172a", 102: "#1e293b", 103: "#0369a1", 104: "#0284c7",
  105: "#0ea5e9", 106: "#38bdf8", 107: "#06b6d4", 108: "#0891b2", 109: "#1e3a8a",
  110: "#312e81", 111: "#e2e8f0", 112: "#14b8a6",
};

// -------------------------------------------------------------
// 1. MAP CANVAS COMPONENT (WITH COMPREHENSIVE POI MARKERS & FAST FLY-TO)
// -------------------------------------------------------------
function MapCanvas({
  cells,
  factions,
  viewMode,
  economy,
  burgs = [],
  prisons = [],
  convergence,
  onCellClick,
  selectedCellId,
  selectedFactionId
}: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0 });
  const bounds = useRef({ minX: 0, maxX: 100, minY: 0, maxY: 100, baseScale: 1, baseOffX: 0, baseOffY: 0 });

  // POI Filter & Display Controls
  const [showBurgs, setShowBurgs] = useState<"all" | "cities" | "none">("all");
  const [showPrisons, setShowPrisons] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [hoveredMarker, setHoveredMarker] = useState<{
    type: "BURG" | "PRISON" | "CONVERGENCE";
    item: any;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Pre-calculate cell centers for fast rendering & hit-testing
  const cellCoordMap = useMemo(() => {
    const map = new Map<number, { cx: number; cy: number; cell: Cell }>();
    for (const c of cells) {
      let cx = c.center_x;
      let cy = c.center_y;
      if ((cx === undefined || cy === undefined) && c.geometry?.coordinates?.[0]) {
        const poly = c.geometry.coordinates[0];
        let sx = 0, sy = 0;
        for (const pt of poly) { sx += pt[0]; sy += pt[1]; }
        cx = sx / poly.length;
        cy = sy / poly.length;
      }
      if (cx !== undefined && cy !== undefined) {
        map.set(c.id, { cx, cy, cell: c });
      }
    }
    return map;
  }, [cells]);

  // Smooth Camera Fly-to Helper
  const flyToCell = (targetCellId: number) => {
    const coord = cellCoordMap.get(targetCellId);
    const canvas = canvasRef.current;
    if (!coord || !canvas || !bounds.current.baseScale) return;
    const px = coord.cx * bounds.current.baseScale + bounds.current.baseOffX;
    const py = coord.cy * bounds.current.baseScale + bounds.current.baseOffY;
    const targetZoom = Math.max(zoom, 2.5);
    const newOffsetX = -(px - canvas.width / 2) * targetZoom;
    const newOffsetY = -(py - canvas.height / 2) * targetZoom;
    setZoom(targetZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });
    onCellClick(targetCellId);
    setIsSearchFocused(false);
  };

  useEffect(() => {
    if (!cells || cells.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach((cell: Cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      cell.geometry.coordinates[0].forEach(([x, y]: any) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
    });
    if (minX === Infinity) return;
    bounds.current = { minX, maxX, minY, maxY, baseScale: 1, baseOffX: 0, baseOffY: 0 };
  }, [cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
          setZoom(z => z);
        }
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const pad = 10;
    const { minX, maxX, minY, maxY } = bounds.current;
    const scaleX = (canvas.width - pad * 2) / (maxX - minX || 1);
    const scaleY = (canvas.height - pad * 2) / (maxY - minY || 1);
    const baseScale = Math.min(scaleX, scaleY);
    bounds.current.baseScale = baseScale;
    bounds.current.baseOffX = (canvas.width - (maxX - minX) * baseScale) / 2 - minX * baseScale;
    bounds.current.baseOffY = (canvas.height - (maxY - minY) * baseScale) / 2 - minY * baseScale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#090d13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    let selectedCellRef: Cell | null = null;

    // 1. Render Voronoi Polygonal Land Cells
    cells.forEach((cell: Cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      const coords = cell.geometry.coordinates[0];
      const actualFactionId = economy[cell.id]?.faction_id || cell.faction_id;
      const isSelectedFaction = selectedFactionId && actualFactionId === selectedFactionId;
      if (cell.id === selectedCellId) selectedCellRef = cell;

      if (cell.elevation < 20) {
        ctx.fillStyle = "#0c182b";
      } else if (viewMode === "Biome") {
        ctx.fillStyle = BIOME_COLORS[cell.biome] || "#222";
      } else if (viewMode === "Political") {
        const f = actualFactionId ? factions[actualFactionId] : null;
        if (selectedFactionId && !isSelectedFaction) {
          ctx.fillStyle = f ? f.color + "33" : "#0d1420";
        } else {
          ctx.fillStyle = f ? f.color + "cc" : "#1e2a1e";
        }
      } else if (viewMode === "Ecology") {
        const total = (cell.eco_plants || 0) + (cell.eco_prey || 0) + (cell.eco_predators || 0);
        ctx.fillStyle = `rgb(${Math.min(255, total)}, ${Math.min(255, (cell.eco_plants || 0) * 2)}, 50)`;
      } else if (viewMode === "Unrest") {
        const b = economy[cell.id];
        const u = b ? b.unrest || 0 : 0;
        ctx.fillStyle = u > 40 ? "#dc2626" : u > 15 ? "#ea580c" : "#1e293b";
      }

      ctx.beginPath();
      coords.forEach(([x, y]: any, i: number) => {
        const px = x * baseScale + bounds.current.baseOffX;
        const py = y * baseScale + bounds.current.baseOffY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();

      // Highlight selected cell or faction border
      if (cell.id === selectedCellId) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
      } else if (isSelectedFaction) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 0.5 / zoom;
        ctx.stroke();
      }
    });

    // 2. Render Dragon Prisons (12 Sacred Dragon Seals)
    if (showPrisons) {
      for (const p of prisons) {
        const coord = cellCoordMap.get(p.cell_id);
        if (!coord) continue;
        const px = coord.cx * baseScale + bounds.current.baseOffX;
        const py = coord.cy * baseScale + bounds.current.baseOffY;

        const isSelected = selectedCellId === p.cell_id;
        const isHovered = hoveredMarker?.type === "PRISON" && hoveredMarker.item.id === p.id;
        const r = Math.max(6, (isSelected || isHovered ? 11 : 8) / zoom);

        // Cosmic pulsing outer aura
        ctx.beginPath();
        ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "rgba(239, 68, 68, 0.5)" : "rgba(168, 85, 247, 0.35)";
        ctx.fill();

        // Inner seal circle
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = "#3b0764"; // Deep void purple
        ctx.fill();

        // Seal integrity color ring
        const sealColor = p.seal_strength > 75 ? "#10b981" : p.seal_strength > 40 ? "#f59e0b" : "#ef4444";
        ctx.strokeStyle = sealColor;
        ctx.lineWidth = 2.5 / zoom;
        ctx.stroke();

        // Center jewel
        ctx.beginPath();
        ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = sealColor;
        ctx.fill();

        // Name & Integrity Label
        if (showLabels) {
          const fontSize = Math.max(9, Math.min(13, 11 / zoom));
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = `🐉 ${p.dragon_name} [${p.seal_strength}%]`;

          ctx.lineWidth = 3 / zoom;
          ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
          ctx.strokeText(label, px, py + r + 3 / zoom);
          ctx.fillStyle = isSelected ? "#fca5a5" : "#e9d5ff";
          ctx.fillText(label, px, py + r + 3 / zoom);
        }
      }
    }

    // 3. Render Cruorbus Convergence Nexus
    if (convergence) {
      const coord = cellCoordMap.get(convergence.cell_id || 11429);
      if (coord) {
        const px = coord.cx * baseScale + bounds.current.baseOffX;
        const py = coord.cy * baseScale + bounds.current.baseOffY;
        const r = Math.max(7, 10 / zoom);

        ctx.beginPath();
        ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = "#0284c7";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        if (showLabels) {
          const fontSize = Math.max(9, Math.min(13, 11 / zoom));
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = `⚡ Spire of Convergence`;
          ctx.lineWidth = 3 / zoom;
          ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
          ctx.strokeText(label, px, py + r + 3 / zoom);
          ctx.fillStyle = "#38bdf8";
          ctx.fillText(label, px, py + r + 3 / zoom);
        }
      }
    }

    // 4. Render Authentic Burg Markers (352 Settlements)
    if (showBurgs !== "none") {
      for (const b of burgs) {
        const coord = cellCoordMap.get(b.cell_id);
        if (!coord) continue;

        const isCity = (b.urban_tier || 1) >= 3 || (b.pop_null || 0) > 10000;
        const isTown = (b.urban_tier || 1) === 2 || (b.pop_null || 0) > 1200;

        // Level of detail gating
        if (showBurgs === "cities" && !isCity) continue;
        if (zoom < 0.9 && !isCity) continue;
        if (zoom < 1.7 && !isCity && !isTown) continue;

        const px = coord.cx * baseScale + bounds.current.baseOffX;
        const py = coord.cy * baseScale + bounds.current.baseOffY;

        const isSelected = selectedCellId === b.cell_id;
        const isHovered = hoveredMarker?.type === "BURG" && hoveredMarker.item.burg_id === b.burg_id;
        const fColor = b.faction_color || (b.faction_id ? factions[b.faction_id]?.color : null) || "#f59e0b";

        const baseR = (isCity ? 6.5 : isTown ? 4.5 : 3.0) / zoom;
        const scaleRadius = Math.max(isCity ? 5.5 : 3.5, baseR);

        // Hover or selected halo
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(px, py, scaleRadius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.45)" : "rgba(250, 204, 21, 0.45)";
          ctx.fill();
        }

        // Draw Burg icon
        if (isCity) {
          // Diamond / Citadel for Cities & Capitals
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = fColor;
          const s = scaleRadius * 1.5;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.8 / zoom;
          ctx.strokeRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          // Circle for Towns & Villages
          ctx.beginPath();
          ctx.arc(px, py, scaleRadius, 0, Math.PI * 2);
          ctx.fillStyle = fColor;
          ctx.fill();
          ctx.strokeStyle = isTown ? "#ffffff" : "rgba(0, 0, 0, 0.75)";
          ctx.lineWidth = 1.2 / zoom;
          ctx.stroke();
        }

        // Unrest indicator dot
        if (b.unrest > 35) {
          ctx.beginPath();
          ctx.arc(px + scaleRadius, py - scaleRadius, 2.5 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = "#ef4444";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.8 / zoom;
          ctx.stroke();
        }

        // Label
        const shouldDrawLabel = showLabels && (isCity || zoom >= 1.4 || (isTown && zoom >= 1.0) || isSelected || isHovered);
        if (shouldDrawLabel) {
          const fontSize = Math.max(8.5, Math.min(12, (isCity ? 11 : 9.5) / zoom));
          ctx.font = `${isCity ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = isCity ? `🏰 ${b.name}` : b.name;

          ctx.lineWidth = 2.5 / zoom;
          ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
          ctx.strokeText(label, px, py + scaleRadius + 2 / zoom);
          ctx.fillStyle = isSelected ? "#38bdf8" : isHovered ? "#facc15" : isCity ? "#ffffff" : "#e2e8f0";
          ctx.fillText(label, px, py + scaleRadius + 2 / zoom);
        }
      }
    }

    // 5. High-visibility beacon on selected cell
    if (selectedCellRef && bounds.current.baseScale) {
      const coord = cellCoordMap.get((selectedCellRef as any).id);
      if (coord) {
        const px = coord.cx * baseScale + bounds.current.baseOffX;
        const py = coord.cy * baseScale + bounds.current.baseOffY;
        ctx.beginPath();
        ctx.arc(px, py, 7 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 15 / zoom, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [cells, factions, viewMode, economy, zoom, offset, selectedCellId, selectedFactionId, showBurgs, showPrisons, showLabels, hoveredMarker, burgs, prisons, convergence]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(z => Math.max(0.5, Math.min(15, z * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      return;
    }

    // Hit testing for POI hover detection
    if (!bounds.current.baseScale) return;
    const worldX = (mouseX - canvas.width / 2 - offset.x) / zoom + canvas.width / 2;
    const worldY = (mouseY - canvas.height / 2 - offset.y) / zoom + canvas.height / 2;
    const mapX = (worldX - bounds.current.baseOffX) / bounds.current.baseScale;
    const mapY = (worldY - bounds.current.baseOffY) / bounds.current.baseScale;

    // Check Dragon Prisons
    let hitMarker: any = null;
    if (showPrisons) {
      for (const p of prisons) {
        const coord = cellCoordMap.get(p.cell_id);
        if (coord && Math.hypot(coord.cx - mapX, coord.cy - mapY) < Math.max(8, 14 / zoom)) {
          hitMarker = { type: "PRISON", item: p, screenX: mouseX, screenY: mouseY };
          break;
        }
      }
    }

    // Check Burgs
    if (!hitMarker && showBurgs !== "none") {
      for (const b of burgs) {
        const coord = cellCoordMap.get(b.cell_id);
        if (coord && Math.hypot(coord.cx - mapX, coord.cy - mapY) < Math.max(6, 12 / zoom)) {
          hitMarker = { type: "BURG", item: b, screenX: mouseX, screenY: mouseY };
          break;
        }
      }
    }

    // Check Convergence
    if (!hitMarker && convergence) {
      const coord = cellCoordMap.get(convergence.cell_id || 11429);
      if (coord && Math.hypot(coord.cx - mapX, coord.cy - mapY) < Math.max(8, 16 / zoom)) {
        hitMarker = { type: "CONVERGENCE", item: convergence, screenX: mouseX, screenY: mouseY };
      }
    }

    setHoveredMarker(hitMarker);
    canvas.style.cursor = hitMarker ? "pointer" : "grab";
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const moved = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    isDragging.current = false;

    // Detect click if mouse barely moved
    if (moved < 6 && onCellClick && canvasRef.current && bounds.current.baseScale) {
      if (hoveredMarker) {
        onCellClick(hoveredMarker.item.cell_id);
        return;
      }

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - canvas.width / 2 - offset.x) / zoom + canvas.width / 2;
      const worldY = (mouseY - canvas.height / 2 - offset.y) / zoom + canvas.height / 2;
      const mapX = (worldX - bounds.current.baseOffX) / bounds.current.baseScale;
      const mapY = (worldY - bounds.current.baseOffY) / bounds.current.baseScale;

      // Check if clicked near any Burg or Prison
      let closestItem: any = null;
      let minItemDist = Infinity;
      for (const b of burgs) {
        const coord = cellCoordMap.get(b.cell_id);
        if (coord) {
          const d = Math.hypot(coord.cx - mapX, coord.cy - mapY);
          if (d < minItemDist) { minItemDist = d; closestItem = b; }
        }
      }
      for (const p of prisons) {
        const coord = cellCoordMap.get(p.cell_id);
        if (coord) {
          const d = Math.hypot(coord.cx - mapX, coord.cy - mapY);
          if (d < minItemDist) { minItemDist = d; closestItem = p; }
        }
      }

      if (closestItem && minItemDist < 20 / zoom) {
        onCellClick(closestItem.cell_id);
        return;
      }

      // Fallback: nearest polygon cell
      let nearestCell: any = null;
      let minDist = Infinity;
      for (const c of cells) {
        const coord = cellCoordMap.get(c.id);
        if (coord) {
          const d = (coord.cx - mapX) ** 2 + (coord.cy - mapY) ** 2;
          if (d < minDist) {
            minDist = d;
            nearestCell = c;
          }
        }
      }
      if (nearestCell && Math.sqrt(minDist) < 120) {
        onCellClick(nearestCell.id);
      }
    }
  };

  // Search Results Filter
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const res: Array<{ type: "BURG" | "PRISON" | "CONVERGENCE"; name: string; cell_id: number; subtitle: string }> = [];

    if ("spire".includes(q) || "convergence".includes(q) || "nexus".includes(q)) {
      res.push({
        type: "CONVERGENCE",
        name: "Cruorbus Convergence Nexus",
        cell_id: convergence?.cell_id || 11429,
        subtitle: "Planetary Ley Nexus"
      });
    }

    for (const p of prisons) {
      if (p.dragon_name?.toLowerCase().includes(q) || p.power_domain?.toLowerCase().includes(q)) {
        res.push({
          type: "PRISON",
          name: `Dragon Prison: ${p.dragon_name}`,
          cell_id: p.cell_id,
          subtitle: `Domain: ${p.power_domain} • Seal: ${p.seal_strength}%`
        });
      }
    }

    for (const b of burgs) {
      if (b.name?.toLowerCase().includes(q) || String(b.burg_id) === q || String(b.cell_id) === q) {
        res.push({
          type: "BURG",
          name: b.name,
          cell_id: b.cell_id,
          subtitle: `${b.urban_tier >= 3 ? "Major City" : b.urban_tier === 2 ? "Town" : "Settlement"} • ${b.faction_name || "Independent"} (Pop: ${b.pop_null?.toLocaleString()})`
        });
        if (res.length >= 8) break;
      }
    }

    return res;
  }, [searchQuery, burgs, prisons, convergence]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
      />

      {/* ── TOP MAP HUD: INSTANT SEARCH & POI FILTER TOOLBAR ─────── */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 10
        }}
      >
        {/* Search Bar */}
        <div style={{ position: "relative", width: 280 }}>
          <input
            type="text"
            placeholder="🔍 Search Burgs or 12 Dragon Prisons..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
            style={{
              width: "100%",
              padding: "7px 12px",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#f8fafc",
              fontSize: 12,
              outline: "none",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)"
            }}
          />

          {/* Search Dropdown Results */}
          {isSearchFocused && searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 36,
                left: 0,
                width: "100%",
                background: "#0f172a",
                border: "1px solid #38bdf8",
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                zIndex: 20
              }}
            >
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => flyToCell(r.cell_id)}
                  style={{
                    padding: "8px 10px",
                    borderBottom: i < searchResults.length - 1 ? "1px solid #1e293b" : "none",
                    cursor: "pointer",
                    background: "#0f172a",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: r.type === "PRISON" ? "#c084fc" : r.type === "CONVERGENCE" ? "#38bdf8" : "#f1f5f9" }}>
                      {r.name}
                    </span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>Cell #{r.cell_id}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{r.subtitle}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* POI Toggle Filter Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowBurgs(showBurgs === "all" ? "cities" : showBurgs === "cities" ? "none" : "all")}
            style={{
              padding: "4px 8px",
              background: showBurgs !== "none" ? "rgba(2, 132, 199, 0.85)" : "rgba(15, 23, 42, 0.85)",
              border: `1px solid ${showBurgs !== "none" ? "#38bdf8" : "#334155"}`,
              borderRadius: 4,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(6px)"
            }}
          >
            🏰 Burgs: {showBurgs === "all" ? "All (352)" : showBurgs === "cities" ? "Cities Only" : "Off"}
          </button>

          <button
            onClick={() => setShowPrisons(!showPrisons)}
            style={{
              padding: "4px 8px",
              background: showPrisons ? "rgba(147, 51, 234, 0.85)" : "rgba(15, 23, 42, 0.85)",
              border: `1px solid ${showPrisons ? "#c084fc" : "#334155"}`,
              borderRadius: 4,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(6px)"
            }}
          >
            🐉 Prisons: {showPrisons ? "Active (12)" : "Off"}
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            style={{
              padding: "4px 8px",
              background: showLabels ? "rgba(30, 41, 59, 0.85)" : "rgba(15, 23, 42, 0.85)",
              border: `1px solid ${showLabels ? "#94a3b8" : "#334155"}`,
              borderRadius: 4,
              color: showLabels ? "#f8fafc" : "#64748b",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(6px)"
            }}
          >
            🏷️ Labels: {showLabels ? "On" : "Off"}
          </button>

          <button
            onClick={() => flyToCell(convergence?.cell_id || 11429)}
            style={{
              padding: "4px 8px",
              background: "rgba(56, 189, 248, 0.2)",
              border: "1px solid #0284c7",
              borderRadius: 4,
              color: "#38bdf8",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            ⚡ Spire
          </button>
        </div>
      </div>

      {/* ── FLOATING HOVER TOOLTIP ───────────────────────────────── */}
      {hoveredMarker && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hoveredMarker.screenX + 14, (canvasRef.current?.width || 800) - 240),
            top: Math.min(hoveredMarker.screenY + 14, (canvasRef.current?.height || 600) - 150),
            background: "rgba(15, 23, 42, 0.95)",
            border: `1px solid ${hoveredMarker.type === "PRISON" ? "#c084fc" : "#38bdf8"}`,
            borderRadius: 6,
            padding: "8px 12px",
            minWidth: 200,
            maxWidth: 260,
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
            zIndex: 30
          }}
        >
          {hoveredMarker.type === "BURG" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#f8fafc" }}>
                  🏰 {hoveredMarker.item.name}
                </span>
                <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>
                  {hoveredMarker.item.urban_tier >= 3 ? "Major City" : hoveredMarker.item.urban_tier === 2 ? "Town" : "Village"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Sovereignty: <strong style={{ color: hoveredMarker.item.faction_color || "#facc15" }}>{hoveredMarker.item.faction_name || "Independent"}</strong>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Pop: <strong style={{ color: "#fff" }}>{hoveredMarker.item.pop_null?.toLocaleString()}</strong></span>
                <span>Wealth: <strong style={{ color: "#facc15" }}>{hoveredMarker.item.wealth}g</strong></span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Unrest: <strong style={{ color: hoveredMarker.item.unrest > 30 ? "#ef4444" : "#22c55e" }}>{hoveredMarker.item.unrest}%</strong></span>
                <span>Food: <strong style={{ color: "#38bdf8" }}>{hoveredMarker.item.food?.toLocaleString()}</strong></span>
              </div>
              <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid #334155", fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>
                ⚔️ Click to open 10,000-cell mesh & tactical map
              </div>
            </div>
          )}

          {hoveredMarker.type === "PRISON" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#c084fc" }}>
                  🐉 Prison: {hoveredMarker.item.dragon_name}
                </span>
                <span style={{ fontSize: 10, color: "#e9d5ff", fontWeight: 700 }}>
                  [{hoveredMarker.item.power_domain}]
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Sacred Seal Integrity:{" "}
                <strong style={{ color: hoveredMarker.item.seal_strength > 75 ? "#10b981" : hoveredMarker.item.seal_strength > 40 ? "#f59e0b" : "#ef4444" }}>
                  {hoveredMarker.item.seal_strength}%
                </strong>
              </div>
              <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid #334155", fontSize: 10, color: "#c084fc", fontWeight: 600 }}>
                ⚔️ Click to inspect Dragon Prison & tactical battle map
              </div>
            </div>
          )}

          {hoveredMarker.type === "CONVERGENCE" && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#38bdf8" }}>
                ⚡ Cruorbus Convergence Nexus
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Planetary Nexus of the 12 Primordial Chaos Leys.
              </div>
              <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid #334155", fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>
                ⚔️ Click to inspect The Spire & tactical battle map
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM HUD CONTROLS ─────────────────────────────────── */}
      <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.8)", padding: "5px 10px", borderRadius: 4, fontSize: 11, color: "#94a3b8", backdropFilter: "blur(4px)" }}>
        Drag to Pan • Wheel to Zoom ({zoom.toFixed(1)}x) • Click any Marker to Inspect
      </div>
    </div>
  );
}


// -------------------------------------------------------------
// 2. MAIN OBSERVER DASHBOARD COMPONENT
// -------------------------------------------------------------
export function Dashboard() {
  const [state, setState] = useState<ObserverState | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [hasFetchedMap, setHasFetchedMap] = useState(false);
  const [economyMap, setEconomyMap] = useState<Record<number, any>>({});
  const [factionMap, setFactionMap] = useState<Record<number, Faction>>({});
  const [activeTab, setActiveTab] = useState<MainTab>("MAP");
  const [viewMode, setViewMode] = useState<ViewMode>("Political");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);

  // Regional Meso LOD Floating Window State (10,000 Cells)
  const [focusedCellId, setFocusedCellId] = useState<number | null>(19861);
  const [showRegionalWindow, setShowRegionalWindow] = useState<boolean>(true);
  const [cellSearchInput, setCellSearchInput] = useState<string>("");
  const [tacticalModalTarget, setTacticalModalTarget] = useState<{ cellId: number; rx: number; ry: number } | null>(null);

  // Sector Division State
  const [burgs, setBurgs] = useState<BurgItem[]>([]);
  const [paragons, setParagons] = useState<ParagonItem[]>([]);
  const [prisons, setPrisons] = useState<PrisonItem[]>([]);
  const [convergence, setConvergence] = useState<any>(null);
  const [sectorFeatures, setSectorFeatures] = useState<Record<number, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<SectorCategory>("ALL_BURGS");
  const [sectorSearch, setSectorSearch] = useState("");
  const [selectedBurg, setSelectedBurg] = useState<BurgItem | null>(null);
  const [selectedPrison, setSelectedPrison] = useState<PrisonItem | null>(null);
  const [isConvergenceSelected, setIsConvergenceSelected] = useState(false);

  // Fringe Faction State
  const [fringeDetail, setFringeDetail] = useState<{ factions: FringeFaction[]; lairs: FringeLair[] }>({ factions: [], lairs: [] });
  const [selectedFringe, setSelectedFringe] = useState<FringeFaction | null>(null);

  // Filtered Events State
  const [sectorEvents, setSectorEvents] = useState<SimEvent[]>([]);
  const [fringeEvents, setFringeEvents] = useState<SimEvent[]>([]);
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [burgCitizens, setBurgCitizens] = useState<any[]>([]);

  // Ecology & Chaos Flows State
  const [ecologyData, setEcologyData] = useState<any>(null);
  const [chaosFlowsData, setChaosFlowsData] = useState<any>(null);
  const [selectedFlow, setSelectedFlow] = useState<any>(null);

  // Economy & Trade Specialties State
  const [economyData, setEconomyData] = useState<{
    specialties: any[];
    activeEmbargoes: any[];
    recentTradeEvents: any[];
  } | null>(null);
  const [economyCategoryFilter, setEconomyCategoryFilter] = useState<string>("ALL");
  const [economySearch, setEconomySearch] = useState<string>("");

  // Fetch core simulation state
  const fetchState = useCallback(async () => {
    if (!hasFetchedMap) {
      try {
        const mapRes = await fetch(`/api/observer/map?z=0`);
        if (mapRes.ok) {
          const mapData = await mapRes.json();
          setCells(mapData.cells || []);
          setHasFetchedMap(true);
        }
      } catch (e) {}
    }
    try {
      const res = await fetch(`/api/observer/state?z=0`);
      if (!res.ok) return;
      const data = await res.json();
      setState(data);
      const fm: Record<number, Faction> = {};
      (data.factions || []).forEach((f: Faction) => { fm[f.id] = f; });
      setFactionMap(fm);
      const em: Record<number, any> = {};
      (data.economy || []).forEach((e: any) => { em[e.cell_id] = e; });
      setEconomyMap(em);
    } catch (e) {
      console.error("Fetch state error:", e);
    }
  }, [hasFetchedMap]);

  // Fetch comprehensive sector data (352 Burgs, 12 Prisons, Convergence)
  const fetchSectors = useCallback(async () => {
    try {
      const res = await fetch("/api/observer/sectors");
      if (!res.ok) return;
      const data = await res.json();
      setBurgs(data.burgs || []);
      setParagons(data.paragons || []);
      setPrisons(data.prisons || []);
      setConvergence(data.convergence || null);

      const sf: Record<number, any> = {};
      (data.sectorFeatures || []).forEach((f: any) => { sf[f.cell_id] = f.features; });
      setSectorFeatures(sf);

      // Select Heartspire or first burg by default if none selected
      if (!selectedBurg && (data.burgs || []).length > 0) {
        const defaultBurg = data.burgs.find((b: any) => b.burg_id === 25) || data.burgs[0];
        setSelectedBurg(defaultBurg);
        setFocusedCellId(prev => prev ?? defaultBurg.cell_id);
      }
    } catch (e) {
      console.error("Fetch sectors error:", e);
    }
  }, [selectedBurg]);

  // Fetch fringe factions and lairs
  const fetchFringe = useCallback(async () => {
    try {
      const res = await fetch("/api/observer/fringe_detail");
      if (!res.ok) return;
      const data = await res.json();
      setFringeDetail(data);
      if (!selectedFringe && (data.factions || []).length > 0) {
        setSelectedFringe(data.factions[0]);
      }
    } catch (e) {
      console.error("Fetch fringe error:", e);
    }
  }, [selectedFringe]);

  useEffect(() => {
    fetchState();
    fetchSectors();
    fetchFringe();
  }, [fetchState, fetchSectors, fetchFringe]);

  // Polling loop for active state
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    async function poll() {
      if (!active) return;
      await fetchState();
      if (active) timerId = setTimeout(poll, 1500);
    }

    poll();

    fetch("/api/observer/autoplay")
      .then(r => r.json())
      .then(d => { if (active) setIsPlaying(d.autoplay); })
      .catch(() => {});

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchState]);

  // Fetch filtered sector events when selection changes
  useEffect(() => {
    async function loadSectorEvents() {
      let url = "/api/observer/filtered_events?limit=150";
      if (isConvergenceSelected) {
        url += "&keyword=Convergence";
      } else if (selectedPrison) {
        url += `&keyword=${encodeURIComponent(selectedPrison.dragon_name)}`;
      } else if (selectedBurg) {
        url += `&burg_id=${selectedBurg.burg_id}&burg_name=${encodeURIComponent(selectedBurg.name)}`;
      }
      if (tierFilter !== "ALL") {
        url += `&tier=${tierFilter}`;
      }

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSectorEvents(data.events || []);
        }
      } catch (e) {}
    }

    loadSectorEvents();
  }, [selectedBurg, selectedPrison, isConvergenceSelected, tierFilter, state?.calendar?.tick]);

  // Fetch sampled living citizens with active narrative tags when a burg is selected
  useEffect(() => {
    if (!selectedBurg) {
      setBurgCitizens([]);
      return;
    }
    fetch(`/api/observer/burg_citizens?burg_id=${selectedBurg.burg_id}&limit=8`)
      .then(r => r.json())
      .then(d => {
        setBurgCitizens(d.citizens || []);
      })
      .catch(() => {});
  }, [selectedBurg, state?.calendar?.tick]);

  // Fetch filtered fringe faction events when fringe selection changes
  useEffect(() => {
    async function loadFringeEvents() {
      if (!selectedFringe) return;
      const cleanKeyword = selectedFringe.name.replace(/^The\s+/, "");
      try {
        const res = await fetch(`/api/observer/filtered_events?faction_id=${selectedFringe.id}&keyword=${encodeURIComponent(cleanKeyword)}&limit=150`);
        if (res.ok) {
          const data = await res.json();
          setFringeEvents(data.events || []);
        }
      } catch (e) {}
    }

    loadFringeEvents();
  }, [selectedFringe, state?.calendar?.tick]);

  // Fetch Ecology and Chaos Flows telemetry
  useEffect(() => {
    if (activeTab === "ECOLOGY_CHAOS") {
      fetch("/api/observer/ecology").then(r => r.json()).then(d => setEcologyData(d)).catch(() => {});
      fetch("/api/observer/chaos_flows").then(r => r.json()).then(d => {
        setChaosFlowsData(d);
        if (d.flows && d.flows.length > 0 && !selectedFlow) {
          setSelectedFlow(d.flows[0]);
        }
      }).catch(() => {});
    }
    if (activeTab === "ECONOMY") {
      fetch("/api/observer/economy/specialties")
        .then(r => r.json())
        .then(d => setEconomyData(d))
        .catch(() => {});
    }
  }, [activeTab, state?.calendar?.tick]);

  // Controls: Step 1 Tick
  const runSingleTick = async () => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);
    try {
      await fetch("/api/observer/tick", { method: "POST" });
      await fetchState();
      await fetchSectors();
    } catch (e) {
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Controls: Batch Run Ticks (5, 10)
  const runBatchTicks = async (count: number) => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);
    try {
      await fetch("/api/observer/batch_ticks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });
      await fetchState();
      await fetchSectors();
    } catch (e) {
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Controls: Autoplay Toggle
  const togglePlay = async () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    await fetch("/api/observer/autoplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextState })
    });
  };

  // Filtered Burg list based on search
  const filteredBurgs = useMemo(() => {
    if (!sectorSearch.trim()) return burgs;
    const q = sectorSearch.toLowerCase();
    return burgs.filter(b => b.name.toLowerCase().includes(q) || String(b.burg_id).includes(q));
  }, [burgs, sectorSearch]);

  const cal = state?.calendar;
  const dateDisplay = cal
    ? (cal.is_shadow_week
        ? `Year ${cal.year}, Shadow Week (Day ${cal.day_of_month || (cal.tick % 13) + 1}/13) • ${cal.moon_phase || 'The Grand Eclipse'} • Chaos Flow: The Void`
        : `Year ${cal.year}, Month ${cal.month} (${cal.month_name || 'Dragon'}), Day ${cal.day_of_month || ((cal.tick - 1) % 44) + 1}/44 • Season: ${cal.season} • Moon: ${cal.moon_phase} • Flow: ${cal.active_flow} (${cal.dragon_domain})`)
    : "Awaiting simulation initialization...";

  // Selected burg environmental tags
  const currentBurgFeatures = selectedBurg ? sectorFeatures[selectedBurg.cell_id] : null;
  const currentBurgTags: string[] = currentBurgFeatures?.environmental_tags || [];
  const currentBurgParagons = selectedBurg ? paragons.filter(p => p.burg_id === selectedBurg.burg_id) : [];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#0a0e14", color: "#e2e8f0", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ============================================================= */}
      {/* 1. TOP HEADER & TELEMETRY CONTROL BAR                         */}
      {/* ============================================================= */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "#020408", borderBottom: "1px solid #1e293b", flexWrap: "wrap", gap: 12 }}>
        
        {/* Title & Telemetry */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, color: "#38bdf8", fontWeight: 800, letterSpacing: "-0.5px" }}>OSTRAKA</span>
            <span style={{ fontSize: 10, background: "#0369a1", color: "#e0f2fe", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>Observer</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0f172a", border: "1px solid #1e293b", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isPlaying || isBatchRunning || state?.tickInProgress ? "#22c55e" : "#64748b", boxShadow: isPlaying ? "0 0 8px #22c55e" : "none" }} />
            <span style={{ color: "#94a3b8" }}>Tick <strong style={{ color: "#38bdf8", fontSize: 13 }}>{cal?.tick || 0}</strong></span>
            <span style={{ color: "#334155" }}>|</span>
            <span style={{ color: cal?.is_shadow_week ? "#f87171" : "#e2e8f0", fontWeight: 500 }}>{dateDisplay}</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #1e293b" }}>
          <button
            onClick={() => setActiveTab("SECTORS")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "SECTORS" ? "#1e293b" : "transparent", color: activeTab === "SECTORS" ? "#38bdf8" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🏰</span> Territorial Sectors
          </button>
          <button
            onClick={() => setActiveTab("FRINGE")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "FRINGE" ? "#1e293b" : "transparent", color: activeTab === "FRINGE" ? "#f43f5e" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🌑</span> Fringe Factions
          </button>
          <button
            onClick={() => setActiveTab("ECOLOGY_CHAOS")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "ECOLOGY_CHAOS" ? "#1e293b" : "transparent", color: activeTab === "ECOLOGY_CHAOS" ? "#10b981" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🌿</span> Flora, Fauna & Chaos
          </button>
          <button
            onClick={() => setActiveTab("MAP")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "MAP" ? "#1e293b" : "transparent", color: activeTab === "MAP" ? "#a855f7" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🗺️</span> 2D World Map
          </button>
          <button
            onClick={() => setActiveTab("EVENTS")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "EVENTS" ? "#1e293b" : "transparent", color: activeTab === "EVENTS" ? "#fbbf24" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📜</span> Master Events
          </button>
          <button
            onClick={() => setActiveTab("ECONOMY")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "ECONOMY" ? "#1e293b" : "transparent", color: activeTab === "ECONOMY" ? "#eab308" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>⚖️</span> Economy & Trade
          </button>
          <button
            onClick={() => setActiveTab("RULES_LAB")}
            style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: activeTab === "RULES_LAB" ? "#1e293b" : "transparent", color: activeTab === "RULES_LAB" ? "#38bdf8" : "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🎲</span> TTRPG Rules Lab
          </button>
        </div>

        {/* Action Controls: Tick at Will */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={runSingleTick}
            disabled={isBatchRunning || isPlaying}
            style={{ padding: "6px 12px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, opacity: isBatchRunning ? 0.6 : 1 }}
          >
            ▶ +1 Tick
          </button>
          <button
            onClick={() => runBatchTicks(5)}
            disabled={isBatchRunning || isPlaying}
            style={{ padding: "6px 12px", background: "#0369a1", color: "#e0f2fe", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, opacity: isBatchRunning ? 0.6 : 1 }}
          >
            ⏩ +5 Ticks
          </button>
          <button
            onClick={() => runBatchTicks(10)}
            disabled={isBatchRunning || isPlaying}
            style={{ padding: "6px 12px", background: "#075985", color: "#e0f2fe", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, opacity: isBatchRunning ? 0.6 : 1 }}
          >
            ⚡ +10 Ticks
          </button>
          <button
            onClick={togglePlay}
            style={{ padding: "6px 14px", background: isPlaying ? "#dc2626" : "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}
          >
            {isPlaying ? "⏹ Pause" : "▶ Autoplay"}
          </button>
        </div>
      </header>

      {/* ============================================================= */}
      {/* 2. BODY CONTENT ROUTER                                        */}
      {/* ============================================================= */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: TERRITORIAL SECTOR LOGS (BURGS, PRISONS, CONVERGENCE)  */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "SECTORS" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            
            {/* LEFT: Sector Division Selector */}
            <div style={{ width: 340, background: "#0b111a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column" }}>
              
              {/* Category Pills */}
              <div style={{ padding: "12px 14px 6px 14px", display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setSelectedCategory("ALL_BURGS"); setIsConvergenceSelected(false); setSelectedPrison(null); }}
                  style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 4, cursor: "pointer", background: selectedCategory === "ALL_BURGS" ? "#0284c7" : "#1e293b", color: selectedCategory === "ALL_BURGS" ? "#fff" : "#94a3b8" }}
                >
                  Burgs (352)
                </button>
                <button
                  onClick={() => { setSelectedCategory("PRISONS"); setIsConvergenceSelected(false); if (prisons.length > 0) setSelectedPrison(prisons[0] || null); }}
                  style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 4, cursor: "pointer", background: selectedCategory === "PRISONS" ? "#9333ea" : "#1e293b", color: selectedCategory === "PRISONS" ? "#fff" : "#94a3b8" }}
                >
                  Prisons (12)
                </button>
                <button
                  onClick={() => { setSelectedCategory("CONVERGENCE"); setIsConvergenceSelected(true); setSelectedPrison(null); }}
                  style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 4, cursor: "pointer", background: selectedCategory === "CONVERGENCE" ? "#dc2626" : "#1e293b", color: selectedCategory === "CONVERGENCE" ? "#fff" : "#94a3b8" }}
                >
                  Convergence
                </button>
              </div>

              {/* Search Bar for Burgs */}
              {selectedCategory === "ALL_BURGS" && (
                <div style={{ padding: "8px 14px" }}>
                  <input
                    type="text"
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    placeholder="Search burg name or ID..."
                    style={{ width: "100%", padding: "6px 10px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#f8fafc", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}

              {/* Territory List Stream */}
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
                {selectedCategory === "ALL_BURGS" && (
                  filteredBurgs.map(b => {
                    const isSelected = selectedBurg?.burg_id === b.burg_id && !isConvergenceSelected && !selectedPrison;
                    const hasUnrest = b.unrest >= 40;
                    return (
                      <div
                        key={b.burg_id}
                        onClick={() => { setSelectedBurg(b); setSelectedPrison(null); setIsConvergenceSelected(false); }}
                        style={{
                          padding: "8px 10px",
                          marginBottom: 4,
                          borderRadius: 6,
                          background: isSelected ? "#1e293b" : "#0d1520",
                          borderLeft: `4px solid ${isSelected ? "#38bdf8" : hasUnrest ? "#ef4444" : b.faction_color || "#334155"}`,
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#38bdf8" : "#f1f5f9" }}>{b.name}</span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>#{b.burg_id}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          <span>Pop: <strong style={{ color: "#cbd5e1" }}>{b.pop_null?.toLocaleString()}</strong></span>
                          <span>Food: <strong style={{ color: b.food < 1000 ? "#ef4444" : "#10b981" }}>{b.food?.toLocaleString()}</strong></span>
                          <span>Unrest: <strong style={{ color: hasUnrest ? "#ef4444" : "#cbd5e1" }}>{b.unrest}</strong></span>
                        </div>
                      </div>
                    );
                  })
                )}

                {selectedCategory === "PRISONS" && (
                  prisons.map(p => {
                    const isSelected = selectedPrison?.id === p.id;
                    const isWeakened = p.seal_strength < 90;
                    return (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedPrison(p); setSelectedBurg(null); setIsConvergenceSelected(false); }}
                        style={{
                          padding: "10px 12px",
                          marginBottom: 6,
                          borderRadius: 6,
                          background: isSelected ? "#1e293b" : "#0f172a",
                          borderLeft: `4px solid ${isSelected ? "#a855f7" : isWeakened ? "#ef4444" : "#22c55e"}`,
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#c084fc" : "#f1f5f9" }}>Prison of {p.dragon_name}</span>
                          <span style={{ fontSize: 11, color: "#a855f7", fontWeight: 600 }}>{p.power_domain}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          Cell: {p.cell_id} • Seal Strength: <strong style={{ color: isWeakened ? "#ef4444" : "#22c55e" }}>{p.seal_strength}%</strong>
                        </div>
                      </div>
                    );
                  })
                )}

                {selectedCategory === "CONVERGENCE" && (
                  <div
                    onClick={() => { setIsConvergenceSelected(true); setSelectedBurg(null); setSelectedPrison(null); }}
                    style={{ padding: "12px", borderRadius: 6, background: "#1e1b4b", borderLeft: "4px solid #ef4444", cursor: "pointer" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f87171" }}>The Planetary Convergence</div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
                      Central Leyline Nexus (Cell 11429) where all 12 Chaos Rivers meet.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Selected Territory Telemetry, Active Tags, and Dedicated Event Log */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#070b10", overflow: "hidden" }}>
              
              {/* Telemetry Header */}
              <div style={{ padding: "16px 20px", background: "#0b111a", borderBottom: "1px solid #1e293b" }}>
                {isConvergenceSelected ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#f87171" }}>The Cruorbus Convergence Nexus</span>
                      <span style={{ fontSize: 11, background: "#7f1d1d", color: "#fecaca", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>WORLD CORE NEXUS</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 10px 0" }}>{convergence?.description}</p>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, alignItems: "center" }}>
                      <div>Cell ID: <strong>{convergence?.cell_id}</strong></div>
                      <div>Active Leyline Branches: <strong>{convergence?.zones?.length || 10}</strong></div>
                      {convergence?.cell_id && (
                        <button
                          onClick={() => {
                            setFocusedCellId(convergence.cell_id);
                            setShowRegionalWindow(true);
                            setActiveTab("MAP");
                          }}
                          style={{
                            background: "#7f1d1d",
                            color: "#fecaca",
                            border: "1px solid #b91c1c",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          🗺️ View Regional Meso Mesh
                        </button>
                      )}
                    </div>
                  </div>
                ) : selectedPrison ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#c084fc" }}>Prison of {selectedPrison.dragon_name}</span>
                      <span style={{ fontSize: 11, background: "#581c87", color: "#f3e8ff", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>DOMAIN OF {selectedPrison.power_domain.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 18, fontSize: 12, marginTop: 8, alignItems: "center" }}>
                      <div>Cell ID: <strong>{selectedPrison.cell_id}</strong></div>
                      <div>Cosmic Seal: <strong style={{ color: selectedPrison.seal_strength < 90 ? "#ef4444" : "#22c55e" }}>{selectedPrison.seal_strength}%</strong></div>
                      <div>Wardens Stationed: <strong>Active</strong></div>
                      <button
                        onClick={() => {
                          setFocusedCellId(selectedPrison.cell_id);
                          setShowRegionalWindow(true);
                          setActiveTab("MAP");
                        }}
                        style={{
                          background: "#581c87",
                          color: "#f3e8ff",
                          border: "1px solid #7e22ce",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        🗺️ View Regional Meso Mesh
                      </button>
                    </div>
                  </div>
                ) : selectedBurg ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8" }}>{selectedBurg.name}</span>
                          <span style={{ fontSize: 11, background: "#0c4a6e", color: "#e0f2fe", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>BURG #{selectedBurg.burg_id}</span>
                          <span style={{ fontSize: 11, background: "#1e293b", color: "#94a3b8", padding: "2px 8px", borderRadius: 4 }}>Cell {selectedBurg.cell_id}</span>
                          <button
                            onClick={() => {
                              setFocusedCellId(selectedBurg.cell_id);
                              setShowRegionalWindow(true);
                              setActiveTab("MAP");
                            }}
                            style={{
                              background: "#0284c7",
                              color: "#fff",
                              border: "none",
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            🗺️ View Regional Meso Mesh
                          </button>
                          <button
                            onClick={() => {
                              setTacticalModalTarget({ cellId: selectedBurg.cell_id, rx: 50, ry: 50 });
                            }}
                            style={{
                              background: "linear-gradient(135deg, #0284c7, #7c3aed)",
                              color: "#fff",
                              border: "none",
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(124, 58, 237, 0.4)"
                            }}
                          >
                            ⚔️ Open Tactical & GM Sandbox
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                          Faction: <strong style={{ color: selectedBurg.faction_color || "#38bdf8" }}>{selectedBurg.faction_name || "Sovereign Scute"}</strong> • Tier: <strong>{selectedBurg.urban_tier || 1}</strong>
                        </div>
                      </div>

                      {/* Stat Metrics Grid */}
                      <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
                        <div style={{ background: "#0f172a", padding: "6px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Population</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>{selectedBurg.pop_null?.toLocaleString()}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "6px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Food Reserve</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: selectedBurg.food < 1000 ? "#ef4444" : "#10b981" }}>{selectedBurg.food?.toLocaleString()}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "6px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Wealth</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#facc15" }}>{selectedBurg.wealth?.toLocaleString()}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "6px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Unrest</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: selectedBurg.unrest > 40 ? "#ef4444" : "#38bdf8" }}>{selectedBurg.unrest}</div>
                        </div>
                      </div>
                    </div>

                    {/* Active Systemic Narrative Tags Badge Pool */}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Active Sector Tags:</span>
                      {currentBurgTags.length > 0 ? (
                        currentBurgTags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: tag.includes("Famine") || tag.includes("Crisis") || tag.includes("Murder") ? "rgba(239, 68, 68, 0.2)" : "rgba(56, 189, 248, 0.15)",
                              color: tag.includes("Famine") || tag.includes("Crisis") || tag.includes("Murder") ? "#f87171" : "#38bdf8",
                              border: `1px solid ${tag.includes("Famine") || tag.includes("Crisis") ? "rgba(239, 68, 68, 0.4)" : "rgba(56, 189, 248, 0.3)"}`
                            }}
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>No anomaly tags. Base municipal peace.</span>
                      )}
                    </div>

                    {/* Paragons in this Burg */}
                    {currentBurgParagons.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                        {currentBurgParagons.map(p => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                            <span style={{ color: "#94a3b8" }}>{p.title}:</span>
                            <strong style={{ color: "#f8fafc" }}>{p.name}</strong>
                            {p.corruption_score > 0 && <span style={{ color: "#f59e0b", fontSize: 10 }}>[Corr: {p.corruption_score}]</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Living Tagged Citizens in this Burg */}
                    {burgCitizens.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                          <span>Living Tagged Citizens ({burgCitizens.length} sampled):</span>
                          <span style={{ color: "#64748b", fontStyle: "italic", fontSize: 10 }}>Tagged via live macro events & mayor decrees</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                          {burgCitizens.map(c => {
                            const traits = Array.isArray(c.traits) ? c.traits : [];
                            const tagList = traits.filter((t: string) => typeof t === 'string' && t.startsWith("#"));
                            return (
                              <div key={c.citizen_id} style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div>
                                    <strong style={{ color: "#f8fafc" }}>{c.name}</strong>
                                    <span style={{ color: "#64748b", marginLeft: 4 }}>({c.profession})</span>
                                  </div>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: c.temper === 'DESPERATE' || c.temper === 'REBELLIOUS' ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.2)', color: c.temper === 'DESPERATE' || c.temper === 'REBELLIOUS' ? '#f87171' : '#38bdf8' }}>
                                    {c.temper}
                                  </span>
                                </div>
                                {tagList.length > 0 && (
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                                    {tagList.map((tg: string) => (
                                      <span key={tg} style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: tg.includes("Famine") || tg.includes("Curfew") ? "rgba(239, 68, 68, 0.25)" : "rgba(168, 85, 247, 0.25)", color: tg.includes("Famine") || tg.includes("Curfew") ? "#fca5a5" : "#d8b4fe" }}>
                                        {tg}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {c.motivation && (
                                  <div style={{ marginTop: 4, fontSize: 10, color: "#94a3b8", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    "{c.motivation}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Event Log Filter Bar */}
              <div style={{ padding: "8px 20px", background: "#090d14", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>Territorial Event Chronicle ({sectorEvents.length} events logged)</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {["ALL", "CRITICAL", "MAJOR", "MINOR"].map(t => (
                    <button
                      key={t}
                      onClick={() => setTierFilter(t)}
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        background: tierFilter === t ? "#38bdf8" : "#1e293b",
                        color: tierFilter === t ? "#000" : "#94a3b8"
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtered Event Stream */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {sectorEvents.length > 0 ? (
                  sectorEvents.map(e => {
                    const isCrit = e.tier === "CRITICAL";
                    const isMajor = e.tier === "MAJOR";
                    const borderColor = isCrit ? "#ef4444" : isMajor ? "#f59e0b" : "#3b82f6";
                    return (
                      <div
                        key={e.id}
                        style={{
                          padding: "10px 14px",
                          background: isCrit ? "rgba(239, 68, 68, 0.08)" : isMajor ? "rgba(245, 158, 11, 0.06)" : "#0d1420",
                          borderLeft: `4px solid ${borderColor}`,
                          borderRadius: 6,
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 11, marginBottom: 4 }}>
                          <span>Tick <strong>{e.tick}</strong> ({e.lore_date})</span>
                          <span style={{ fontWeight: 700, color: borderColor }}>{e.type}</span>
                        </div>
                        <div style={{ color: "#f1f5f9", lineHeight: 1.5 }}>{e.message}</div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 13 }}>
                    No events recorded in this sector yet. Advance ticks or trigger systemic cascades to generate history.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: FRINGE FACTIONS (UNDERWORLD & INDEPENDENT SYNDICATES)  */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "FRINGE" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            
            {/* LEFT: Fringe Faction List */}
            <div style={{ width: 320, background: "#0b111a", borderRight: "1px solid #1e293b", overflowY: "auto", padding: "10px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", padding: "4px 8px 8px 8px" }}>
                Independent Syndicates & Factions
              </div>
              {fringeDetail.factions.map(f => {
                const isSelected = selectedFringe?.id === f.id;
                const lairsCount = fringeDetail.lairs.filter(l => l.faction_id === f.id).length;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFringe(f)}
                    style={{
                      padding: "10px 12px",
                      marginBottom: 6,
                      borderRadius: 6,
                      background: isSelected ? "#1e293b" : "#0d1520",
                      borderLeft: `4px solid ${isSelected ? "#f43f5e" : "#334155"}`,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#f43f5e" : "#f1f5f9" }}>{f.name}</span>
                      <span style={{ fontSize: 10, background: "#1e293b", padding: "2px 6px", borderRadius: 4, color: "#94a3b8" }}>{f.type}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      <span>Total Manpower: <strong style={{ color: "#f8fafc" }}>{((f.total_manpower ?? ((f.manpower || 0) + (fringeDetail.lairs.filter(l => l.faction_id === f.id).reduce((s, l) => s + (l.manpower || 0), 0))))).toLocaleString()}</strong></span>
                      <span>Wealth: <strong style={{ color: "#facc15" }}>{f.wealth?.toLocaleString()}</strong></span>
                      <span>Lairs: <strong style={{ color: "#38bdf8" }}>{lairsCount}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT: Selected Fringe Faction Profile, Lairs, and World Interactions Log */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#070b10", overflow: "hidden" }}>
              {selectedFringe ? (
                <>
                  {/* Faction Profile Card */}
                  <div style={{ padding: "16px 20px", background: "#0b111a", borderBottom: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: "#f43f5e" }}>{selectedFringe.name}</span>
                          <span style={{ fontSize: 11, background: "#881337", color: "#ffe4e6", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{selectedFringe.type}</span>
                          <span style={{ fontSize: 11, background: "#1e293b", color: "#94a3b8", padding: "2px 8px", borderRadius: 4 }}>Origin Cell {selectedFringe.origin_cell_id}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 10px 0", maxWidth: 700 }}>{selectedFringe.description}</p>
                      </div>

                      <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                        <div style={{ background: "#0f172a", padding: "6px 12px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Total Manpower</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>
                            {((selectedFringe.total_manpower ?? ((selectedFringe.manpower || 0) + (fringeDetail.lairs.filter(l => l.faction_id === selectedFringe.id).reduce((s, l) => s + (l.manpower || 0), 0))))).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
                            {selectedFringe.manpower || 0} reserve &bull; {(fringeDetail.lairs.filter(l => l.faction_id === selectedFringe.id).reduce((s, l) => s + (l.manpower || 0), 0)).toLocaleString()} in lairs
                          </div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "6px 12px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Treasury</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#facc15" }}>{selectedFringe.wealth?.toLocaleString()}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "6px 12px", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <div style={{ color: "#64748b" }}>Local Heat</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: selectedFringe.heat ? "#ef4444" : "#10b981" }}>{selectedFringe.heat || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Contraband Types */}
                    {selectedFringe.contraband_types && selectedFringe.contraband_types.length > 0 && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Contraband Traffiсking:</span>
                        {selectedFringe.contraband_types.map(cb => (
                          <span key={cb} style={{ fontSize: 10, background: "#1e293b", color: "#cbd5e1", padding: "2px 6px", borderRadius: 4 }}>
                            {cb}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Established Subterranean Lairs */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                        Active Established Lairs in Burgs ({fringeDetail.lairs.filter(l => l.faction_id === selectedFringe.id).length}):
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {fringeDetail.lairs.filter(l => l.faction_id === selectedFringe.id).map(l => (
                          <div key={l.id} style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                            <span style={{ color: "#f43f5e", fontWeight: 700 }}>{l.lair_type}</span> in <strong>{l.burg_name || `Burg #${l.burg_id}`}</strong> (Manpower: {l.manpower})
                          </div>
                        ))}
                        {fringeDetail.lairs.filter(l => l.faction_id === selectedFringe.id).length === 0 && (
                          <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>No established lairs yet. Siphoning unrest to establish initial dens.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* World Interactions Log */}
                  <div style={{ padding: "8px 20px", background: "#090d14", borderBottom: "1px solid #1e293b" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                      Simulated World Interactions Chronicle ({fringeEvents.length} events logged)
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {fringeEvents.length > 0 ? (
                      fringeEvents.map(e => (
                        <div
                          key={e.id}
                          style={{
                            padding: "10px 14px",
                            background: "#0d1420",
                            borderLeft: `4px solid ${e.tier === "MAJOR" ? "#f43f5e" : "#0284c7"}`,
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 11, marginBottom: 4 }}>
                            <span>Tick <strong>{e.tick}</strong> ({e.lore_date})</span>
                            <span style={{ fontWeight: 700, color: "#f43f5e" }}>{e.type}</span>
                          </div>
                          <div style={{ color: "#f1f5f9", lineHeight: 1.5 }}>{e.message}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 13 }}>
                        No specific world interaction events logged for {selectedFringe.name} yet. Advance simulation ticks to generate crime and cartel expansion.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: 40, color: "#64748b", textAlign: "center" }}>Select a fringe faction on the left.</div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: FLORA, FAUNA & CHAOS FLOWS                             */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "ECOLOGY_CHAOS" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#0a0f18" }}>
            {/* Left Column: 12 Primordial Chaos Flows */}
            <div style={{ width: 340, borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", background: "#0d1522" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e293b", background: "#0a101b" }}>
                <h3 style={{ margin: 0, fontSize: 13, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🌀</span> 12 Primordial Chaos Flows
                </h3>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Active Month: <strong style={{ color: "#38bdf8" }}>{chaosFlowsData?.calendar?.month_name || "Nexar"}</strong> ({chaosFlowsData?.calendar?.moon_phase || "Cruorbus"})
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {(chaosFlowsData?.flows || []).map((flow: any) => {
                  const isSelected = selectedFlow?.flow_id === flow.flow_id;
                  const isSurging = flow.is_surging;
                  const isFlooding = flow.is_flooding;
                  return (
                    <div
                      key={flow.flow_id}
                      onClick={() => setSelectedFlow(flow)}
                      style={{
                        padding: "10px 12px",
                        marginBottom: 6,
                        borderRadius: 6,
                        background: isSelected ? "#1e293b" : "#0f172a",
                        borderLeft: `4px solid ${isFlooding ? "#ef4444" : isSurging ? "#f59e0b" : "#10b981"}`,
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: isSelected ? "#38bdf8" : "#f1f5f9" }}>{flow.name}</span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: isFlooding ? "rgba(239, 68, 68, 0.2)" : isSurging ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.15)",
                          color: isFlooding ? "#f87171" : isSurging ? "#fbbf24" : "#34d399",
                          border: `1px solid ${isFlooding ? "#ef4444" : isSurging ? "#f59e0b" : "#10b981"}`
                        }}>
                          {flow.current_surge}x {isFlooding ? "FLOOD" : isSurging ? "SURGE" : "EBB"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
                        <span>Dragon: <strong style={{ color: "#e2e8f0" }}>{flow.dragon_name}</strong></span>
                        <span>Power: <strong style={{ color: "#a78bfa" }}>{flow.elemental_power}</strong></span>
                      </div>
                      <div style={{ marginTop: 6, width: "100%", height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(100, (Number(flow.current_surge) / 2.5) * 100)}%`,
                          height: "100%",
                          background: isFlooding ? "#ef4444" : isSurging ? "#f59e0b" : "#10b981",
                          borderRadius: 2
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Middle Column: Selected Flow Waypoints, Crossing Spot & Continental Ecology Gauges */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: 16 }}>
              {/* Continental Trophic & Botanical Telemetry Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>🌿 Flora Coverage</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981", marginTop: 4 }}>
                    {ecologyData?.averages?.avg_plants ?? "—"} <span style={{ fontSize: 12, color: "#64748b" }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Botanical carrying capacity</div>
                </div>

                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>🦌 Herbivore Prey</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                    {ecologyData?.averages?.avg_prey ?? "—"} <span style={{ fontSize: 12, color: "#64748b" }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Wild ungulate & grazer herds</div>
                </div>

                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>🐺 Predator Threat</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", marginTop: 4 }}>
                    {ecologyData?.averages?.avg_predators ?? "—"} <span style={{ fontSize: 12, color: "#64748b" }}>/ 60</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Dire packs & carnivores</div>
                </div>

                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>☠️ Eco-Blight Index</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#ec4899", marginTop: 4 }}>
                    {ecologyData?.averages?.avg_blight ?? "—"} <span style={{ fontSize: 12, color: "#64748b" }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Dragon seal decay miasma</div>
                </div>
              </div>

              {/* Selected Flow River Dossier */}
              {selectedFlow && (
                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 10, marginBottom: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 16, color: "#f8fafc", fontWeight: 700 }}>{selectedFlow.name}</h2>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                        Origin: Outer Perimeter Angle {selectedFlow.source_angle}° ➔ Void Sink ({selectedFlow.current_width}m channel width)
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>Primordial Domain:</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#a855f7" }}>{selectedFlow.dragon_name} ({selectedFlow.elemental_power})</div>
                    </div>
                  </div>

                  {/* Narrow Crossing Ford */}
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    📍 Natural Narrow Crossing Point (Glass-Rock Ford)
                  </h4>
                  {(selectedFlow.narrow_spots || []).map((spot: any, idx: number) => (
                    <div key={idx} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0" }}>Glass-Rock Constriction #{idx + 1}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 11, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "1px 6px", borderRadius: 4 }}>Pinch: {spot.widthMeters}m</span>
                          <span style={{ fontSize: 11, background: "rgba(239, 68, 68, 0.15)", color: "#f87171", padding: "1px 6px", borderRadius: 4 }}>Crossing DC: {spot.crossingDC}</span>
                        </div>
                      </div>
                      <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{spot.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Hotspot Grids: Starving Predators & Mutated Chaos Flora */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Starving Predator Hotspots */}
                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 12, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🐺</span> Starving Predator Hotspots
                  </h4>
                  {(ecologyData?.predatorHotspots || []).map((h: any) => (
                    <div key={h.cell_id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#f8fafc" }}>Sector #{h.cell_id}</span>
                        <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>Pred: {h.eco_predators} / Prey: {h.eco_prey}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Nearby Threat: <strong style={{ color: "#e2e8f0" }}>{h.nearby_burg || "Outlying Wilderness"}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mutated Flora Hotspots */}
                <div style={{ background: "#0d1522", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 12, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🌿</span> Chaos Flora Hotspots
                  </h4>
                  {(ecologyData?.chaosFloraHotspots || []).map((h: any) => (
                    <div key={h.cell_id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#f8fafc" }}>Sector #{h.cell_id}</span>
                        <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Flora: {h.eco_plants}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 2 }}>
                        Ley Intensity: <strong>{h.intensity}%</strong> ({h.chaos_type})
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        Nearby Burg: <strong style={{ color: "#e2e8f0" }}>{h.nearby_burg || "Wild Flora Ley"}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Ecological & Chaos Event Chronicle */}
            <div style={{ width: 380, borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column", background: "#0d1522" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e293b", background: "#0a101b" }}>
                <h3 style={{ margin: 0, fontSize: 13, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📜</span> Ecological & Chaos Incidents
                </h3>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {(ecologyData?.recentEvents || []).map((ev: any) => {
                  const isFlora = ev.type === "FLORA_MUTAGENESIS";
                  const isBeast = ev.type === "CHAOS_BEAST_MUTATION";
                  const isPredator = ev.type === "STARVING_PREDATOR_MIGRATION";
                  const isCrop = ev.type === "HERBIVORE_CROP_RAID";
                  const badgeColor = isFlora ? "#10b981" : isBeast ? "#ec4899" : isPredator ? "#f59e0b" : isCrop ? "#38bdf8" : "#a855f7";
                  return (
                    <div key={ev.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: `3px solid ${badgeColor}`, borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: badgeColor, textTransform: "uppercase" }}>{ev.type.replace(/_/g, " ")}</span>
                        <span style={{ fontSize: 10, color: "#64748b" }}>Tick {ev.tick}</span>
                      </div>
                      <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>{ev.message}</p>
                      {ev.lore_date && <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>{ev.lore_date}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: 2D WORLD MAP & TACTICAL SURVEY                         */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "MAP" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div style={{ width: 280, background: "#0b111a", borderRight: "1px solid #1e293b", overflowY: "auto", padding: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Map Overlay Mode:</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  style={{ width: "100%", padding: "6px 8px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, color: "#f8fafc", fontSize: 12 }}
                >
                  <option value="Political">Political Borders</option>
                  <option value="Biome">Natural Biomes</option>
                  <option value="Unrest">Civil Unrest Heatmap</option>
                  <option value="Ecology">Trophic Biomass Ecology</option>
                </select>
              </div>

              {/* Direct Regional Cell Inspector */}
              <div style={{ marginBottom: 14, background: "#080d15", border: "1px solid #1e293b", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Regional Cell Inspector</span>
                  <span style={{ fontSize: 9, background: "#0284c7", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>10,000 Cells</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    type="number"
                    placeholder="Enter Cell ID..."
                    value={cellSearchInput}
                    onChange={(e) => setCellSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && cellSearchInput.trim()) {
                        const cid = parseInt(cellSearchInput.trim(), 10);
                        if (!isNaN(cid)) {
                          setFocusedCellId(cid);
                          setShowRegionalWindow(true);
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 4,
                      color: "#f8fafc",
                      padding: "4px 8px",
                      fontSize: 11
                    }}
                  />
                  <button
                    onClick={() => {
                      const cid = parseInt(cellSearchInput.trim(), 10);
                      if (!isNaN(cid)) {
                        setFocusedCellId(cid);
                        setShowRegionalWindow(true);
                      }
                    }}
                    style={{
                      background: "#0284c7",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Go
                  </button>
                </div>

                {focusedCellId !== null && (
                  <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Active Focus:</span>
                      <strong style={{ color: "#38bdf8" }}>Cell #{focusedCellId}</strong>
                    </div>
                    <button
                      onClick={() => setShowRegionalWindow(!showRegionalWindow)}
                      style={{
                        marginTop: 4,
                        padding: "4px 8px",
                        background: showRegionalWindow ? "#1e293b" : "#0284c7",
                        color: showRegionalWindow ? "#94a3b8" : "#fff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {showRegionalWindow ? "Hide Regional Window" : "Open Regional Window"}
                    </button>
                    <button
                      onClick={() => setTacticalModalTarget({ cellId: focusedCellId, rx: 50, ry: 50 })}
                      style={{
                        marginTop: 2,
                        padding: "5px 8px",
                        background: "linear-gradient(135deg, #0284c7, #7c3aed)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(124, 58, 237, 0.4)"
                      }}
                    >
                      ⚔️ Open 256x256 Tactical & GM Sandbox
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Quick Jumps:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {[
                      { name: "Heartspire", id: 19561 },
                      { name: "Flute", id: 13408 },
                      { name: "Crystaldusk", id: 23498 },
                      { name: "Lumina", id: 24017 }
                    ].map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => {
                          setFocusedCellId(loc.id);
                          setShowRegionalWindow(true);
                        }}
                        style={{
                          background: focusedCellId === loc.id ? "#0369a1" : "#0f172a",
                          color: focusedCellId === loc.id ? "#fff" : "#94a3b8",
                          border: "1px solid #1e293b",
                          borderRadius: 3,
                          padding: "2px 6px",
                          fontSize: 10,
                          cursor: "pointer"
                        }}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #1e293b", paddingBottom: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Sovereign Factions ({state?.factions?.length || 0})</span>
                {selectedFactionId && (
                  <button
                    onClick={() => setSelectedFactionId(null)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              {(state?.factions || []).map(f => {
                const isSelected = f.id === selectedFactionId;
                const factionBurgs = burgs.filter(b => b.faction_id === f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFactionId(isSelected ? null : f.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      marginBottom: 6,
                      background: isSelected ? "rgba(56, 189, 248, 0.15)" : "#0f172a",
                      borderLeft: `4px solid ${f.color}`,
                      border: isSelected ? "1px solid #38bdf8" : "1px solid #1e293b",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: isSelected ? "#38bdf8" : "#f1f5f9", fontSize: 12 }}>{f.name}</span>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{factionBurgs.length} burgs</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                      <span>Treasury: <strong style={{ color: "#facc15" }}>{f.wealth?.toLocaleString() || 0}</strong></span>
                      <span>Aggression: <strong style={{ color: "#f87171" }}>{f.trait_aggression || 5}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <MapCanvas
                cells={cells}
                factions={factionMap}
                viewMode={viewMode}
                economy={economyMap}
                burgs={burgs}
                prisons={prisons}
                convergence={convergence}
                selectedFactionId={selectedFactionId}
                onCellClick={(id: number) => {
                  setFocusedCellId(id);
                  setShowRegionalWindow(true);
                  const b = burgs.find(b => b.cell_id === id);
                  if (b) setSelectedBurg(b);
                }}
                selectedCellId={focusedCellId || selectedBurg?.cell_id}
              />

              {/* Floating Regional Meso LOD Simulation Window (10,000 Cells) */}
              {showRegionalWindow && focusedCellId !== null && (
                <RegionMap
                  cellId={focusedCellId}
                  tick={state?.calendar?.tick}
                  isFloating={true}
                  onClose={() => setShowRegionalWindow(false)}
                />
              )}

              {/* Minimized / Closed Reopen Pill Button */}
              {!showRegionalWindow && focusedCellId !== null && (
                <button
                  onClick={() => setShowRegionalWindow(true)}
                  style={{
                    position: "absolute",
                    bottom: 24,
                    right: 24,
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "1px solid #38bdf8",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
                    zIndex: 40,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>🗺️</span> Open Regional Window (Cell #{focusedCellId})
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: MASTER CONTINENTAL EVENT STREAM                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "EVENTS" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#070b10", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", background: "#0b111a", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Master Continental Event Chronicle</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>Showing recent live simulation events across all sectors & factions</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {(state?.events || []).map(e => {
                const isCrit = e.tier === "CRITICAL";
                const isMajor = e.tier === "MAJOR";
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "10px 14px",
                      background: isCrit ? "rgba(239, 68, 68, 0.08)" : isMajor ? "rgba(245, 158, 11, 0.06)" : "#0d1420",
                      borderLeft: `4px solid ${isCrit ? "#ef4444" : isMajor ? "#f59e0b" : "#3b82f6"}`,
                      borderRadius: 6,
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 11, marginBottom: 4 }}>
                      <span>Tick <strong>{e.tick}</strong> ({e.lore_date}) • Burg #{e.burg_id || "Global"}</span>
                      <span style={{ fontWeight: 700, color: isCrit ? "#ef4444" : isMajor ? "#f59e0b" : "#38bdf8" }}>{e.type}</span>
                    </div>
                    <div style={{ color: "#f1f5f9", lineHeight: 1.5 }}>{e.message}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: FACTION ECONOMIC SPECIALTIES & INTER-REALM TRADE       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "ECONOMY" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#070b10", overflow: "hidden" }}>
            {/* Top Toolbar */}
            <div style={{ padding: "12px 20px", background: "#0b111a", borderBottom: "1px solid #1e293b", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fbbf24", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚖️</span> Sovereign Faction Economies & Inter-Realm Trade Engine
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#64748b" }}>
                  Unique signature goods, harvest methods, required progression commodities, and active wartime embargo chokepoints across Ostraka.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Filter faction or good..."
                  value={economySearch}
                  onChange={(e) => setEconomySearch(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 6,
                    color: "#f8fafc",
                    padding: "5px 10px",
                    fontSize: 11,
                    width: 180
                  }}
                />
              </div>
            </div>

            {/* Category Filter Bar */}
            <div style={{ padding: "8px 20px", background: "#080d15", borderBottom: "1px solid #1e293b", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginRight: 4 }}>Progression Category:</span>
              {["ALL", "PRESERVATION", "STRUCTURAL", "FOUNDATION", "ADVANCED", "HEALTH", "METAPHYSICAL", "LOGISTICS", "ENERGY"].map(cat => {
                const isActive = economyCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setEconomyCategoryFilter(cat)}
                    style={{
                      background: isActive ? "#0284c7" : "#0f172a",
                      color: isActive ? "#fff" : "#94a3b8",
                      border: "1px solid #1e293b",
                      borderRadius: 4,
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Main Content Area: Split Logistics & Specialties Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Wartime Embargoes & Caravan Feed Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Active Embargoes */}
                <div style={{ background: "#0b111a", border: "1px solid #1e293b", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚔️</span> Active Wartime Trade Embargoes ({economyData?.activeEmbargoes?.length || 0})
                  </div>
                  {(!economyData?.activeEmbargoes || economyData.activeEmbargoes.length === 0) ? (
                    <div style={{ fontSize: 11, color: "#10b981", fontStyle: "italic", padding: "8px 0" }}>
                      🕊️ Continental trade peace: all inter-faction caravan routes open with zero active embargoes.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                      {economyData.activeEmbargoes.map((emb: any) => (
                        <div key={emb.id} style={{ background: "#1c1017", border: "1px solid #881337", borderRadius: 4, padding: "6px 10px", fontSize: 11 }}>
                          <span style={{ color: "#fb7185", fontWeight: 700 }}>{emb.faction1_name}</span>
                          <span style={{ color: "#64748b", margin: "0 6px" }}>⚔️ EMBARGO ⚔️</span>
                          <span style={{ color: "#fb7185", fontWeight: 700 }}>{emb.faction2_name}</span>
                          <span style={{ color: "#fda4af", fontSize: 10, marginLeft: 8 }}>(Tension: {emb.tension})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Trade Caravan Events */}
                <div style={{ background: "#0b111a", border: "1px solid #1e293b", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🐪</span> Live Inter-Faction Caravan Logistics
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                    {(!economyData?.recentTradeEvents || economyData.recentTradeEvents.length === 0) ? (
                      <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                        Awaiting next trade caravan dispatched along roads...
                      </div>
                    ) : (
                      economyData.recentTradeEvents.slice(0, 5).map((ev: any) => (
                        <div key={ev.id} style={{ background: "#08101a", border: "1px solid #1e293b", borderRadius: 4, padding: "4px 8px", fontSize: 10 }}>
                          <span style={{ color: "#38bdf8", fontWeight: 700 }}>Tick {ev.tick}:</span>{" "}
                          <span style={{ color: ev.type === "TRADE_EMBARGO_CHOKEPOINT" ? "#f43f5e" : "#e2e8f0" }}>{ev.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Faction Specialties Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                {(economyData?.specialties || [])
                  .filter((spec: any) => {
                    if (economyCategoryFilter !== "ALL" && spec.category !== economyCategoryFilter) return false;
                    if (economySearch.trim()) {
                      const q = economySearch.toLowerCase();
                      return (
                        spec.factionName.toLowerCase().includes(q) ||
                        spec.uniqueGoodName.toLowerCase().includes(q) ||
                        spec.specialtyName.toLowerCase().includes(q) ||
                        spec.artisanRole.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((spec: any) => {
                    const catColors: Record<string, { bg: string; text: string; border: string }> = {
                      PRESERVATION: { bg: "#14532d", text: "#86efac", border: "#166534" },
                      STRUCTURAL: { bg: "#78350f", text: "#fde68a", border: "#92400e" },
                      FOUNDATION: { bg: "#365314", text: "#bef264", border: "#4d7c0f" },
                      ADVANCED: { bg: "#164e63", text: "#a5f3fc", border: "#155e75" },
                      HEALTH: { bg: "#064e3b", text: "#6ee7b7", border: "#047857" },
                      METAPHYSICAL: { bg: "#581c87", text: "#e9d5ff", border: "#6b21a8" },
                      LOGISTICS: { bg: "#1e3a8a", text: "#93c5fd", border: "#1d4ed8" },
                      ENERGY: { bg: "#7f1d1d", text: "#fca5a5", border: "#991b1b" }
                    };
                    const color = catColors[spec.category] || { bg: "#1e293b", text: "#cbd5e1", border: "#334155" };

                    return (
                      <div
                        key={spec.factionId}
                        style={{
                          background: "#0c131f",
                          border: `1px solid ${color.border}`,
                          borderRadius: 8,
                          padding: 14,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{spec.factionName}</div>
                            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>{spec.specialtyName}</div>
                          </div>
                          <span
                            style={{
                              background: color.bg,
                              color: color.text,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em"
                            }}
                          >
                            {spec.category}
                          </span>
                        </div>

                        {/* Unique Signature Commodity */}
                        <div style={{ background: "#070c14", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>✨ {spec.uniqueGoodName}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#eab308" }}>💰 {spec.baseExportPrice}g / batch</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>{spec.description}</p>
                        </div>

                        {/* Harvest & Production Method Lore */}
                        <div style={{ fontSize: 10, color: "#cbd5e1", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, padding: "6px 8px" }}>
                          <strong style={{ color: "#a855f7" }}>Harvest / Craft Lore:</strong> {spec.harvestMethod}
                        </div>

                        {/* Inputs and Progression Role */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#64748b", borderTop: "1px solid #1e293b", paddingTop: 6 }}>
                          <div>
                            <span style={{ color: "#94a3b8" }}>Master Artisan: </span>
                            <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{spec.artisanRole}</span>
                          </div>
                          <div style={{ fontSize: 9, color: "#0ea5e9", fontStyle: "italic" }}>
                            {spec.artisanPersonaTag}
                          </div>
                        </div>

                        <div style={{ fontSize: 10, color: "#10b981", background: "rgba(16, 185, 129, 0.08)", padding: "4px 8px", borderRadius: 4 }}>
                          <strong>Progression Key:</strong> {spec.progressRoleDescription}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "RULES_LAB" && (
          <RulesLabTab />
        )}

      </div>

      {tacticalModalTarget && (
        <TacticalSandboxModal
          cellId={tacticalModalTarget.cellId}
          rx={tacticalModalTarget.rx}
          ry={tacticalModalTarget.ry}
          onClose={() => setTacticalModalTarget(null)}
        />
      )}
    </div>
  );
}
export default Dashboard;
