import { DAYS_PER_WEEK } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";
import { goodKeyFromName } from "../../economy/goodCatalog.js";

export interface MarketGoodDef {
  id: number;
  key: string;
  value: number;
}

export interface MarketBurgStock {
  burgId: number;
  marketId: number;
  food: number;
  complexInventory: Record<string, number>;
}

export interface MarketRowSnapshot {
  id: number;
  centerBurgId: number;
  goods: Record<string, any>;
}

export interface CommodityPriceSnapshot {
  commodity: string;
  basePrice: number;
  currentPrice: number;
  globalDemand: number;
}

export interface MarketSnapshot {
  tick: number;
  due: boolean;
  goods: MarketGoodDef[];
  burgs: MarketBurgStock[];
  markets: MarketRowSnapshot[];
  prices: CommodityPriceSnapshot[];
}

function parseInv(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

/**
 * Loads regional market goods, burg stockpiles, and continental commodity prices.
 * On non-weekly ticks (unless forced), skips DB queries and marks `due: false`.
 */
export async function loadMarket(db: Db, tick: number, force: boolean = false): Promise<MarketSnapshot> {
  if (!force && tick % DAYS_PER_WEEK !== 0) {
    return { tick, due: false, goods: [], burgs: [], markets: [], prices: [] };
  }

  const goodsRes = await db.query(`SELECT id, name, value FROM sim_goods ORDER BY id`);
  const marketsRes = await db.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id`);
  const burgsRes = await db.query(`
    SELECT b.burg_id, c.market_id, b.food, s.complex_inventory
    FROM sim_burg_economy b
    LEFT JOIN sim_cells c ON c.id = b.cell_id
    LEFT JOIN sim_industrial_stockpiles s ON s.burg_id = b.burg_id
    ORDER BY b.burg_id
  `);
  const pricesRes = await db.query(
    `SELECT commodity, base_price, current_price, global_demand FROM sim_commodity_prices ORDER BY commodity`
  );

  return {
    tick,
    due: true,
    goods: goodsRes.rows.map((g: any) => ({
      id: Number(g.id),
      key: goodKeyFromName(String(g.name || "")),
      value: Number(g.value) || 1,
    })),
    markets: marketsRes.rows.map((m: any) => ({
      id: Number(m.id),
      centerBurgId: Number(m.center_burg_id) || 0,
      goods: parseInv(m.goods),
    })),
    burgs: burgsRes.rows.map((row: any) => ({
      burgId: Number(row.burg_id),
      marketId: Number(row.market_id) || 0,
      food: Number(row.food) || 0,
      complexInventory: parseInv(row.complex_inventory) as Record<string, number>,
    })),
    prices: pricesRes.rows.map((p: any) => ({
      commodity: String(p.commodity),
      basePrice: Number(p.base_price) || 1,
      currentPrice: Number(p.current_price) || 0,
      globalDemand: Number(p.global_demand) || 0,
    })),
  };
}
