import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { generateLevel3Map } from './utils/Level3Generator';
import { audioManager } from './utils/AudioManager';
import {
  DEFAULT_START_CELL,
  VIEWPORT_SIZE,
  TILE_SIZE,
  getBiomeName,
  getAnimalSpriteCoords,
  getNPCSpriteCoords
} from './utils/SpriteHelper';
import type { InjectedProp, InjectedNPC, StoryBeat, SaveSlot, TacticalCombatState, TacticalRollCard, CombatParticipant } from './types';
import { TacticalCombatOverlay } from './components/hud/TacticalCombatOverlay';
import { VirtualTouchControls } from './components/hud/VirtualTouchControls';
import {
  evaluateLineOfSight,
  getReachableTiles,
  getGridDistance,
  calculatePoolTier,
  calculateMoveRange,
  getMovementTurnOrder,
  getDeclarationTurnOrder,
  getResolutionTurnOrder,
  type LosResult
} from './utils/TacticalCombatHelper';
import {
  calculateVisionRadius,
  computeMultiSourceFieldOfView,
  resolveStealthContest
} from './utils/FieldOfViewHelper';
import {
  generateWildlifeHerd,
  generateApexPredator,
  processTrophicWildlifeTick
} from './utils/TrophicWildlifeHelper';
import { getDiurnalPhase, updateNPCDiurnalRoutines } from './utils/DiurnalScheduleHelper';
import { streamConcordiaAction } from './utils/NarrativeStreamer';
import { SpatialHashGrid } from './utils/SpatialHashGrid';
import { CombatParticleManager, TerrainPrerenderCache } from './utils/CanvasEffectHelper';

// Modular HUD Components
import { HeroHud } from './components/hud/HeroHud';
import { CenterHeaderBar } from './components/hud/CenterHeaderBar';
import { WorldMapTab } from './components/hud/WorldMapTab';
import { ActionTerminal, BottomKeyBar } from './components/hud/ActionTerminal';

// Modular Modal Components
import { StartMenuModal } from './components/modals/StartMenuModal';
import { CharacterCreationModal } from './components/modals/CharacterCreationModal';
import { SaveGameModal, LoadGameModal } from './components/modals/SaveLoadModals';
import { DeathModal } from './components/modals/DeathModal';
import { MemorialModal } from './components/modals/MemorialModal';
import { SkillsProgressionModal } from './components/modals/SkillsProgressionModal';
import { BarterShopModal } from './components/modals/BarterShopModal';
import { NoticeBoardModal } from './components/modals/NoticeBoardModal';
import { FieldCraftingModal } from './components/modals/FieldCraftingModal';
import { PaperdollLoadoutModal, type EquipmentItem } from './components/modals/PaperdollLoadoutModal';
import { ChaosFlowCrossingModal } from './components/modals/ChaosFlowCrossingModal';
import { ContextRadialMenu, type RadialActionOption } from './components/hud/ContextRadialMenu';
import {
  processFireSpread,
  freezeWaterTile,
  getForagedFloraItem
} from './utils/ElementalCascadeHelper';
import {
  computeSquadTactics,
  isPlayerFlanked,
  resolveResilienceSave
} from './utils/TacticalAIHelper';
import { generateUrbanSettlement } from './utils/UrbanSettlementGenerator';

