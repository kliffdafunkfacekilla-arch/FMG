/**
 * World market: commodity prices follow world stock levels.
 *
 * sim_commodity_prices was only ever touched by player trades in the GM screen; the simulation never
 * moved a price, so the market showed its seed values for thousands of ticks. Once a week this sums the
 * world's stock of each commodity (burg food, stockpile columns, and stockpile inventory items of the
 * same name), and moves the price a step towards
 *
 *     base_price * sqrt(reference_stock / current_stock), clamped to 0.4 .. 2.5 x base
 *
 * The reference stock (global_demand) is recorded the first time a commodity has any stock, so prices
 * rise as goods get scarcer than they were and fall in a glut. global_supply holds the current stock.
 * Commodities with no stock anywhere drift back towards base price.
 */
import { DAYS_PER_WEEK } from "../canon/calendar.js";

type Db = { query: (text: string, params?: any[]) => Promise<any> };

const STEP = 0.25; // fraction of the gap to the target price closed each week

export async function runMarketAgent(client: Db, tick: number): Promise<number> {
  if (tick % DAYS_PER_WEEK !== 0) return 0;

  const cols = await client.query(`
    SELECT COALESCE(SUM(raw_wood), 0) AS wood, COALESCE(SUM(raw_ore), 0) + COALESCE(SUM(forged_steel), 0) AS iron,
           COALESCE(SUM(raw_fiber), 0) AS fibre, COALESCE(SUM(textiles), 0) AS textile,
           COALESCE(SUM(alchemical_potions), 0) AS medicine, COALESCE(SUM(raw_herbs), 0) AS aromatics
    FROM sim_industrial_stockpiles`);
  const food = await client.query(`SELECT COALESCE(SUM(food), 0) AS grain FROM sim_burg_economy`);
  const items = await client.query(`
    SELECT key, SUM(CASE WHEN value ~ '^-?[0-9.]+$' THEN value::numeric ELSE 0 END) AS qty
    FROM sim_industrial_stockpiles, jsonb_each_text(COALESCE(complex_inventory, '{}'::jsonb))
    GROUP BY key`);

  const stock = new Map<string, number>();
  const add = (k: string, v: any) => stock.set(k, (stock.get(k) || 0) + (Number(v) || 0));
  for (const [k, v] of Object.entries(cols.rows[0] || {})) add(k, v);
  add("grain", food.rows[0]?.grain);
  for (const r of items.rows) add(String(r.key), r.qty);

  const prices = await client.query(`SELECT commodity, base_price, current_price, global_demand FROM sim_commodity_prices ORDER BY commodity`);
  let updated = 0;
  for (const p of prices.rows) {
    const base = Number(p.base_price) || 1;
    const current = Number(p.current_price) || base;
    const supply = Math.max(0, Math.round(stock.get(p.commodity) || 0));
    let reference = Number(p.global_demand) || 0;
    if (reference <= 0 && supply > 0) reference = supply; // first sighting sets the reference

    const target = supply > 0 && reference > 0
      ? Math.min(base * 2.5, Math.max(base * 0.4, base * Math.sqrt(reference / supply)))
      : base;
    const next = Math.round((current + (target - current) * STEP) * 1000) / 1000;

    await client.query(
      `UPDATE sim_commodity_prices SET current_price = $1, global_supply = $2, global_demand = $3, last_updated_tick = $4 WHERE commodity = $5`,
      [next, Math.min(supply, 2147483647), Math.min(Math.round(reference), 2147483647), tick, p.commodity]
    );
    updated++;
  }
  return updated;
}
