import pool from "../db/pool";
import Database from "better-sqlite3";
import path from "path";

// Use better-sqlite3 directly for the synchronous batch writes — much faster than the async pool wrapper
const dbPath = path.resolve(__dirname, "../../aetheria.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function getLoreDate(t: number) {
  const s = ["The Thaw","The Bloom","The Zenith","The Wilt","The Fall","The Chill","The Rime","Shadow Week"];
  return `Year ${Math.floor(t / 8) + 1}, ${s[t % 8]}`;
}

import { simulateBurgEconomy, BurgEconomyState, StockpileState, EconomyInputs } from "../simulation/economyPure";

export async function executeMasterTick() {
  // ─── Phase 1: Cosmology & Time ────────────────────────────────────────────
  let tick = 1, year = 1, month = 1;
  const calRow = db.prepare("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1").get() as any;
  if (calRow) {
    tick = calRow.tick + 1;
    month = calRow.month;
    year = calRow.year;
    if (tick % 30 === 0) {
      month++;
      if (month > 8) { month = 1; year++; }
    }
    db.prepare("UPDATE sim_calendar SET tick = ?, month = ?, year = ? WHERE id = ?").run(tick, month, year, calRow.id);
  } else {
    db.prepare("INSERT INTO sim_calendar (tick, year, month, moon_phase, season) VALUES (?, ?, ?, ?, ?)").run(tick, year, month, "Full", "Spring");
  }

  const loreDate = getLoreDate(tick);
  const isShadowWeek = (month === 8);

  if (isShadowWeek) {
    db.prepare("UPDATE sim_sacred_groves SET seal_strength = MAX(0, seal_strength - 10)").run();
  }

  const events: { type: string; message: string; tier: string; burg_id: number | null; faction_id: number | null }[] = [];

  // ─── Load All Data In Bulk ────────────────────────────────────────────────
  const burgs = db.prepare("SELECT * FROM sim_burg_economy").all() as any[];
  const stockpiles = db.prepare("SELECT * FROM sim_industrial_stockpiles").all() as any[];
  const infra = db.prepare("SELECT burg_id, type FROM sim_infrastructure").all() as any[];
  const tradeRoutes = db.prepare("SELECT source_burg_id, dest_burg_id FROM sim_trade_routes").all() as any[];
  const mayors = db.prepare("SELECT burg_id, corruption_score, traits FROM sim_paragons WHERE title = 'Mayor'").all() as any[];
  const cells = db.prepare("SELECT * FROM sim_cells").all() as any[];
  const factions = db.prepare("SELECT * FROM sim_factions").all() as any[];
  const outlawFactions = db.prepare("SELECT * FROM sim_outlaw_factions").all() as any[];
  const enterprises = db.prepare("SELECT * FROM sim_outlaw_enterprises").all() as any[];

  // ─── Build Lookup Maps ────────────────────────────────────────────────────
  const stockpileMap = new Map<number, any>();
  for (const s of stockpiles) stockpileMap.set(s.burg_id, s);

  const infraMap = new Map<number, Set<string>>();
  for (const r of infra) {
    if (!infraMap.has(r.burg_id)) infraMap.set(r.burg_id, new Set());
    infraMap.get(r.burg_id)!.add(r.type);
  }

  const connectedBurgs = new Set<number>();
  for (const r of tradeRoutes) {
    connectedBurgs.add(r.source_burg_id);
    connectedBurgs.add(r.dest_burg_id);
  }

  const mayorMap = new Map<number, any>();
  for (const m of mayors) mayorMap.set(m.burg_id, m);

  const cellMap = new Map<number, any>();
  for (const c of cells) cellMap.set(c.id, c);

  // Inventory map (complex_inventory JSON per burg)
  const invMap = new Map<number, Record<string, number>>();
  for (const s of stockpiles) {
    try { invMap.set(s.burg_id, JSON.parse(s.complex_inventory || "{}")); }
    catch { invMap.set(s.burg_id, {}); }
  }
  for (const b of burgs) {
    if (!invMap.has(b.burg_id)) invMap.set(b.burg_id, {});
  }

  // ─── Phase 2: Economy & Ecology (Computed via Pure Functions) ────────────
  const burgUpdates = new Map<number, any>();
  const stockpileUpdates = new Map<number, any>();
  const newInfra: { burg_id: number; type: string }[] = [];
  const newAgents: { role: string; cell_id: number }[] = [];

  // Global ecology regen (bulk)
  db.prepare("UPDATE sim_cells SET eco_plants = MIN(100, COALESCE(eco_plants,0) + 5), eco_prey = MIN(100, COALESCE(eco_prey,0) + 5)").run();

  for (const burg of burgs) {
    const bId = burg.burg_id as number;
    const types = infraMap.get(bId) || new Set<string>();
    const sp = stockpileMap.get(bId) || { raw_wood: 0, raw_ore: 0, raw_herbs: 0, raw_fiber: 0, refined_lumber: 0, forged_steel: 0, alchemical_potions: 0, textiles: 0 };
    const inv = invMap.get(bId) || {};

    const mayor = mayorMap.get(bId);
    let traitMod = 0, hasAgrarian = false, hasParanoid = false;
    if (mayor?.traits) {
      try {
        const pt = typeof mayor.traits === "string" ? JSON.parse(mayor.traits) : mayor.traits;
        if (pt.length > 0) { traitMod = pt[0].modifier || 0; hasAgrarian = pt[0].name === "agrarian"; hasParanoid = pt[0].name === "paranoid"; }
      } catch {}
    }

    const viceDenCount = enterprises.filter(e => e.target_id === bId && ["VICE_DEN", "NARCOTICS"].includes(e.enterprise_type)).length;

    const inputs: EconomyInputs = {
      infraTypes: types,
      hasMarketConnection: connectedBurgs.has(bId),
      mayorTraitModifier: traitMod,
      viceDenCount
    };

    const nextState = simulateBurgEconomy(
      { food: burg.food, wealth: burg.wealth, unrest: burg.unrest, health: burg.health, pop_null: burg.pop_null },
      { raw_wood: sp.raw_wood, raw_ore: sp.raw_ore, raw_herbs: sp.raw_herbs, raw_fiber: sp.raw_fiber, refined_lumber: sp.refined_lumber, forged_steel: sp.forged_steel, alchemical_potions: sp.alchemical_potions, textiles: sp.textiles },
      inv,
      inputs
    );

    invMap.set(bId, nextState.inv);
    stockpileUpdates.set(bId, { ...nextState.stockpile, complex_inventory: JSON.stringify(nextState.inv) });
    burgUpdates.set(bId, { burg_id: bId, ...nextState.burg });

    const newWealth = nextState.burg.wealth;
    const rl = nextState.stockpile.refined_lumber;
    const fs = nextState.stockpile.forged_steel;
    const newPop = nextState.burg.pop_null;

    // Autonomous building
    if (hasAgrarian && !types.has("FARM") && newWealth >= 20 && rl >= 20) {
      newInfra.push({ burg_id: bId, type: "FARM" });
      types.add("FARM");
    } else if (hasParanoid && !types.has("WALL") && newWealth >= 50 && fs >= 50 && rl >= 50) {
      newInfra.push({ burg_id: bId, type: "WALL" });
      types.add("WALL");
    }

    // Warden recruitment
    if (Math.random() < 0.05 && newPop > 0) {
      burgUpdates.get(bId)!.pop_null = Math.max(0, newPop - 10);
      newAgents.push({ role: "Warden", cell_id: burg.cell_id });
    }
  }

  // ─── Phase 2: Batch Flush All Burg & Stockpile Updates ───────────────────
  const updateBurgStmt = db.prepare(
    "UPDATE sim_burg_economy SET food=?, wealth=?, unrest=?, health=?, pop_null=? WHERE burg_id=?"
  );
  const upsertStockStmt = db.prepare(`
    INSERT INTO sim_industrial_stockpiles (burg_id, raw_wood, raw_ore, raw_herbs, raw_fiber, refined_lumber, forged_steel, alchemical_potions, textiles, complex_inventory)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(burg_id) DO UPDATE SET raw_wood=excluded.raw_wood, raw_ore=excluded.raw_ore, raw_herbs=excluded.raw_herbs, raw_fiber=excluded.raw_fiber, refined_lumber=excluded.refined_lumber, forged_steel=excluded.forged_steel, alchemical_potions=excluded.alchemical_potions, textiles=excluded.textiles, complex_inventory=excluded.complex_inventory
  `);
  const insertInfraStmt = db.prepare("INSERT OR IGNORE INTO sim_infrastructure (burg_id, type) VALUES (?, ?)");
  const insertAgentStmt = db.prepare("INSERT INTO sim_agents (role, location_cell_id) VALUES (?, ?)");
  const insertEventStmt = db.prepare(
    "INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const batchWrite = db.transaction(() => {
    for (const u of burgUpdates.values()) {
      updateBurgStmt.run(u.food, u.wealth, u.unrest, u.health, u.pop_null, u.burg_id);
    }
    for (const [bId, sp] of stockpileUpdates.entries()) {
      upsertStockStmt.run(bId, sp.raw_wood, sp.raw_ore, sp.raw_herbs, sp.raw_fiber, sp.refined_lumber, sp.forged_steel, sp.alchemical_potions, sp.textiles, sp.complex_inventory);
    }
    for (const inf of newInfra) {
      insertInfraStmt.run(inf.burg_id, inf.type);
    }
    for (const ag of newAgents) {
      insertAgentStmt.run(ag.role, ag.cell_id);
    }
  });
  batchWrite();

  // ─── Phase 2.5: Military Upkeep (Batch) ──────────────────────────────────
  const freshBurgs = db.prepare("SELECT * FROM sim_burg_economy").all() as any[];
  const militaryUpdates: { pop_null: number; food: number; burg_id: number }[] = [];

  for (const burg of freshBurgs) {
    let mf: Record<string, number> = {};
    try { mf = JSON.parse(burg.military_forces || "{}"); } catch {}
    const totalTroops = Object.values(mf).reduce((a, b) => a + (b as number), 0);
    if (totalTroops === 0) continue;

    const maxTroops = Math.floor((burg.pop_null || 0) * 0.05);
    let capChanged = false;
    for (const k of Object.keys(mf)) {
      const v = mf[k] || 0;
      if (totalTroops > maxTroops && v > 0) { mf[k] = Math.floor(v * (maxTroops / totalTroops)); capChanged = true; }
    }

    const upkeep = Math.floor(totalTroops / 100) * 5;
    const inv = invMap.get(burg.burg_id) || {};
    let newFood = burg.food || 0;
    let hasFood = false;
    if (newFood >= upkeep) { newFood -= upkeep; hasFood = true; }
    else if ((inv["grain"] || 0) >= upkeep) { inv["grain"] = (inv["grain"] || 0) - upkeep; hasFood = true; }

    if (!hasFood && totalTroops > 0) {
      // Desertion
      for (const k of Object.keys(mf)) {
        const v = mf[k] || 0;
        if (v > 0) mf[k] = Math.max(0, v - Math.ceil(v * 0.1));
      }
      events.push({ type: "DESERTION", message: `Desertion in Burg ${burg.burg_id} — troops went unpaid.`, tier: "MINOR", burg_id: burg.burg_id, faction_id: burg.faction_id });
    }

    if (capChanged || !hasFood) {
      militaryUpdates.push({ pop_null: burg.pop_null, food: newFood, burg_id: burg.burg_id });
      db.prepare("UPDATE sim_burg_economy SET military_forces=?, food=? WHERE burg_id=?").run(JSON.stringify(mf), newFood, burg.burg_id);
    }
  }

  // ─── Phase 3: Demographics (Paragon seeding) ─────────────────────────────
  const burgsWithoutMayor = db.prepare(`
    SELECT b.burg_id, b.cell_id, b.pop_null FROM sim_burg_economy b
    LEFT JOIN sim_paragons p ON p.burg_id = b.burg_id AND p.title = 'Mayor'
    WHERE p.id IS NULL AND b.pop_null > 100
    LIMIT 50
  `).all() as any[];

  const insertParagonStmt = db.prepare(
    "INSERT INTO sim_paragons (burg_id, name, title, corruption_score, traits) VALUES (?, ?, ?, ?, ?)"
  );
  const seedParagons = db.transaction(() => {
    for (const b of burgsWithoutMayor) {
      const cs = Math.floor(Math.random() * 100);
      const trait = cs > 70 ? { name: "corrupt", modifier: -0.2 } : cs < 30 ? { name: "agrarian", modifier: 0.3 } : { name: "stable", modifier: 0.0 };
      insertParagonStmt.run(b.burg_id, `Mayor ${b.burg_id}`, "Mayor", cs, JSON.stringify([trait]));
    }
  });
  seedParagons();

  // ─── Phase 4: Upkeep & Dragon Seals ─────────────────────────────────────
  if (isShadowWeek) {
    events.push({ type: "SHADOW_WEEK", message: `Shadow Week: Dragon Prison seals weakened across the realm.`, tier: "MAJOR", burg_id: null, faction_id: null });
  }

  // Thermodynamic dragon seal recharge from outlaw heat
  const totalOutlawHeat = outlawFactions.reduce((sum: number, f: any) => sum + (f.heat || 0), 0);
  if (totalOutlawHeat > 0) {
    const resonance = Math.floor(totalOutlawHeat / 10);
    db.prepare("UPDATE sim_sacred_groves SET seal_strength = MIN(100, seal_strength + ?)").run(resonance);
  }

  // ─── Phase 5: Underworld ──────────────────────────────────────────────────
  const heatUpdates: { id: number; heat: number }[] = [];
  for (const ent of enterprises) {
    const heat = ent.enterprise_type === "VICE_DEN" ? 8 : ent.enterprise_type === "NARCOTICS" ? 5 : 2;
    const faction = outlawFactions.find((f: any) => f.id === ent.faction_id);
    if (faction) heatUpdates.push({ id: faction.id, heat: (faction.heat || 0) + heat });

  }

  // Militia vs cartel (burgs with enough troops fight back)
  for (const burg of freshBurgs) {
    let mf: Record<string, number> = {};
    try { mf = JSON.parse(burg.military_forces || "{}"); } catch {}
    const troops = (mf["Footmen"] || 0) + (mf["Thorn-men"] || 0) * 1.5;
    if (troops < 10) continue;

    const entInBurg = enterprises.find((e: any) => e.target_id === burg.burg_id && ["VICE_DEN", "NARCOTICS"].includes(e.enterprise_type));
    if (!entInBurg) continue;
    const faction = outlawFactions.find((f: any) => f.id === entInBurg.faction_id);
    if (!faction) continue;

    if (troops > (faction.heat || 0)) {
      db.prepare("DELETE FROM sim_outlaw_enterprises WHERE id = ?").run(entInBurg.id);
      db.prepare("UPDATE sim_outlaw_factions SET manpower = MAX(0, manpower - 50) WHERE id = ?").run(faction.id);
      events.push({ type: "CARTEL_BUST", message: `Militia in Burg ${burg.burg_id} busted a ${entInBurg.enterprise_type} operation.`, tier: "MAJOR", burg_id: burg.burg_id, faction_id: faction.id });
    }
  }

  const flushHeat = db.transaction(() => {
    for (const h of heatUpdates) {
      db.prepare("UPDATE sim_outlaw_factions SET heat = MIN(100, ?) WHERE id = ?").run(h.heat, h.id);
    }
  });
  flushHeat();

  // New enterprise spawning
  for (const faction of outlawFactions) {
    if ((faction.manpower || 0) > 50 && Math.random() < 0.1) {
      const targetBurg = burgs[Math.floor(Math.random() * burgs.length)];
      if (targetBurg) {
        const eType = Math.random() > 0.5 ? "VICE_DEN" : "NARCOTICS";
        db.prepare("INSERT INTO sim_outlaw_enterprises (faction_id, target_id, enterprise_type) VALUES (?, ?, ?)").run(faction.id, targetBurg.burg_id, eType);
      }
    }
  }

  // ─── Phase 6: Diplomacy ───────────────────────────────────────────────────
  const dipRes = db.prepare("SELECT * FROM sim_diplomacy").all() as any[];
  for (const rel of dipRes) {
    if (rel.status === "WAR") {
      const fA = factions.find((f: any) => f.id === rel.faction_a_id);
      const fB = factions.find((f: any) => f.id === rel.faction_b_id);
      if (fA && fB) {
        events.push({ type: "WAR_TICK", message: `${fA.name} and ${fB.name} remain at war.`, tier: "MINOR", burg_id: null, faction_id: fA.id });
      }
    }
  }

  // ─── Flush Events ────────────────────────────────────────────────────────
  const flushEvents = db.transaction(() => {
    for (const ev of events) {
      insertEventStmt.run(tick, ev.type, ev.message, ev.tier, loreDate, ev.burg_id ?? null, ev.faction_id ?? null);
    }
  });
  flushEvents();

  return { status: "success", currentTick: tick, loreDate, eventsLogged: events.length };
}
