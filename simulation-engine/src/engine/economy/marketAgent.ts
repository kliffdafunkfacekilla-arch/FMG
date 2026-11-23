/**
 * Regional & World Market Pricing:
 * Updates all 31 regional markets in `sim_markets` from the real local stockpiles of their member
 * burgs, and syncs continental commodity indices in `sim_commodity_prices` so trade UI and macros
 * stay grounded in live citizen production.
 */
import { DAYS_PER_WEEK } from "../canon/calendar.js";
import { goodKeyFromName } from "./goodCatalog.js";

type Db = { query: (text: string, params?: any[]) => Promise<any> };

const STEP = 0.25; // fraction of the gap to target price closed each update

function parseInv(raw: any): Record<string, number> {
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

export async function updateRegionalMarkets(
  client: Db,
  tick: number
): Promise<{ marketsUpdated: number; commoditiesUpdated: number }> {
  const goodsRes = await client.query(`SELECT id, name, value FROM sim_goods ORDER BY id`);
  const marketsRes = await client.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id`);
  const burgsRes = await client.query(`
    SELECT b.burg_id, c.market_id, b.food, s.complex_inventory
    FROM sim_burg_economy b
    LEFT JOIN sim_cells c ON c.id = b.cell_id
    LEFT JOIN sim_industrial_stockpiles s ON s.burg_id = b.burg_id
    ORDER BY b.burg_id
  `);

  const goodsList: Array<{ id: number; key: string; value: number }> = goodsRes.rows.map((g: any) => ({
    id: Number(g.id),
    key: goodKeyFromName(String(g.name || "")),
    value: Number(g.value) || 1,
  }));

  const marketStocks = new Map<number, Map<string, number>>();
  const worldStock = new Map<string, number>();
  const addStock = (mId: number, key: string, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (mId > 0) {
      let map = marketStocks.get(mId);
      if (!map) {
        map = new Map<string, number>();
        marketStocks.set(mId, map);
      }
      map.set(key, (map.get(key) || 0) + qty);
    }
    worldStock.set(key, (worldStock.get(key) || 0) + qty);
  };

  for (const row of burgsRes.rows) {
    const mId = Number(row.market_id) || 0;
    const grainEquiv = Math.round((Number(row.food) || 0) / 100);
    if (grainEquiv > 0) addStock(mId, "grain", grainEquiv);
    const inv = parseInv(row.complex_inventory);
    for (const [k, v] of Object.entries(inv)) {
      const qty = Number(v);
      if (Number.isFinite(qty) && qty > 0) addStock(mId, k, qty);
    }
  }

  // Update all regional markets in sim_markets
  const updIds: number[] = [];
  const updGoodsJson: string[] = [];
  for (const m of marketsRes.rows) {
    const mId = Number(m.id);
    const prevGoods = parseInv(m.goods) as Record<string, any>;
    const mStock = marketStocks.get(mId) || new Map<string, number>();
    const nextGoods: Record<string, { price: number; stock: number; refStock: number }> = {};

    for (const g of goodsList) {
      const prev = prevGoods[String(g.id)] || {};
      const base = g.value;
      const current = Number(prev.price) > 0 ? Number(prev.price) : base;
      const supply = Math.round((mStock.get(g.key) || 0) * 100) / 100;
      const ref =
        Number(prev.refStock) > 0
          ? Number(prev.refStock)
          : Math.max(10, Number(prev.stock) || supply || 10);

      const target =
        supply > 0
          ? Math.min(base * 3.0, Math.max(base * 0.35, base * Math.sqrt(ref / supply)))
          : Math.min(base * 2.5, base * 1.4);

      const nextPrice = Math.round((current + (target - current) * STEP) * 1000) / 1000;
      nextGoods[String(g.id)] = {
        price: nextPrice,
        stock: supply,
        refStock: Math.round(ref * 100) / 100,
      };
    }

    updIds.push(mId);
    updGoodsJson.push(JSON.stringify(nextGoods));
  }

  if (updIds.length > 0) {
    await client.query(
      `UPDATE sim_markets AS m
       SET goods = v.goods
       FROM (
         SELECT unnest($1::int[]) AS id, unnest($2::jsonb[]) AS goods
       ) AS v
       WHERE m.id = v.id`,
      [updIds, updGoodsJson]
    );
  }

  // Sync continental index into sim_commodity_prices
  const aliasSupply = (commodity: string): number => {
    const direct = worldStock.get(commodity) || 0;
    switch (commodity) {
      case "aromatics":
        return direct + (worldStock.get("incense") || 0) + (worldStock.get("spices") || 0) + (worldStock.get("perfume") || 0);
      case "textile":
        return direct + (worldStock.get("cloth") || 0) + (worldStock.get("garments") || 0);
      case "fibre":
        return direct + (worldStock.get("hemp") || 0) + (worldStock.get("wool") || 0) + (worldStock.get("silk") || 0);
      case "spice":
        return direct + (worldStock.get("spices") || 0);
      case "crystals":
        return direct + (worldStock.get("piezo_quartz") || 0) + (worldStock.get("gemstones") || 0);
      case "medicine":
        return direct + (worldStock.get("aether_clear") || 0) + (worldStock.get("grave_berries") || 0);
      case "narcotic":
        return direct + (worldStock.get("viper_haze") || 0) + (worldStock.get("tobacco") || 0);
      case "exotic":
        return direct + (worldStock.get("ivory") || 0) + (worldStock.get("pearls") || 0) + (worldStock.get("amber") || 0);
      case "pitch":
        return direct + (worldStock.get("tar") || 0) + (worldStock.get("oil") || 0);
      case "dragon_stone_shard":
        return direct + (worldStock.get("dragonstone") || 0);
      default:
        return direct;
    }
  };

  const pricesRes = await client.query(
    `SELECT commodity, base_price, current_price, global_demand FROM sim_commodity_prices ORDER BY commodity`
  );
  let commoditiesUpdated = 0;
  for (const p of pricesRes.rows) {
    const base = Number(p.base_price) || 1;
    const current = Number(p.current_price) || base;
    const supply = Math.max(0, Math.round(aliasSupply(String(p.commodity))));
    let reference = Number(p.global_demand) || 0;
    if (reference <= 0 && supply > 0) reference = supply;

    const target =
      supply > 0 && reference > 0
        ? Math.min(base * 2.5, Math.max(base * 0.4, base * Math.sqrt(reference / supply)))
        : base;
    const next = Math.round((current + (target - current) * STEP) * 1000) / 1000;

    await client.query(
      `UPDATE sim_commodity_prices SET current_price = $1, global_supply = $2, global_demand = $3, last_updated_tick = $4 WHERE commodity = $5`,
      [next, Math.min(supply, 2147483647), Math.min(Math.round(reference), 2147483647), tick, p.commodity]
    );
    commoditiesUpdated++;
  }

  return { marketsUpdated: updIds.length, commoditiesUpdated };
}

export async function runMarketAgent(client: Db, tick: number): Promise<number> {
  if (tick % DAYS_PER_WEEK !== 0) return 0;
  const { commoditiesUpdated } = await updateRegionalMarkets(client, tick);
  return commoditiesUpdated;
}