export default function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [character, setCharacter] = useState<any>(null);

  const [currentCellId, setCurrentCellId] = useState<number>(DEFAULT_START_CELL);
  const [cellTelemetry, setCellTelemetry] = useState<any>(null);
  const [regionalPos, setRegionalPos] = useState({ rx: 105, ry: 112 });
  const [localPos, setLocalPos] = useState({ lx: 128, ly: 128 });

  const [manifest, setManifest] = useState<any>(null);
  const [tilemap, setTilemap] = useState<{ grid: Uint8Array; size: number } | null>(null);

  // DeepMind Concordia & WhatELSE Grounded State
  const [injectedProps, setInjectedProps] = useState<InjectedProp[]>([]);
  const [injectedNPCs, setInjectedNPCs] = useState<InjectedNPC[]>([]);
  const [activeBeat, setActiveBeat] = useState<StoryBeat | null>(null);
  const [campaignState, setCampaignState] = useState<any>(null);
  const [calendarState, setCalendarState] = useState<any>(null);
  const [chaosFlowTelemetry, setChaosFlowTelemetry] = useState<any>(null);
  const [crossingTargetCell, setCrossingTargetCell] = useState<any | null>(null);
  const [isCrossingSubmitting, setIsCrossingSubmitting] = useState<boolean>(false);
  const [activeChaosSurge, setActiveChaosSurge] = useState<any | null>(null);

  // Spatial Hash Grid Partitioning (O(1) Proximity & Collision on 16x16 Buckets)
  const npcSpatialGridRef = useRef<SpatialHashGrid<InjectedNPC>>(new SpatialHashGrid<InjectedNPC>(16));
  const propSpatialGridRef = useRef<SpatialHashGrid<InjectedProp>>(new SpatialHashGrid<InjectedProp>(16));

  useEffect(() => {
    npcSpatialGridRef.current.rebuild(injectedNPCs);
  }, [injectedNPCs]);

  useEffect(() => {
    propSpatialGridRef.current.rebuild(injectedProps);
  }, [injectedProps]);

  const [encounterTarget, setEncounterTarget] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  // Phase C: Tactical Turn-Based Combat State (Stamina & Focus Pool Economy + 3-Phase Round)
  const [combatState, setCombatState] = useState<TacticalCombatState>({
    inCombat: false,
    roundNumber: 1,
    turnIndex: 0,
    phase: 'MOVEMENT',
    phaseTurnOrder: [],
    activeTurnUnitId: null,
    playerStamina: 10,
    playerMaxStaminaPool: 10,
    playerStaminaTier: 'LIGHT',
    playerFocus: 10,
    playerMaxFocusPool: 10,
    playerFocusTier: 'LIGHT',
    playerHasMoved: false,
    playerHasUsedStaminaAction: false,
    playerHasUsedFocusAction: false,
    playerAp: 10,
    playerMaxAp: 10,
    turnOrder: [],
    participants: new Map(),
    lastRollCard: null,
  });

  // Phase A: Interactive Tile Hover Telemetry
  const [hoverTile, setHoverTile] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    tileName: string;
    coverLevel: string;
    moveCost: string;
    entityName?: string;
  } | null>(null);

  // Phase A & B: Particle System & Offscreen Terrain Prerender Cache
  const particleManagerRef = useRef<CombatParticleManager>(new CombatParticleManager());
  const terrainCacheRef = useRef<TerrainPrerenderCache>(new TerrainPrerenderCache());
  const visualHeroPos = useRef<{ x: number; y: number }>({ x: 128, y: 128 });
  const level3WorkerRef = useRef<Worker | null>(null);
  const stepCounterRef = useRef<number>(0);

  // Option 2: Shadowcasting Fog of War & Stealth Mechanics
  const [isStealthed, setIsStealthed] = useState(false);
  const exploredTilesRef = useRef<Set<string>>(new Set());

  // Background Music & SFX Manager State
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(audioManager.getCurrentTrack());
  const [isMuted, setIsMuted] = useState(false);
  const [musicVol, setMusicVol] = useState(0.35);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [ambientMuted, setAmbientMuted] = useState(false);

  const handleToggleAmbient = () => {
    audioManager.toggleMuteAmbient();
    setAmbientMuted(audioManager.isAmbientMute());
  };

  const handleToggleMusic = () => {
    audioManager.toggleMusic();
    setIsPlayingMusic(audioManager.isMusicPlaying());
    setCurrentTrack(audioManager.getCurrentTrack());
  };

  const handleNextTrack = () => {
    audioManager.nextTrack();
    setIsPlayingMusic(true);
    setCurrentTrack(audioManager.getCurrentTrack());
  };

  const handleToggleMute = () => {
    audioManager.toggleMuteMusic();
    setIsMuted(audioManager.isMusicMute());
  };

  const handleToggleSfx = () => {
    audioManager.toggleMuteSfx();
    setSfxMuted(audioManager.isSfxMute());
  };

  const handleVolumeChange = (v: number) => {
    setMusicVol(v);
    audioManager.setMusicVolume(v);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastEncounterId = useRef<string | null>(null);

  // Pixel Art Tileset & Spritesheet Assets from /gfx
  const overworldImgRef = useRef<HTMLImageElement | null>(null);
  const objectsImgRef = useRef<HTMLImageElement | null>(null);
  const caveImgRef = useRef<HTMLImageElement | null>(null);
  const innerImgRef = useRef<HTMLImageElement | null>(null);
  const animalSpritesImgRef = useRef<HTMLImageElement | null>(null);
  const [gfxLoaded, setGfxLoaded] = useState(false);

  useEffect(() => {
    let count = 0;
    const onLoad = () => {
      count++;
      if (count >= 3) setGfxLoaded(true);
    };

    const ow = new Image();
    ow.onload = onLoad;
    ow.src = '/gfx/Overworld.png';
    overworldImgRef.current = ow;

    const obj = new Image();
    obj.onload = onLoad;
    obj.src = '/gfx/objects.png';
    objectsImgRef.current = obj;

    const cv = new Image();
    cv.onload = onLoad;
    cv.src = '/gfx/cave.png';
    caveImgRef.current = cv;

    const inn = new Image();
    inn.onload = onLoad;
    inn.src = '/gfx/Inner.png';
    innerImgRef.current = inn;

    const anim = new Image();
    anim.onload = onLoad;
    anim.src = '/gfx/Gemini_Generated_Image_a4motwa4motwa4mo.png';
    animalSpritesImgRef.current = anim;
  }, []);

  // View Tab: Tactical Battlegrid vs. World Map Reference
  const [activeCenterTab, setActiveCenterTab] = useState<'battlegrid' | 'worldMap'>('battlegrid');

  // Modals Visibility State
  const [inStartMenu, setInStartMenu] = useState(true);
  const [showCharModal, setShowCharModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showMemorialModal, setShowMemorialModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showBarterModal, setShowBarterModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showCraftingModal, setShowCraftingModal] = useState(false);
  const [showPaperdollModal, setShowPaperdollModal] = useState(false);
  const [isTorchLit, setIsTorchLit] = useState(false);
  const [radialMenuState, setRadialMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetName: string;
    targetType: 'npc' | 'prop' | 'tile';
    options: RadialActionOption[];
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    targetName: '',
    targetType: 'tile',
    options: []
  });

  // Modal Data States
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [saveSlotName, setSaveSlotName] = useState('');
  const [memorialList, setMemorialList] = useState<any[]>([]);
  const [hardcoreDeathProcessed, setHardcoreDeathProcessed] = useState(false);
  const [tradeCatalog, setTradeCatalog] = useState<any[]>([]);
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);
  const [bountyList, setBountyList] = useState<any[]>([]);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [levelUpSubmitting, setLevelUpSubmitting] = useState(false);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);

  // Fetch character stats & options
  useEffect(() => {
    fetch('http://localhost:3000/api/dm/player')
      .then(r => r.json())
      .then(data => setCharacter(data))
      .catch(() => {});

    fetch('http://localhost:3000/api/dm/character/options')
      .then(r => r.json())
      .then(data => setOptionsData(data))
      .catch(() => {});
  }, []);

  // Initialize Backend & WhatELSE Sector
  useEffect(() => {
    async function init() {
      try {
        setMessages([{ sender: 'System', text: `Booting Concordia ECGM Engine on Global Cell ${currentCellId}...`, type: 'info' }]);
        await fetch(`http://localhost:3000/api/regional/start/${currentCellId}`, { method: 'POST' });
        await fetchSectorState(regionalPos.rx, regionalPos.ry, currentCellId);
        setLoading(false);
      } catch (err: any) {
        setMessages(prev => [...prev, { sender: 'System', text: `Initialization failed: ${err.message}`, type: 'error' }]);
      }
    }
    init();
  }, []);

  // Phase B: Web Worker Initialization for Asynchronous Level 3 Map Generation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        level3WorkerRef.current = new Worker(new URL('./workers/level3Worker.ts', import.meta.url), { type: 'module' });
      } catch (e) {
        console.warn('Level3 Web Worker creation failed, fallback to main thread:', e);
      }
    }
    return () => {
      level3WorkerRef.current?.terminate();
    };
  }, []);

  const generateLevel3Async = (manifestData: any): Promise<{ grid: Uint8Array; size: number }> => {
    return new Promise((resolve) => {
      if (!level3WorkerRef.current) {
        resolve(generateLevel3Map(manifestData));
        return;
      }
      const reqId = `l3_${Date.now()}_${Math.random()}`;
      const handleMsg = (e: MessageEvent) => {
        if (e.data?.id === reqId) {
          level3WorkerRef.current?.removeEventListener('message', handleMsg);
          if (e.data.gridBuffer) {
            resolve({ grid: new Uint8Array(e.data.gridBuffer), size: e.data.size });
          } else {
            resolve(generateLevel3Map(manifestData));
          }
        }
      };
      level3WorkerRef.current.addEventListener('message', handleMsg);
      level3WorkerRef.current.postMessage({ id: reqId, manifest: manifestData });
    });
  };

  // Loads WhatELSE StoryBeat, injected props, and Concordia Game Master loop
  const fetchSectorState = async (rx: number, ry: number, targetCellId?: number) => {
    const activeCellId = targetCellId ?? currentCellId;
    try {
      fetch(`http://localhost:3000/api/regional/cell/${activeCellId}`)
        .then(r => r.json())
        .then(d => { if (d.cell) setCellTelemetry(d); })
        .catch(() => {});

      const res = await fetch(`http://localhost:3000/api/regional/manifest/${activeCellId}?x=${rx}&y=${ry}`);
      if (res.ok) {
        const data = await res.json();
        setManifest(data);
        exploredTilesRef.current.clear();

        // Phase B: Asynchronous Web Worker Generation (zero main-thread blocking)
        const map = await generateLevel3Async(data);
        setTilemap(map);

        // Load WhatELSE Sector Injection
        const sectorRes = await fetch('http://localhost:3000/api/dm/sector_load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              cellId: activeCellId,
              rx,
              ry,
              biomeName: getBiomeName(data.global_context.biome_id),
              isWarzone: data.global_context.isWarzone,
              isFamine: data.global_context.isFamine,
              chaosRadiation: data.environment.chaos_radiation,
              infrastructureMask: data.environment.infrastructure_mask,
              elevation: data.environment.elevation,
              vegetationDensity: data.environment.vegetation_density,
              factionOwner: data.global_context.faction_owner,
              crimeRate: data.global_context.crime_rate,
              entitiesPresent: data.entities_present
            }
          })
        });

        if (sectorRes.ok) {
          const sectorData = await sectorRes.json();
          const combinedProps: InjectedProp[] = sectorData.props || [];
          const combinedNPCs: InjectedNPC[] = sectorData.npcs || [];

          // Milestone 3: If this sector is an urban Burg Settlement, synthesize authentic urban landmarks & citizens
          const isUrban = data.global_context?.burg != null ||
                          data.environment?.base_terrain === 4 ||
                          ((data.environment?.infrastructure_mask || 0) & 32) !== 0;

          if (isUrban) {
            const burgName = data.global_context?.burg?.name || 'Provincial Burg';
            const factionName = data.global_context?.faction_owner || 'Crown Sovereignty';
            const urbanTier = data.global_context?.burg?.urban_tier || 2;
            const unrest = data.global_context?.burg?.unrest || 10;
            const biomeId = data.global_context?.biome_id || 6;
            const urbanSettlement = generateUrbanSettlement(burgName, factionName, urbanTier, unrest, biomeId);

            // Merge unique urban props (fountain, market stalls, forge, notice boards)
            const existingPropIds = new Set(combinedProps.map(p => p.id));
            urbanSettlement.props.forEach(up => {
              if (!existingPropIds.has(up.id)) combinedProps.push(up);
            });

            // Merge unique urban citizens (Captain, Sentry, Guildmaster, Blacksmith, Innkeeper)
            const existingNpcIds = new Set(combinedNPCs.map(n => n.id));
            urbanSettlement.npcs.forEach(un => {
              if (!existingNpcIds.has(un.id)) combinedNPCs.push(un);
            });
          } else {
            // Milestone 2: Living Trophic Wildlife Ecology & Herding
            // If this is a wilderness sector, synthesize an authentic herd and stalking apex predator
            const biomeId = data.global_context?.biome_id || 6;
            const hasWildFauna = combinedNPCs.some(n => n.tags?.includes('prey') || n.herdId != null);
            if (!hasWildFauna) {
              const herdCenter: [number, number] = [
                Math.round(128 + (Math.random() - 0.5) * 44),
                Math.round(128 + (Math.random() - 0.5) * 44)
              ];
              const wildHerd = generateWildlifeHerd(biomeId, herdCenter, 3);
              const apexPred = generateApexPredator(biomeId, [
                Math.max(15, Math.min(240, herdCenter[0] + 12)),
                Math.max(15, Math.min(240, herdCenter[1] - 10))
              ]);
              combinedNPCs.push(...wildHerd, apexPred);
            }
          }

          setInjectedProps(combinedProps);
          setInjectedNPCs(combinedNPCs);
          setActiveBeat(sectorData.beat || null);
          setCampaignState(sectorData.campaignState || null);
          if (sectorData.calendar) setCalendarState(sectorData.calendar);
          setChaosFlowTelemetry(sectorData.chaosFlow || null);

          // Phase C: Dynamic Chaos Surge & Cascade Ripples
          if (sectorData.chaosSurge) {
            setActiveChaosSurge(sectorData.chaosSurge);
            setMessages(prev => [
              ...prev,
              {
                sender: `🌀 Chaos Surge [${sectorData.chaosSurge.activeSurge.domainLean}]`,
                text: `${sectorData.chaosSurge.activeSurge.headline} — ${sectorData.chaosSurge.activeSurge.description}`,
                type: 'event'
              }
            ]);
            if (sectorData.chaosSurge.ripples?.length > 0) {
              const rippleSummary = sectorData.chaosSurge.ripples
                .map((r: any) => `• ${r.targetName}: ${r.outcomeDescription}`)
                .join('\n');
              setMessages(prev => [
                ...prev,
                {
                  sender: '🌊 Chaotic Ripple Cascade',
                  text: rippleSummary,
                  type: 'info'
                }
              ]);
            }
          } else {
            setActiveChaosSurge(null);
          }

          audioManager.setBiomeSoundscape(getBiomeName(data.global_context.biome_id), Boolean(isUrban));
          lastEncounterId.current = null;
          setEncounterTarget(null);

          // Trigger Concordia Sensory Arrival Scene (Gemini)
          fetch('http://localhost:3000/api/dm/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: {
                sector: `Region (${rx}, ${ry})`,
                biome: getBiomeName(data.global_context.biome_id),
                factionOwner: data.global_context.faction_owner,
                props: (sectorData.props || []).map((p: any) => p.name),
                entities: (sectorData.npcs || []).map((n: any) => n.name)
              }
            })
          })
            .then(r => r.json())
            .then(sceneData => {
              if (sceneData.scene) {
                setMessages(prev => [...prev, { sender: 'GM', text: sceneData.scene, type: 'narrative' }]);
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Fetch sector error:', err);
    }
  };

  const handleInvestSkillRank = async (branchId?: string, grantFreeLevel = false) => {
    if (!character) return;
    setLevelUpSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/tactical/character/${character.id || 1}/levelup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          grantFreeLevel
        })
      });
      const data = await res.json();
      if (data.success && data.character) {
        setCharacter(data.character);
        setMessages(prev => [
          ...prev,
          {
            sender: 'GM',
            text: `🌟 ADVANCEMENT UNLOCKED: ${character.name} has ascended in power! New Level: ${data.character.level || (character.level + 1)}. Available Skill Points: ${data.character.skill_points ?? 0}.`,
            type: 'narrative'
          }
        ]);
        triggerAutoSave('Skill Advancement');
      } else {
        alert(data.error || 'Failed to invest skill point.');
      }
    } catch (e: any) {
      alert('Error updating skills: ' + e.message);
    } finally {
      setLevelUpSubmitting(false);
    }
  };

  const triggerAutoSave = async (slotLabel = 'AutoSave') => {
    if (!character) return;
    try {
      const res = await fetch('http://localhost:3000/api/dm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: `${slotLabel} - (${regionalPos.rx}, ${regionalPos.ry})`,
          characterData: character,
          worldPos: { cellId: currentCellId, rx: regionalPos.rx, ry: regionalPos.ry, lx: localPos.lx, ly: localPos.ly },
          storyState: { campaignState, activeBeat }
        })
      });
      if (res.ok) {
        setAutoSaveToast(`💾 Auto-Saved: Sector (${regionalPos.rx}, ${regionalPos.ry})`);
        setTimeout(() => setAutoSaveToast(null), 3000);
      }
    } catch {}
  };

  const handleRevivePlayer = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/player/revive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.character) {
          setCharacter(data.character);
        }
        setLocalPos({ lx: 128, ly: 128 });
        setShowDeathModal(false);
        setMessages(prev => [
          ...prev,
          {
            sender: 'The Chronicler',
            text: `🕯️ REVIVED: You awaken gasping for air near the embers of a traveler's campfire at sector center (128, 128). Your wounds have been bandaged to ${data.restoredHp || 10} HP. Scavengers claimed ${data.goldLost || 0} gold while you lay senseless.`,
            type: 'narrative'
          }
        ]);
        triggerAutoSave('AutoSave - Post Revive');
      }
    } catch (err: any) {
      alert(`Revive failed: ${err.message}`);
    }
  };

  const handleHardcorePermadeath = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/player/permadeath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          causeOfDeath: 'Fell in mortal combat',
          sectorX: regionalPos.rx,
          sectorY: regionalPos.ry
        })
      });
      if (res.ok) {
        setHardcoreDeathProcessed(true);
      }
    } catch (err) {
      console.error('Permadeath error:', err);
    }
  };

  const handleOpenMemorialsModal = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/memorials');
      if (res.ok) {
        const data = await res.json();
        setMemorialList(data.memorials || []);
        setShowMemorialModal(true);
      }
    } catch (err: any) {
      alert(`Could not load memorials: ${err.message}`);
    }
  };

  const openBarterModal = async () => {
    setShowBarterModal(true);
    setTradeStatus(null);
    try {
      const res = await fetch(`http://localhost:3000/api/dm/trade/catalog?cellId=${currentCellId}`);
      if (res.ok) {
        const data = await res.json();
        setTradeCatalog(data.wares || []);
      }
    } catch (e) {
      console.error('Barter fetch error:', e);
    }
  };

  const handleBuyItem = async (ware: any) => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/trade/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: character?.id || 1,
          itemName: ware.name,
          price: ware.price
        })
      });
      const data = await res.json();
      if (res.ok && data.character) {
        setCharacter(data.character);
        setTradeStatus(`Purchased ${ware.name}! (-${ware.price}g)`);
      } else {
        setTradeStatus(`Failed: ${data.error || 'Could not purchase'}`);
      }
    } catch (e: any) {
      setTradeStatus(`Error: ${e.message}`);
    }
  };

  const handleSellItem = async (itemName: string, idx: number) => {
    try {
      const matchingWare = tradeCatalog.find(w => w.name.toLowerCase() === itemName.toLowerCase());
      const salePrice = matchingWare ? matchingWare.sellPrice : 6;
      const res = await fetch('http://localhost:3000/api/dm/trade/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: character?.id || 1,
          itemIndex: idx,
          itemName,
          salePrice
        })
      });
      const data = await res.json();
      if (res.ok && data.character) {
        setCharacter(data.character);
        setTradeStatus(`Sold ${itemName}! (+${salePrice}g)`);
      } else {
        setTradeStatus(`Failed: ${data.error || 'Could not sell'}`);
      }
    } catch (e: any) {
      setTradeStatus(`Error: ${e.message}`);
    }
  };

  const openNoticeModal = async () => {
    setShowNoticeModal(true);
    try {
      const res = await fetch(`http://localhost:3000/api/dm/bounties?cellId=${currentCellId}`);
      if (res.ok) {
        const data = await res.json();
        setBountyList(data.bounties || []);
      }
    } catch (e) {
      console.error('Bounty fetch error:', e);
    }
  };

  const handleAcceptBounty = (bounty: any) => {
    triggerAction(`I accept the civic bounty: "${bounty.title}" from ${bounty.giver}`);
    setShowNoticeModal(false);
  };

  const handleContinue = async () => {
    if (!audioManager.isMusicPlaying()) {
      audioManager.playMusic();
      setIsPlayingMusic(true);
      setCurrentTrack(audioManager.getCurrentTrack());
    }
    if (character) {
      setInStartMenu(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/dm/player');
      if (res.ok) {
        const data = await res.json();
        setCharacter(data);
        setInStartMenu(false);
      } else {
        setShowCharModal(true);
      }
    } catch {
      setInStartMenu(false);
    }
  };

  const handleSaveGame = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: saveSlotName,
          characterData: character,
          worldPos: { cellId: currentCellId, rx: regionalPos.rx, ry: regionalPos.ry, lx: localPos.lx, ly: localPos.ly },
          storyState: { campaignState, activeBeat }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowSaveModal(false);
        setSaveSlotName('');
        setMessages(prev => [
          ...prev,
          { sender: 'System', text: `💾 Game Saved: "${data.save.slot_name}" at Sector (${regionalPos.rx}, ${regionalPos.ry})`, type: 'info' }
        ]);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleOpenLoadModal = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/saves');
      if (res.ok) {
        const data = await res.json();
        setSaveSlots(data.saves || []);
        setShowLoadModal(true);
      }
    } catch (err: any) {
      alert(`Could not fetch saves: ${err.message}`);
    }
  };

  const handleLoadGame = async (saveId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dm/load/${saveId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.character) setCharacter(data.character);
        if (data.worldPos?.rx && data.worldPos?.ry) {
          setRegionalPos({ rx: data.worldPos.rx, ry: data.worldPos.ry });
          if (data.worldPos.lx && data.worldPos.ly) {
            setLocalPos({ lx: data.worldPos.lx, ly: data.worldPos.ly });
          }
          await fetchSectorState(data.worldPos.rx, data.worldPos.ry);
        }
        setShowLoadModal(false);
        setInStartMenu(false);
        setMessages(prev => [
          ...prev,
          { sender: 'System', text: `📂 Game Loaded: ${data.character.name} (Lv. ${data.character.level}) at Sector (${data.worldPos.rx}, ${data.worldPos.ry})`, type: 'info' }
        ]);
      }
    } catch (err: any) {
      alert(`Load failed: ${err.message}`);
    }
  };

  const handleDeleteSave = async (saveId: number) => {
    if (!confirm('Are you sure you want to delete this save?')) return;
    try {
      await fetch(`http://localhost:3000/api/dm/saves/${saveId}`, { method: 'DELETE' });
      setSaveSlots(prev => prev.filter(s => s.id !== saveId));
    } catch {}
  };

  // WASD Movement with proximity encounter checks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'Escape') {
        if (!showCharModal && !showSaveModal && !showLoadModal && !showSkillsModal && !showMemorialModal) {
          setInStartMenu(prev => !prev);
          return;
        } else {
          setShowCharModal(false);
          setShowSaveModal(false);
          setShowLoadModal(false);
          setShowSkillsModal(false);
          setShowMemorialModal(false);
          return;
        }
      }

      if (inStartMenu || showCharModal || showSaveModal || showLoadModal || showSkillsModal || showMemorialModal || showDeathModal) return;
      if (!tilemap) return;

      let nx = localPos.lx;
      let ny = localPos.ly;
      let nr_x = regionalPos.rx;
      let nr_y = regionalPos.ry;

      if (e.key === ' ' && combatState.inCombat) {
        e.preventDefault();
        handleEndTurn();
        return;
      }

      if (e.key === 'w' || e.key === 'ArrowUp') ny -= 1;
      if (e.key === 's' || e.key === 'ArrowDown') ny += 1;
      if (e.key === 'a' || e.key === 'ArrowLeft') nx -= 1;
      if (e.key === 'd' || e.key === 'ArrowRight') nx += 1;

      // In combat mode, movement occurs during Phase 1: MOVEMENT (1 Move action per round)
      if (combatState.inCombat && (nx !== localPos.lx || ny !== localPos.ly)) {
        if (combatState.phase !== 'MOVEMENT') {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Movement phase has completed! Declare or execute actions, or press Space to advance.', type: 'error' }]);
          return;
        }
        if (combatState.playerHasMoved) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already completed your 1 Movement action this round! Press Space to enter Declaration Phase.', type: 'error' }]);
          return;
        }
      }

      // Hotkey action triggers (1-5)
      if (e.key === '1') {
        if (!combatState.inCombat) {
          const nearestHostile = injectedNPCs.find(n => n.alive && n.disposition <= -1);
          if (nearestHostile) startCombatMode(nearestHostile);
        }
        handleCombatAction('attack');
        return;
      }
      if (e.key === '2') { handleSneakToggle(); return; }
      if (e.key === '3') { triggerAction(`I inspect and search ${encounterTarget ? encounterTarget.name : 'the surroundings'} for clues, traps, and loot`); return; }
      if (e.key === '4') { triggerAction(`I speak to ${encounterTarget ? encounterTarget.name : 'those nearby'} to negotiate or demand answers`); return; }
      if (e.key === '5') {
        if (combatState.inCombat) {
          handleCombatAction('guard');
        } else {
          triggerAction('I take a tactical pause to assess my wounds and environment');
        }
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        handleToggleTorch();
        return;
      }

      let changedRegion = false;
      let crossedCellBoundary = false;
      let cellDir = '';

      // Screen transition (Zelda style border crossing)
      if (nx < 0) { nx = 255; nr_x -= 1; changedRegion = true; }
      if (nx > 255) { nx = 0; nr_x += 1; changedRegion = true; }
      if (ny < 0) { ny = 255; nr_y -= 1; changedRegion = true; }
      if (ny > 255) { ny = 0; nr_y += 1; changedRegion = true; }

      // Check if regional sector crossed global cell boundaries (0 to 224)
      if (nr_x < 0) { cellDir = 'W'; crossedCellBoundary = true; }
      else if (nr_x >= 225) { cellDir = 'E'; crossedCellBoundary = true; }
      else if (nr_y < 0) { cellDir = 'N'; crossedCellBoundary = true; }
      else if (nr_y >= 225) { cellDir = 'S'; crossedCellBoundary = true; }

      // Collision check
      if (!changedRegion) {
        const tileType = tilemap.grid[ny * tilemap.size + nx];
        if (tileType === 1 || tileType === 2) return; // Tree or deep water
      }

      if (crossedCellBoundary) {
        audioManager.playStep();
        fetch(`http://localhost:3000/api/regional/neighbor?cellId=${currentCellId}&dir=${cellDir}`)
          .then(r => r.json())
          .then(async data => {
            if (data.neighbor) {
              const nextCellId = data.neighbor.id;
              const nextRx = cellDir === 'W' ? 224 : cellDir === 'E' ? 0 : nr_x;
              const nextRy = cellDir === 'N' ? 224 : cellDir === 'S' ? 0 : nr_y;

              // Check if crossing into a lethal Primordial Chaos Flow global cell
              if (data.neighbor.is_flow_cell) {
                setCrossingTargetCell({
                  ...data.neighbor,
                  pendingNextRx: nextRx,
                  pendingNextRy: nextRy,
                  pendingNx: nx,
                  pendingNy: ny
                });
                return;
              }

              setCurrentCellId(nextCellId);
              setRegionalPos({ rx: nextRx, ry: nextRy });
              setLocalPos({ lx: nx, ly: ny });
              await fetch(`http://localhost:3000/api/regional/start/${nextCellId}`, { method: 'POST' });
              await fetchSectorState(nextRx, nextRy, nextCellId);
              setMessages(prev => [
                ...prev,
                {
                  sender: 'The Chronicler',
                  text: `🧭 BORDER CROSSED: Entered Global Cell ${nextCellId} (${data.neighbor.faction_name || 'Wild Frontier'})! Elevation: ${data.neighbor.elevation}m.`,
                  type: 'narrative'
                }
              ]);
            }
          })
          .catch(console.error);
        return;
      }

      if (changedRegion) {
        audioManager.playStep();
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchSectorState(nr_x, nr_y);
        triggerAutoSave('AutoSave - Regional Border');
      } else if (nx !== localPos.lx || ny !== localPos.ly) {
        setLocalPos({ lx: nx, ly: ny });
        audioManager.playStep();
        stepCounterRef.current++;

        if (!combatState.inCombat) {
          runTrophicTick({ lx: nx, ly: ny });
        }

        if (combatState.inCombat) {
          setCombatState(prev => ({ ...prev, playerHasMoved: true }));
        }

        // O(1) Spatial Hash Grid Proximity Queries
        const nearbyNPC = npcSpatialGridRef.current.findNearest(nx, ny, 3, n => n.alive)?.item;
        const nearbyProp = propSpatialGridRef.current.findNearest(nx, ny, 2, p => !p.isDestroyed)?.item;

        // Auto-trigger combat if hostile within 4 tiles
        const nearbyHostile = npcSpatialGridRef.current.findNearest(nx, ny, 4, n => n.alive && n.disposition < 0)?.item;
        if (nearbyHostile && !combatState.inCombat) {
          startCombatMode(nearbyHostile);
        }

        const target = nearbyNPC || nearbyProp;
        if (target) {
          setEncounterTarget(target);
          if (nearbyNPC && nearbyNPC.disposition < 0) {
            audioManager.playBattleMusic();
            setCurrentTrack(audioManager.getCurrentTrack());
            setIsPlayingMusic(true);
          }
          if (target.id !== lastEncounterId.current) {
            lastEncounterId.current = target.id;
            setMessages(prev => [
              ...prev,
              {
                sender: 'GM',
                text: nearbyNPC
                  ? `⚠️ ENCOUNTER: You stand face-to-face with ${nearbyNPC.name}! They eye you with ${nearbyNPC.disposition < 0 ? 'hostile intent' : 'cautious curiosity'}. What do you do?`
                  : `📍 INTERACTION: You approach ${nearbyProp?.name}. Tags: [${(Array.isArray(nearbyProp?.tags) ? nearbyProp.tags : []).join(', ')}]. How do you interact with it?`,
                type: 'narrative'
              }
            ]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localPos, regionalPos, tilemap, injectedNPCs, injectedProps, character, encounterTarget, inStartMenu, showCharModal, showSaveModal, showLoadModal, combatState]);

  // Mouse Click-to-Target on Battlegrid
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const half = Math.floor(VIEWPORT_SIZE / 2);
    const clickDx = Math.floor((e.clientX - rect.left) / TILE_SIZE) - half;
    const clickDy = Math.floor((e.clientY - rect.top) / TILE_SIZE) - half;
    const clickedX = localPos.lx + clickDx;
    const clickedY = localPos.ly + clickDy;

    const clickedNPC = npcSpatialGridRef.current.findNearest(clickedX, clickedY, 1.8, n => n.alive)?.item;
    const clickedProp = propSpatialGridRef.current.findNearest(clickedX, clickedY, 1.8, p => !p.isDestroyed)?.item;

    const target = clickedNPC || clickedProp;
    if (target) {
      setEncounterTarget(target);
      const dist = Math.round(Math.hypot(target.pos[0] - localPos.lx, target.pos[1] - localPos.ly));
      setMessages(prev => [
        ...prev,
        {
          sender: 'Tactical Grid',
          text: `🎯 TARGET LOCKED: ${target.name} at (${target.pos[0]}, ${target.pos[1]}) [${dist} tiles away]. Contextual actions ready!`,
          type: 'info'
        }
      ]);
    }

    // Option 1: Populate and open Context Radial Action Menu
    if (clickedNPC) {
      const opts: RadialActionOption[] = [
        {
          id: 'strike',
          label: 'STRIKE',
          icon: '⚔️',
          color: 'bg-red-900/90 border-red-500 text-red-200 hover:bg-red-800',
          description: 'Physical Strike (1 Stamina)',
          action: () => handleCombatAction('attack')
        },
        {
          id: 'composure',
          label: 'FOCUS',
          icon: '🧠',
          color: 'bg-purple-900/90 border-purple-500 text-purple-200 hover:bg-purple-800',
          description: 'Mental Strike (1 Focus)',
          action: () => handleCombatAction('composure')
        },
        {
          id: 'talk',
          label: 'TALK',
          icon: '💬',
          color: 'bg-blue-900/90 border-blue-500 text-blue-200 hover:bg-blue-800',
          description: 'Speak & Negotiate',
          action: () => triggerAction(`I speak with ${clickedNPC.name}`)
        },
        {
          id: 'sneak_ambush',
          label: 'AMBUSH',
          icon: '🥷',
          color: 'bg-indigo-950/90 border-indigo-500 text-indigo-200 hover:bg-indigo-900',
          description: 'Sneak Ambush (+4 Surprise Advantage)',
          action: () => {
            setIsStealthed(true);
            handleCombatAction('attack');
          }
        },
        {
          id: 'inspect',
          label: 'INSPECT',
          icon: '🔍',
          color: 'bg-amber-950/90 border-amber-500 text-amber-200 hover:bg-amber-900',
          description: 'Examine attributes and weaknesses',
          action: () => triggerAction(`I inspect ${clickedNPC.name} carefully to assess their stance and weapons`)
        }
      ];

      const npcRoleLower = (clickedNPC.role || '').toLowerCase();
      const isMerchant =
        npcRoleLower.includes('merchant') ||
        npcRoleLower.includes('smith') ||
        npcRoleLower.includes('trader') ||
        npcRoleLower.includes('provisioner') ||
        npcRoleLower.includes('innkeeper') ||
        npcRoleLower.includes('apothecary') ||
        clickedNPC.tags?.includes('merchant') ||
        clickedNPC.tags?.includes('trader') ||
        clickedNPC.tags?.includes('vendor') ||
        clickedNPC.tags?.includes('artisan');

      if (isMerchant) {
        opts.push({
          id: 'barter',
          label: 'BARTER',
          icon: '⚖️',
          color: 'bg-amber-600/90 border-amber-400 text-amber-100 hover:bg-amber-500',
          description: 'Trade Wares & Equipment',
          action: () => openBarterModal()
        });
      }

      setRadialMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        targetName: clickedNPC.name,
        targetType: 'npc',
        options: opts
      });
    } else if (clickedProp) {
      const pTags = Array.isArray(clickedProp.tags) ? clickedProp.tags : [];
      const pNameLower = clickedProp.name.toLowerCase();
      const opts: RadialActionOption[] = [
        {
          id: 'search',
          label: 'SEARCH',
          icon: '🔍',
          color: 'bg-amber-950/90 border-amber-500 text-amber-200 hover:bg-amber-900',
          description: 'Search & Inspect',
          action: () => triggerAction(`I search ${clickedProp.name}`)
        }
      ];

      if (pTags.includes('stall') || pTags.includes('market') || pNameLower.includes('stall') || pNameLower.includes('market') || pNameLower.includes('shop')) {
        opts.push({
          id: 'browse_stall',
          label: 'BROWSE',
          icon: '🛒',
          color: 'bg-amber-600/90 border-amber-400 text-amber-100 hover:bg-amber-500',
          description: 'Browse Market Wares',
          action: () => openBarterModal()
        });
      }
      if (pTags.includes('notice_board') || pTags.includes('board') || pNameLower.includes('notice') || pNameLower.includes('bounties')) {
        opts.push({
          id: 'read_notices',
          label: 'NOTICES',
          icon: '📜',
          color: 'bg-amber-700/90 border-amber-400 text-amber-100 hover:bg-amber-600',
          description: 'Read Reeve Bounties',
          action: () => openNoticeModal()
        });
      }
      if (pTags.includes('flora') || pTags.includes('herbs') || pTags.includes('forageable')) {
        opts.push({
          id: 'forage',
          label: 'FORAGE',
          icon: '🌿',
          color: 'bg-emerald-900/90 border-emerald-500 text-emerald-200 hover:bg-emerald-800',
          description: 'Forage medicinal flora',
          action: () => triggerAction(`I forage ${clickedProp.name}`)
        });
      }
      if (pTags.includes('locked') || pTags.includes('chest') || pTags.includes('door') || pTags.includes('container')) {
        opts.push({
          id: 'unlock',
          label: 'OPEN',
          icon: '🔓',
          color: 'bg-yellow-900/90 border-yellow-500 text-yellow-200 hover:bg-yellow-800',
          description: 'Unlock / Open',
          action: () => triggerAction(`I open ${clickedProp.name}`)
        });
      }
      if (pTags.includes('wood') || pTags.includes('flammable') || pTags.includes('dry')) {
        opts.push({
          id: 'ignite',
          label: 'IGNITE',
          icon: '🔥',
          color: 'bg-orange-900/90 border-orange-500 text-orange-200 hover:bg-orange-800',
          description: 'Set on fire',
          action: () => triggerAction(`I ignite ${clickedProp.name} with spark and flame`)
        });
      }
      opts.push({
        id: 'smash',
        label: 'SMASH',
        icon: '💥',
        color: 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700',
        description: 'Smash / Bludgeon',
        action: () => triggerAction(`I smash ${clickedProp.name}`)
      });
      setRadialMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        targetName: clickedProp.name,
        targetType: 'prop',
        options: opts
      });
    } else {
      const tileId = tilemap && clickedX >= 0 && clickedX < tilemap.size && clickedY >= 0 && clickedY < tilemap.size
        ? tilemap.grid[clickedY * tilemap.size + clickedX]
        : 0;
      const opts: RadialActionOption[] = [
        {
          id: 'move',
          label: 'MOVE',
          icon: '🏃',
          color: 'bg-cyan-950/90 border-cyan-500 text-cyan-200 hover:bg-cyan-900',
          description: 'Move toward this tile',
          action: () => handleVirtualMove(Math.sign(clickDx), Math.sign(clickDy))
        },
        {
          id: 'sneak',
          label: 'SNEAK',
          icon: '🥷',
          color: 'bg-indigo-950/90 border-indigo-500 text-indigo-200 hover:bg-indigo-900',
          description: 'Toggle Stealth Stance',
          action: () => handleSneakToggle()
        }
      ];
      if (tileId === 2) {
        opts.push({
          id: 'freeze',
          label: 'FREEZE',
          icon: '❄️',
          color: 'bg-sky-900/90 border-sky-400 text-sky-200 hover:bg-sky-800',
          description: 'Freeze water into ice bridge',
          action: () => triggerAction('I freeze the water into an ice bridge')
        });
      }
      opts.push({
        id: 'camp',
        label: 'REST',
        icon: '⛺',
        color: 'bg-emerald-950/90 border-emerald-500 text-emerald-200 hover:bg-emerald-900',
        description: 'Camp & Recover',
        action: () => triggerAction('I rest at camp to recover HP and composure')
      });
      setRadialMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        targetName: tileId === 2 ? 'Water' : `Tile [${clickedX}, ${clickedY}]`,
        targetType: 'tile',
        options: opts
      });
    }
  };

  // Phase A: Hover Tile Telemetry Tooltip
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !tilemap) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const half = Math.floor(VIEWPORT_SIZE / 2);
    const hoverDx = Math.floor((e.clientX - rect.left) / TILE_SIZE) - half;
    const hoverDy = Math.floor((e.clientY - rect.top) / TILE_SIZE) - half;
    const hx = localPos.lx + hoverDx;
    const hy = localPos.ly + hoverDy;

    if (hx >= 0 && hx < tilemap.size && hy >= 0 && hy < tilemap.size) {
      const tile = tilemap.grid[hy * tilemap.size + hx];
      const terrainNames: Record<number, string> = {
        0: 'Plains / Grassland',
        1: 'Dense Forest Canopy',
        2: 'Flowing Waterway',
        3: 'Mountain Ridge / Cliff',
        4: 'Cobblestone Road',
        5: 'Fortified Wall',
        6: 'Arcane Leyline Ward',
        7: 'Ancient Megalith Ruin',
        8: 'Arid Sand Dunes',
        9: 'Chaos Blight',
        10: 'Glacial Ice',
        11: 'Wetland Mud',
        12: 'Abyss Trench'
      };
      const foundNPC = npcSpatialGridRef.current.getExact(hx, hy, n => n.alive);
      const foundProp = propSpatialGridRef.current.getExact(hx, hy, p => !p.isDestroyed);

      let cover = 'OPEN';
      if (foundProp) {
        cover = foundProp.tags.some(t => t.includes('cover_heavy') || t.includes('stone') || t.includes('wall'))
          ? 'FULL COVER (+4)'
          : 'HALF COVER (+2)';
      }

      setHoverTile({
        x: hx,
        y: hy,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        tileName: terrainNames[tile] || 'Wilderness',
        coverLevel: cover,
        moveCost: (tile === 1 || tile === 2 || tile === 3 || tile === 5 || tile === 12) ? 'BLOCKED' : '1 AP',
        entityName: foundNPC ? `${foundNPC.name} (${foundNPC.role})` : foundProp ? foundProp.name : undefined
      });
    } else {
      setHoverTile(null);
    }
  };

  // Render Canvas with Pixel Art Tiles and Sprites from /gfx
  useEffect(() => {
    let animId: number;

    const render = () => {
      if (!canvasRef.current || !tilemap || !manifest) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Enable nearest-neighbor scaling for crisp retro pixel art
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Phase A: Sub-tile hero position lerp
      const targetX = localPos.lx;
      const targetY = localPos.ly;
      const diffX = targetX - visualHeroPos.current.x;
      const diffY = targetY - visualHeroPos.current.y;
      if (Math.abs(diffX) > 0.01 || Math.abs(diffY) > 0.01) {
        visualHeroPos.current.x += diffX * 0.4;
        visualHeroPos.current.y += diffY * 0.4;
      } else {
        visualHeroPos.current.x = targetX;
        visualHeroPos.current.y = targetY;
      }

      // Phase B: Terrain Offscreen Cache Validation
      const sectorKey = `${regionalPos.rx}_${regionalPos.ry}_${manifest.global_context.biome_id}`;
      if (!terrainCacheRef.current.isCached(sectorKey)) {
        terrainCacheRef.current.init(VIEWPORT_SIZE * TILE_SIZE, VIEWPORT_SIZE * TILE_SIZE);
        terrainCacheRef.current.markCached(sectorKey);
      }

    const half = Math.floor(VIEWPORT_SIZE / 2);

    const getTileCoords = (tile: number, biomeId: number): [number, number] => {
      // Coordinates on Overworld.png (16x16 grid: 40 cols x 36 rows)
      if (tile === 0) {
        if (biomeId === 1 || biomeId === 3) return [2, 14]; // Desert/Savanna sand
        if (biomeId === 10 || biomeId === 11) return [22, 0]; // Tundra/Glacier snow
        return [0, 0]; // Lush grass
      }
      if (tile === 1) return [32, 1]; // Tree canopy
      if (tile === 2) return [16, 0]; // Water
      if (tile === 3) return [12, 0]; // Mountain cliff
      if (tile === 4) return [26, 20]; // Cobblestone / Dirt road
      if (tile === 5) return [6, 0]; // Structure wall
      if (tile === 6) return [13, 0]; // Arcane rune
      if (tile === 7) return [14, 0]; // Danger / Ruins
      if (tile === 8) return [3, 23]; // Arid desert
      if (tile === 9) return [7, 0]; // Blight / Corruption
      if (tile === 10) return [23, 0]; // Ice / Snow
      if (tile === 11) return [31, 3]; // Marsh mud
      if (tile === 12) return [12, 1]; // Abyss rock
      return [0, 0];
    };

    const biomePalettes: Record<number, [string, string]> = {
      0: ['#1e3a8a', '#1e40af'],
      1: ['#fde047', '#a16207'],
      2: ['#d6d3d1', '#78716c'],
      3: ['#fcd34d', '#b45309'],
      4: ['#a3e635', '#4d7c0f'],
      5: ['#bef264', '#65a30d'],
      6: ['#86efac', '#166534'],
      7: ['#6ee7b7', '#065f46'],
      8: ['#4ade80', '#14532d'],
      9: ['#22c55e', '#064e3b'],
      10: ['#e0f2fe', '#94a3b8'],
      11: ['#f8fafc', '#cbd5e1'],
      12: ['#14b8a6', '#0f766e']
    };

    const hasOverworldGfx = !!(overworldImgRef.current && overworldImgRef.current.complete && overworldImgRef.current.naturalWidth > 0);
    const hasObjectsGfx = !!(objectsImgRef.current && objectsImgRef.current.complete && objectsImgRef.current.naturalWidth > 0);

    // Option 2 & Milestone 1: Dynamic Perception Field of View (FOV) & Torch Illumination
    const playerPerception = character?.derived?.perception ?? character?.stats?.perception ?? 10;
    const visionRadius = calculateVisionRadius(playerPerception, isTorchLit);

    // Multi-source lighting: Player + Active campfires/hearths in the sector
    const lightSources: Array<{ x: number; y: number; radius: number }> = [
      { x: localPos.lx, y: localPos.ly, radius: visionRadius }
    ];

    // Find active fire / hearth props that cast ambient light
    injectedProps.forEach(prop => {
      if (!prop.isDestroyed) {
        const lower = prop.name.toLowerCase();
        const isFire = prop.tags.includes('fire') || prop.tags.includes('burning') || prop.tags.includes('hearth') ||
                       lower.includes('hearth') || lower.includes('campfire') || lower.includes('spit') || lower.includes('forge');
        if (isFire) {
          lightSources.push({ x: prop.pos[0], y: prop.pos[1], radius: 4 });
        }
      }
    });

    const visibleTiles = computeMultiSourceFieldOfView(lightSources, tilemap, injectedProps);

    // Record newly seen tiles into exploration memory
    visibleTiles.forEach(coord => exploredTilesRef.current.add(coord));

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = localPos.lx + dx;
        const ty = localPos.ly + dy;

        const screenX = (dx + half) * TILE_SIZE;
        const screenY = (dy + half) * TILE_SIZE;

        if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) {
          ctx.fillStyle = '#0b0f19';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const tileCoord = `${tx},${ty}`;
        const isVisible = visibleTiles.has(tileCoord);
        const isExplored = exploredTilesRef.current.has(tileCoord);

        if (!isVisible && !isExplored) {
          ctx.fillStyle = '#050811';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const tile = tilemap.grid[ty * tilemap.size + tx];
        const biomeId = manifest.global_context.biome_id;
        const palette = biomePalettes[biomeId] || ['#4ade80', '#166534'];

        if (hasOverworldGfx) {
          const [srcCol, srcRow] = getTileCoords(tile, biomeId);
          // If tree, draw underlying terrain first
          if (tile === 1) {
            const [gCol, gRow] = getTileCoords(0, biomeId);
            ctx.drawImage(overworldImgRef.current!, gCol * 16, gRow * 16, 16, 16, screenX, screenY, TILE_SIZE, TILE_SIZE);
          }
          ctx.drawImage(
            overworldImgRef.current!,
            srcCol * 16,
            srcRow * 16,
            16,
            16,
            screenX,
            screenY,
            TILE_SIZE,
            TILE_SIZE
          );
        } else {
          // Color fallback if image not loaded yet
          if (tile === 0) ctx.fillStyle = palette[0];
          else if (tile === 1) ctx.fillStyle = palette[1];
          else if (tile === 2) ctx.fillStyle = '#3b82f6';
          else if (tile === 3) ctx.fillStyle = '#a8a29e';
          else if (tile === 4) ctx.fillStyle = '#451a03';
          else if (tile === 5) ctx.fillStyle = '#1c1917';
          else if (tile === 6) ctx.fillStyle = '#c026d3';
          else if (tile === 7) ctx.fillStyle = '#7f1d1d';
          else if (tile === 8) ctx.fillStyle = '#f97316';
          else if (tile === 9) ctx.fillStyle = '#991b1b';
          else if (tile === 10) ctx.fillStyle = '#f3f4f6';
          else if (tile === 11) ctx.fillStyle = '#78350f';
          else if (tile === 12) ctx.fillStyle = '#111827';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        // Shroud previously explored tiles not currently in active vision
        if (!isVisible && isExplored) {
          ctx.fillStyle = 'rgba(5, 8, 17, 0.65)';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 0a. Primordial Chaos Flow Luminescent Torrent Overlay
    if (chaosFlowTelemetry && (chaosFlowTelemetry.intersected || chaosFlowTelemetry.distToFlow <= 60)) {
      ctx.save();
      const timeSec = Date.now() * 0.002;
      const surge = chaosFlowTelemetry.nearestFlow?.currentSurge || 1.2;
      const flowWidth = Math.max(4, Math.min(8, Math.round((chaosFlowTelemetry.nearestFlow?.currentWidth || 25) / 4)));

      for (let y = 0; y < VIEWPORT_SIZE; y++) {
        const ty = localPos.ly - half + y;
        const waveOffset = Math.sin((ty * 0.08) + timeSec) * 4;
        const centerCol = 128 + waveOffset;

        for (let w = -flowWidth; w <= flowWidth; w++) {
          const tx = Math.round(centerCol + w);
          const screenX = (tx - localPos.lx + half) * TILE_SIZE;
          const screenY = (ty - localPos.ly + half) * TILE_SIZE;

          if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
            const edgeRatio = 1.0 - (Math.abs(w) / flowWidth);
            const pulse = (Math.sin(timeSec * 3 + ty * 0.1) * 0.15) + 0.35;
            const alpha = Math.min(0.65, edgeRatio * pulse * Math.min(1.5, surge));

            ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            if (Math.abs(w) <= 1 && Math.random() < 0.2) {
              ctx.fillStyle = `rgba(253, 224, 71, ${alpha + 0.25})`;
              ctx.fillRect(screenX + 3, screenY + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            }
          }
        }
      }

      // If near narrow spot, render crossing stepping stones
      if (chaosFlowTelemetry.nearNarrowSpot) {
        for (let sy = 126; sy <= 130; sy++) {
          const screenX = (128 - localPos.lx + half) * TILE_SIZE;
          const screenY = (sy - localPos.ly + half) * TILE_SIZE;
          if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // 0b. Phase C: Tactical Movement Reachability Overlay (during Movement Phase)
    if (combatState.inCombat && combatState.phase === 'MOVEMENT' && !combatState.playerHasMoved && canvasRef.current) {
      const moveDistance = combatState.participants.get('player')?.moveRange || 4;
      const reachable = getReachableTiles(localPos.lx, localPos.ly, moveDistance, (tx, ty) => {
        if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) return false;
        const t = tilemap.grid[ty * tilemap.size + tx];
        return t !== 1 && t !== 2 && t !== 3 && t !== 5 && t !== 12;
      });

      ctx.save();
      reachable.forEach(({ x, y }) => {
        const sx = (x - localPos.lx + half) * TILE_SIZE;
        const sy = (y - localPos.ly + half) * TILE_SIZE;
        if (sx >= 0 && sx < canvasRef.current!.width && sy >= 0 && sy < canvasRef.current!.height) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      });
      ctx.restore();
    }

    // 1. Render Injected Props with Pixel Art Sprites
    const getPropCoords = (name: string, tags: string[]): [number, number] => {
      const lower = name.toLowerCase();
      if (tags.includes('fire') || tags.includes('burning') || lower.includes('fire') || lower.includes('torch') || lower.includes('hearth') || lower.includes('spit') || lower.includes('campfire')) {
        return [4, 3]; // Campfire flame
      }
      if (tags.includes('water') || tags.includes('water_source') || tags.includes('drinkable') || lower.includes('fountain') || lower.includes('well') || lower.includes('spring') || lower.includes('basin') || lower.includes('trough')) {
        return [16, 0]; // Water fountain / spring
      }
      if (tags.includes('crafting') || tags.includes('forge') || lower.includes('anvil') || lower.includes('forge') || lower.includes('blacksmith') || lower.includes('ore') || lower.includes('grindstone')) {
        return [13, 2]; // Anvil / forge / metal crafting
      }
      if (tags.includes('notice_board') || tags.includes('board') || lower.includes('notice') || lower.includes('board') || lower.includes('sign') || lower.includes('post') || lower.includes('signpost')) {
        return [5, 0]; // Signpost / bulletin board
      }
      if (tags.includes('bone') || tags.includes('remains') || lower.includes('skull') || lower.includes('skeleton') || lower.includes('remains') || lower.includes('ribs') || lower.includes('bones')) {
        return [14, 0]; // Bones / skull / remains
      }
      if (tags.includes('climbable') || tags.includes('cliff') || tags.includes('elevation') || lower.includes('cliff') || lower.includes('precipice') || lower.includes('ridge') || lower.includes('bluff') || lower.includes('crag')) {
        return [12, 0]; // Cliff / precipice / high ledge
      }
      if (tags.includes('trap') || tags.includes('mechanism') || lower.includes('trap') || lower.includes('tripwire') || lower.includes('rig') || lower.includes('snare')) {
        return [15, 0]; // Trap / mechanism
      }
      if (tags.includes('altar') || tags.includes('sacred') || lower.includes('altar') || lower.includes('shrine') || lower.includes('relic')) {
        return [10, 4]; // Sacred stone altar
      }
      if (tags.includes('door') || tags.includes('gate') || lower.includes('door') || lower.includes('gate') || lower.includes('portcullis') || lower.includes('hatch')) {
        return [10, 0]; // Door / gate / portcullis
      }
      if (tags.includes('magic') || tags.includes('runes') || lower.includes('crystal') || lower.includes('wardstone') || lower.includes('monolith')) {
        return [2, 5]; // Magic crystal / rune
      }
      if (tags.includes('chest') || lower.includes('chest') || lower.includes('box') || lower.includes('footlocker') || lower.includes('cache') || lower.includes('sarcophagus')) {
        return [0, 0]; // Wooden treasure chest
      }
      if (tags.includes('barrel') || lower.includes('barrel') || lower.includes('keg') || lower.includes('cask')) {
        return [1, 0]; // Wooden barrel
      }
      if (tags.includes('flora') || tags.includes('herbs') || tags.includes('forageable') || lower.includes('lichen') || lower.includes('flower') || lower.includes('fern') || lower.includes('plant') || lower.includes('reed') || lower.includes('bramble') || lower.includes('roots')) {
        return [3, 4]; // Wild flora / herbs
      }
      if (tags.includes('stone') || lower.includes('pillar') || lower.includes('monolith') || lower.includes('milestone') || lower.includes('cairn') || lower.includes('rock') || lower.includes('boulder')) {
        return [8, 4]; // Ancient stone monument / megalith
      }
      if (tags.includes('wood') || lower.includes('wagon') || lower.includes('cart') || lower.includes('barricade') || lower.includes('trunk') || lower.includes('snag') || lower.includes('stall') || lower.includes('rack')) {
        return [6, 2]; // Wooden wagon / barricade / stall
      }
      return [0, 0];
    };

    injectedProps.forEach(prop => {
      if (prop.isDestroyed) return;
      const propCoord = `${prop.pos[0]},${prop.pos[1]}`;
      const isPVisible = visibleTiles.has(propCoord);
      const isPExplored = exploredTilesRef.current.has(propCoord);
      if (!isPVisible && !isPExplored) return;

      const screenX = (prop.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (prop.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        const tags = Array.isArray(prop.tags) ? prop.tags : [];

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(screenX + TILE_SIZE / 2, screenY + TILE_SIZE - 2, TILE_SIZE / 2 - 3, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (hasObjectsGfx) {
          const [propCol, propRow] = getPropCoords(prop.name, tags);
          ctx.drawImage(
            objectsImgRef.current!,
            propCol * 16,
            propRow * 16,
            16,
            16,
            screenX,
            screenY,
            TILE_SIZE,
            TILE_SIZE
          );
        } else {
          ctx.fillStyle = tags.includes('fire') ? '#ea580c' : '#78350f';
          ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#fde047';
          ctx.strokeRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }

        // Shroud if explored but not actively visible
        if (!isPVisible && isPExplored) {
          ctx.fillStyle = 'rgba(5, 8, 17, 0.65)';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        // Prop Label badge with dark backing
        const shortName = prop.name.split(' ')[0];
        ctx.font = 'bold 8px monospace';
        const textWidth = ctx.measureText(shortName).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(screenX + TILE_SIZE / 2 - textWidth / 2 - 2, screenY - 9, textWidth + 4, 9);
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(shortName, screenX + TILE_SIZE / 2, screenY - 2);
      }
    });

    // 2. Render Injected NPCs with High-Contrast Tokens & Retro Animal Sprites
    injectedNPCs.forEach(npc => {
      if (!npc.alive) return;
      const npcCoord = `${npc.pos[0]},${npc.pos[1]}`;
      // Dynamic entities are strictly hidden in the shroud of war
      if (!visibleTiles.has(npcCoord)) return;

      // Stealth opposed perception contest check
      if (npc.isStealthed) {
        const dist = Math.hypot(npc.pos[0] - localPos.lx, npc.pos[1] - localPos.ly);
        if (dist > 1.5) {
          const detected = resolveStealthContest(npc.stealth || 10, playerPerception, false);
          if (!detected) return;
        }
      }

      const screenX = (npc.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (npc.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        const ringColor = npc.disposition < 0 ? '#ef4444' : npc.disposition > 0 ? '#22c55e' : '#3b82f6';

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(screenX + TILE_SIZE / 2, screenY + TILE_SIZE - 1, TILE_SIZE / 2 - 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (animalSpritesImgRef.current && animalSpritesImgRef.current.complete) {
          const { col, row } = getNPCSpriteCoords(npc);
          ctx.imageSmoothingEnabled = false;
          // Render animal sprite from 128x128 grid
          ctx.drawImage(
            animalSpritesImgRef.current,
            col * 128, row * 128, 128, 128,
            screenX - 2, screenY - 4, TILE_SIZE + 4, TILE_SIZE + 4
          );

          // Subtle disposition halo ring
          ctx.beginPath();
          ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 + 1, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = ringColor;
          ctx.stroke();
        } else {
          // Fallback token body
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = ringColor;
          ctx.stroke();

          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(npc.disposition < 0 ? '⚔️' : npc.disposition > 0 ? '🤝' : '👤', screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 + 4);
        }

        // Nameplate with black backing
        const npcShort = npc.name.split(' ')[0];
        ctx.font = 'bold 8.5px sans-serif';
        const nWidth = ctx.measureText(npcShort).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(screenX + TILE_SIZE / 2 - nWidth / 2 - 2, screenY - 10, nWidth + 4, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(npcShort, screenX + TILE_SIZE / 2, screenY - 2);
      }
    });

    // 3. Draw Player Token at exact viewport center with Animal Kin Sprite
    const px = half * TILE_SIZE;
    const py = half * TILE_SIZE;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE, TILE_SIZE / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Option 2: Shimmering Indigo Stealth Shroud when Stealthed
    if (isStealthed) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(79, 70, 229, 0.28)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#818cf8';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }

    if (animalSpritesImgRef.current && animalSpritesImgRef.current.complete) {
      const walkFrame = Math.abs(localPos.lx + localPos.ly);
      const { col, row } = getAnimalSpriteCoords(
        character?.kingdom,
        character?.species || character?.lineage,
        walkFrame
      );
      ctx.imageSmoothingEnabled = false;
      // Draw crisp 128x128 animal sprite scaled to player tile
      ctx.drawImage(
        animalSpritesImgRef.current,
        col * 128, row * 128, 128, 128,
        px - 3, py - 6, TILE_SIZE + 6, TILE_SIZE + 6
      );

      // Heroic Gold aura rings
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();
    } else {
      // Fallback dark circular token backing
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.fill();

      // Heroic Gold aura rings
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Hero glyph / species emoji
      const heroIcon = character?.species?.includes('Bear') ? '🐻'
        : character?.kingdom === 'Reptile' ? '🦎'
        : character?.kingdom === 'Avian' ? '🦅'
        : character?.kingdom === 'Aquatic' ? '🐙'
        : character?.kingdom === 'Insect' ? '🐝'
        : character?.kingdom === 'Plant' ? '🌿'
        : '🐺';

      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(heroIcon, px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4);
    }

    // "YOU" Hero Badge
    ctx.font = 'bold 9px sans-serif';
    const youWidth = ctx.measureText('YOU').width;
    ctx.fillStyle = isStealthed ? '#4338ca' : '#b45309';
    ctx.fillRect(px + TILE_SIZE / 2 - youWidth / 2 - 3, py - 12, youWidth + 6, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillText('YOU', px + TILE_SIZE / 2, py - 4);

    if (isStealthed) {
      ctx.font = 'bold 8px monospace';
      const snkText = '🥷 STEALTHED';
      const snkWidth = ctx.measureText(snkText).width;
      ctx.fillStyle = 'rgba(30, 27, 75, 0.85)';
      ctx.fillRect(px + TILE_SIZE / 2 - snkWidth / 2 - 3, py - 23, snkWidth + 6, 9);
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText(snkText, px + TILE_SIZE / 2, py - 16);
    }

    // Milestone 2: Diurnal Night & Twilight Ambient Canvas Atmosphere
    const diurnal = getDiurnalPhase(calendarState?.tick || 1, stepCounterRef.current);
    if (diurnal.ambientDarkness > 0.05 && canvasRef.current) {
      ctx.save();
      ctx.fillStyle = diurnal.tintColor;
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.restore();
    }

    // Milestone 1: Dynamic Torch Lighting & Campfire Radial Cutouts
    if (isTorchLit) {
      const now = performance.now();
      const flicker = Math.sin(now * 0.007) * 4 + Math.cos(now * 0.013) * 2;
      const torchRadiusPx = Math.max(40, (visionRadius * TILE_SIZE * 0.72) + flicker);

      const centerX = px + TILE_SIZE / 2;
      const centerY = py + TILE_SIZE / 2;

      ctx.save();
      const torchGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        TILE_SIZE * 0.35,
        centerX,
        centerY,
        torchRadiusPx
      );
      torchGrad.addColorStop(0, 'rgba(255, 190, 60, 0.32)');
      torchGrad.addColorStop(0.35, 'rgba(245, 130, 25, 0.18)');
      torchGrad.addColorStop(0.7, 'rgba(190, 60, 10, 0.06)');
      torchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = torchGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, torchRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      // Flame icon badge above head
      ctx.font = 'bold 8.5px monospace';
      const torchText = '🔥 TORCH LIT';
      const torchWidth = ctx.measureText(torchText).width;
      ctx.fillStyle = 'rgba(120, 53, 15, 0.9)';
      ctx.fillRect(px + TILE_SIZE / 2 - torchWidth / 2 - 3, py - 34, torchWidth + 6, 9);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(torchText, px + TILE_SIZE / 2, py - 27);

      ctx.restore();
    }

    // Dynamic light glow from visible campfires/hearths
    injectedProps.forEach(prop => {
      if (!prop.isDestroyed) {
        const lower = prop.name.toLowerCase();
        const isFire = prop.tags.includes('fire') || prop.tags.includes('burning') || prop.tags.includes('hearth') ||
                       lower.includes('hearth') || lower.includes('campfire') || lower.includes('spit') || lower.includes('forge');
        if (isFire) {
          const dx = prop.pos[0] - localPos.lx;
          const dy = prop.pos[1] - localPos.ly;
          if (Math.abs(dx) <= half && Math.abs(dy) <= half) {
            const hx = (dx + half) * TILE_SIZE + TILE_SIZE / 2;
            const hy = (dy + half) * TILE_SIZE + TILE_SIZE / 2;
            const now = performance.now();
            const hFlicker = Math.sin(now * 0.005 + prop.pos[0]) * 3;
            const hearthRadius = (TILE_SIZE * 3.5) + hFlicker;

            ctx.save();
            const hGrad = ctx.createRadialGradient(hx, hy, TILE_SIZE * 0.3, hx, hy, hearthRadius);
            hGrad.addColorStop(0, 'rgba(255, 170, 40, 0.26)');
            hGrad.addColorStop(0.5, 'rgba(230, 90, 15, 0.12)');
            hGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = hGrad;
            ctx.beginPath();
            ctx.arc(hx, hy, hearthRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    });

    // 4. Target Lock Bracket (if an entity or prop is currently targeted)
    if (encounterTarget && canvasRef.current) {
      const targetScreenX = (encounterTarget.pos[0] - localPos.lx + half) * TILE_SIZE;
      const targetScreenY = (encounterTarget.pos[1] - localPos.ly + half) * TILE_SIZE;
      if (targetScreenX >= 0 && targetScreenX < canvasRef.current.width && targetScreenY >= 0 && targetScreenY < canvasRef.current.height) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        const pad = 2;
        const corner = 6;
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(targetScreenX - pad, targetScreenY - pad + corner);
        ctx.lineTo(targetScreenX - pad, targetScreenY - pad);
        ctx.lineTo(targetScreenX - pad + corner, targetScreenY - pad);
        // Top-right corner
        ctx.moveTo(targetScreenX + TILE_SIZE + pad - corner, targetScreenY - pad);
        ctx.lineTo(targetScreenX + TILE_SIZE + pad, targetScreenY - pad);
        ctx.lineTo(targetScreenX + TILE_SIZE + pad, targetScreenY - pad + corner);
        // Bottom-left corner
        ctx.moveTo(targetScreenX - pad, targetScreenY + TILE_SIZE + pad - corner);
        ctx.lineTo(targetScreenX - pad, targetScreenY + TILE_SIZE + pad);
        ctx.lineTo(targetScreenX - pad + corner, targetScreenY + TILE_SIZE + pad);
        // Bottom-right corner
        ctx.moveTo(targetScreenX + TILE_SIZE + pad - corner, targetScreenY + TILE_SIZE + pad);
        ctx.lineTo(targetScreenX + TILE_SIZE + pad, targetScreenY + TILE_SIZE + pad);
        ctx.lineTo(targetScreenX + TILE_SIZE + pad, targetScreenY + TILE_SIZE + pad - corner);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4b. Phase C: Tactical Line of Sight (LOS) Ray and Cover Badge
    if (combatState.inCombat && encounterTarget && canvasRef.current) {
      const los = evaluateLineOfSight(localPos.lx, localPos.ly, encounterTarget.pos[0], encounterTarget.pos[1], injectedProps, tilemap);
      const tx = (encounterTarget.pos[0] - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2;
      const ty = (encounterTarget.pos[1] - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = los.hasLos ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2;
      ctx.moveTo(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      if (los.coverLevel !== 'NONE') {
        ctx.fillStyle = los.coverLevel === 'FULL' ? '#ef4444' : '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          los.coverLevel === 'FULL' ? '🛡️ FULL (+4)' : '🛡️ HALF (+2)',
          tx,
          ty - TILE_SIZE / 2 - 10
        );
      }
      ctx.restore();
    }

    // 5. Tactical Radial Darkness Vignette (Lighting & Field of View)
    if (canvasRef.current) {
      const centerX = px + TILE_SIZE / 2;
      const centerY = py + TILE_SIZE / 2;
      const grad = ctx.createRadialGradient(
        centerX, centerY, 3.5 * TILE_SIZE,
        centerX, centerY, 8.5 * TILE_SIZE
      );
      grad.addColorStop(0, 'rgba(5, 8, 17, 0)');
      grad.addColorStop(0.45, 'rgba(5, 8, 17, 0.18)');
      grad.addColorStop(0.75, 'rgba(5, 8, 17, 0.6)');
      grad.addColorStop(1, 'rgba(5, 8, 17, 0.93)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    // 6. Dynamic Biome Weather Particles
    if (canvasRef.current && manifest?.global_context) {
      const biomeId = manifest.global_context.biome_id;
      // Rain / Mist: Biomes 6 (Woodland), 7 (Boreal Forest), 12 (Wetland Swamp)
      if (biomeId === 6 || biomeId === 7 || biomeId === 12) {
        ctx.save();
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
        ctx.lineWidth = 1.2;
        const numDrops = 35;
        for (let i = 0; i < numDrops; i++) {
          const seed = (i * 997 + localPos.lx * 13 + localPos.ly * 37) % 10000;
          const rx = (seed * 47) % canvasRef.current.width;
          const ry = (seed * 89) % canvasRef.current.height;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry + 10);
          ctx.stroke();
        }
        ctx.restore();
      }
      // Snow / Frost: Biomes 10 (Tundra), 11 (Glacier)
      else if (biomeId === 10 || biomeId === 11) {
        ctx.save();
        ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
        const numFlakes = 30;
        for (let i = 0; i < numFlakes; i++) {
          const seed = (i * 883 + localPos.lx * 19 + localPos.ly * 43) % 10000;
          const rx = (seed * 53) % canvasRef.current.width;
          const ry = (seed * 71) % canvasRef.current.height;
          const size = (seed % 3) + 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      // Desert Dust / Sand Motes: Biomes 1 (Hot Desert), 2 (Cold Desert), 3 (Savanna)
      else if (biomeId === 1 || biomeId === 2 || biomeId === 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(252, 211, 77, 0.28)';
        const numDust = 25;
        for (let i = 0; i < numDust; i++) {
          const seed = (i * 769 + localPos.lx * 29 + localPos.ly * 53) % 10000;
          const rx = (seed * 61) % canvasRef.current.width;
          const ry = (seed * 79) % canvasRef.current.height;
          ctx.beginPath();
          ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 6b. Chaos Storm Weather Overlay (Aetheric Storms & Volatile Atmosphere)
    if (canvasRef.current && activeChaosSurge?.stormActive) {
      const stormType = activeChaosSurge.stormType || activeChaosSurge.activeSurge?.name || 'Aetheric Storm';
      ctx.save();
      const timeMs = Date.now();

      // Shimmering Atmospheric Chaos Tint
      const isViolet = /flux|nexus|motus|dragon|void/i.test(stormType);
      const isCrimson = /blood|omen|mass|war/i.test(stormType);

      ctx.fillStyle = isViolet
        ? 'rgba(168, 85, 247, 0.08)'
        : isCrimson
        ? 'rgba(239, 68, 68, 0.08)'
        : 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Inverted Gravity Rain or Shimmering Motes (falling UP or swirling)
      const numChaosParticles = 35;
      for (let i = 0; i < numChaosParticles; i++) {
        const seed = (i * 941 + Math.floor(timeMs / 40)) % 10000;
        const px = (seed * 67 + (timeMs * 0.05 * (i % 2 === 0 ? 1 : -1))) % canvasRef.current.width;
        // Inverted rain: moving upward!
        const py = (canvasRef.current.height - ((timeMs * 0.12 * ((i % 5) + 1) + seed * 31) % canvasRef.current.height));

        ctx.fillStyle = isViolet
          ? (i % 2 === 0 ? 'rgba(216, 180, 254, 0.7)' : 'rgba(192, 132, 252, 0.9)')
          : isCrimson
          ? (i % 2 === 0 ? 'rgba(252, 165, 165, 0.7)' : 'rgba(248, 113, 113, 0.9)')
          : (i % 2 === 0 ? 'rgba(186, 230, 253, 0.7)' : 'rgba(125, 211, 252, 0.9)');

        ctx.beginPath();
        ctx.arc(Math.abs(px), Math.abs(py), (i % 3) + 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Occasional lightning aetheric arc
        if (i === 0 && (timeMs % 3000 < 120)) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(canvasRef.current.width * 0.2, 0);
          ctx.lineTo(canvasRef.current.width * 0.35, canvasRef.current.height * 0.4);
          ctx.lineTo(canvasRef.current.width * 0.5, canvasRef.current.height);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 7. Phase A: Floating Combat Text Particles (Damage, Procs, Deflections)
    particleManagerRef.current.updateAndDraw(ctx);

    // Continuous 60 FPS animation ticker when particles are active or hero is walking
    const isWalking = Math.abs(localPos.lx - visualHeroPos.current.x) > 0.01 || Math.abs(localPos.ly - visualHeroPos.current.y) > 0.01;
    if (particleManagerRef.current.hasActiveParticles() || isWalking || activeChaosSurge?.stormActive) {
      animId = requestAnimationFrame(render);
    }
  };

  render();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}, [localPos, tilemap, manifest, injectedProps, injectedNPCs, gfxLoaded, character, encounterTarget, combatState, isStealthed, activeChaosSurge]);

  // --- PHASE C: TACTICAL TURN-BASED COMBAT ENGINE (STAMINA & FOCUS POOLS + 3-PHASE ROUND) ---

  const startCombatMode = (initialFoe?: InjectedNPC) => {
    if (combatState.inCombat) return;

    // 1. Calculate player's 12-stat derived values
    const stats: Record<string, number> = {
      might: Number(character?.might) || 5,
      endurance: Number(character?.endurance) || 5,
      reflex: Number(character?.reflex) || 5,
      finesse: Number(character?.finesse) || 5,
      vitality: Number(character?.vitality) || 5,
      fortitude: Number(character?.fortitude) || 5,
      knowledge: Number(character?.knowledge) || 5,
      logic: Number(character?.logic) || 5,
      awareness: Number(character?.awareness) || 5,
      intuition: Number(character?.intuition) || 5,
      charm: Number(character?.charm) || 5,
      willpower: Number(character?.willpower) || 5,
    };

    const get = (k: string) => stats[k] || 5;
    const ratioBM = (b1: string, b2: string, m1: string) => get(b1) + get(b2) + Math.round(get(m1) / 2);
    const ratioMB = (m1: string, m2: string, b1: string) => get(m1) + get(m2) + Math.round(get(b1) / 2);

    const movementSpeed = ratioBM('reflex', 'finesse', 'intuition');
    const resilience = ratioBM('fortitude', 'endurance', 'willpower');
    const perception = ratioMB('awareness', 'knowledge', 'vitality');
    const stealth = ratioMB('logic', 'charm', 'might');
    const totalStamina = ratioBM('might', 'finesse', 'intuition');
    const totalFocus = ratioMB('logic', 'charm', 'reflex');

    // 2. Equipment loadout fees & pool tier derivation
    const weaponMod = Number(character?.weapon_mod) || 1;
    const armorMod = Number(character?.armor_mod) || 1;
    const weaponFee = Math.max(1, weaponMod + (Number(character?.weapon_damage_bonus) || 1));
    const armorFee = Math.max(1, armorMod + (Number(character?.armor_dr) || 1));
    const totalStaminaFee = weaponFee + armorFee;
    const totalFocusFee = Math.max(1, Math.floor(armorFee / 2));

    const staminaTier = calculatePoolTier(totalStaminaFee, totalStamina);
    const focusTier = calculatePoolTier(totalFocusFee, totalFocus);
    const moveRange = calculateMoveRange(movementSpeed);

    const parts = new Map<string, CombatParticipant>();
    parts.set('player', {
      id: 'player',
      name: character?.name || 'Hero',
      pos: [localPos.lx, localPos.ly],
      isPlayer: true,
      hp: Number(character?.current_hp) || 20,
      maxHp: Number(character?.max_hp) || 20,
      composure: Number(character?.composure) || 15,
      maxComposure: Number(character?.max_composure) || 15,
      movementSpeed,
      perception,
      stealth,
      resilience,
      moveRange,
      hasMoved: false,
      hasUsedStaminaAction: false,
      hasUsedFocusAction: false,
      currentStamina: staminaTier.pool,
      maxStaminaPool: staminaTier.pool,
      staminaTier: staminaTier.tier,
      staminaRegenRate: staminaTier.regenRate,
      currentFocus: focusTier.pool,
      maxFocusPool: focusTier.pool,
      focusTier: focusTier.tier,
      focusRegenRate: focusTier.regenRate,
      ap: staminaTier.pool,
      maxAp: staminaTier.pool,
      initiative: movementSpeed,
      statAffinity: character?.institution || 'might',
      equippedWeapon: character?.equipped_weapon,
      equippedArmor: character?.equipped_armor,
      alive: true
    });

    const hostiles = injectedNPCs.filter(n => n.alive && (n.disposition <= -1 || n.id === initialFoe?.id));
    hostiles.forEach(h => {
      const foeSpeed = h.stats?.speed ?? (h.stats?.reflex ? h.stats.reflex * 2 : 10);
      const foePercept = h.stats?.awareness ? h.stats.awareness * 2 : 8;
      const foeResil = h.stats?.fortitude ? h.stats.fortitude * 2 : 9;
      const foeStamTier = calculatePoolTier(3, 12);
      const foeFocTier = calculatePoolTier(2, 12);

      parts.set(h.id, {
        id: h.id,
        name: h.name,
        pos: h.pos,
        isPlayer: false,
        hp: h.hp,
        maxHp: h.maxHp,
        movementSpeed: foeSpeed,
        perception: foePercept,
        stealth: 8,
        resilience: foeResil,
        moveRange: calculateMoveRange(foeSpeed),
        hasMoved: false,
        hasUsedStaminaAction: false,
        hasUsedFocusAction: false,
        currentStamina: foeStamTier.pool,
        maxStaminaPool: foeStamTier.pool,
        staminaTier: foeStamTier.tier,
        staminaRegenRate: foeStamTier.regenRate,
        currentFocus: foeFocTier.pool,
        maxFocusPool: foeFocTier.pool,
        focusTier: foeFocTier.tier,
        focusRegenRate: foeFocTier.regenRate,
        ap: 4,
        maxAp: 4,
        initiative: foeSpeed,
        disposition: h.disposition,
        equippedWeapon: h.equippedWeapon,
        equippedArmor: h.equippedArmor,
        alive: h.alive
      });
    });

    // Phase 1: Movement Phase order (Fastest moves first)
    const moveOrder = getMovementTurnOrder(Array.from(parts.values()));

    setCombatState({
      inCombat: true,
      roundNumber: 1,
      turnIndex: 0,
      phase: 'MOVEMENT',
      phaseTurnOrder: moveOrder,
      activeTurnUnitId: moveOrder[0] || 'player',
      playerStamina: staminaTier.pool,
      playerMaxStaminaPool: staminaTier.pool,
      playerStaminaTier: staminaTier.tier,
      playerFocus: focusTier.pool,
      playerMaxFocusPool: focusTier.pool,
      playerFocusTier: focusTier.tier,
      playerHasMoved: false,
      playerHasUsedStaminaAction: false,
      playerHasUsedFocusAction: false,
      playerAp: staminaTier.pool,
      playerMaxAp: staminaTier.pool,
      turnOrder: moveOrder,
      participants: parts,
      lastRollCard: null
    });

    audioManager.playBattleMusic();
    setIsPlayingMusic(true);
    setCurrentTrack(audioManager.getCurrentTrack());
    setMessages(prev => [
      ...prev,
      {
        sender: 'Tactical Grid',
        text: `⚔️ TACTICAL COMBAT INITIATED! Starting Pools: Stamina ${staminaTier.pool} (${staminaTier.tier}), Focus ${focusTier.pool} (${focusTier.tier}). Phase 1: MOVEMENT (Speed Order: High -> Low).`,
        type: 'info'
      }
    ]);
  };

  const triggerCombatAction = async (
    actionText: string,
    actionType: 'stamina' | 'focus' | 'both',
    staminaCost: number,
    focusCost: number,
    losInfo: LosResult | null,
    combatType: 'melee' | 'ranged' = 'melee'
  ) => {
    if (!actionText.trim() || isActing) return;

    if (combatState.inCombat) {
      if ((actionType === 'stamina' || actionType === 'both') && combatState.playerHasUsedStaminaAction) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Stamina Action this round!', type: 'error' }]);
        return;
      }
      if ((actionType === 'focus' || actionType === 'both') && combatState.playerHasUsedFocusAction) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Focus Action this round!', type: 'error' }]);
        return;
      }
      if (staminaCost > 0 && combatState.playerStamina < staminaCost) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: `⚠️ Insufficient Stamina Points! Requires ${staminaCost} Stamina (Have: ${combatState.playerStamina}).`, type: 'error' }]);
        return;
      }
      if (focusCost > 0 && combatState.playerFocus < focusCost) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: `⚠️ Insufficient Focus Points! Requires ${focusCost} Focus (Have: ${combatState.playerFocus}).`, type: 'error' }]);
        return;
      }
    }

    const wasStealthed = isStealthed;
    if (isStealthed) {
      setIsStealthed(false);
    }

    setIsActing(true);
    setMessages(prev => [...prev, { sender: 'You', text: actionText, type: 'player' }]);
    setChatInput('');

    audioManager.playSfx('attack');
    audioManager.playBattleMusic();
    setIsPlayingMusic(true);

    try {
      const res = await fetch('http://localhost:3000/api/dm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionText,
          playerId: character?.id || 1,
          playerPos: [localPos.lx, localPos.ly],
          coverBonus: losInfo?.coverBonus || 0,
          coverLevel: losInfo?.coverLevel || 'NONE',
          combatType,
          actionCostType: actionType,
          staminaSpent: staminaCost,
          focusSpent: focusCost,
          isStealthed: wasStealthed,
          sneakAttack: wasStealthed
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { sender: 'System', text: `Tactical Error: ${data.error || res.statusText}`, type: 'error' }]);
        return;
      }

      // Deduct Stamina / Focus points & consume action slots
      if (combatState.inCombat) {
        setCombatState(prev => {
          const updatedParts = new Map(prev.participants);
          const p = updatedParts.get('player');
          const newStam = Math.max(0, (prev.playerStamina ?? 5) - staminaCost);
          const newFoc = Math.max(0, (prev.playerFocus ?? 5) - focusCost);
          const usedStam = prev.playerHasUsedStaminaAction || actionType === 'stamina' || actionType === 'both';
          const usedFoc = prev.playerHasUsedFocusAction || actionType === 'focus' || actionType === 'both';

          if (p) {
            updatedParts.set('player', {
              ...p,
              currentStamina: newStam,
              currentFocus: newFoc,
              hasUsedStaminaAction: usedStam,
              hasUsedFocusAction: usedFoc
            });
          }

          return {
            ...prev,
            playerStamina: newStam,
            playerFocus: newFoc,
            playerHasUsedStaminaAction: usedStam,
            playerHasUsedFocusAction: usedFoc,
            participants: updatedParts
          };
        });
      }

      // Spawn floating combat text and create Roll Card
      const half = Math.floor(VIEWPORT_SIZE / 2);
      const targetScreenX = encounterTarget ? (encounterTarget.pos[0] - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2 : 250;
      const targetScreenY = encounterTarget ? (encounterTarget.pos[1] - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2 : 250;

      if (data.rollOutcome) {
        const netDmg = (data.rollOutcome.injuryPoints || 1) * 4;
        if (data.rollOutcome.hit) {
          audioManager.playSfx('hit');
          particleManagerRef.current.spawn(
            targetScreenX,
            targetScreenY,
            `-${netDmg} HP`,
            '#ef4444',
            16
          );
          if (wasStealthed) {
            particleManagerRef.current.spawn(
              targetScreenX,
              targetScreenY - 18,
              'SNEAK ATTACK! +4',
              '#c084fc',
              14
            );
          }
        } else {
          audioManager.playSfx('miss');
          particleManagerRef.current.spawn(
            targetScreenX,
            targetScreenY,
            'DEFLECTED',
            '#94a3b8',
            13
          );
        }

        const rollCard: TacticalRollCard = {
          id: `card_${Date.now()}`,
          timestamp: Date.now(),
          attackerName: data.rollOutcome.attackerName || character?.name || 'Hero',
          attackerRoll: data.rollOutcome.attackerRoll ?? data.rollOutcome.playerRoll ?? 10,
          attackerStatKey: data.rollOutcome.attackerStatKey || 'might',
          attackerStatVal: data.rollOutcome.attackerStatVal ?? data.rollOutcome.playerStatVal ?? 5,
          attackerMod: data.rollOutcome.attackerMod ?? 0,
          attackerTotal: data.rollOutcome.attackerTotal ?? (data.rollOutcome.playerRoll + data.rollOutcome.playerStatVal),
          defenderName: data.rollOutcome.defenderName || encounterTarget?.name || 'Defender',
          defenderRoll: data.rollOutcome.defenderRoll ?? 10,
          defenderStatKey: data.rollOutcome.defenderStatKey || 'reflex',
          defenderStatVal: data.rollOutcome.defenderStatVal ?? 5,
          defenderMod: data.rollOutcome.defenderMod ?? 0,
          defenderTotal: data.rollOutcome.defenderTotal ?? data.rollOutcome.dcOrDefenderRoll ?? 15,
          difference: data.rollOutcome.difference ?? 0,
          injuryPoints: data.rollOutcome.injuryPoints ?? 0,
          hit: data.rollOutcome.hit ?? false,
          coverBonus: losInfo?.coverBonus,
          coverLevel: losInfo?.coverLevel,
          weaponName: data.rollOutcome.weaponName || character?.equipped_weapon,
          armorName: data.rollOutcome.armorName
        };
        setCombatState(prev => ({ ...prev, lastRollCard: rollCard }));
      }

      if (data.systemLog) {
        setMessages(prev => [...prev, { sender: 'System', text: data.systemLog, type: 'system' }]);
      }
      if (data.narrativeResponse) {
        setMessages(prev => [...prev, { sender: 'GM', text: data.narrativeResponse, type: 'narrative' }]);
      }
      if (data.lootAwarded) {
        audioManager.playSfx('chest');
        setMessages(prev => [
          ...prev,
          { sender: 'Loot', text: `💰 Received +${data.lootAwarded.gold} Gold${data.lootAwarded.item ? ` and acquired ${data.lootAwarded.item}!` : '!'}`, type: 'info' }
        ]);
        particleManagerRef.current.spawn(targetScreenX, targetScreenY - 16, `+${data.lootAwarded.gold}g`, '#f59e0b', 14);
      }

      fetch('http://localhost:3000/api/dm/player')
        .then(r => r.json())
        .then(p => { if (p && p.id) setCharacter(p); })
        .catch(() => {});

      fetch('http://localhost:3000/api/dm/state')
        .then(r => r.json())
        .then(state => {
          if (state.props) setInjectedProps(state.props);
          if (state.npcs) {
            setInjectedNPCs(state.npcs);
            const activeHostiles = state.npcs.filter((n: any) => n.alive && n.disposition <= -1);
            if (activeHostiles.length === 0 && combatState.inCombat) {
              setCombatState(prev => ({ ...prev, inCombat: false }));
              setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '🏆 VICTORY! All threats neutralized. Sector is secure. Returning to Free Roam.', type: 'info' }]);
            }
          }
        })
        .catch(() => {});
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'System', text: `Action error: ${err.message}`, type: 'error' }]);
    } finally {
      setIsActing(false);
    }
  };

  const handleSneakToggle = () => {
    if (isStealthed) {
      setIsStealthed(false);
      audioManager.playSfx('step');
      setMessages(prev => [...prev, {
        sender: 'Tactical Grid',
        text: '👁️ [STEALTH BROKEN] You step out from the shadows into open view.',
        type: 'system'
      }]);
    } else {
      const heroStealth = character?.derived?.stealth ?? character?.stats?.stealth ?? 10;
      setIsStealthed(true);
      audioManager.playSfx('step');
      setMessages(prev => [...prev, {
        sender: 'Tactical Grid',
        text: `🥷 [STEALTH ACTIVE] You slip into the shadows (Stealth: ${heroStealth}). Footfalls masked. Your next attack gains +4 Surprise Advantage!`,
        type: 'system'
      }]);
    }
  };

  const handleToggleTorch = () => {
    if (isTorchLit) {
      setIsTorchLit(false);
      audioManager.playSfx('step');
      setMessages(prev => [...prev, {
        sender: 'Tactical Grid',
        text: '💨 [TORCH SNUFFED] You extinguish the flame, receding into the ambient shadows.',
        type: 'system'
      }]);
    } else {
      setIsTorchLit(true);
      audioManager.playSfx('special');
      setMessages(prev => [...prev, {
        sender: 'Tactical Grid',
        text: '🔥 [TORCH IGNITED] You brandish a blazing firebrand torch! The darkness is pierced by warm radial illumination (+4 FOV radius).',
        type: 'system'
      }]);
    }
  };

  const runTrophicTick = (playerCurPos = localPos) => {
    if (!injectedNPCs || injectedNPCs.length === 0) return;
    const result = processTrophicWildlifeTick(
      injectedNPCs,
      playerCurPos,
      isStealthed,
      tilemap,
      injectedProps
    );
    const currentDiurnal = getDiurnalPhase(calendarState?.tick || 1, stepCounterRef.current);
    const routineRes = updateNPCDiurnalRoutines(result.updatedNPCs, currentDiurnal.phase, [128, 128]);
    setInjectedNPCs(routineRes.updatedNPCs);
    if (routineRes.routineEvents.length > 0 && Math.random() < 0.25) {
      setMessages(m => [...m, { sender: 'Civic Routine', text: routineRes.routineEvents[0], type: 'info' }]);
    }
    if (result.spawnedProps.length > 0) {
      setInjectedProps(prev => [...prev, ...result.spawnedProps]);
    }
    if (result.combatFloaters.length > 0) {
      const half = Math.floor(VIEWPORT_SIZE / 2);
      result.combatFloaters.forEach(cf => {
        const sx = (cf.x - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2;
        const sy = (cf.y - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2;
        particleManagerRef.current.spawn(sx, sy, cf.text, cf.color, 13);
      });
    }
    if (result.logs.length > 0) {
      result.logs.forEach(l => {
        setMessages(m => [...m, { sender: 'Ecology', text: l, type: 'info' }]);
      });
    }
  };

  const handleEquipItem = (item: EquipmentItem) => {
    setCharacter((prev: any) => {
      const updated = { ...prev };
      if (item.category === 'weapon') {
        updated.equipped_weapon = item.name;
        updated.weapon_stat = item.stat.toUpperCase();
        updated.weapon_mod = item.rating;
      } else if (item.category === 'armor') {
        updated.equipped_armor = item.name;
        updated.armor_stat = item.stat.toUpperCase();
        updated.armor_mod = item.rating;
        updated.armor_dr = item.bonusValue;
      } else if (item.category === 'mental_weapon') {
        updated.equipped_social_weapon = item.name;
      } else if (item.category === 'mental_armor') {
        updated.equipped_social_armor = item.name;
      }
      return updated;
    });

    audioManager.playSfx('special');
    setMessages(prev => [
      ...prev,
      {
        sender: 'Loadout Manager',
        text: `⚔️ Equipped ${item.name} (Attuned: ${item.stat.toUpperCase()}, Rating: +${item.rating}, Fee: ${item.loadoutCost} ${item.isBodyStat ? 'SP' : 'FP'}). Loadout pools updated!`,
        type: 'info'
      }
    ]);

    fetch('http://localhost:3000/api/dm/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipped_weapon: item.category === 'weapon' ? item.name : undefined,
        equipped_armor: item.category === 'armor' ? item.name : undefined,
        equipped_social_weapon: item.category === 'mental_weapon' ? item.name : undefined,
        equipped_social_armor: item.category === 'mental_armor' ? item.name : undefined
      })
    }).catch(() => {});
  };

  const handleCombatAction = (actionKey: 'attack' | 'composure' | 'guard' | 'item' | 'flee') => {
    const targetNPC = encounterTarget && injectedNPCs.find(n => n.id === encounterTarget.id);
    const los = targetNPC
      ? evaluateLineOfSight(localPos.lx, localPos.ly, targetNPC.pos[0], targetNPC.pos[1], propSpatialGridRef.current, tilemap)
      : null;

    if (actionKey === 'attack') {
      if (combatState.inCombat) {
        if (combatState.playerHasUsedStaminaAction) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Stamina Action this round!', type: 'error' }]);
          return;
        }
        if (combatState.playerStamina < 1) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Insufficient Stamina Points! Requires 1 Stamina.', type: 'error' }]);
          return;
        }
      }
      const dist = targetNPC ? getGridDistance(localPos.lx, localPos.ly, targetNPC.pos[0], targetNPC.pos[1]) : 1;
      if (dist > 2) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: `⚠️ Target is ${dist} tiles away! Move closer for Melee or aim carefully.`, type: 'error' }]);
        return;
      }
      triggerCombatAction(`I strike ${targetNPC ? targetNPC.name : 'the enemy'} with my ${character?.equipped_weapon || 'weapon'}`, 'stamina', 1, 0, los, 'melee');
    } else if (actionKey === 'composure') {
      if (combatState.inCombat) {
        if (combatState.playerHasUsedFocusAction) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Focus Action this round!', type: 'error' }]);
          return;
        }
        if (combatState.playerFocus < 1) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Insufficient Focus Points! Requires 1 Focus.', type: 'error' }]);
          return;
        }
      }
      triggerCombatAction(`I focus my mental presence to strike ${targetNPC ? targetNPC.name : 'the target'} with a composure attack`, 'focus', 0, 1, los, 'melee');
    } else if (actionKey === 'guard') {
      if (combatState.inCombat) {
        if (combatState.playerHasUsedStaminaAction) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Stamina Action this round!', type: 'error' }]);
          return;
        }
        if (combatState.playerStamina < 1) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Requires 1 Stamina Point to Guard!', type: 'error' }]);
          return;
        }
      }
      triggerCombatAction(`I brace my guard with ${character?.equipped_armor || 'armor'} and fortify my posture`, 'stamina', 1, 0, null);
    } else if (actionKey === 'item') {
      if (combatState.inCombat) {
        if (combatState.playerHasUsedStaminaAction) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already performed your Stamina Action this round!', type: 'error' }]);
          return;
        }
        if (combatState.playerStamina < 1) {
          setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Requires 1 Stamina Point to Use Item!', type: 'error' }]);
          return;
        }
      }
      const item = character?.inventory?.find((it: string) => it.toLowerCase().includes('draught') || it.toLowerCase().includes('salve') || it.toLowerCase().includes('ration') || it.toLowerCase().includes('haunch'));
      triggerCombatAction(`I apply my ${item || 'field rations'}`, 'stamina', 1, 0, null);
    } else if (actionKey === 'flee') {
      triggerCombatAction('I disengage tactically and retreat out of weapon reach', 'stamina', 0, 0, null);
    }
  };

  const handleEndTurn = async () => {
    if (!combatState.inCombat || isActing) return;
    setIsActing(true);

    const activeHostiles = injectedNPCs.filter(n => n.alive && n.disposition <= -1 && getGridDistance(n.pos[0], n.pos[1], localPos.lx, localPos.ly) <= 10);

    if (activeHostiles.length === 0) {
      setCombatState(prev => ({ ...prev, inCombat: false }));
      setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '🏆 VICTORY! All threats neutralized. Exiting combat.', type: 'info' }]);
      setIsActing(false);
      return;
    }

    // --- PHASE 1: MOVEMENT PHASE COMPLETED -> TRANSITION TO DECLARATION PHASE ---
    if (combatState.phase === 'MOVEMENT') {
      const updatedParts = new Map(combatState.participants);

      // Milestone 2: Intelligent Squad AI Movement, Cover-Seeking, Flanking & Intent Telegraphed
      if (tilemap) {
        for (const enemy of activeHostiles) {
          const tactics = computeSquadTactics(enemy, activeHostiles, [localPos.lx, localPos.ly], tilemap, injectedProps);
          enemy.pos[0] = tactics.newPos[0];
          enemy.pos[1] = tactics.newPos[1];

          // Store tactical intent in participant
          const p = updatedParts.get(enemy.id);
          if (p) {
            p.declaredAction = {
              actionType: tactics.actionType,
              actionName: tactics.declaredActionName,
              targetId: 'player',
              targetName: 'Hero',
              staminaCost: tactics.staminaCost,
              focusCost: tactics.focusCost
            };

            const half = Math.floor(VIEWPORT_SIZE / 2);
            const sx = (enemy.pos[0] - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2;
            const sy = (enemy.pos[1] - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2;

            if (tactics.isFlanking) {
              particleManagerRef.current.spawn(sx, sy, 'FLANKING!', '#ef4444', 13);
            } else if (tactics.tacticalTactic === 'COVER_SEEK') {
              particleManagerRef.current.spawn(sx, sy, 'IN COVER', '#06b6d4', 12);
            } else if (tactics.tacticalTactic === 'FLEE_WOUNDED') {
              particleManagerRef.current.spawn(sx, sy, 'FLEEING!', '#eab308', 12);
            }
          }
        }
      }

      // Phase 2: Lowest perception declares FIRST!
      const declarationOrder = getDeclarationTurnOrder(Array.from(updatedParts.values()));

      setCombatState(prev => ({
        ...prev,
        phase: 'DECLARATION',
        phaseTurnOrder: declarationOrder,
        activeTurnUnitId: 'player',
        playerHasMoved: true,
        participants: updatedParts
      }));

      setMessages(prev => [
        ...prev,
        {
          sender: 'Tactical Grid',
          text: `👁️ PHASE 2: DECLARATION (Lowest Perception declares first). Squad AI has maneuvered and committed intentions! Your high perception reveals their telegraphed actions. Commit your response.`,
          type: 'info'
        }
      ]);
      setIsActing(false);
      return;
    }

    // --- PHASE 2: DECLARATION COMPLETED -> TRANSITION TO RESOLUTION PHASE ---
    if (combatState.phase === 'DECLARATION') {
      const resolutionOrder = getResolutionTurnOrder(Array.from(combatState.participants.values()));

      setCombatState(prev => ({
        ...prev,
        phase: 'RESOLUTION',
        phaseTurnOrder: resolutionOrder,
        activeTurnUnitId: resolutionOrder[0] || 'player'
      }));

      // Execute declared enemy strikes in speed order with Flanking & Cover bonuses
      for (const enemy of activeHostiles) {
        const p = combatState.participants.get(enemy.id);
        const dist = getGridDistance(enemy.pos[0], enemy.pos[1], localPos.lx, localPos.ly);
        const foeStam = enemy.currentStamina ?? 5;
        const foeFoc = enemy.currentFocus ?? 5;

        if (p?.declaredAction) {
          const isMelee = p.declaredAction.actionType === 'stamina' && dist <= 2;
          const isRangedOrArcane = (p.declaredAction.actionName.includes('Ranged') || p.declaredAction.actionName.includes('Eldritch')) && dist <= 8;

          if ((isMelee && foeStam >= 1) || (isRangedOrArcane && (foeStam >= 1 || foeFoc >= 1))) {
            if (p.declaredAction.actionType === 'stamina') enemy.currentStamina = Math.max(0, foeStam - 1);
            else enemy.currentFocus = Math.max(0, foeFoc - 1);

            // Flanking evaluation
            const allOther = activeHostiles.filter(h => h.id !== enemy.id && h.alive).map(h => h.pos);
            const flanking = isPlayerFlanked(enemy.pos, allOther, [localPos.lx, localPos.ly]);

            if (flanking) {
              const half = Math.floor(VIEWPORT_SIZE / 2);
              particleManagerRef.current.spawn(
                half * TILE_SIZE + TILE_SIZE / 2,
                half * TILE_SIZE + TILE_SIZE / 2 - 15,
                'FLANKED! +2',
                '#ef4444',
                15
              );
            }

            await triggerAction(`${enemy.name} executes ${p.declaredAction.actionName} against Hero!${flanking ? ' [FLANKING ADVANTAGE +2]' : ''}`);
          }
        }
      }

      // --- END OF ROUND: REGENERATE STAMINA & FOCUS POOLS BASED ON LOADOUT TIERS ---
      const nextRound = combatState.roundNumber + 1;
      setCombatState(prev => {
        const updatedParts = new Map(prev.participants);

        // Player regen
        const stamRegen = prev.playerStaminaTier === 'LIGHT' ? 1 : prev.playerStaminaTier === 'MEDIUM' ? (nextRound % 2 === 0 ? 1 : 0) : (nextRound % 3 === 0 ? 1 : 0);
        const focRegen = prev.playerFocusTier === 'LIGHT' ? 1 : prev.playerFocusTier === 'MEDIUM' ? (nextRound % 2 === 0 ? 1 : 0) : (nextRound % 3 === 0 ? 1 : 0);

        const newStam = Math.min(prev.playerMaxStaminaPool, prev.playerStamina + stamRegen);
        const newFoc = Math.min(prev.playerMaxFocusPool, prev.playerFocus + focRegen);

        const playerP = updatedParts.get('player');
        if (playerP) {
          playerP.currentStamina = newStam;
          playerP.currentFocus = newFoc;
          playerP.hasMoved = false;
          playerP.hasUsedStaminaAction = false;
          playerP.hasUsedFocusAction = false;
          playerP.declaredAction = null;
        }

        // Hostiles regen & reset
        activeHostiles.forEach(h => {
          const foeP = updatedParts.get(h.id);
          if (foeP) {
            foeP.currentStamina = Math.min(foeP.maxStaminaPool, foeP.currentStamina + 1);
            foeP.hasMoved = false;
            foeP.hasUsedStaminaAction = false;
            foeP.hasUsedFocusAction = false;
            foeP.declaredAction = null;
          }
        });

        const nextMoveOrder = getMovementTurnOrder(Array.from(updatedParts.values()));

        // Option 3: Process Elemental Cascades (Fire spread & burnt tiles)
        if (tilemap) {
          const spread = processFireSpread(tilemap, injectedProps, injectedNPCs);
          if (spread.logs.length > 0) {
            spread.logs.forEach(l => {
              setMessages(m => [...m, { sender: 'Elemental Grid', text: l, type: 'warning' }]);
            });

            // Milestone 2: Opposed Resilience Save against heat/fire trauma
            const playerResilience = character?.derived?.resilience ?? character?.stats?.resilience ?? 10;
            const resSave = resolveResilienceSave(playerResilience, 12, 'Blazing Heat');
            setMessages(m => [...m, { sender: 'Resilience Check', text: resSave.message, type: resSave.saved ? 'info' : 'warning' }]);
            if (!resSave.saved) {
              setCharacter((prev: any) => ({ ...prev, current_hp: Math.max(1, (prev.current_hp || 20) - 2) }));
              const half = Math.floor(VIEWPORT_SIZE / 2);
              particleManagerRef.current.spawn(
                half * TILE_SIZE + TILE_SIZE / 2,
                half * TILE_SIZE + TILE_SIZE / 2,
                '-2 HP (Fire)',
                '#f97316',
                14
              );
            }
          }
          spread.burntTiles.forEach(b => {
            const half = Math.floor(VIEWPORT_SIZE / 2);
            const sx = (b.x - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2;
            const sy = (b.y - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2;
            particleManagerRef.current.spawn(sx, sy, '🔥 ASH', '#f97316', 14);
          });
        }

        return {
          ...prev,
          roundNumber: nextRound,
          phase: 'MOVEMENT',
          phaseTurnOrder: nextMoveOrder,
          activeTurnUnitId: nextMoveOrder[0] || 'player',
          playerStamina: newStam,
          playerFocus: newFoc,
          playerHasMoved: false,
          playerHasUsedStaminaAction: false,
          playerHasUsedFocusAction: false,
          participants: updatedParts
        };
      });

      setMessages(prev => [
        ...prev,
        {
          sender: 'Tactical Grid',
          text: `🌟 ROUND ${nextRound} BEGINS: Pools regenerated! Phase 1: MOVEMENT begins (Speed Order).`,
          type: 'info'
        }
      ]);
      setIsActing(false);
      return;
    }
  };

  const handleVirtualMove = (dx: number, dy: number) => {
    if (inStartMenu || showCharModal || showSaveModal || showLoadModal || showSkillsModal || showMemorialModal || showDeathModal) return;
    if (!tilemap) return;

    if (combatState.inCombat) {
      if (combatState.phase !== 'MOVEMENT') {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ Movement phase has completed! Declare or execute actions, or press Pass.', type: 'error' }]);
        return;
      }
      if (combatState.playerHasMoved) {
        setMessages(prev => [...prev, { sender: 'Tactical Grid', text: '⚠️ You have already completed your 1 Movement action this round! Press Pass to enter Declaration Phase.', type: 'error' }]);
        return;
      }
    }

    const nx = localPos.lx + dx;
    const ny = localPos.ly + dy;
    if (nx >= 0 && nx < tilemap.size && ny >= 0 && ny < tilemap.size) {
      const tile = tilemap.grid[ny * tilemap.size + nx];
      if (tile !== 1 && tile !== 2 && tile !== 3 && tile !== 5) {
        setLocalPos({ lx: nx, ly: ny });
        audioManager.playStep();
        stepCounterRef.current++;

        if (!combatState.inCombat) {
          runTrophicTick({ lx: nx, ly: ny });
        }

        if (combatState.inCombat) {
          setCombatState(prev => ({ ...prev, playerHasMoved: true }));
        }

        const nearbyHostile = npcSpatialGridRef.current.findNearest(nx, ny, 4, n => n.alive && n.disposition < 0)?.item;
        if (nearbyHostile && !combatState.inCombat) {
          startCombatMode(nearbyHostile);
        }
      }
    }
  };

  // Execute Action through Concordia Game Master loop
  const triggerAction = async (actionText: string) => {
    if (!actionText.trim() || isActing) return;
    setIsActing(true);
    setMessages(prev => [...prev, { sender: 'You', text: actionText, type: 'player' }]);
    setChatInput('');

    // Trigger proactive action SFX and music mood
    const lowerAction = actionText.toLowerCase();
    if (lowerAction.includes('attack') || lowerAction.includes('strike') || lowerAction.includes('slash') || lowerAction.includes('stab')) {
      audioManager.playSfx('attack');
      audioManager.playBattleMusic();
      setCurrentTrack(audioManager.getCurrentTrack());
      setIsPlayingMusic(true);
    } else if (lowerAction.includes('rest') || lowerAction.includes('pause')) {
      audioManager.playExplorationMusic();
      setCurrentTrack(audioManager.getCurrentTrack());
    } else if (lowerAction.includes('open') || lowerAction.includes('chest') || lowerAction.includes('loot') || lowerAction.includes('crate') || lowerAction.includes('sack')) {
      audioManager.playSfx('chest');
    } else if (lowerAction.includes('door') || lowerAction.includes('gate')) {
      audioManager.playSfx('door');
    }

    // Option 3: Elemental Water Freezing (Cryo / Cold Bridge)
    if (tilemap && (lowerAction.includes('freeze') || lowerAction.includes('ice') || lowerAction.includes('frost') || lowerAction.includes('cryo'))) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const res = freezeWaterTile(localPos.lx + dx, localPos.ly + dy, tilemap);
          if (res.success) {
            audioManager.playSfx('special');
            const half = Math.floor(VIEWPORT_SIZE / 2);
            const sx = (dx + half) * TILE_SIZE + TILE_SIZE / 2;
            const sy = (dy + half) * TILE_SIZE + TILE_SIZE / 2;
            particleManagerRef.current.spawn(sx, sy, '❄️ ICE BRIDGE', '#38bdf8', 14);
            setMessages(prev => [...prev, { sender: 'Elemental Grid', text: res.message, type: 'info' }]);
            break;
          }
        }
      }
    }

    // Option 3: Field Flora Foraging
    if (encounterTarget && (lowerAction.includes('forage') || lowerAction.includes('harvest') || lowerAction.includes('gather') || lowerAction.includes('pick'))) {
      const isFlora = encounterTarget.tags && (encounterTarget.tags.includes('flora') || encounterTarget.tags.includes('herbs') || encounterTarget.tags.includes('forageable'));
      if (isFlora && manifest?.global_context) {
        const item = getForagedFloraItem(encounterTarget.name, manifest.global_context.biome_id);
        const currInv = Array.isArray(character?.inventory) ? [...character.inventory] : [];
        currInv.push(item);
        setCharacter((prev: any) => ({ ...prev, inventory: currInv }));
        audioManager.playSfx('chest');
        setMessages(prev => [...prev, { sender: 'Foraging', text: `🌿 Harvested 1x ${item} from ${encounterTarget.name}! Added to pack.`, type: 'info' }]);
        const half = Math.floor(VIEWPORT_SIZE / 2);
        const tx = (encounterTarget.pos[0] - localPos.lx + half) * TILE_SIZE + TILE_SIZE / 2;
        const ty = (encounterTarget.pos[1] - localPos.ly + half) * TILE_SIZE + TILE_SIZE / 2;
        particleManagerRef.current.spawn(tx, ty, `+${item}`, '#34d399', 14);
      }
    }

    try {
      await streamConcordiaAction(
        'http://localhost:3000/api/dm/action_stream',
        {
          actionText,
          playerId: character?.id || 1,
          playerPos: [localPos.lx, localPos.ly]
        },
        {
          onMechanics: (data) => {
            if (data.systemLog) {
              setMessages(prev => [...prev, { sender: 'System', text: data.systemLog, type: 'system' }]);
              if (data.systemLog.includes('HIT')) {
                audioManager.playSfx('hit');
              } else if (data.systemLog.includes('MISS')) {
                audioManager.playSfx('miss');
              }
            }
            if (data.dialogue) {
              setMessages(prev => [...prev, { sender: data.intent?.targetName || 'Dialogue', text: data.dialogue, type: 'dialogue' }]);
            }
            if (data.lootAwarded) {
              audioManager.playSfx('chest');
              setMessages(prev => [
                ...prev,
                {
                  sender: 'Loot',
                  text: `💰 Received +${data.lootAwarded.gold} Gold${data.lootAwarded.item ? ` and acquired ${data.lootAwarded.item}!` : '!'}`,
                  type: 'info'
                }
              ]);
            }

            // Refresh player character sheet from DB
            fetch('http://localhost:3000/api/dm/player')
              .then(r => r.json())
              .then(p => {
                if (p && p.id) {
                  if (character && Number(p.current_hp) < Number(character.current_hp)) {
                    audioManager.playSfx('damage');
                  }
                  setCharacter(p);
                  if (Number(p.current_hp) <= 0) {
                    audioManager.playSfx('death');
                    setShowDeathModal(true);
                    if (p.difficulty === 'hardcore') {
                      handleHardcorePermadeath();
                    }
                  }
                }
              })
              .catch(() => {});

            // Objective Progress & WhatELSE Quest Notification
            if (data.objectiveProgress?.description) {
              setMessages(prev => [
                ...prev,
                {
                  sender: 'Quest Tracker',
                  text: `🎯 [OBJECTIVE COMPLETED]: ${data.objectiveProgress.description}`,
                  type: 'info'
                }
              ]);
            }

            if (data.objectiveProgress?.beatCompleted) {
              setMessages(prev => [
                ...prev,
                {
                  sender: 'Story Director',
                  text: `🌟 [STORY BEAT COMPLETED]: "${activeBeat?.title || 'Story Beat'}". The Campaign Arc advances!`,
                  type: 'info'
                }
              ]);
              triggerAutoSave('AutoSave - Story Beat Complete');
            }

            // Sync active state from Concordia GM
            if (data.campaignState) {
              setCampaignState(data.campaignState);
              if (data.campaignState.activeBeat) {
                setActiveBeat(data.campaignState.activeBeat);
              }
            }

            // Refresh ground state props & NPCs
            fetch('http://localhost:3000/api/dm/state')
              .then(r => r.json())
              .then(state => {
                if (state.props) {
                  setInjectedProps(state.props.map((p: any) => ({
                    ...p,
                    tags: Array.isArray(p.tags) ? p.tags : []
                  })));
                }
                if (state.npcs) setInjectedNPCs(state.npcs);
              })
              .catch(() => {});
          },
          onChunk: (delta: string) => {
            if (!delta) return;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'GM' && last.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + delta }
                ];
              } else {
                return [
                  ...prev,
                  { sender: 'GM', text: delta, type: 'narrative', isStreaming: true }
                ];
              }
            });
          },
          onDone: () => {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'GM' && last.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, isStreaming: false }
                ];
              }
              return prev;
            });
          },
          onError: (err: string) => {
            setMessages(prev => [...prev, { sender: 'System', text: `Concordia GM Error: ${err}`, type: 'error' }]);
          }
        }
      );
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'System', text: `Concordia GM Error: ${err.message}`, type: 'error' }]);
    } finally {
      setIsActing(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAction(chatInput);
  };

  const handleFastTravel = (targetCell: any) => {
    if (targetCell.is_flow_cell) {
      setCrossingTargetCell(targetCell);
      return;
    }
    setCurrentCellId(targetCell.id);
    const targetRx = Math.min(224, Math.max(0, Math.floor((targetCell.p?.[0] || targetCell.center_x || 1400) / 12.5)));
    const targetRy = Math.min(224, Math.max(0, Math.floor((targetCell.p?.[1] || targetCell.center_y || 740) / 6.6)));
    setRegionalPos({ rx: targetRx, ry: targetRy });
    setLocalPos({ lx: 128, ly: 128 });
    fetchSectorState(targetRx, targetRy, targetCell.id);
    setActiveCenterTab('battlegrid');
    setMessages(prev => [
      ...prev,
      {
        sender: 'GM',
        text: `🗺️ FAST TRAVEL: You have navigated the overland trade routes to arrive in Global Cell ${targetCell.id} (${targetCell.faction_name || 'Wild Frontier'}).`,
        type: 'narrative'
      }
    ]);
  };

  const handleConfirmCrossing = async (method: 'AIRSHIP_OWNED' | 'AIRSHIP_CHARTER' | 'ON_FOOT_HAZARD') => {
    if (!crossingTargetCell || !character) return;
    setIsCrossingSubmitting(true);
    try {
      const res = await fetch('http://localhost:3000/api/regional/attempt_crossing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellId: crossingTargetCell.id,
          playerId: character.id || 1,
          method
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Sky-Guild Dispatcher',
            text: `❌ Crossing Rejected: ${data.error || 'Transit disallowed.'}`,
            type: 'error'
          }
        ]);
        return;
      }

      const targetCellId = crossingTargetCell.id;
      const targetRx = crossingTargetCell.pendingNextRx ?? Math.min(224, Math.max(0, Math.floor((crossingTargetCell.p?.[0] || crossingTargetCell.center_x || 1400) / 12.5)));
      const targetRy = crossingTargetCell.pendingNextRy ?? Math.min(224, Math.max(0, Math.floor((crossingTargetCell.p?.[1] || crossingTargetCell.center_y || 740) / 6.6)));
      const targetLx = crossingTargetCell.pendingNx ?? 128;
      const targetLy = crossingTargetCell.pendingNy ?? 128;

      setCharacter((prev: any) => {
        if (!prev) return prev;
        const updated = { ...prev };
        if (data.goldCost) {
          updated.gold = Math.max(0, (Number(updated.gold) || 0) - data.goldCost);
        }
        if (data.damageTaken != null) {
          updated.current_hp = Math.max(0, (Number(updated.current_hp) || 20) - data.damageTaken);
        }
        if (data.xpAwarded) {
          updated.xp = (Number(updated.xp) || 0) + data.xpAwarded;
        }
        if (data.mutation) {
          const currentMutations = Array.isArray(updated.mutations) ? [...updated.mutations] : [];
          currentMutations.push(data.mutation);
          updated.mutations = currentMutations;
        }
        return updated;
      });

      if (method === 'ON_FOOT_HAZARD') {
        audioManager.playSfx('damage');
      } else {
        audioManager.playSfx('special');
      }

      setMessages(prev => [
        ...prev,
        {
          sender: method === 'ON_FOOT_HAZARD' ? '⚠️ The Abyssal Chasm' : '🚀 Sky-Guild Flight',
          text: data.narrative,
          type: method === 'ON_FOOT_HAZARD' ? (data.incapacitated ? 'error' : 'event') : 'narrative'
        }
      ]);

      if (data.mutation) {
        setMessages(prev => [
          ...prev,
          {
            sender: '🧬 Primordial Mutation Manifested',
            text: `[${data.mutation.name}]: ${data.mutation.description}`,
            type: 'event'
          }
        ]);
      }

      setCrossingTargetCell(null);

      if (data.incapacitated || (data.remainingHp != null && data.remainingHp <= 0)) {
        setShowDeathModal(true);
        return;
      }

      setCurrentCellId(targetCellId);
      setRegionalPos({ rx: targetRx, ry: targetRy });
      setLocalPos({ lx: targetLx, ly: targetLy });
      await fetch(`http://localhost:3000/api/regional/start/${targetCellId}`, { method: 'POST' });
      await fetchSectorState(targetRx, targetRy, targetCellId);
      setActiveCenterTab('battlegrid');
    } catch (err: any) {
      console.error('Crossing error:', err);
      setMessages(prev => [
        ...prev,
        { sender: 'System', text: `Failed to attempt crossing: ${err.message}`, type: 'error' }
      ]);
    } finally {
      setIsCrossingSubmitting(false);
    }
  };

  // Direction & Distance to Sector Center (128, 128)
  const distToCenter = Math.round(Math.hypot(128 - localPos.lx, 128 - localPos.ly));
  const dxCenter = 128 - localPos.lx;
  const dyCenter = 128 - localPos.ly;
  let compassDir = '';
  if (dyCenter < -4) compassDir += 'North ';
  if (dyCenter > 4) compassDir += 'South ';
  if (dxCenter > 4) compassDir += 'East';
  if (dxCenter < -4) compassDir += 'West';
  if (!compassDir) compassDir = 'Sector Center';

  // Active Objective Distance Tracker
  const activeObj = activeBeat?.objectives?.find(o => !o.completed);
  const objTargetEntity = activeObj
    ? (injectedNPCs.find(n => n.id === activeObj.targetId) || injectedProps.find(p => p.id === activeObj.targetId))
    : null;
  const objDist = objTargetEntity
    ? Math.round(Math.hypot(objTargetEntity.pos[0] - localPos.lx, objTargetEntity.pos[1] - localPos.ly))
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden font-sans">
      {/* Top Main Section */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Pane: Hero Sheet & WhatELSE Campaign Tracker */}
        <HeroHud
          character={character}
          manifest={manifest}
          calendarState={calendarState}
          regionalPos={regionalPos}
          localPos={localPos}
          activeBeat={activeBeat}
          injectedNPCs={injectedNPCs}
          injectedProps={injectedProps}
          encounterTarget={encounterTarget}
          activeCenterTab={activeCenterTab}
          isActing={isActing}
          currentTrack={currentTrack}
          isPlayingMusic={isPlayingMusic}
          isMuted={isMuted}
          musicVol={musicVol}
          sfxMuted={sfxMuted}
          ambientMuted={ambientMuted}
          onOpenStartMenu={() => setInStartMenu(true)}
          onNewHero={() => setShowCharModal(true)}
          onOpenSaveModal={() => setShowSaveModal(true)}
          onOpenLoadModal={handleOpenLoadModal}
          onOpenSkillsModal={() => setShowSkillsModal(true)}
          onOpenPaperdoll={() => setShowPaperdollModal(true)}
          onTargetSelect={(target) => setEncounterTarget(target)}
          onToggleWorldMap={() => setActiveCenterTab(prev => prev === 'worldMap' ? 'battlegrid' : 'worldMap')}
          onToggleMusic={handleToggleMusic}
          onNextTrack={handleNextTrack}
          onToggleMute={handleToggleMute}
          onVolumeChange={handleVolumeChange}
          onToggleSfx={handleToggleSfx}
          onToggleAmbient={handleToggleAmbient}
          onUseItem={(item) => triggerAction(`I use and apply my ${item}`)}
        />

        {/* Center Pane: Tactical View or World Map Reference */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          {/* Header Bar with Tabs & Telemetry */}
          <CenterHeaderBar
            activeCenterTab={activeCenterTab}
            encounterTarget={encounterTarget}
            objDist={objDist}
            distToCenter={distToCenter}
            compassDir={compassDir}
            regionalPos={regionalPos}
            currentCellId={currentCellId}
            cellTelemetry={cellTelemetry}
            onSelectTab={setActiveCenterTab}
            onOpenCrafting={() => setShowCraftingModal(true)}
            isTorchLit={isTorchLit}
            onToggleTorch={handleToggleTorch}
            diurnalInfo={getDiurnalPhase(calendarState?.tick || 1, stepCounterRef.current)}
          />

          {activeCenterTab === 'battlegrid' ? (
            loading ? (
              <div className="text-amber-500 animate-pulse text-lg tracking-widest">TRANSLATING GLOBAL MATRIX...</div>
            ) : (
              <div className="shadow-2xl border-4 border-gray-800 rounded relative">
                <canvas
                  ref={canvasRef}
                  width={VIEWPORT_SIZE * TILE_SIZE}
                  height={VIEWPORT_SIZE * TILE_SIZE}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setHoverTile(null)}
                  className="bg-black block cursor-crosshair"
                  title="Click any prop or NPC to target directly"
                />

                {/* Primordial Chaos Flow Hazard & Crossing HUD Overlay */}
                {chaosFlowTelemetry && (chaosFlowTelemetry.intersected || chaosFlowTelemetry.nearNarrowSpot || chaosFlowTelemetry.distToFlow <= 60) && (
                  <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between px-3 py-2 rounded-lg bg-gray-950/90 border border-purple-500/70 shadow-2xl backdrop-blur-md font-mono text-xs text-purple-200">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base animate-pulse">⚡</span>
                      <div>
                        <div className="font-bold text-amber-300 flex items-center gap-2">
                          <span>{chaosFlowTelemetry.nearestFlow?.name || 'Primordial Chaos Flow'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-900/80 text-[10px] text-purple-300 border border-purple-700/50">
                            {chaosFlowTelemetry.nearestFlow?.elementalPower} (Surge x{chaosFlowTelemetry.nearestFlow?.currentSurge})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-300 mt-0.5">
                          {chaosFlowTelemetry.nearNarrowSpot ? (
                            <span className="text-emerald-400 font-semibold">
                              ⚠️ Narrow Ford Discovered (DC {chaosFlowTelemetry.narrowSpot?.crossingDC || 15}): Dangerous on-foot dash possible! Safe by Airship.
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold">
                              ☠️ Unbridged Torrent: Lethal chaotic radiation! Only safe passage is by Airship.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {chaosFlowTelemetry.nearNarrowSpot && (
                        <button
                          type="button"
                          onClick={() => triggerAction('I sprint across the narrow ford')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold text-[10px] rounded shadow transition-colors"
                          title="Attempt dangerous opposed sprint across the narrow ford"
                        >
                          Brave Ford
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (cellTelemetry?.cell) {
                            setCrossingTargetCell({
                              ...cellTelemetry.cell,
                              flow_name: chaosFlowTelemetry?.nearestFlow?.name,
                              dragon_name: chaosFlowTelemetry?.nearestFlow?.dragonName,
                              elemental_power: chaosFlowTelemetry?.nearestFlow?.elementalPower,
                              current_surge: chaosFlowTelemetry?.nearestFlow?.currentSurge
                            });
                          } else {
                            triggerAction('I board my airship and fly safely over the chaos flow');
                          }
                        }}
                        className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-purple-100 font-bold text-[10px] rounded shadow border border-purple-400 transition-colors"
                        title="Safe passage across the planetary barrier via Airship"
                      >
                        Airship Transit
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Sector Chaos Surge Banner */}
                {activeChaosSurge && (
                  <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-950/90 border border-purple-600/70 shadow-2xl backdrop-blur-md font-mono text-[11px] text-purple-200">
                    <div className="flex items-center gap-2">
                      <span className="animate-spin text-sm">🌀</span>
                      <div>
                        <span className="font-bold text-amber-300">Surge: {activeChaosSurge.activeSurge.name}</span>
                        <span className="text-gray-300 ml-2">[{activeChaosSurge.activeSurge.domainLean} • {activeChaosSurge.activeSurge.tier}]</span>
                      </div>
                    </div>
                    <span className="text-[10.5px] text-purple-300/90 italic truncate max-w-sm">{activeChaosSurge.activeSurge.headline}</span>
                  </div>
                )}

                {/* Phase A: Interactive Tile Hover Telemetry Tooltip */}
                {hoverTile && (
                  <div
                    className="absolute pointer-events-none z-30 bg-gray-950/95 border border-amber-600/70 rounded-lg px-2.5 py-1.5 shadow-2xl text-[11px] font-mono text-gray-200 backdrop-blur-md transition-all duration-75"
                    style={{
                      left: Math.min(Math.max(10, hoverTile.screenX + 16), (VIEWPORT_SIZE * TILE_SIZE) - 170),
                      top: Math.max(12, hoverTile.screenY - 45)
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-1">
                      <span className="font-bold text-amber-400">[{hoverTile.x}, {hoverTile.y}]</span>
                      <span className="text-[10px] text-gray-300 font-semibold">{hoverTile.tileName}</span>
                    </div>
                    <div className="flex items-center gap-3 pt-1 text-[10px]">
                      <span className="text-gray-400">Move: <strong className={hoverTile.moveCost === 'BLOCKED' ? 'text-rose-400' : 'text-emerald-400'}>{hoverTile.moveCost}</strong></span>
                      <span className="text-gray-400">Cover: <strong className="text-sky-300">{hoverTile.coverLevel}</strong></span>
                    </div>
                    {hoverTile.entityName && (
                      <div className="text-[10px] text-yellow-300 font-bold pt-1 border-t border-gray-800/80 mt-1 flex items-center gap-1">
                        <span>🎯</span> {hoverTile.entityName}
                      </div>
                    )}
                  </div>
                )}

                {/* Phase C: Turn-Based Tactical Combat Overlay */}
                <TacticalCombatOverlay
                  combatState={combatState}
                  targetUnit={encounterTarget?.type === 'npc' ? (combatState.participants.get(encounterTarget.id) || null) : null}
                  targetLos={encounterTarget ? evaluateLineOfSight(localPos.lx, localPos.ly, encounterTarget.pos[0] ?? 0, encounterTarget.pos[1] ?? 0, injectedProps, tilemap) : null}
                  onExecuteCombatAction={handleCombatAction}
                  onEndTurn={handleEndTurn}
                  onDismissRollCard={() => setCombatState(prev => ({ ...prev, lastRollCard: null }))}
                />

                {/* Phase A: Virtual Touch & Keyboardless D-Pad Controls */}
                <VirtualTouchControls
                  onMove={handleVirtualMove}
                  onAction={(k) => {
                    if (k === '1') {
                      if (!combatState.inCombat) {
                        const nearestHostile = injectedNPCs.find(n => n.alive && n.disposition <= -1);
                        if (nearestHostile) startCombatMode(nearestHostile);
                      }
                      handleCombatAction('attack');
                    } else if (k === '2') {
                      handleSneakToggle();
                    } else if (k === '3') {
                      triggerAction(`I inspect and search ${encounterTarget ? encounterTarget.name : 'the surroundings'} for clues, traps, and loot`);
                    } else if (k === '4') {
                      triggerAction(`I speak to ${encounterTarget ? encounterTarget.name : 'those nearby'} to negotiate or demand answers`);
                    } else if (k === '5') {
                      if (combatState.inCombat) {
                        handleCombatAction('guard');
                      } else {
                        triggerAction('I take a tactical pause to assess my wounds and environment');
                      }
                    } else if (k === 'T') {
                      handleToggleTorch();
                    }
                  }}
                  inCombat={combatState.inCombat}
                  onEndTurn={handleEndTurn}
                />
              </div>
            )
          ) : (
            <WorldMapTab
              cellTelemetry={cellTelemetry}
              regionalPos={regionalPos}
              character={character}
              onFastTravel={handleFastTravel}
            />
          )}
        </div>

        {/* Right Pane: DM Story Engine & Action Controls */}
        <ActionTerminal
          messages={messages}
          chatInput={chatInput}
          isActing={isActing}
          encounterTarget={encounterTarget}
          character={character}
          onChatInputChange={setChatInput}
          onSubmit={handleSend}
          onTriggerAction={triggerAction}
          onOpenBarterModal={openBarterModal}
          onOpenNoticeModal={openNoticeModal}
        />
      </div>

      {/* Bottom Pane: Quick Action Key Bar */}
      <BottomKeyBar
        encounterTarget={encounterTarget}
        character={character}
        isActing={isActing}
        onTriggerAction={triggerAction}
        isTorchLit={isTorchLit}
        onToggleTorch={handleToggleTorch}
      />

      {/* Auto-Save Floating Notification Toast */}
      {autoSaveToast && (
        <div className="fixed bottom-12 right-6 z-50 bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs px-3 py-1.5 rounded-lg shadow-xl animate-bounce flex items-center gap-2">
          <span>💾</span>
          <span>{autoSaveToast}</span>
        </div>
      )}

      {/* App Start Menu / Title Screen */}
      <StartMenuModal
        inStartMenu={inStartMenu}
        character={character}
        currentTrack={currentTrack}
        isPlayingMusic={isPlayingMusic}
        onContinue={handleContinue}
        onNewGame={() => setShowCharModal(true)}
        onOpenLoadModal={handleOpenLoadModal}
        onOpenMemorialsModal={handleOpenMemorialsModal}
        onJumpToSector={() => {
          setInStartMenu(false);
          fetchSectorState(regionalPos.rx, regionalPos.ry);
        }}
        onToggleMusic={handleToggleMusic}
        onNextTrack={handleNextTrack}
      />

      {/* Character Creation Studio Modal */}
      <CharacterCreationModal
        showCharModal={showCharModal}
        optionsData={optionsData}
        onClose={() => setShowCharModal(false)}
        onCreateSuccess={(newHero) => {
          setCharacter(newHero);
          setShowCharModal(false);
          setInStartMenu(false);
          if (!audioManager.isMusicPlaying()) {
            audioManager.playMusic();
            setIsPlayingMusic(true);
            setCurrentTrack(audioManager.getCurrentTrack());
          }
          setMessages(prev => [
            ...prev,
            {
              sender: 'System',
              text: `⚔️ Character created: ${newHero.name} — ${newHero.kingdom} ${newHero.species} (${newHero.lineage}) attuned to ${newHero.equipped_weapon} [${newHero.weapon_stat?.toUpperCase()}] and ${newHero.equipped_armor}!`,
              type: 'info'
            }
          ]);
          fetchSectorState(regionalPos.rx, regionalPos.ry);
        }}
      />

      {/* Save Game Modal */}
      <SaveGameModal
        showSaveModal={showSaveModal}
        saveSlotName={saveSlotName}
        regionalPos={regionalPos}
        localPos={localPos}
        character={character}
        activeBeat={activeBeat}
        onSlotNameChange={setSaveSlotName}
        onClose={() => setShowSaveModal(false)}
        onSaveGame={handleSaveGame}
      />

      {/* Load Game Modal */}
      <LoadGameModal
        showLoadModal={showLoadModal}
        saveSlots={saveSlots}
        onClose={() => setShowLoadModal(false)}
        onLoadGame={handleLoadGame}
        onDeleteSave={handleDeleteSave}
      />

      {/* Fallen Hero / Defeat Modal */}
      <DeathModal
        showDeathModal={showDeathModal}
        character={character}
        hardcoreDeathProcessed={hardcoreDeathProcessed}
        regionalPos={regionalPos}
        localPos={localPos}
        onRevivePlayer={handleRevivePlayer}
        onOpenLoadModal={handleOpenLoadModal}
        onReturnToMainMenu={() => {
          setShowDeathModal(false);
          setInStartMenu(true);
        }}
        onOpenMemorialsModal={handleOpenMemorialsModal}
        onForgeNewHero={() => {
          setShowDeathModal(false);
          setShowCharModal(true);
        }}
      />

      {/* Hall of the Fallen / Memorial Archive Modal */}
      <MemorialModal
        showMemorialModal={showMemorialModal}
        memorialList={memorialList}
        onClose={() => setShowMemorialModal(false)}
      />

      {/* 3-Branch x 4-Rank Skill Progression Modal */}
      <SkillsProgressionModal
        showSkillsModal={showSkillsModal}
        character={character}
        optionsData={optionsData}
        levelUpSubmitting={levelUpSubmitting}
        onClose={() => setShowSkillsModal(false)}
        onInvestSkillRank={handleInvestSkillRank}
      />

      {/* Mercantile Barter & Provisions Modal */}
      <BarterShopModal
        showBarterModal={showBarterModal}
        tradeStatus={tradeStatus}
        tradeCatalog={tradeCatalog}
        character={character}
        onClose={() => setShowBarterModal(false)}
        onBuyItem={handleBuyItem}
        onSellItem={handleSellItem}
      />

      {/* Municipal Notice Board & Reeve Bounties Modal */}
      <NoticeBoardModal
        showNoticeModal={showNoticeModal}
        bountyList={bountyList}
        onClose={() => setShowNoticeModal(false)}
        onAcceptBounty={handleAcceptBounty}
      />

      {/* Field Alchemy & Crafting Modal */}
      <FieldCraftingModal
        isOpen={showCraftingModal}
        onClose={() => setShowCraftingModal(false)}
        inventory={Array.isArray(character?.inventory) ? character.inventory : []}
        onCraftSuccess={(updatedInv, msg, item) => {
          setCharacter((prev: any) => ({ ...prev, inventory: updatedInv }));
          audioManager.playSfx('special');
          setMessages(prev => [...prev, { sender: 'Alchemy', text: msg, type: 'info' }]);
          const half = Math.floor(VIEWPORT_SIZE / 2);
          particleManagerRef.current.spawn(
            half * TILE_SIZE + TILE_SIZE / 2,
            half * TILE_SIZE + TILE_SIZE / 2 - 20,
            `CRAFTED: ${item}`,
            '#10b981',
            15
          );
        }}
      />

      {/* Option 1: Visual Paperdoll & Loadout Manager Modal */}
      <PaperdollLoadoutModal
        isOpen={showPaperdollModal}
        onClose={() => setShowPaperdollModal(false)}
        character={character}
        onEquipItem={handleEquipItem}
      />

      {/* Primordial Chaos Flow Lethal Crossing Modal */}
      <ChaosFlowCrossingModal
        isOpen={Boolean(crossingTargetCell)}
        targetCell={crossingTargetCell}
        character={character}
        isSubmitting={isCrossingSubmitting}
        onClose={() => setCrossingTargetCell(null)}
        onConfirmTransit={handleConfirmCrossing}
      />

      {/* Option 1: Context Radial Action Menu */}
      <ContextRadialMenu
        isOpen={radialMenuState.isOpen}
        x={radialMenuState.x}
        y={radialMenuState.y}
        targetName={radialMenuState.targetName}
        targetType={radialMenuState.targetType}
        options={radialMenuState.options}
        onClose={() => setRadialMenuState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
