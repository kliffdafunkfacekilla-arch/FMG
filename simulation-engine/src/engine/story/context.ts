import type { Db } from "../deltas/types.js";
import { mapNpcIdToEntityRef } from "../entities/refs.js";
import { ensureEntity, getEntityByRef } from "../entities/registry.js";
import { factTags } from "../facts/facts.js";
import { deriveCitizenMotives, deriveParagonMotives } from "../rpg/paragonMotives.js";

export const STORY_CONTEXT_WEIGHTS = {
  wDist: 3.0,
  wActor: 4.0,
  wRecency: 2.0,
  wStakes: 2.5,
} as const;

export interface StoryFocusInput {
  cellId: number;
  rx?: number | undefined;
  ry?: number | undefined;
  z?: number | undefined;
}

export interface StoryPartyInput {
  playerId?: number | undefined;
  playerIds?: number[] | undefined;
}

export interface StoryContextOptions {
  tokenBudget?: number | undefined;
  maxNeighborCells?: number | undefined;
}

export interface EntityBrief {
  ref: string;
  id?: string | undefined;
  name: string;
  role: string;
  want?: string | undefined;
  flaw?: string | undefined;
  lineWontCross?: string | undefined;
  tags: string[];
  relationshipsToParty: string[];
}

export interface StoryContext {
  focus: {
    tile: {
      cellId: number;
      rx: number;
      ry: number;
      z: number;
      burgId: number | null;
      burgName: string | null;
      layerName: string | null;
    };
    entities: EntityBrief[];
    objects: Array<{
      id: string;
      name: string;
      pos?: [number, number] | undefined;
      tags: string[];
      isDestroyed?: boolean | undefined;
    }>;
    overlays: Array<{
      id: number;
      objectRef: string | null;
      change: string;
      tick: number;
      source: string;
    }>;
  };
  region: {
    burgs: Array<{
      burgId: number;
      cellId: number;
      name: string;
      food: number;
      wealth: number;
      unrest: number;
      popNull: number;
      popAttuned: number;
      factionName: string;
      econTags: string[];
      factionTags: string[];
      distanceRank: number;
    }>;
    openStorylines: Array<{
      id: number;
      cellId: number;
      question: string;
      stakes: string;
      actorIds: string[];
      clock: number;
      clockMax: number;
      state: string;
      score: number;
    }>;
    convoys: Array<{
      id: number;
      goodName: string;
      quantity: number;
      status: string;
      sourceBurgId: number;
      destBurgId: number;
      currentCellId: number | null;
    }>;
    borders: Array<{
      cellId: number;
      factionA: number | null;
      factionB: number | null;
    }>;
    wildlife: {
      cellId: number;
      prey: number;
      predators: number;
      apex: number;
      blight: number;
    } | null;
  };
  world: {
    tick: number;
    date: string;
    season: string;
    moonPhase: string;
    wars: Array<{
      factionAId: number;
      factionBId: number;
      factionAName: string;
      factionBName: string;
      tension: number;
    }>;
    diplomacy: Array<{
      factionAName: string;
      factionBName: string;
      status: string;
      tension: number;
    }>;
    marketExtremes: Array<{
      burgId: number;
      burgName: string;
      summary: string;
    }>;
    chaosFlows: Array<{
      flowId: number;
      name: string;
      dragonName: string;
      power: string;
      surge: number;
    }>;
    factionFinances: Array<{
      factionId: number;
      name: string;
      treasury: number;
      wealth: number;
    }>;
  };
  history: {
    recentEvents: Array<{
      id: number;
      tick: number;
      tier: string;
      type: string;
      message: string;
      cellId: number | null;
      burgId: number | null;
      score: number;
    }>;
    resolvedHere: Array<{
      id: number;
      question: string;
      state: string;
      resolutionSummary: string | null;
    }>;
    deltasTouching: Array<{
      id: number;
      tick: number;
      source: string;
      kind: string;
    }>;
  };
  party: {
    characters: Array<{
      ref: string;
      id: number;
      name: string;
      species: string;
      lineage: string;
      institution: string;
      inventory: string[];
      traits: string[];
    }>;
    recentActions: Array<{
      verb: string;
      targetRef?: string | undefined;
      result: string;
      tick: number;
    }>;
    standing: Array<{
      subjectRef: string;
      value: number;
    }>;
    gmMemories: string[];
  };
  meta: {
    tokenEstimate: number;
    budget: number;
    dropped: Array<{ section: string; count: number }>;
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function cleanLine(s: unknown, maxLen: number = 140): string {
  return String(s ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function scoreItem(opts: {
  isSameCell: boolean;
  sharesActor: boolean;
  ageTicks: number;
  stakesWeight: number;
}): number {
  const proximity = opts.isSameCell ? 1.0 : 0.45;
  const actorOverlap = opts.sharesActor ? 1.0 : 0.0;
  const recency = 1 / (1 + Math.max(0, opts.ageTicks) / 10);
  return Number(
    (
      STORY_CONTEXT_WEIGHTS.wDist * proximity +
      STORY_CONTEXT_WEIGHTS.wActor * actorOverlap +
      STORY_CONTEXT_WEIGHTS.wRecency * recency +
      STORY_CONTEXT_WEIGHTS.wStakes * opts.stakesWeight
    ).toFixed(3)
  );
}

async function loadFocusSection(
  db: Db,
  cellId: number,
  rx: number,
  ry: number,
  z: number,
  currentTick: number
): Promise<StoryContext["focus"]> {
  const layerRes = await db.query(
    `SELECT layer_name, props, npcs
     FROM sim_sector_layers
     WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4
     LIMIT 1`,
    [cellId, rx, ry, z]
  );
  const burgRes = await db.query(
    `SELECT burg_id, name FROM sim_burg_economy WHERE cell_id = $1 ORDER BY burg_id ASC LIMIT 1`,
    [cellId]
  );
  const overlayRes = await db.query(
    `SELECT id, object_ref, change, tick, source
     FROM map_overlays
     WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z = $4
     ORDER BY id DESC
     LIMIT 20`,
    [cellId, rx, ry, z]
  );

  const burg = burgRes.rows[0] ?? null;
  const burgId = burg ? Number(burg.burg_id) : null;
  const burgName = burg ? String(burg.name) : null;
  const layer = layerRes.rows[0] ?? null;

  const paragonMap = new Map<number, any>();
  if (burgId) {
    const pRes = await db.query(
      `SELECT id, name, title, traits, corruption_score, outlaw_id, want, flaw, line_wont_cross
       FROM sim_paragons
       WHERE burg_id = $1
       ORDER BY id ASC
       LIMIT 12`,
      [burgId]
    );
    for (const r of pRes.rows) paragonMap.set(Number(r.id), r);
  }

  const rawNpcs: any[] = Array.isArray(layer?.npcs) ? layer.npcs.slice(0, 16) : [];
  const entities: EntityBrief[] = [];
  const seenRefs = new Set<string>();

  for (const n of rawNpcs) {
    if (!n || !n.id) continue;
    const rawId = String(n.id);
    const ref = n.entity_ref ? String(n.entity_ref) : mapNpcIdToEntityRef(rawId, { cellId, rx, ry });
    if (seenRefs.has(ref)) continue;

    // Rule 7 / W5: resolve every focus NPC against the entity registry (or promote derived local entity)
    const ent = await ensureEntity(db, ref, {
      name: String(n.name || rawId),
      kind: ref.startsWith("creature:") ? "creature" : ref.startsWith("squad:") ? "group" : "person",
      lod: "micro",
      cellId,
      rx,
      ry,
      z,
      x: Array.isArray(n.pos) && Number.isFinite(Number(n.pos[0])) ? Number(n.pos[0]) : null,
      y: Array.isArray(n.pos) && Number.isFinite(Number(n.pos[1])) ? Number(n.pos[1]) : null,
      createdTick: currentTick,
    });
    if (!ent || !ent.alive) continue;
    seenRefs.add(ent.ref);

    let want = n.want ? String(n.want) : undefined;
    let flaw = n.flaw ? String(n.flaw) : undefined;
    let lineWontCross = n.lineWontCross ? String(n.lineWontCross) : undefined;

    if (ent.ref.startsWith("paragon:")) {
      const pid = Number(ent.source_id);
      const pRow = paragonMap.get(pid);
      const profile = pRow ? deriveParagonMotives(pRow) : deriveParagonMotives({ id: pid || 1, title: n.role });
      want = want || pRow?.want || profile.want;
      flaw = flaw || pRow?.flaw || profile.flaw;
      lineWontCross = lineWontCross || pRow?.line_wont_cross || profile.lineWontCross;
    } else if (!want || !flaw || !lineWontCross) {
      const cm = deriveCitizenMotives({
        role: n.role,
        tags: Array.isArray(n.tags) ? n.tags : [],
        want: n.want,
        flaw: n.flaw,
        lineWontCross: n.lineWontCross,
      });
      want = want || cm.want;
      flaw = flaw || cm.flaw;
      lineWontCross = lineWontCross || cm.lineWontCross;
    }

    entities.push({
      ref: ent.ref,
      id: rawId,
      name: cleanLine(n.name || ent.name, 80),
      role: cleanLine(n.role || "Resident", 50),
      want: cleanLine(want, 140),
      flaw: cleanLine(flaw, 140),
      lineWontCross: cleanLine(lineWontCross, 140),
      tags: Array.isArray(n.tags) ? n.tags.map((t: any) => String(t)).slice(0, 10) : [],
      relationshipsToParty: [],
    });
  }

  // If the sector layer wasn't generated/cached yet, surface the burg's authoritative paragons from DB
  if (entities.length === 0 && paragonMap.size > 0) {
    for (const pRow of paragonMap.values()) {
      const ref = `paragon:${pRow.id}`;
      const ent = await ensureEntity(db, ref, { cellId, lod: "macro", createdTick: currentTick });
      if (!ent || !ent.alive) continue;
      const profile = deriveParagonMotives(pRow);
      entities.push({
        ref: ent.ref,
        id: `npc_paragon_${pRow.id}`,
        name: cleanLine(ent.name, 80),
        role: cleanLine(pRow.title || "Paragon", 50),
        want: cleanLine(pRow.want || profile.want, 140),
        flaw: cleanLine(pRow.flaw || profile.flaw, 140),
        lineWontCross: cleanLine(pRow.line_wont_cross || profile.lineWontCross, 140),
        tags: [],
        relationshipsToParty: [],
      });
    }
  }

  const rawProps: any[] = Array.isArray(layer?.props) ? layer.props.slice(0, 12) : [];
  const objects = rawProps
    .filter((p) => p && p.id)
    .map((p) => ({
      id: String(p.id),
      name: cleanLine(p.name || p.type || p.id, 80),
      pos: Array.isArray(p.pos) && p.pos.length >= 2 ? ([Number(p.pos[0]), Number(p.pos[1])] as [number, number]) : undefined,
      tags: Array.isArray(p.tags) ? p.tags.map((t: any) => String(t)).slice(0, 8) : [],
      isDestroyed: Boolean(p.isDestroyed),
    }));

  const overlays = overlayRes.rows.map((r: any) => ({
    id: Number(r.id),
    objectRef: r.object_ref ? String(r.object_ref) : null,
    change: String(r.change),
    tick: Number(r.tick || 0),
    source: String(r.source || ""),
  }));

  return {
    tile: {
      cellId,
      rx,
      ry,
      z,
      burgId,
      burgName,
      layerName: layer?.layer_name ? String(layer.layer_name) : null,
    },
    entities,
    objects,
    overlays,
  };
}

async function loadRegionSection(
  db: Db,
  cellId: number,
  maxNeighborCells: number,
  currentTick: number,
  importantActors: Set<string>
): Promise<{
  region: StoryContext["region"];
  regionCellIds: number[];
  regionBurgIds: number[];
  storylineActors: Set<string>;
}> {
  const neighborsRes = await db.query(
    `SELECT id FROM sim_cells ORDER BY cell_dist2(id, $1) ASC, id ASC LIMIT $2`,
    [cellId, Math.max(2, maxNeighborCells)]
  );
  const burgsRes = await db.query(
    `SELECT b.burg_id, b.cell_id, b.name, b.food, b.wealth, b.unrest, b.pop_null, b.pop_attuned,
            COALESCE(f.name, 'Provincial Sovereignty') AS faction_name
     FROM sim_burg_economy b
     LEFT JOIN sim_cells c ON c.id = b.cell_id
     LEFT JOIN sim_factions f ON f.id = c.faction_id
     ORDER BY cell_dist2(b.cell_id, $1) ASC, b.burg_id ASC
     LIMIT 6`,
    [cellId]
  );
  const wildlifeRes = await db.query(
    `SELECT id, COALESCE(eco_prey, 0) AS prey, COALESCE(eco_predators, 0) AS predators,
            COALESCE(eco_apex, 0) AS apex, COALESCE(eco_blight, 0) AS blight
     FROM sim_cells WHERE id = $1 LIMIT 1`,
    [cellId]
  );

  const burgs = burgsRes.rows.map((r: any, idx: number) => {
    const food = Number(r.food || 0);
    const wealth = Number(r.wealth || 0);
    const unrest = Number(r.unrest || 0);
    const popNull = Number(r.pop_null || 0);
    const popAttuned = Number(r.pop_attuned || 0);
    const tags = factTags({ food, wealth, unrest, pop_null: popNull, pop_attuned: popAttuned });
    return {
      burgId: Number(r.burg_id),
      cellId: Number(r.cell_id),
      name: String(r.name || `Burg #${r.burg_id}`),
      food,
      wealth,
      unrest,
      popNull,
      popAttuned,
      factionName: String(r.faction_name || "Provincial Sovereignty"),
      econTags: tags.econTags,
      factionTags: tags.factionTags,
      distanceRank: idx + 1,
    };
  });

  const neighborCellIds = neighborsRes.rows.map((r: any) => Number(r.id));
  const regionCellIds = Array.from(new Set([cellId, ...neighborCellIds, ...burgs.map((b: any) => b.cellId)]));
  const regionBurgIds = burgs.map((b: any) => b.burgId);

  const threadsRes = await db.query(
    `SELECT id, cell_id, question, stakes, actor_ids, clock, clock_max, state, created_tick
     FROM sim_threads
     WHERE state IN ('open', 'escalated') AND cell_id = ANY($1::int[])
     ORDER BY id ASC
     LIMIT 16`,
    [regionCellIds]
  );
  const convoysRes =
    regionBurgIds.length > 0
      ? await db.query(
          `SELECT id, COALESCE(good_name, good_key, 'Cargo') AS good_name, quantity, status,
                  source_burg_id, dest_burg_id, current_cell_id
           FROM sim_trade_shipments
           WHERE status NOT IN ('DELIVERED', 'FAILED', 'COMPLETED', 'CANCELLED')
             AND (source_burg_id = ANY($1::int[]) OR dest_burg_id = ANY($1::int[]) OR current_cell_id = ANY($2::int[]))
           ORDER BY id ASC
           LIMIT 8`,
          [regionBurgIds, regionCellIds]
        )
      : { rows: [] };
  const bordersRes = await db.query(
    `SELECT cell_id, faction_a, faction_b
     FROM sim_faction_borders
     WHERE cell_id = ANY($1::int[]) AND is_border = true
     ORDER BY id ASC
     LIMIT 10`,
    [regionCellIds]
  );

  const storylineActors = new Set<string>();
  const openStorylines: StoryContext["region"]["openStorylines"] = [];

  for (const t of threadsRes.rows) {
    const rawActors: string[] = Array.isArray(t.actor_ids) ? t.actor_ids.map(String) : [];
    const verifiedActors: string[] = [];
    for (const raw of rawActors) {
      const ref = raw.startsWith("npc_") ? mapNpcIdToEntityRef(raw) : raw;
      const exists = (await getEntityByRef(db, ref)) ?? (await ensureEntity(db, ref));
      if (exists) {
        verifiedActors.push(exists.ref);
        storylineActors.add(exists.ref);
      }
    }
    const tCellId = Number(t.cell_id);
    const stakesWeight = t.state === "escalated" ? 1.2 : 0.9;
    const sharesActor = verifiedActors.some((a) => importantActors.has(a));
    openStorylines.push({
      id: Number(t.id),
      cellId: tCellId,
      question: cleanLine(t.question, 140),
      stakes: cleanLine(t.stakes, 140),
      actorIds: verifiedActors,
      clock: Number(t.clock || 0),
      clockMax: Number(t.clock_max || 6),
      state: String(t.state),
      score: scoreItem({
        isSameCell: tCellId === cellId,
        sharesActor,
        ageTicks: currentTick - Number(t.created_tick || currentTick),
        stakesWeight,
      }),
    });
  }

  openStorylines.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id - b.id));

  const wRow = wildlifeRes.rows[0];
  const wildlife = wRow
    ? {
        cellId: Number(wRow.id),
        prey: Number(wRow.prey || 0),
        predators: Number(wRow.predators || 0),
        apex: Number(wRow.apex || 0),
        blight: Number(wRow.blight || 0),
      }
    : null;

  return {
    region: {
      burgs,
      openStorylines,
      convoys: convoysRes.rows.map((c: any) => ({
        id: Number(c.id),
        goodName: String(c.good_name),
        quantity: Number(c.quantity || 0),
        status: String(c.status),
        sourceBurgId: Number(c.source_burg_id),
        destBurgId: Number(c.dest_burg_id),
        currentCellId: c.current_cell_id !== null && c.current_cell_id !== undefined ? Number(c.current_cell_id) : null,
      })),
      borders: bordersRes.rows.map((b: any) => ({
        cellId: Number(b.cell_id),
        factionA: b.faction_a !== null && b.faction_a !== undefined ? Number(b.faction_a) : null,
        factionB: b.faction_b !== null && b.faction_b !== undefined ? Number(b.faction_b) : null,
      })),
      wildlife,
    },
    regionCellIds,
    regionBurgIds,
    storylineActors,
  };
}

async function loadWorldSection(db: Db): Promise<StoryContext["world"]> {
  const calRes = await db.query(
    `SELECT tick, year, month, month_name, day_of_month, season, moon_phase
     FROM sim_calendar
     ORDER BY tick DESC
     LIMIT 1`
  );
  const diploRes = await db.query(
    `SELECT d.faction_a_id, d.faction_b_id, d.status, d.tension,
            COALESCE(fa.name, 'Faction #' || d.faction_a_id) AS faction_a_name,
            COALESCE(fb.name, 'Faction #' || d.faction_b_id) AS faction_b_name
     FROM sim_diplomacy d
     LEFT JOIN sim_factions fa ON fa.id = d.faction_a_id
     LEFT JOIN sim_factions fb ON fb.id = d.faction_b_id
     WHERE UPPER(COALESCE(d.status, '')) = 'WAR' OR COALESCE(d.tension, 0) >= 60
     ORDER BY (UPPER(COALESCE(d.status, '')) = 'WAR') DESC, d.tension DESC, d.id ASC
     LIMIT 8`
  );
  const marketRes = await db.query(
    `SELECT m.center_burg_id, COALESCE(b.name, 'Market #' || m.center_burg_id) AS burg_name,
            COALESCE(b.unrest, 0) AS unrest, COALESCE(b.food, 0) AS food
     FROM sim_markets m
     LEFT JOIN sim_burg_economy b ON b.burg_id = m.center_burg_id
     ORDER BY COALESCE(b.unrest, 0) DESC, m.center_burg_id ASC
     LIMIT 5`
  );
  const flowRes = await db.query(
    `SELECT flow_id, name, dragon_name, elemental_power, COALESCE(current_surge, 0) AS current_surge
     FROM sim_chaos_flows
     ORDER BY current_surge DESC, flow_id ASC
     LIMIT 5`
  );
  const facRes = await db.query(
    `SELECT id, name, COALESCE(treasury, 0) AS treasury, COALESCE(wealth, 0) AS wealth
     FROM sim_factions
     ORDER BY treasury DESC, id ASC
     LIMIT 6`
  );

  const cal = calRes.rows[0] || {};
  const tick = Number(cal.tick || 1);
  const date = cal.year
    ? `Y${cal.year} ${cal.month_name || `M${cal.month}`} D${cal.day_of_month || 1}`
    : `Tick ${tick}`;

  const wars = diploRes.rows
    .filter((r: any) => String(r.status || "").toUpperCase() === "WAR")
    .map((r: any) => ({
      factionAId: Number(r.faction_a_id),
      factionBId: Number(r.faction_b_id),
      factionAName: String(r.faction_a_name),
      factionBName: String(r.faction_b_name),
      tension: Number(r.tension || 0),
    }));

  const diplomacy = diploRes.rows
    .filter((r: any) => String(r.status || "").toUpperCase() !== "WAR")
    .map((r: any) => ({
      factionAName: String(r.faction_a_name),
      factionBName: String(r.faction_b_name),
      status: String(r.status || "TENSE"),
      tension: Number(r.tension || 0),
    }));

  const marketExtremes = marketRes.rows.map((m: any) => ({
    burgId: Number(m.center_burg_id),
    burgName: String(m.burg_name),
    summary: `food=${Number(m.food)}, unrest=${Number(m.unrest)}`,
  }));

  const chaosFlows = flowRes.rows.map((f: any) => ({
    flowId: Number(f.flow_id),
    name: String(f.name || `Flow #${f.flow_id}`),
    dragonName: String(f.dragon_name || "Unknown"),
    power: String(f.elemental_power || "Chaos"),
    surge: Number(Number(f.current_surge || 0).toFixed(2)),
  }));

  const factionFinances = facRes.rows.map((f: any) => ({
    factionId: Number(f.id),
    name: String(f.name || `Faction #${f.id}`),
    treasury: Number(f.treasury || 0),
    wealth: Number(f.wealth || 0),
  }));

  return {
    tick,
    date,
    season: String(cal.season || "Unknown"),
    moonPhase: String(cal.moon_phase || "Unknown"),
    wars,
    diplomacy,
    marketExtremes,
    chaosFlows,
    factionFinances,
  };
}

async function loadHistorySection(
  db: Db,
  focusCellId: number,
  regionCellIds: number[],
  regionBurgIds: number[],
  currentTick: number
): Promise<StoryContext["history"]> {
  const eventsRes = await db.query(
    `SELECT id, tick, tier, type, message, cell_id, burg_id
     FROM sim_events
     WHERE cell_id = ANY($1::int[]) OR burg_id = ANY($2::int[]) OR tier IN ('MAJOR', 'CRITICAL')
     ORDER BY id DESC
     LIMIT 12`,
    [regionCellIds, regionBurgIds.length > 0 ? regionBurgIds : [-1]]
  );
  const resolvedRes = await db.query(
    `SELECT id, question, state, resolution
     FROM sim_threads
     WHERE state IN ('resolved', 'expired') AND cell_id = ANY($1::int[])
     ORDER BY id DESC
     LIMIT 6`,
    [regionCellIds]
  );
  const deltasRes = await db.query(
    `SELECT id, tick, source, kind
     FROM world_deltas
     ORDER BY id DESC
     LIMIT 10`
  );

  const recentEvents = eventsRes.rows
    .map((e: any) => {
      const eCellId = e.cell_id !== null && e.cell_id !== undefined ? Number(e.cell_id) : null;
      const tier = String(e.tier || "MINOR");
      const stakesWeight = tier === "CRITICAL" ? 1.4 : tier === "MAJOR" ? 1.0 : 0.6;
      return {
        id: Number(e.id),
        tick: Number(e.tick || 0),
        tier,
        type: String(e.type || "EVENT"),
        message: cleanLine(e.message, 150),
        cellId: eCellId,
        burgId: e.burg_id !== null && e.burg_id !== undefined ? Number(e.burg_id) : null,
        score: scoreItem({
          isSameCell: eCellId === focusCellId,
          sharesActor: false,
          ageTicks: currentTick - Number(e.tick || currentTick),
          stakesWeight,
        }),
      };
    })
    .sort((a: any, b: any) => (b.score !== a.score ? b.score - a.score : b.id - a.id));

  const resolvedHere = resolvedRes.rows.map((r: any) => ({
    id: Number(r.id),
    question: cleanLine(r.question, 110),
    state: String(r.state),
    resolutionSummary: r.resolution ? cleanLine(r.resolution, 110) : null,
  }));

  const deltasTouching = deltasRes.rows.map((d: any) => ({
    id: Number(d.id),
    tick: Number(d.tick || 0),
    source: String(d.source || ""),
    kind: String(d.kind || ""),
  }));

  return {
    recentEvents,
    resolvedHere,
    deltasTouching,
  };
}

async function loadPartySection(
  db: Db,
  party: StoryPartyInput,
  currentTick: number
): Promise<StoryContext["party"]> {
  const explicitIds = party.playerIds?.filter((id) => Number.isFinite(id) && id > 0) ?? [];
  let res =
    explicitIds.length > 0
      ? await db.query(
          `SELECT id, name, species, lineage, institution, inventory, passive_traits
           FROM sim_player_character
           WHERE id = ANY($1::int[])
           ORDER BY id ASC`,
          [explicitIds]
        )
      : party.playerId && party.playerId > 0
        ? await db.query(
            `SELECT id, name, species, lineage, institution, inventory, passive_traits
             FROM sim_player_character
             WHERE id = $1
             LIMIT 1`,
            [party.playerId]
          )
        : await db.query(
            `SELECT id, name, species, lineage, institution, inventory, passive_traits
             FROM sim_player_character
             ORDER BY id ASC
             LIMIT 4`
          );

  if (res.rows.length === 0) {
    res = await db.query(
      `SELECT id, name, species, lineage, institution, inventory, passive_traits
       FROM sim_player_character
       ORDER BY id ASC
       LIMIT 4`
    );
  }

  const characters: StoryContext["party"]["characters"] = [];
  const charIds: number[] = [];

  for (const r of res.rows) {
    const pid = Number(r.id);
    const ref = `player:${pid}`;
    await ensureEntity(db, ref, {
      name: String(r.name || `Adventurer #${pid}`),
      kind: "person",
      lod: "micro",
      createdTick: currentTick,
    });
    charIds.push(pid);
    const invRaw = Array.isArray(r.inventory) ? r.inventory : [];
    const traitsRaw = Array.isArray(r.passive_traits) ? r.passive_traits : [];
    characters.push({
      ref,
      id: pid,
      name: String(r.name || "Adventurer"),
      species: String(r.species || "Human"),
      lineage: String(r.lineage || "Freeborn"),
      institution: String(r.institution || "Independent"),
      inventory: invRaw.slice(0, 4).map((i: any) => (typeof i === "string" ? i : String(i?.name || "Item"))),
      traits: traitsRaw.slice(0, 4).map((t: any) => String(t)),
    });
  }

  let gmMemories: string[] = [];
  if (charIds.length > 0) {
    const memRes = await db.query(
      `SELECT summary FROM sim_gm_memories WHERE player_id = ANY($1::int[]) ORDER BY id DESC LIMIT 6`,
      [charIds]
    );
    gmMemories = memRes.rows.map((r: any) => cleanLine(r.summary, 140)).filter(Boolean);
  }

  return {
    characters,
    recentActions: [],
    standing: [],
    gmMemories,
  };
}

/**
 * Serializes a StoryContext into crisp labelled lines with explicit entity/thread IDs for LLM prompts.
 * Never dumps raw JSON blobs.
 */
export function renderStoryContext(ctx: StoryContext): string {
  const lines: string[] = [];
  const t = ctx.focus.tile;
  lines.push(
    `[FOCUS] Tile cell:${t.cellId} (${t.rx},${t.ry} z=${t.z})` +
      (t.burgId ? ` | Burg [burg:${t.burgId}] ${t.burgName || ""}` : "") +
      (t.layerName ? ` | ${t.layerName}` : "")
  );

  for (const e of ctx.focus.entities) {
    const motive = [e.want ? `Want: ${e.want}` : "", e.flaw ? `Flaw: ${e.flaw}` : "", e.lineWontCross ? `Line: ${e.lineWontCross}` : ""]
      .filter(Boolean)
      .join(" | ");
    lines.push(
      `- Entity [${e.ref}] ${e.name} (${e.role})` +
        (e.tags.length > 0 ? ` tags=${e.tags.join(",")}` : "") +
        (motive ? ` | ${motive}` : "")
    );
  }
  for (const o of ctx.focus.objects) {
    lines.push(
      `- Object [${o.id}] ${o.name}${o.isDestroyed ? " (Destroyed)" : ""}` +
        (o.tags.length > 0 ? ` tags=${o.tags.join(",")}` : "")
    );
  }
  for (const ov of ctx.focus.overlays) {
    lines.push(`- Overlay #${ov.id} ${ov.change} on ${ov.objectRef || "tile"} (tick ${ov.tick}, ${ov.source})`);
  }

  if (ctx.party.characters.length > 0 || ctx.party.gmMemories.length > 0) {
    lines.push("[PARTY]");
    for (const c of ctx.party.characters) {
      lines.push(
        `- PC [${c.ref}] ${c.name} (${c.species}, ${c.institution})` +
          (c.inventory.length > 0 ? ` | Gear: ${c.inventory.join(", ")}` : "")
      );
    }
    for (const mem of ctx.party.gmMemories) {
      lines.push(`- Memory: ${mem}`);
    }
  }

  lines.push("[REGION]");
  for (const b of ctx.region.burgs) {
    const allTags = [...b.econTags, ...b.factionTags];
    lines.push(
      `- Burg [burg:${b.burgId}] ${b.name} (cell:${b.cellId}, ${b.factionName}): food=${b.food} wealth=${b.wealth} unrest=${b.unrest}` +
        (allTags.length > 0 ? ` tags=${allTags.join(",")}` : "")
    );
  }
  for (const th of ctx.region.openStorylines) {
    lines.push(
      `- Storyline [thread:${th.id}] (${th.state} ${th.clock}/${th.clockMax}, cell:${th.cellId}, score=${th.score}): ${th.question} | Stakes: ${th.stakes}` +
        (th.actorIds.length > 0 ? ` | Actors: ${th.actorIds.join(", ")}` : "")
    );
  }
  for (const c of ctx.region.convoys) {
    lines.push(
      `- Convoy #${c.id} (${c.goodName} x${c.quantity}, ${c.status}): burg:${c.sourceBurgId} -> burg:${c.destBurgId}`
    );
  }
  for (const bd of ctx.region.borders) {
    lines.push(`- Border cell:${bd.cellId} (faction:${bd.factionA ?? "?"} vs faction:${bd.factionB ?? "?"})`);
  }
  if (ctx.region.wildlife) {
    const w = ctx.region.wildlife;
    lines.push(`- Wildlife cell:${w.cellId}: prey=${Math.round(w.prey)} predators=${Math.round(w.predators)} apex=${Math.round(w.apex)} blight=${Math.round(w.blight)}`);
  }

  if (ctx.history.recentEvents.length > 0 || ctx.history.resolvedHere.length > 0 || ctx.history.deltasTouching.length > 0) {
    lines.push("[HISTORY]");
    for (const ev of ctx.history.recentEvents) {
      lines.push(`- Event #${ev.id} (tick ${ev.tick}, ${ev.tier}, ${ev.type}): ${ev.message}`);
    }
    for (const r of ctx.history.resolvedHere) {
      lines.push(`- Resolved [thread:${r.id}] (${r.state}): ${r.question}${r.resolutionSummary ? ` -> ${r.resolutionSummary}` : ""}`);
    }
    for (const d of ctx.history.deltasTouching) {
      lines.push(`- Delta #${d.id} (tick ${d.tick}, ${d.source}): ${d.kind}`);
    }
  }

  lines.push("[WORLD]");
  lines.push(`- Calendar: ${ctx.world.date} | Season: ${ctx.world.season} | Moon: ${ctx.world.moonPhase}`);
  for (const w of ctx.world.wars) {
    lines.push(`- War [war:${w.factionAId}-${w.factionBId}] ${w.factionAName} vs ${w.factionBName} (tension ${w.tension})`);
  }
  for (const dp of ctx.world.diplomacy) {
    lines.push(`- Diplomacy: ${dp.factionAName} & ${dp.factionBName} (${dp.status}, tension ${dp.tension})`);
  }
  for (const mk of ctx.world.marketExtremes) {
    lines.push(`- Market [burg:${mk.burgId}] ${mk.burgName}: ${mk.summary}`);
  }
  for (const fl of ctx.world.chaosFlows) {
    lines.push(`- Flow [flow:${fl.flowId}] ${fl.name} (${fl.dragonName}, ${fl.power}): surge=${fl.surge}`);
  }
  for (const fn of ctx.world.factionFinances) {
    lines.push(`- Faction [faction:${fn.factionId}] ${fn.name}: treasury=${fn.treasury} wealth=${fn.wealth}`);
  }

  return lines.join("\n");
}

function applyTokenBudget(ctx: StoryContext, budget: number): void {
  const dropCounts = new Map<string, number>();
  const bump = (section: string) => {
    dropCounts.set(section, (dropCounts.get(section) || 0) + 1);
  };

  // Stage 1: Trim long tails evenly so world wars, region storylines, and neighboring burgs stay represented alongside focus entities.
  const softTrimmers: Array<{ section: string; tryDrop: () => boolean }> = [
    { section: "world.factionFinances", tryDrop: () => Boolean(ctx.world.factionFinances.length > 2 && ctx.world.factionFinances.pop()) },
    { section: "world.marketExtremes", tryDrop: () => Boolean(ctx.world.marketExtremes.length > 2 && ctx.world.marketExtremes.pop()) },
    { section: "world.chaosFlows", tryDrop: () => Boolean(ctx.world.chaosFlows.length > 2 && ctx.world.chaosFlows.pop()) },
    { section: "world.diplomacy", tryDrop: () => Boolean(ctx.world.diplomacy.length > 2 && ctx.world.diplomacy.pop()) },
    { section: "history.deltasTouching", tryDrop: () => Boolean(ctx.history.deltasTouching.length > 3 && ctx.history.deltasTouching.pop()) },
    { section: "history.recentEvents", tryDrop: () => Boolean(ctx.history.recentEvents.length > 4 && ctx.history.recentEvents.pop()) },
    { section: "focus.objects", tryDrop: () => Boolean(ctx.focus.objects.length > 6 && ctx.focus.objects.pop()) },
    { section: "focus.entities", tryDrop: () => Boolean(ctx.focus.entities.length > 6 && ctx.focus.entities.pop()) },
    { section: "region.borders", tryDrop: () => Boolean(ctx.region.borders.length > 2 && ctx.region.borders.pop()) },
    { section: "region.convoys", tryDrop: () => Boolean(ctx.region.convoys.length > 2 && ctx.region.convoys.pop()) },
    { section: "region.burgs", tryDrop: () => Boolean(ctx.region.burgs.length > 3 && ctx.region.burgs.pop()) },
    { section: "party.gmMemories", tryDrop: () => Boolean(ctx.party.gmMemories.length > 3 && ctx.party.gmMemories.pop()) },
  ];

  // Stage 2: Deep trim in reverse priority order: world -> history -> region -> party -> focus (focus.tile is always preserved)
  const hardTrimmers: Array<{ section: string; tryDrop: () => boolean }> = [
    { section: "world.factionFinances", tryDrop: () => Boolean(ctx.world.factionFinances.pop()) },
    { section: "world.marketExtremes", tryDrop: () => Boolean(ctx.world.marketExtremes.pop()) },
    { section: "world.chaosFlows", tryDrop: () => Boolean(ctx.world.chaosFlows.pop()) },
    { section: "world.diplomacy", tryDrop: () => Boolean(ctx.world.diplomacy.pop()) },
    { section: "world.wars", tryDrop: () => Boolean(ctx.world.wars.pop()) },
    { section: "history.deltasTouching", tryDrop: () => Boolean(ctx.history.deltasTouching.pop()) },
    { section: "history.resolvedHere", tryDrop: () => Boolean(ctx.history.resolvedHere.pop()) },
    { section: "history.recentEvents", tryDrop: () => Boolean(ctx.history.recentEvents.pop()) },
    { section: "region.borders", tryDrop: () => Boolean(ctx.region.borders.pop()) },
    { section: "region.convoys", tryDrop: () => Boolean(ctx.region.convoys.pop()) },
    {
      section: "region.wildlife",
      tryDrop: () => {
        if (!ctx.region.wildlife) return false;
        ctx.region.wildlife = null;
        return true;
      },
    },
    { section: "region.burgs", tryDrop: () => Boolean(ctx.region.burgs.length > 2 && ctx.region.burgs.pop()) },
    { section: "region.openStorylines", tryDrop: () => Boolean(ctx.region.openStorylines.pop()) },
    { section: "region.burgs", tryDrop: () => Boolean(ctx.region.burgs.pop()) },
    { section: "party.gmMemories", tryDrop: () => Boolean(ctx.party.gmMemories.pop()) },
    { section: "party.characters", tryDrop: () => Boolean(ctx.party.characters.pop()) },
    { section: "focus.overlays", tryDrop: () => Boolean(ctx.focus.overlays.pop()) },
    { section: "focus.objects", tryDrop: () => Boolean(ctx.focus.objects.pop()) },
    { section: "focus.entities", tryDrop: () => Boolean(ctx.focus.entities.pop()) },
  ];

  let tokens = estimateTokens(renderStoryContext(ctx));
  while (tokens > budget) {
    let droppedOne = false;
    for (const t of softTrimmers) {
      if (t.tryDrop()) {
        bump(t.section);
        droppedOne = true;
        break;
      }
    }
    if (!droppedOne) {
      for (const t of hardTrimmers) {
        if (t.tryDrop()) {
          bump(t.section);
          droppedOne = true;
          break;
        }
      }
    }
    if (!droppedOne) break;
    tokens = estimateTokens(renderStoryContext(ctx));
  }

  ctx.meta.tokenEstimate = tokens;
  ctx.meta.budget = budget;
  ctx.meta.dropped = Array.from(dropCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([section, count]) => ({ section, count }));
}

/**
 * Builds a ranked, token-budgeted StoryContext spanning Micro Focus, Party, Meso Region, History, and World.
 */
export async function buildStoryContext(
  db: Db,
  focus: StoryFocusInput,
  party: StoryPartyInput = {},
  options: StoryContextOptions = {}
): Promise<StoryContext> {
  const cellId = Number(focus.cellId) || 30627;
  const rx = focus.rx ?? 50;
  const ry = focus.ry ?? 50;
  const z = focus.z ?? 0;
  const budget = Math.max(120, Math.round(options.tokenBudget ?? 4000));
  const maxNeighborCells = Math.max(2, Math.round(options.maxNeighborCells ?? 8));

  const world = await loadWorldSection(db);
  const currentTick = world.tick;
  const focusSec = await loadFocusSection(db, cellId, rx, ry, z, currentTick);
  const partySec = await loadPartySection(db, party, currentTick);

  const importantActors = new Set<string>([
    ...focusSec.entities.map((e) => e.ref),
    ...partySec.characters.map((c) => c.ref),
  ]);

  const { region, regionCellIds, regionBurgIds } = await loadRegionSection(
    db,
    cellId,
    maxNeighborCells,
    currentTick,
    importantActors
  );
  const history = await loadHistorySection(db, cellId, regionCellIds, regionBurgIds, currentTick);

  const ctx: StoryContext = {
    focus: focusSec,
    region,
    world,
    history,
    party: partySec,
    meta: {
      tokenEstimate: 0,
      budget,
      dropped: [],
    },
  };

  applyTokenBudget(ctx, budget);
  return ctx;
}
