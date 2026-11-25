import type { Delta } from "../../deltas/types.js";
import type { MarketSnapshot } from "./load.js";

const STEP = 0.25; // fraction of the gap to target price closed each update

export interface MarketStepResult {
  deltas: Delta[];
  marketsUpdated: number;
  commoditiesUpdated: number;
}

function aliasWorldSupply(worldStock: Map<string, number>, commodity: string): number {
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
}

/**
 * Pure regional market & continental commodity price step.
 * Emits `market.setGoods` and `commodity.set` deltas without database side effects.
 */
export function stepMarket(snap: MarketSnapshot): MarketStepResult {
  if (!snap.due) return { deltas: [], marketsUpdated: 0, commoditiesUpdated: 0 };

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

  for (const row of snap.burgs) {
    const mId = row.marketId || 0;
    const grainEquiv = Math.round((row.food || 0) / 100);
    if (grainEquiv > 0) addStock(mId, "grain", grainEquiv);
    for (const [k, v] of Object.entries(row.complexInventory || {})) {
      const qty = Number(v);
      if (Number.isFinite(qty) && qty > 0) addStock(mId, k, qty);
    }
  }

  const deltas: Delta[] = [];

  for (const m of snap.markets) {
    const prevGoods = m.goods || {};
    const mStock = marketStocks.get(m.id) || new Map<string, number>();
    const nextGoods: Record<string, { price: number; stock: number; refStock: number }> = {};

    for (const g of snap.goods) {
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

    deltas.push({
      kind: "market.setGoods",
      marketId: m.id,
      goods: nextGoods,
    });
  }

  for (const p of snap.prices) {
    const base = p.basePrice || 1;
    const current = p.currentPrice || base;
    const supply = Math.max(0, Math.round(aliasWorldSupply(worldStock, p.commodity)));
    let reference = p.globalDemand || 0;
    if (reference <= 0 && supply > 0) reference = supply;

    const target =
      supply > 0 && reference > 0
        ? Math.min(base * 2.5, Math.max(base * 0.4, base * Math.sqrt(reference / supply)))
        : base;
    const next = Math.round((current + (target - current) * STEP) * 1000) / 1000;

    deltas.push({
      kind: "commodity.set",
      commodity: p.commodity,
      currentPrice: next,
      globalSupply: Math.min(supply, 2147483647),
      globalDemand: Math.min(Math.round(reference), 2147483647),
      lastUpdatedTick: snap.tick,
    });
  }

  return {
    deltas,
    marketsUpdated: snap.markets.length,
    commoditiesUpdated: snap.prices.length,
  };
}
