import { dateForTick } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";
import { upsertEntity } from "../../entities/registry.js";
import { sqlShuffle } from "../../rng.js";
import type {
  CartelBurgSnap,
  CartelCanyonSnap,
  CartelLairSnap,
  CartelRowSnap,
  CartelsSnapshot,
  CircusStopSnap,
  CommanderSnap,
  FactionTreasurySnap,
  GhostwindDropSnap,
  MountainBurgSnap,
  OuterBurgSnap,
} from "./types.js";

/**
 * Ensures every outlaw syndicate has `worker_groups` and a Syndicate Boss paragon.
 * Fast path runs a single read query when already populated (zero writes on normal ticks).
 */
export async function ensureCartelBootstrap(client: Db, tick: number): Promise<void> {
  const res = await client.query(`
    SELECT f.id, f.name, f.origin_cell_id, f.worker_groups,
           EXISTS(SELECT 1 FROM sim_paragons p WHERE p.outlaw_id = f.id) AS has_boss
    FROM sim_outlaw_factions f
    ORDER BY f.id ASC
  `);

  for (const r of res.rows) {
    const fid = Number(r.id);
    if (r.worker_groups === undefined || r.worker_groups === null) {
      await client.query(`UPDATE sim_outlaw_factions SET worker_groups = 3 WHERE id = $1`, [fid]);
    }
    if (!r.has_boss) {
      const originBurgRes = await client.query(
        `SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
        [r.origin_cell_id]
      );
      const originBurgId = originBurgRes.rows[0]?.burg_id || 1;
      const traits = JSON.stringify([{ name: "Ruthless", modifier: 0.2 }]);
      const newP = await client.query(
        `INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits)
         VALUES ($1, $2, 'Syndicate Boss', $3, $4) RETURNING *`,
        [fid, originBurgId, `${r.name} Boss`, traits]
      );
      const paragon = newP.rows[0];
      if (paragon?.id) {
        await upsertEntity(client, {
          ref: `paragon:${paragon.id}`,
          kind: "person",
          name: `${paragon.name} (${paragon.title || "Syndicate Boss"})`,
          alive: true,
          lod: "macro",
          cellId: Number(r.origin_cell_id || 0) || null,
          sourceTable: "sim_paragons",
          sourceId: String(paragon.id),
          createdTick: tick,
        });
      }
    }
  }
}

/**
 * Loads cartel, target burg, lair, commander, active canyon, dead drop, and tick-gated
 * auxiliary data cleanly into a `CartelsSnapshot` (~6-7 queries on typical days).
 */
export async function loadCartels(
  client: Db,
  tick: number,
  loreDate: string
): Promise<CartelsSnapshot> {
  const dayOfYear = dateForTick(tick).dayOfYear;

  const cartelsRes = await client.query(`SELECT * FROM sim_outlaw_factions ORDER BY id ASC`);
  const cartels: CartelRowSnap[] = cartelsRes.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name || "Outlaw Syndicate"),
    type: String(r.type || "CARTEL"),
    originCellId: r.origin_cell_id !== null && r.origin_cell_id !== undefined ? Number(r.origin_cell_id) : null,
    originBurgId: r.origin_burg_id !== null && r.origin_burg_id !== undefined ? Number(r.origin_burg_id) : null,
    manpower: Number(r.manpower || 0),
    wealth: Number(r.wealth || 0),
    heat: Number(r.heat || 0),
    workerGroups: Number(r.worker_groups ?? 3),
  }));

  const targetBurgsRes = await client.query(`
    SELECT b.burg_id, b.cell_id, b.name, b.unrest, b.pop_null, b.pop_attuned, b.wealth, b.health,
           b.food, b.raw_materials, b.refined_goods, c.faction_id
    FROM sim_burg_economy b
    JOIN sim_cells c ON c.id = b.cell_id
    ORDER BY ${sqlShuffle("b.burg_id")}
    LIMIT 60
  `);
  const targetBurgs: CartelBurgSnap[] = targetBurgsRes.rows.map((r: any) => ({
    burgId: Number(r.burg_id),
    cellId: Number(r.cell_id),
    name: String(r.name || ""),
    unrest: Number(r.unrest || 0),
    popNull: Number(r.pop_null || 0),
    popAttuned: Number(r.pop_attuned || 0),
    wealth: Number(r.wealth || 0),
    health: r.health !== null && r.health !== undefined ? Number(r.health) : 100,
    food: Number(r.food || 0),
    rawMaterials: Number(r.raw_materials || 0),
    refinedGoods: Number(r.refined_goods || 0),
    factionId: r.faction_id !== null && r.faction_id !== undefined ? Number(r.faction_id) : null,
  }));

  const lairsRes = await client.query(`
    SELECT l.id, l.faction_id, l.cell_id, l.burg_id, l.lair_type, l.manpower, l.heat,
           b.name AS burg_name, b.military_forces, f.name AS cartel_name
    FROM sim_fringe_lairs l
    LEFT JOIN sim_burg_economy b ON l.burg_id = b.burg_id
    LEFT JOIN sim_outlaw_factions f ON l.faction_id = f.id
    ORDER BY l.id ASC
  `);
  const lairs: CartelLairSnap[] = lairsRes.rows.map((r: any) => ({
    id: Number(r.id),
    factionId: Number(r.faction_id),
    cellId: Number(r.cell_id),
    burgId: r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null,
    lairType: String(r.lair_type || ""),
    manpower: Number(r.manpower || 0),
    heat: Number(r.heat || 0),
    burgName: r.burg_name ? String(r.burg_name) : null,
    militaryForces: r.military_forces,
    cartelName: r.cartel_name ? String(r.cartel_name) : null,
  }));

  const cmdRes = await client.query(`
    SELECT DISTINCT ON (burg_id) burg_id, traits, corruption_score
    FROM sim_paragons
    WHERE burg_id IS NOT NULL AND title LIKE '%Commander%'
    ORDER BY burg_id, id ASC
  `);
  const commandersByBurg: Record<number, CommanderSnap> = {};
  for (const r of cmdRes.rows) {
    commandersByBurg[Number(r.burg_id)] = {
      traits: r.traits,
      corruptionScore: Number(r.corruption_score || 0),
    };
  }

  const canyonRes = await client.query(`
    SELECT c.id, c.name, c.cell_id, nb.burg_id AS nearest_burg_id, nb.name AS nearest_burg_name
    FROM sim_grind_canyons c
    LEFT JOIN LATERAL (
      SELECT b.burg_id, b.name
      FROM sim_burg_economy b
      ORDER BY cell_dist2(b.cell_id, c.cell_id) ASC, b.burg_id ASC
      LIMIT 1
    ) nb ON true
    WHERE c.status IN ('OPEN', 'COLLAPSING')
    ORDER BY c.id ASC
  `);
  const activeCanyons: CartelCanyonSnap[] = canyonRes.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name || ""),
    cellId: Number(r.cell_id),
    nearestBurgId: r.nearest_burg_id !== null && r.nearest_burg_id !== undefined ? Number(r.nearest_burg_id) : null,
    nearestBurgName: r.nearest_burg_name ? String(r.nearest_burg_name) : null,
  }));

  const dropsRes = await client.query(`
    SELECT d.id, d.created_tick, d.client_faction_id, d.target_faction_id, d.target_burg_id, d.bounty_gold,
           cf.name AS client_name, tf.name AS target_name,
           b.name AS target_burg_name, b.wealth AS target_wealth, b.food AS target_food
    FROM sim_ghostwind_dead_drops d
    JOIN sim_factions cf ON cf.id = d.client_faction_id
    JOIN sim_factions tf ON tf.id = d.target_faction_id
    JOIN sim_burg_economy b ON b.burg_id = d.target_burg_id
    WHERE d.status = 'PENDING'
    ORDER BY d.id ASC
  `);
  const pendingGhostwindDrops: GhostwindDropSnap[] = dropsRes.rows.map((r: any) => ({
    id: Number(r.id),
    createdTick: Number(r.created_tick || 0),
    clientFactionId: Number(r.client_faction_id),
    targetFactionId: Number(r.target_faction_id),
    targetBurgId: Number(r.target_burg_id),
    bountyGold: Number(r.bounty_gold || 0),
    clientName: String(r.client_name || ""),
    targetName: String(r.target_name || ""),
    targetBurgName: String(r.target_burg_name || ""),
    targetBurgWealth: Number(r.target_wealth || 0),
    targetBurgFood: Number(r.target_food || 0),
  }));

  let lastGhostwindStrikeTick = 0;
  let outerBurgs: OuterBurgSnap[] = [];
  const capitalBurgByFaction: Record<number, number> = {};
  if (pendingGhostwindDrops.length > 0) {
    const lastRes = await client.query(
      `SELECT COALESCE(MAX(executed_tick), 0)::int AS last_tick FROM sim_ghostwind_dead_drops WHERE status = 'EXECUTED'`
    );
    lastGhostwindStrikeTick = Number(lastRes.rows[0]?.last_tick || 0);

    const outerRes = await client.query(
      `SELECT burg_id, name FROM sim_burg_economy WHERE is_capital = false ORDER BY wealth ASC, burg_id ASC LIMIT 3`
    );
    outerBurgs = outerRes.rows.map((r: any) => ({ burgId: Number(r.burg_id), name: String(r.name || "") }));

    const clientFids = Array.from(new Set(pendingGhostwindDrops.map((d) => d.clientFactionId)));
    const capRes = await client.query(
      `SELECT DISTINCT ON (c.faction_id) c.faction_id, b.burg_id
       FROM sim_burg_economy b
       JOIN sim_cells c ON b.cell_id = c.id
       WHERE c.faction_id = ANY($1::int[]) AND b.is_capital = true
       ORDER BY c.faction_id, b.burg_id ASC`,
      [clientFids]
    );
    for (const r of capRes.rows) {
      capitalBurgByFaction[Number(r.faction_id)] = Number(r.burg_id);
    }
  }

  let topPowers: FactionTreasurySnap[] = [];
  const richestBurgByFaction: Record<number, { burgId: number; name: string }> = {};
  if (dayOfYear === 48 || dayOfYear === 313) {
    const topRes = await client.query(`
      SELECT id, name, treasury FROM sim_factions
      WHERE id NOT IN (1, 21) AND treasury >= 250
      ORDER BY treasury DESC, id ASC LIMIT 4
    `);
    topPowers = topRes.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name || ""),
      treasury: Number(r.treasury || 0),
    }));
    if (topPowers.length >= 4) {
      const targetIds = topPowers.map((p) => p.id);
      const rbRes = await client.query(
        `SELECT DISTINCT ON (c.faction_id) c.faction_id, b.burg_id, b.name
         FROM sim_burg_economy b
         JOIN sim_cells c ON b.cell_id = c.id
         WHERE c.faction_id = ANY($1::int[]) AND b.wealth >= 60
         ORDER BY c.faction_id, b.wealth DESC, b.burg_id ASC`,
        [targetIds]
      );
      for (const r of rbRes.rows) {
        richestBurgByFaction[Number(r.faction_id)] = {
          burgId: Number(r.burg_id),
          name: String(r.name || ""),
        };
      }
    }
  }

  let hireableFactions: FactionTreasurySnap[] = [];
  if (tick % 4 === 0) {
    const hfRes = await client.query(
      `SELECT id, name, treasury FROM sim_factions WHERE id > 0 AND treasury >= 2000 ORDER BY id ASC`
    );
    hireableFactions = hfRes.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name || ""),
      treasury: Number(r.treasury || 0),
    }));
  }

  let mountainBurgs: MountainBurgSnap[] = [];
  if (tick % 3 === 0 || tick % 4 === 1) {
    const mbRes = await client.query(`
      SELECT b.burg_id, b.name, b.cell_id, c.elevation
      FROM sim_burg_economy b
      JOIN sim_cells c ON b.cell_id = c.id
      WHERE c.elevation >= 55
      ORDER BY b.burg_id ASC
    `);
    mountainBurgs = mbRes.rows.map((r: any) => ({
      burgId: Number(r.burg_id),
      name: String(r.name || ""),
      cellId: Number(r.cell_id),
      elevation: Number(r.elevation || 0),
    }));
  }

  let circusCandidates: CircusStopSnap[] = [];
  if (tick % 45 === 15) {
    const ccRes = await client.query(`
      SELECT f.id AS faction_id, f.name AS faction_name, b.burg_id, b.name AS burg_name, b.cell_id
      FROM sim_factions f
      JOIN sim_burg_economy b ON b.cell_id IN (SELECT id FROM sim_cells WHERE faction_id = f.id)
      WHERE f.id > 0 AND b.wealth > 100
      ORDER BY f.id ASC, b.burg_id ASC
    `);
    circusCandidates = ccRes.rows.map((r: any) => ({
      factionId: Number(r.faction_id),
      factionName: String(r.faction_name || ""),
      burgId: Number(r.burg_id),
      burgName: String(r.burg_name || ""),
      cellId: Number(r.cell_id),
    }));
  }

  let crackdownCrowns: FactionTreasurySnap[] = [];
  if (tick % 20 === 0) {
    const ccRes = await client.query(
      `SELECT id, name, treasury FROM sim_factions WHERE id > 0 AND treasury >= 1000 ORDER BY id ASC`
    );
    crackdownCrowns = ccRes.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name || ""),
      treasury: Number(r.treasury || 0),
    }));
  }

  let ghostspringOriginBurgId: number | null = null;
  const gs = cartels.find((c) => c.id === 8 || c.name.includes("Ghostspring"));
  if (gs && !lairs.some((l) => l.factionId === gs.id)) {
    const peakCell = gs.originCellId || 30627;
    const obRes = await client.query(
      `SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
      [peakCell]
    );
    ghostspringOriginBurgId = obRes.rows[0]?.burg_id ? Number(obRes.rows[0].burg_id) : 1;
  }

  return {
    tick,
    loreDate,
    dayOfYear,
    cartels,
    targetBurgs,
    lairs,
    commandersByBurg,
    activeCanyons,
    pendingGhostwindDrops,
    lastGhostwindStrikeTick,
    topPowers,
    richestBurgByFaction,
    outerBurgs,
    capitalBurgByFaction,
    hireableFactions,
    mountainBurgs,
    circusCandidates,
    crackdownCrowns,
    ghostspringOriginBurgId,
  };
}
