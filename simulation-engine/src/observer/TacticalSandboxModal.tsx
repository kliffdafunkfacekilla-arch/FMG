import React, { useState, useEffect, useRef } from 'react';

interface PropItem {
  id: string;
  name: string;
  pos: [number, number];
  tags?: string[];
  hp?: number;
  maxHp?: number;
  description?: string;
  [key: string]: any;
}

interface NpcItem {
  id: string;
  name: string;
  role?: string;
  pos: [number, number];
  tags?: string[];
  faction?: string;
  hp?: number;
  maxHp?: number;
  disposition?: number;
  alive?: boolean;
  equippedWeapon?: string;
  equippedArmor?: string;
  [key: string]: any;
}

interface TacticalLayerData {
  success: boolean;
  cellId: number;
  rx: number;
  ry: number;
  z: number;
  name: string;
  grid: number[];
  props: PropItem[];
  npcs: NpcItem[];
  features: Record<string, any>;
}

interface TacticalSandboxModalProps {
  cellId: number;
  rx: number;
  ry: number;
  onClose: () => void;
}

export const TacticalSandboxModal: React.FC<TacticalSandboxModalProps> = ({
  cellId,
  rx,
  ry,
  onClose
}) => {
  const [zLayer, setZLayer] = useState<number>(0);
  const [layerData, setLayerData] = useState<TacticalLayerData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector selection
  const [selectedProp, setSelectedProp] = useState<PropItem | null>(null);
  const [selectedNpc, setSelectedNpc] = useState<NpcItem | null>(null);

  // B.R.U.T.A.L. GM Action state
  const [actionInput, setActionInput] = useState<string>("Examine surroundings and search for clues");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionResult, setActionResult] = useState<any>(null);

  // AI Story Arc & WhatELSE state
  const [storyLoading, setStoryLoading] = useState<boolean>(false);
  const [storyArc, setStoryArc] = useState<any>(null);
  const [mutatedAssets, setMutatedAssets] = useState<any[]>([]);

  // Crisis state
  const [crisisLoading, setCrisisLoading] = useState<boolean>(false);
  const [lastCrisisEvent, setLastCrisisEvent] = useState<any>(null);

  // 4-Player AI Session State (Ollama + B.R.U.T.A.L. GM)
  const [sessionMode, setSessionMode] = useState<'PARTY' | 'MANUAL'>('PARTY');
  const [partySession, setPartySession] = useState<any>(null);
  const [partyStepLoading, setPartyStepLoading] = useState<boolean>(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const autoPlayRef = useRef<boolean>(false);
  autoPlayRef.current = autoPlay;

  const loadPartySession = async () => {
    try {
      const res = await fetch('/api/dm/party_session/state');
      if (res.ok) {
        const data = await res.json();
        if (data.sessionState) {
          setPartySession(data.sessionState);
        }
      }
    } catch {}
  };

  const initPartySession = async () => {
    setPartyStepLoading(true);
    try {
      const res = await fetch('/api/dm/party_session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellId, rx, ry, z: zLayer })
      });
      if (res.ok) {
        const data = await res.json();
        setPartySession(data.sessionState);
      }
    } catch (err: any) {
      console.error('Failed to init party session:', err);
    } finally {
      setPartyStepLoading(false);
    }
  };

  const stepPartySession = async () => {
    if (partyStepLoading) return;
    setPartyStepLoading(true);
    try {
      const res = await fetch('/api/dm/party_session/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setPartySession(data.sessionState);
        if (data.sessionState?.activeStoryArc?.resolved) {
          setAutoPlay(false);
        }
        await loadLayer(zLayer);
      }
    } catch (err: any) {
      console.error('Failed to step party session:', err);
    } finally {
      setPartyStepLoading(false);
    }
  };

  useEffect(() => {
    loadPartySession();
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      if (autoPlayRef.current && !partyStepLoading) {
        stepPartySession();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPlay, partyStepLoading]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load tactical layer
  const loadLayer = async (targetZ: number = zLayer) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm/sector_layer?cellId=${cellId}&rx=${rx}&ry=${ry}&z=${targetZ}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: TacticalLayerData = await res.json();
      setLayerData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load tactical sector layer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLayer(zLayer);
  }, [cellId, rx, ry, zLayer]);

  // Render 256x256 tactical map onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layerData || !layerData.grid || layerData.grid.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 256;
    const imgData = ctx.createImageData(SIZE, SIZE);
    const data = imgData.data;

    // Palette mapping
    const getTileColor = (tile: number, z: number): [number, number, number] => {
      if (z === -1) {
        // Subterranean sewer / dungeon / cavern palette
        switch (tile) {
          case 0: return [15, 12, 25]; // void abyss
          case 1: return [48, 52, 60]; // damp flagstone
          case 2: return [35, 60, 50]; // slimy mossy masonry
          case 3: return [65, 50, 35]; // dirt / mud cave path
          case 4: return [50, 60, 75]; // polished vault floor
          case 5: return [25, 65, 85]; // subterranean pool / seepage
          case 6: return [25, 30, 40]; // solid bedrock / dungeon wall
          case 7: return [75, 30, 30]; // iron reinforcement / grating
          case 8: return [95, 65, 35]; // timber bracing
          default: return [30, 35, 45];
        }
      } else if (z === 1) {
        // Upper Lofts / Ramparts / Canopy palette
        switch (tile) {
          case 0: return [10, 15, 25]; // open sky drop-off
          case 1: return [35, 75, 40]; // leafy tree canopy
          case 2: return [20, 55, 28]; // dense tree bough
          case 3: return [105, 80, 50]; // wooden rope bridge / catwalk
          case 4: return [90, 100, 115]; // stone parapet
          case 5: return [40, 80, 160]; // sky cistern
          case 6: return [50, 60, 75]; // crenellations / battlements
          case 7: return [145, 50, 35]; // tile loft roof
          case 8: return [130, 85, 45]; // timber floorboard
          default: return [50, 60, 75];
        }
      } else {
        // Surface ground palette
        switch (tile) {
          case 0: return [86, 122, 60]; // natural meadow ground / soil (lighter than tall grass and woods)
          case 1: return [22, 60, 26]; // woodland trees / foliage
          case 2: return [25, 90, 180]; // river / lake / ocean water
          case 3: return [135, 95, 55]; // dirt road / rural lane
          case 4: return [90, 100, 115]; // cobblestone pavement / plaza
          case 5: return [75, 80, 90]; // stone wall / rock crags
          case 6: return [140, 40, 180]; // chaos conduit / rift
          case 7: return [140, 50, 35]; // wooden cottage / building roof
          case 8: return [225, 125, 30]; // campfire / forge / signal beacon
          case 9: return [200, 170, 110]; // arid sand / desert dunes
          case 10: return [110, 125, 140]; // ancient monolith stone
          case 11: return [195, 210, 225]; // snow frost / wetland marsh
          case 12: return [35, 30, 45]; // volcanic basalt / obsidian
          // Natural ground tiles (engine/maps/TacticalTerrain.ts TILE)
          case 13: return [222, 230, 238]; // snow
          case 14: return [168, 205, 228]; // ice
          case 15: return [24, 52, 40]; // conifer
          case 16: return [66, 100, 46]; // tall grass / moss
          case 17: return [64, 92, 78]; // marsh / reeds
          case 18: return [128, 124, 116]; // scree / gravel
          case 19: return [168, 150, 82]; // dry grass
          case 20: return [16, 70, 34]; // jungle
          case 21: return [16, 52, 120]; // deep water
          case 22: return [112, 88, 62]; // bare earth / mud
          case 23: return [60, 88, 52]; // shrub / scrub
          case 24: return [120, 84, 48]; // bridge planks
          default: return [86, 122, 60];
        }
      }
    };

    // Per-pixel texture: a fixed hash per pixel shades each tile a little lighter or darker, and canopy
    // and water get a coarser mottle, so ground reads as ground instead of flat fills.
    const isCanopy = (t: number) => t === 1 || t === 15 || t === 20 || t === 23;
    const isWater = (t: number) => t === 2 || t === 21 || t === 17;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const tile = layerData.grid[i] || 0;
      const [r, g, b] = getTileColor(tile, layerData.z);
      const x = i % SIZE, y = (i / SIZE) | 0;
      let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const fine = (((h >>> 16) & 255) / 255 - 0.5) * 0.14;
      const coarseSeed = Math.imul(((x >> 2) * 73856093) ^ ((y >> 2) * 19349663), 83492791);
      const coarse = isCanopy(tile) || isWater(tile) ? ((((coarseSeed >>> 16) & 255) / 255) - 0.5) * 0.18 : 0;
      const k = 1 + fine + coarse;
      const idx = i * 4;
      data[idx] = Math.max(0, Math.min(255, r * k));
      data[idx + 1] = Math.max(0, Math.min(255, g * k));
      data[idx + 2] = Math.max(0, Math.min(255, b * k));
      data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw Props as distinct icons
    for (const prop of layerData.props || []) {
      const px = prop.pos ? prop.pos[0] : 128;
      const py = prop.pos ? prop.pos[1] : 128;
      const isSelected = selectedProp?.id === prop.id;

      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = prop.id.includes("fountain") ? "#38bdf8" :
                      prop.id.includes("vault") || prop.id.includes("stair") ? "#ec4899" :
                      prop.id.includes("chest") ? "#f59e0b" : "#a855f7";
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

       // Draw NPCs as distinct tokens
    for (const npc of layerData.npcs || []) {
      const nx = npc.pos ? npc.pos[0] : 128;
      const ny = npc.pos ? npc.pos[1] : 128;
      const isSelected = selectedNpc?.id === npc.id;

      ctx.beginPath();
      ctx.arc(nx, ny, isSelected ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = npc.role?.toLowerCase().includes("guard") || npc.role?.toLowerCase().includes("commander") ? "#3b82f6" :
                      npc.role?.toLowerCase().includes("bandit") || npc.role?.toLowerCase().includes("rogue") ? "#ef4444" :
                      npc.tags?.some(t => t.includes("Predator")) ? "#f97316" : "#10b981";
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected ? "#facc15" : "#ffffff";
      ctx.stroke();
    }

    // Draw 4 Party Character Tokens
    if (partySession && partySession.members) {
      for (let i = 0; i < partySession.members.length; i++) {
        const m = partySession.members[i];
        const mx = m.pos ? m.pos[0] : 128;
        const my = m.pos ? m.pos[1] : 128;
        const isCurrentTurn = partySession.turnIndex === i;

        // Outer glow on active turn
        if (isCurrentTurn) {
          ctx.beginPath();
          ctx.arc(mx, my, 9, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(mx, my, isCurrentTurn ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = m.color || "#f59e0b";
        ctx.fill();
        ctx.lineWidth = isCurrentTurn ? 2.5 : 1.5;
        ctx.strokeStyle = isCurrentTurn ? "#facc15" : "#ffffff";
        ctx.stroke();

        // Badge letter
        ctx.fillStyle = "#ffffff";
        ctx.font = isCurrentTurn ? "bold 8px monospace" : "bold 6px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.badge || m.name[0], mx, my);
      }
    }
  }, [layerData, selectedProp, selectedNpc, partySession]);

  // Handle canvas clicks to inspect props / NPCs
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !layerData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = 256 / rect.width;
    const scaleY = 256 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check prop click (radius 8px)
    const clickedProp = (layerData.props || []).find(p => {
      const dx = (p.pos?.[0] ?? 128) - clickX;
      const dy = (p.pos?.[1] ?? 128) - clickY;
      return Math.hypot(dx, dy) <= 8;
    });

    if (clickedProp) {
      setSelectedProp(clickedProp);
      setSelectedNpc(null);
      return;
    }

    // Check NPC click (radius 8px)
    const clickedNpc = (layerData.npcs || []).find(n => {
      const dx = (n.pos?.[0] ?? 128) - clickX;
      const dy = (n.pos?.[1] ?? 128) - clickY;
      return Math.hypot(dx, dy) <= 8;
    });

    if (clickedNpc) {
      setSelectedNpc(clickedNpc);
      setSelectedProp(null);
      return;
    }

    // Empty space click clears selection
    setSelectedProp(null);
    setSelectedNpc(null);
  };

  // B.R.U.T.A.L. GM Action Execution
  const executeGMAction = async (customAction?: string) => {
    const text = customAction || actionInput;
    if (!text.trim()) return;

    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/dm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionText: text,
          playerId: 1,
          playerPos: [128, 128]
        })
      });
      const data = await res.json();
      setActionResult(data);
    } catch (err: any) {
      setActionResult({ error: err.message || "Action arbitration failed" });
    } finally {
      setActionLoading(false);
    }
  };

  // AI Story Arc Generation
  const generateStoryArc = async () => {
    setStoryLoading(true);
    setStoryArc(null);
    try {
      const res = await fetch('/api/dm/story/generate_arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellId,
          rx,
          ry,
          z: zLayer
        })
      });
      const data = await res.json();
      setStoryArc(data.arc || data);
      setMutatedAssets(data.mutationsApplied || []);
      // Reload layer to see injected tags / props
      await loadLayer(zLayer);
    } catch (err: any) {
      setStoryArc({ error: err.message || "Story Arc generation failed" });
    } finally {
      setStoryLoading(false);
    }
  };

  // Synthesize WhatELSE Relic Beat
  const synthesizeWhatElse = async () => {
    setStoryLoading(true);
    try {
      const res = await fetch('/api/dm/sector_load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellId,
          rx,
          ry,
          diurnalPhase: "MORNING"
        })
      });
      const data = await res.json();
      setStoryArc({
        title: data.whatElse?.title || "Emergent Relic Discovery",
        synopsis: data.whatElse?.narrativeSummary || "A forgotten sign of ancient aether-tech whispers beneath the stones.",
        phases: [
          { phaseNumber: 1, objective: "Investigate local ruins for energy resonance" },
          { phaseNumber: 2, objective: "Decipher the sigil lock without setting off a surge" },
          { phaseNumber: 3, objective: "Recover relic before outlaws converge" }
        ],
        rewards: { xp: 45, gold: 80 }
      });
      await loadLayer(zLayer);
    } catch (err: any) {
      setStoryArc({ error: err.message || "WhatELSE generation failed" });
    } finally {
      setStoryLoading(false);
    }
  };

  // Crisis Trigger
  const triggerCrisis = async (type: string) => {
    setCrisisLoading(true);
    setLastCrisisEvent(null);
    try {
      const res = await fetch('/api/observer/trigger_crisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, cellId })
      });
      const data = await res.json();
      setLastCrisisEvent(data.event || data);
      await loadLayer(zLayer);
    } catch (err: any) {
      setLastCrisisEvent({ error: err.message || "Crisis trigger failed" });
    } finally {
      setCrisisLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 8, 15, 0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: '#0a0f1d',
        border: '1px solid #1e293b',
        borderRadius: 12,
        width: '96vw',
        maxWidth: 1440,
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        overflow: 'hidden',
        color: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚔️</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>
                {layerData?.name || `Tactical Map: Cell #${cellId} (rx: ${rx}, ry: ${ry})`}
              </h2>
              <span style={{
                background: '#0284c7',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4
              }}>
                256x256 Tactical Grid
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Region Cell #{cellId} • Meso Coordinate ({rx}, {ry}) • Dynamic Discrete Step • 1 Tick = 1 Day
            </div>
          </div>

          {/* Layer Switcher & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex',
              background: '#020617',
              padding: 3,
              borderRadius: 6,
              border: '1px solid #334155'
            }}>
              {[
                { z: 1, label: 'Z = +1 (Upper)' },
                { z: 0, label: 'Z = 0 (Surface)' },
                { z: -1, label: 'Z = -1 (Subterranean)' }
              ].map(item => (
                <button
                  key={item.z}
                  onClick={() => setZLayer(item.z)}
                  style={{
                    background: zLayer === item.z ? '#0284c7' : 'transparent',
                    color: zLayer === item.z ? '#fff' : '#94a3b8',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: zLayer === item.z ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              style={{
                background: '#334155',
                color: '#fff',
                border: 'none',
                width: 30,
                height: 30,
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controlled Instability Crisis Toolbar */}
        <div style={{
          padding: '8px 20px',
          background: '#080d1a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          overflowX: 'auto',
          fontSize: 12
        }}>
          <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚡ Instability Crisis Injector:
          </span>
          <button
            onClick={() => triggerCrisis('CHAOS_SURGE')}
            disabled={crisisLoading}
            style={{
              background: '#4c1d95',
              color: '#f5d0fe',
              border: '1px solid #7c3aed',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            ⚡ Primordial Chaos Surge
          </button>
          <button
            onClick={() => triggerCrisis('DEEP_COLD_FREEZE')}
            disabled={crisisLoading}
            style={{
              background: '#0c4a6e',
              color: '#bae6fd',
              border: '1px solid #0284c7',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            ❄️ Hard Winter Blizzard
          </button>
          <button
            onClick={() => triggerCrisis('FAMINE_BANDIT_REVOLT')}
            disabled={crisisLoading}
            style={{
              background: '#78350f',
              color: '#fde68a',
              border: '1px solid #d97706',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            🍞 Famine & Roving Bandits
          </button>
          <button
            onClick={() => triggerCrisis('CORRUPT_EMBEZZLE_EMBARGO')}
            disabled={crisisLoading}
            style={{
              background: '#831843',
              color: '#fbcfe8',
              border: '1px solid #db2777',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            ⚖️ Corrupt Mayor & Compass Embargo
          </button>
          <button
            onClick={() => triggerCrisis('BORDER_WAR')}
            disabled={crisisLoading}
            style={{
              background: '#7f1d1d',
              color: '#fecaca',
              border: '1px solid #dc2626',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            ⚔️ Sovereign Border War
          </button>
        </div>

        {lastCrisisEvent && (
          <div style={{
            background: '#1e1b4b',
            borderBottom: '1px solid #4338ca',
            padding: '6px 20px',
            fontSize: 11,
            color: '#c7d2fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span><strong>Crisis Active:</strong> {lastCrisisEvent.message || lastCrisisEvent.error}</span>
            <span style={{ color: '#818cf8' }}>{lastCrisisEvent.loreDate || ''}</span>
          </div>
        )}

        {/* Main Content: Left 256x256 Canvas + Right GM & Story Panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '540px 1fr',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Left Column: Canvas View + Inspector */}
          <div style={{
            padding: 16,
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#040711',
            overflowY: 'auto'
          }}>
            <div style={{
              position: 'relative',
              width: 512,
              height: 512,
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.8)',
              border: '2px solid #1e293b'
            }}>
              {loading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(4, 7, 17, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  fontSize: 14,
                  fontWeight: 600
                }}>
                  ⏳ Loading Tactical Sector Data...
                </div>
              )}
              {error && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(127, 29, 29, 0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fecaca',
                  padding: 20,
                  fontSize: 12
                }}>
                  {error}
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={256}
                height={256}
                onClick={handleCanvasClick}
                style={{
                  width: 512,
                  height: 512,
                  imageRendering: 'pixelated',
                  cursor: 'crosshair',
                  display: 'block'
                }}
              />
            </div>

            {/* Tactical Legend & Inspector */}
            <div style={{
              background: '#0a0f1d',
              border: '1px solid #1e293b',
              borderRadius: 6,
              padding: 10,
              fontSize: 11
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>Tactical Legend & Entities</span>
                <span style={{ color: '#64748b' }}>Props: {layerData?.props?.length || 0} • NPCs: {layerData?.npcs?.length || 0}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 10 }}>
                <span>📦 Containers (Gold)</span>
                <span>⛲ Fountains (Cyan)</span>
                <span>🪜 Stairs/POEs (Pink)</span>
                <span>🛡️ Guards (Blue)</span>
                <span>👤 Citizens (Green)</span>
                <span>🦹 Outlaws/Bandits (Red)</span>
              </div>

              {/* Entity Inspector */}
              {selectedProp && (
                <div style={{
                  marginTop: 10,
                  padding: 8,
                  background: '#111827',
                  border: '1px solid #f59e0b',
                  borderRadius: 4
                }}>
                  <div style={{ fontWeight: 700, color: '#fbbf24' }}>
                    📦 Prop: {selectedProp.name || selectedProp.id}
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>
                    Pos: ({selectedProp.pos?.[0]}, {selectedProp.pos?.[1]}) • Tags: {(selectedProp.tags || []).join(', ') || 'none'}
                  </div>
                  {selectedProp.description && (
                    <div style={{ color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' }}>
                      "{selectedProp.description}"
                    </div>
                  )}
                  {selectedProp.injected_item && (
                    <div style={{ color: '#38bdf8', marginTop: 4, fontWeight: 600 }}>
                      🔑 Plot Item: {selectedProp.injected_item}
                    </div>
                  )}
                  {selectedProp.sub_map_target && (
                    <div style={{ color: '#ec4899', marginTop: 4, fontWeight: 600 }}>
                      🚪 Dungeon Sub-Map POE: {selectedProp.sub_map_target}
                    </div>
                  )}
                </div>
              )}

              {selectedNpc && (
                <div style={{
                  marginTop: 10,
                  padding: 8,
                  background: '#111827',
                  border: '1px solid #38bdf8',
                  borderRadius: 4
                }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                    👤 NPC: {selectedNpc.name} ({selectedNpc.role || 'Citizen'})
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>
                    Faction: {selectedNpc.faction || 'Neutral'} • HP: {selectedNpc.hp}/{selectedNpc.maxHp || 20} • Pos: ({selectedNpc.pos?.[0]}, {selectedNpc.pos?.[1]})
                  </div>
                  <div style={{ color: '#a78bfa', marginTop: 2 }}>
                    Tags: {(selectedNpc.tags || []).join(', ') || 'none'}
                  </div>
                  {selectedNpc.dialogue && (
                    <div style={{ color: '#fef08a', marginTop: 4, fontStyle: 'italic' }}>
                      "{selectedNpc.dialogue}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Story Director & B.R.U.T.A.L. GM Console */}
          <div style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            background: '#090e1a'
          }}>
            {/* Section 1: AI Story Generator (Pillar 4) */}
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#a855f7' }}>
                    ✨ Pillar 4: AI Story Generator & Emergent Quests
                  </h3>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Generates dynamic story arcs and anchors clues/dungeons into this sector's physical props
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={generateStoryArc}
                    disabled={storyLoading}
                    style={{
                      background: '#7c3aed',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {storyLoading ? '⏳ Generating...' : '⚡ Generate Story Arc'}
                  </button>
                  <button
                    onClick={synthesizeWhatElse}
                    disabled={storyLoading}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✨ Synthesize WhatELSE Beat
                  </button>
                </div>
              </div>

              {storyArc && (
                <div style={{
                  background: '#030712',
                  border: '1px solid #6b21a8',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12
                }}>
                  <div style={{ fontWeight: 800, color: '#c084fc', fontSize: 14 }}>
                    {storyArc.title}
                  </div>
                  <div style={{ color: '#cbd5e1', marginTop: 4, lineHeight: 1.4 }}>
                    {storyArc.synopsis}
                  </div>

                  {storyArc.phases && storyArc.phases.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontWeight: 700, color: '#93c5fd' }}>Quest Objectives:</span>
                      <ol style={{ margin: '4px 0 0 16px', padding: 0, color: '#94a3b8' }}>
                        {storyArc.phases.map((p: any, idx: number) => (
                          <li key={idx} style={{ marginTop: 2 }}>
                            {p.objective || p.name || `Phase ${idx + 1}`}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {mutatedAssets.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #1e293b' }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>Anchored Physical Mutations:</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {mutatedAssets.map((m: any, idx: number) => (
                          <span
                            key={idx}
                            style={{
                              background: '#1e293b',
                              color: '#a5f3fc',
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 3
                            }}
                          >
                            {m.type === 'PROP' ? '📦' : '👤'} {m.id} (Tags: {(m.addedTags || []).join(', ')})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: B.R.U.T.A.L. Game Master Live Action Console (Pillar 3) */}
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 14,
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
                    🎲 Pillar 3: B.R.U.T.A.L. Game Master Console
                  </h3>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    B.R.U.T.A.L. v4.9 (1d12 + Stat vs Guard) • Real Sector Simulation
                  </div>
                </div>

                {/* Mode Selector */}
                <div style={{ display: 'flex', gap: 4, background: '#020617', padding: 3, borderRadius: 6 }}>
                  <button
                    onClick={() => setSessionMode('PARTY')}
                    style={{
                      background: sessionMode === 'PARTY' ? '#2563eb' : 'transparent',
                      color: sessionMode === 'PARTY' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    👥 4-Player AI Session
                  </button>
                  <button
                    onClick={() => setSessionMode('MANUAL')}
                    style={{
                      background: sessionMode === 'MANUAL' ? '#2563eb' : 'transparent',
                      color: sessionMode === 'MANUAL' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    👤 Manual Action
                  </button>
                </div>
              </div>

              {sessionMode === 'PARTY' ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginTop: 10 }}>
                  {/* Dynamic AI Director Story Trouble Banner */}
                  {partySession?.activeStoryArc && (
                    <div style={{
                      background: '#030712',
                      border: '1px solid #6366f1',
                      borderRadius: 6,
                      padding: '8px 10px',
                      marginBottom: 8,
                      fontSize: 11
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#818cf8', fontSize: 11 }}>
                          📜 ACTIVE WORLD TROUBLE: {partySession.activeStoryArc.arc_id}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 9 }}>Phase {partySession.activeStoryArc.active_phase ?? 1}</span>
                      </div>
                      <div style={{ color: '#e2e8f0', marginTop: 2, fontStyle: 'italic', lineHeight: 1.3 }}>
                        "{partySession.activeStoryArc.inciting_incident}"
                      </div>
                      {partySession.activeStoryArc.beats?.[(partySession.activeStoryArc.active_phase || 1) - 1] && (
                        <div style={{ marginTop: 4, color: '#38bdf8', fontSize: 10 }}>
                          🎯 <strong>Objective:</strong> {partySession.activeStoryArc.beats[(partySession.activeStoryArc.active_phase || 1) - 1].objective}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Controls Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617', padding: '6px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: 11, color: '#e2e8f0' }}>
                      <span style={{ fontWeight: 800, color: '#38bdf8' }}>Round {partySession?.round ?? 1}</span>
                      <span style={{ color: '#64748b', margin: '0 6px' }}>•</span>
                      <span>Turn: <strong style={{ color: partySession?.members?.[partySession?.turnIndex]?.color || '#f59e0b' }}>
                        {partySession?.members?.[partySession?.turnIndex]?.name ?? 'Harrow Grist'}
                      </strong></span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={stepPartySession}
                        disabled={partyStepLoading}
                        style={{
                          background: partyStepLoading ? '#475569' : '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: partyStepLoading ? 'wait' : 'pointer'
                        }}
                      >
                        {partyStepLoading ? '⏳ Ollama Resolving...' : '▶ Step Next Turn'}
                      </button>
                      <button
                        onClick={() => setAutoPlay(!autoPlay)}
                        style={{
                          background: autoPlay ? '#ef4444' : '#334155',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {autoPlay ? '⏸ Pause' : '⚡ Auto-Play'}
                      </button>
                      <button
                        onClick={initPartySession}
                        disabled={partyStepLoading}
                        style={{
                          background: '#1e293b',
                          color: '#94a3b8',
                          border: '1px solid #334155',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Re-Roll Arc
                      </button>
                    </div>
                  </div>

                  {/* Party Member Status Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
                    {(partySession?.members || []).map((m: any, idx: number) => {
                      const isCurrent = partySession?.turnIndex === idx;
                      return (
                        <div
                          key={m.id}
                          style={{
                            background: isCurrent ? '#1e293b' : '#090d16',
                            border: `1px solid ${isCurrent ? m.color : '#1e293b'}`,
                            borderRadius: 6,
                            padding: 6,
                            fontSize: 10,
                            position: 'relative'
                          }}
                        >
                          {isCurrent && (
                            <span style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: m.color,
                              color: '#000',
                              fontSize: 8,
                              fontWeight: 900,
                              padding: '1px 3px',
                              borderRadius: 2
                            }}>
                              ACTIVE
                            </span>
                          )}
                          <div style={{ fontWeight: 700, color: m.color }}>{m.name}</div>
                          <div style={{ color: '#64748b', fontSize: 9 }}>{m.species} • {m.role}</div>
                          <div style={{ marginTop: 4, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <span>HP: {m.hp}/{m.maxHp}</span>
                            <span>Gold: {m.gold ?? 50}g</span>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🗡️ {m.weapon}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Feed */}
                  <div style={{
                    marginTop: 8,
                    flex: 1,
                    background: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    padding: 10,
                    overflowY: 'auto',
                    maxHeight: 280,
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {partySession?.activeStoryArc?.resolved && (
                      <div style={{
                        background: '#064e3b',
                        border: '1px solid #10b981',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: '#ecfdf5',
                        fontSize: 11
                      }}>
                        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 2, color: '#34d399' }}>
                          🎉 THREAD DECISIVELY RESOLVED BY PARTY ACTION
                        </div>
                        <div>
                          {partySession.activeStoryArc.resolution || "The party has decisively completed the objective and reshaped the sector state."}
                        </div>
                      </div>
                    )}
                    {partySession?.history && partySession.history.length > 0 ? (
                      partySession.history.map((h: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: '#0f172a',
                            borderLeft: `3px solid ${h.success ? '#10b981' : '#ef4444'}`,
                            borderRadius: 4,
                            padding: 8
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                              [R{h.round}:T{h.turn}] {h.characterName}
                            </span>
                            <span style={{
                              fontWeight: 800,
                              fontSize: 9,
                              color: h.success ? '#22c55e' : '#ef4444'
                            }}>
                              {h.success ? 'HIT / SUCCESS' : 'FAILED / DEFLECTED'}
                            </span>
                          </div>
                          <div style={{ fontStyle: 'italic', color: '#93c5fd', marginBottom: 4 }}>
                            "{h.dialogue}"
                          </div>
                          <div style={{ color: '#cbd5e1', marginBottom: 4 }}>
                            <strong>Action:</strong> {h.action}
                          </div>
                          {h.rollOutcome && (
                            <div style={{ fontSize: 10, color: '#94a3b8', background: '#020617', padding: '2px 6px', borderRadius: 3, marginBottom: 4 }}>
                              🎲 1d12 ({h.rollOutcome.playerRoll}) + Stat ({h.rollOutcome.playerStatVal}) = Total {h.rollOutcome.playerRoll + h.rollOutcome.playerStatVal} vs Guard {h.rollOutcome.dcOrDefenderRoll}
                              {h.rollOutcome.injuryPoints ? ` • ${h.rollOutcome.injuryPoints} structural dmg` : ''}
                            </div>
                          )}
                          <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                            {h.narrative}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 30 }}>
                        Click <strong>"▶ Step Next Turn"</strong> to start the 4-player AI party session in this sector!
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Quick Preset Action Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    <button
                      onClick={() => executeGMAction("Examine surroundings and search for hidden clues")}
                      disabled={actionLoading}
                      style={{
                        background: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      🔍 Search Clues
                    </button>
                    <button
                      onClick={() => executeGMAction("Strike hostile with Osmium Greatsword")}
                      disabled={actionLoading}
                      style={{
                        background: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      ⚔️ Attack Target
                    </button>
                    <button
                      onClick={() => executeGMAction("Interrogate local commander about contraband trade routes")}
                      disabled={actionLoading}
                      style={{
                        background: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      🗣️ Interrogate NPC
                    </button>
                    <button
                      onClick={() => executeGMAction("Inspect and pick lock on the heavy stone chest")}
                      disabled={actionLoading}
                      style={{
                        background: '#1e293b',
                        color: '#e2e8f0',
                        border: '1px solid #334155',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      🔓 Pick Lock
                    </button>
                  </div>

                  {/* Free-speech text action bar */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') executeGMAction(); }}
                      placeholder="Type a player action (e.g. 'Sneak past sentry to the sewer flume')"
                      style={{
                        flex: 1,
                        background: '#020617',
                        border: '1px solid #334155',
                        borderRadius: 4,
                        padding: '6px 10px',
                        color: '#f8fafc',
                        fontSize: 12
                      }}
                    />
                    <button
                      onClick={() => executeGMAction()}
                      disabled={actionLoading}
                      style={{
                        background: actionLoading ? '#475569' : '#38bdf8',
                        color: '#0f172a',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        padding: '6px 14px',
                        fontSize: 12,
                        cursor: actionLoading ? 'wait' : 'pointer'
                      }}
                    >
                      {actionLoading ? 'Arbiter...' : 'Execute'}
                    </button>
                  </div>

                  {/* GM Resolution Output */}
                  <div style={{
                    marginTop: 12,
                    flex: 1,
                    background: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    padding: 12,
                    overflowY: 'auto',
                    fontSize: 12,
                    color: '#cbd5e1'
                  }}>
                    {actionResult ? (
                      <div>
                        {actionResult.rollResults && actionResult.rollResults.length > 0 && (
                          <div style={{
                            background: '#0f172a',
                            border: '1px solid #38bdf8',
                            borderRadius: 4,
                            padding: 8,
                            marginBottom: 10
                          }}>
                            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: 13, marginBottom: 4 }}>
                              🎲 Opposed 1d12 Resolution (B.R.U.T.A.L. v4.9)
                            </div>
                            {actionResult.rollResults.map((r: any, idx: number) => (
                              <div key={idx} style={{ fontSize: 11, color: '#94a3b8' }}>
                                <span style={{
                                  color: r.success ? '#22c55e' : '#ef4444',
                                  fontWeight: 700,
                                  marginRight: 6
                                }}>
                                  [{r.success ? 'SUCCESS' : 'FAILURE'}]
                                </span>
                                Roll: <strong>{r.totalRoll ?? r.roll}</strong> vs DC/Defense: <strong>{r.dc ?? r.targetTotal}</strong>
                                {r.stat && ` • Stat: ${r.stat.toUpperCase()}`}
                                {r.xpGained ? ` • +${r.xpGained} XP` : ''}
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                          GM Narrative Chronicle:
                        </div>
                        <div style={{ fontStyle: 'italic', lineHeight: 1.5, color: '#e2e8f0' }}>
                          "{actionResult.narrative || actionResult.text || actionResult.message || 'Action executed.'}"
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 30 }}>
                        Enter an action or click a preset above to test the B.R.U.T.A.L. GM opposed 1d12 arbitration engine on this map.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

