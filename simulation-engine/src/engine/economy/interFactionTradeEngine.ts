import { PoolClient } from "pg";
import { 
  FACTION_SPECIALTIES, 
  getFactionSpecialty, 
  CommodityCategory, 
  getGoodsByCategory,
  FactionSpecialty 
} from "./factionSpecialties.js";

export interface TradeCaravanLog {
  sourceBurgId: number;
  sourceBurgName: string;
  sourceFactionId: number;
  destBurgId: number;
  destBurgName: string;
  destFactionId: number;
  goodKey: string;
  goodName: string;
  amount: number;
  totalGold: number;
  tick: number;
}

export interface TradeEmbargoStall {
  burgId: number;
  burgName: string;
  factionId: number;
  neededGoodKey: string;
  neededGoodName: string;
  category: CommodityCategory;
  stalledProject: string;
}

/**
 * Executes the autonomous Inter-Faction Commodity Trade Engine.
 * 
 * 1. Checks active diplomacy (sim_diplomacy). If two factions are at WAR, an embargo blocks trade.
 * 2. Matches burgs with surplus signature commodities to foreign burgs with acute deficits.
 * 3. Transfers goods and gold along road and maritime networks.
 * 4. Stalls urban progression and triggers economic tension when war severs vital imports.
 */
export async function runInterFactionTradeEngine(
  client: PoolClient, 
  tick: number, 
  loreDate: string
): Promise<{ 
  tradesExecuted: number; 
  embargoStalls: TradeEmbargoStall[]; 
}> {
  // Execute trade passes every 3 ticks to balance performance and simulation granularity
  if (tick % 3 !== 0) {
    return { tradesExecuted: 0, embargoStalls: [] };
  }

  // 1. Fetch diplomatic relations (Wars & Alliances)
  const diploRes = await client.query(`
    SELECT faction_a_id, faction_b_id, status, tension 
    FROM sim_diplomacy
  `);
  
  const warMap = new Set<string>();
  for (const d of diploRes.rows) {
    if (d.status === 'WAR') {
      warMap.add(`${d.faction_a_id}_${d.faction_b_id}`);
      warMap.add(`${d.faction_b_id}_${d.faction_a_id}`);
    }
  }

  // 2. Fetch all active burgs with economy, stockpiles, and cell faction ownership
  const burgRes = await client.query(`
    SELECT b.burg_id, b.name, b.cell_id, b.wealth, b.urban_tier, b.unrest, b.port,
           COALESCE(b.occupier_faction_id, c.faction_id, 0) as faction_id,
           f.name as faction_name,
           s.complex_inventory
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    LEFT JOIN sim_factions f ON COALESCE(b.occupier_faction_id, c.faction_id, 0) = f.id
    LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id
    WHERE b.pop_null > 0 OR b.pop_attuned > 0
  `);

  const burgMap = new Map<number, any>();
  const burgsByFaction = new Map<number, any[]>();

  for (const row of burgRes.rows) {
    let inv: Record<string, number> = {};
    try {
      inv = typeof row.complex_inventory === 'string' 
        ? JSON.parse(row.complex_inventory) 
        : (row.complex_inventory || {});
    } catch (e) {
      inv = {};
    }
    row.inventory = inv;
    burgMap.set(row.burg_id, row);

    const fId = Number(row.faction_id) || 0;
    if (!burgsByFaction.has(fId)) burgsByFaction.set(fId, []);
    burgsByFaction.get(fId)!.push(row);
  }

  // 3. Identify potential trade links (via sim_roads or ports)
  const roadsRes = await client.query(`
    SELECT source_cell_id, dest_cell_id, length FROM sim_roads
  `);

  // Map cell_id to burg_id for fast road routing
  const cellToBurg = new Map<number, number>();
  for (const b of burgRes.rows) {
    if (b.cell_id) cellToBurg.set(Number(b.cell_id), b.burg_id);
  }

  // Build trade graph of connected burg neighbors
  const tradeAdjacency = new Map<number, Set<number>>();
  for (const road of roadsRes.rows) {
    const b1 = cellToBurg.get(Number(road.source_cell_id));
    const b2 = cellToBurg.get(Number(road.dest_cell_id));
    if (b1 && b2 && b1 !== b2) {
      if (!tradeAdjacency.has(b1)) tradeAdjacency.set(b1, new Set());
      if (!tradeAdjacency.has(b2)) tradeAdjacency.set(b2, new Set());
      tradeAdjacency.get(b1)!.add(b2);
      tradeAdjacency.get(b2)!.add(b1);
    }
  }

  // All maritime ports can trade with other ports via sea routes
  const portBurgIds = burgRes.rows.filter(b => b.port).map(b => b.burg_id);
  for (const p1 of portBurgIds) {
    if (!tradeAdjacency.has(p1)) tradeAdjacency.set(p1, new Set());
    for (const p2 of portBurgIds) {
      if (p1 !== p2) tradeAdjacency.get(p1)!.add(p2);
    }
  }

  let tradesExecuted = 0;
  const executedCaravans: TradeCaravanLog[] = [];
  const embargoStalls: TradeEmbargoStall[] = [];
  const modifiedBurgIds = new Set<number>();

  // 4. Trade Execution: Exporters sell surplus to connected Deficit Importers
  for (const importer of burgRes.rows) {
    const impFactionId = Number(importer.faction_id) || 0;
    const impTier = Number(importer.urban_tier) || 1;

    // What categories does this burg need to advance or thrive?
    // Tier 1 -> 2 needs PRESERVATION
    // Tier 2 -> 3 needs STRUCTURAL & FOUNDATION
    // Tier 3 -> 4 needs ADVANCED & METAPHYSICAL / HEALTH
    const desiredCategories: CommodityCategory[] = [];
    if (impTier === 1) desiredCategories.push("PRESERVATION", "FOUNDATION");
    else if (impTier === 2) desiredCategories.push("STRUCTURAL", "FOUNDATION", "PRESERVATION");
    else if (impTier >= 3) desiredCategories.push("ADVANCED", "STRUCTURAL", "METAPHYSICAL", "HEALTH");

    for (const category of desiredCategories) {
      const categoryGoods = getGoodsByCategory(category);
      // Check if importer already has sufficient stock of any good in this category
      const currentStock = categoryGoods.reduce((sum, g) => sum + (importer.inventory[g] || 0), 0);

      // Desired buffer: 20 units for Tier 1, 35 for Tier 2, 50 for Tier 3+
      const targetBuffer = impTier === 1 ? 20 : impTier === 2 ? 35 : 50;

      if (currentStock < targetBuffer && (importer.wealth || 0) >= 15) {
        // Need to import goods from a foreign supplier!
        // Find potential trading partners with connectivity
        const neighbors = Array.from(tradeAdjacency.get(importer.burg_id) || []);
        
        // Also look at regional capitals / major hubs if direct road is absent
        const potentialSellers = neighbors.length > 0 
          ? neighbors.map(id => burgMap.get(id)).filter(Boolean)
          : burgRes.rows.filter(b => b.urban_tier >= 2 && b.burg_id !== importer.burg_id);

        let tradeFound = false;
        let embargoEncountered = false;
        let embargoingFactionName = "";

        for (const seller of potentialSellers) {
          const sellerFactionId = Number(seller.faction_id) || 0;

          // Check for diplomatic trade embargo (Active War)
          if (warMap.has(`${impFactionId}_${sellerFactionId}`)) {
            embargoEncountered = true;
            embargoingFactionName = seller.faction_name || "Hostile Faction";
            continue; // Embargo active! No trade permitted with this wartime enemy
          }

          // Does the seller have a surplus of any good in the desired category?
          for (const goodKey of categoryGoods) {
            const sellerQty = seller.inventory[goodKey] || 0;
            if (sellerQty >= 15) {
              // Valid trade found!
              const spec = Object.values(FACTION_SPECIALTIES).find(s => s.uniqueGood === goodKey);
              const unitPrice = spec?.baseExportPrice || 12;
              const tradeQty = Math.min(10, sellerQty - 5, Math.floor(importer.wealth / (unitPrice / 2)));

              if (tradeQty >= 3) {
                const totalCost = Math.round(tradeQty * (unitPrice / 2));

                // Execute Transaction
                seller.inventory[goodKey] = (seller.inventory[goodKey] || 0) - tradeQty;
                importer.inventory[goodKey] = (importer.inventory[goodKey] || 0) + tradeQty;

                importer.wealth = Math.max(0, (importer.wealth || 0) - totalCost);
                seller.wealth = (seller.wealth || 0) + totalCost;

                modifiedBurgIds.add(importer.burg_id);
                modifiedBurgIds.add(seller.burg_id);
                tradesExecuted++;
                tradeFound = true;

                executedCaravans.push({
                  sourceBurgId: seller.burg_id,
                  sourceBurgName: seller.name,
                  sourceFactionId: sellerFactionId,
                  destBurgId: importer.burg_id,
                  destBurgName: importer.name,
                  destFactionId: impFactionId,
                  goodKey,
                  goodName: spec?.uniqueGoodName || goodKey,
                  amount: tradeQty,
                  totalGold: totalCost,
                  tick
                });
                break;
              }
            }
          }
          if (tradeFound) break;
        }

        // If no trade was possible because of an active wartime embargo, record stall
        if (!tradeFound && embargoEncountered && currentStock < 10) {
          const firstGood = categoryGoods[0] || "vital_commodity";
          embargoStalls.push({
            burgId: importer.burg_id,
            burgName: importer.name,
            factionId: impFactionId,
            neededGoodKey: firstGood,
            neededGoodName: firstGood.replace(/_/g, " "),
            category,
            stalledProject: impTier === 1 ? "Town Charter" : impTier === 2 ? "City Walls" : "Metropolitan Spires"
          });

          // Tense trade consequence: Unrest creeps up from commodity shortage and trade isolation
          if (tick % 9 === 0) {
            await client.query(`
              UPDATE sim_burg_economy 
              SET unrest = LEAST(100, COALESCE(unrest, 0) + 1)
              WHERE burg_id = $1
            `, [importer.burg_id]).catch(() => { });

            await client.query(`
              INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
              VALUES ($1, 'TRADE_EMBARGO_CHOKEPOINT', $2, 'MAJOR', $3, $4, $5)
            `, [
              tick,
              `⚠️ TRADE EMBARGO CHOKEPOINT: Construction in ${importer.name} stalled! Vital ${category.toLowerCase()} materials cut off due to ongoing wartime embargo with ${embargoingFactionName}!`,
              impFactionId, importer.burg_id, loreDate
            ]).catch(() => { });
          }
        }
      }
    }
  }

  // 5. Persist inventory and wealth changes in bulk
  if (modifiedBurgIds.size > 0) {
    const modifiedBurgs = Array.from(modifiedBurgIds).map(id => burgMap.get(id)).filter(Boolean);

    await client.query(`
      INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
      SELECT unnest($1::int[]), unnest($2::jsonb[])
      ON CONFLICT (burg_id) DO UPDATE SET
        complex_inventory = EXCLUDED.complex_inventory
    `, [
      modifiedBurgs.map(b => b.burg_id),
      modifiedBurgs.map(b => JSON.stringify(b.inventory))
    ]);

    await client.query(`
      UPDATE sim_burg_economy AS b SET
        wealth = v.wealth
      FROM (
        SELECT unnest($1::int[]) as burg_id,
               unnest($2::int[]) as wealth
      ) AS v
      WHERE b.burg_id = v.burg_id
    `, [
      modifiedBurgs.map(b => b.burg_id),
      modifiedBurgs.map(b => b.wealth)
    ]);
  }

  // 6. Log major caravan events periodically
  if (executedCaravans.length > 0 && tick % 12 === 0) {
    const highlight = executedCaravans[Math.floor(Math.random() * executedCaravans.length)];
    if (highlight) {
      let customLoreMsg = `📦 INTER-FACTION TRADE CARAVAN: A merchant caravan from ${highlight.sourceBurgName} reached ${highlight.destBurgName}, delivering ${highlight.amount} units of ${highlight.goodName} in exchange for ${highlight.totalGold} gold.`;

      if (highlight.goodKey === 'coded_intel_dossiers') {
        customLoreMsg = `📜 COVERT INTEL EXCHANGE: Flower Valley couriers arrived in ${highlight.destBurgName} with crates invoiced as rare perfumes—discreetly transferring coded diplomatic dossiers and court intelligence in exchange for ${highlight.totalGold} gold!`;
      } else if (highlight.goodKey === 'chaos_resistant_compound') {
        customLoreMsg = `🍄 MYCELIAL SCHOLAR SHIPMENT: A rare, quiet caravan of Mushroom-Folk scholars from The Reliance delivered ${highlight.amount} jars of chaos-resistant compound into ${highlight.destBurgName} to shield cellars from void bleed!`;
      } else if (highlight.goodKey === 'ursine_optical_glass') {
        customLoreMsg = `🐻 URSINE COLLEGIATE CONVOY: Bear-Folk scholars from the mountain colleges delivered precision optical glass and jitter-rig mechanisms to the master builders of ${highlight.destBurgName}.`;
      } else if (highlight.goodKey === 'grave_berries') {
        customLoreMsg = `🦅 BARROW GRAVE-BERRY SHIPMENT: Eastern Hounds drovers on heavy war-birds arrived in ${highlight.destBurgName}, delivering potent grave-berries and draft animals in exchange for ${highlight.totalGold} gold.`;
      } else if (highlight.goodKey === 'traditional_river_vessels') {
        customLoreMsg = `⛵ RIVER SHIPWRIGHT FLOTILLA: River Folk craftsmen navigated shallow channels into ${highlight.destBurgName}, delivering traditional pegged river craft and smoked delta fish.`;
      } else if (highlight.goodKey === 'sumpkin_pharmaceutical_chems') {
        customLoreMsg = `🧪 MIRE PHARMACEUTICAL DROP: Sump-Kin bog distillers delivered a shipment of medicinal narcotics and pharmaceutical chemicals into the clinic vaults of ${highlight.destBurgName}.`;
      }

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
        VALUES ($1, 'INTER_FACTION_TRADE', $2, 'MINOR', $3, $4, $5)
      `, [
        tick,
        customLoreMsg,
        highlight.destFactionId, highlight.destBurgId, loreDate
      ]).catch(() => { });
    }
  }

  return { tradesExecuted, embargoStalls };
}
