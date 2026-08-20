import type { Grid } from "../../core/types";
import type { Burg } from "./burg-generator";
import { GOODS } from "./goods-generator";

export interface BurgMarket {
	burgId: number;
	supply: Record<number, number>;
	demand: Record<number, number>;
	prices: Record<number, number>;
}

export function generateMarkets(
	grid: Grid,
	burgs: Burg[],
	cellGoods: Uint8Array,
): BurgMarket[] {
	const markets: BurgMarket[] = [];

	for (const b of burgs) {
		const supply: Record<number, number> = {};
		const demand: Record<number, number> = {};
		const prices: Record<number, number> = {};

		// Initialize all records for all goods dynamically
		for (const gIdStr of Object.keys(GOODS)) {
			const gId = parseInt(gIdStr, 10);
			supply[gId] = 0;
			demand[gId] = 0;
			prices[gId] = GOODS[gId].value;
		}

		// 1. Calculate supply from neighboring cells
		const neighbors = grid.cells.c[b.cell] || [];
		const supplyCells = [b.cell, ...neighbors];

		for (const cellId of supplyCells) {
			const goodId = cellGoods[cellId];
			if (goodId > 0 && supply[goodId] !== undefined) {
				supply[goodId] += 5.0; // supply points
			}
		}

		// 2. Calculate demand based on population and demandCoverage
		const popFactor = b.population / 1000;
		const foodTarget = popFactor * 0.2;
		const utilitiesTarget = popFactor * 0.15;
		const constructionTarget = popFactor * 0.1;
		const militaryTarget = popFactor * 0.08;
		const luxuryTarget = popFactor * 0.07;

		for (const gIdStr of Object.keys(GOODS)) {
			const gId = parseInt(gIdStr, 10);
			const good = GOODS[gId];
			let itemDemand = popFactor * 0.02; // baseline demand

			if (good.demandCoverage) {
				if (good.demandCoverage.food)
					itemDemand += foodTarget * good.demandCoverage.food;
				if (good.demandCoverage.utilities)
					itemDemand += utilitiesTarget * good.demandCoverage.utilities;
				if (good.demandCoverage.construction)
					itemDemand += constructionTarget * good.demandCoverage.construction;
				if (good.demandCoverage.military)
					itemDemand += militaryTarget * good.demandCoverage.military;
				if (good.demandCoverage.luxury)
					itemDemand += luxuryTarget * good.demandCoverage.luxury;
			}

			demand[gId] = Number(itemDemand.toFixed(2));
		}

		// 3. Dynamic price calculation based on supply/demand ratio
		for (const gIdStr of Object.keys(GOODS)) {
			const gId = parseInt(gIdStr, 10);
			const s = Math.max(supply[gId] || 0, 1.0); // avoid division by 0
			const d = demand[gId] || 0;
			const baseValue = GOODS[gId].value;

			// Price spikes if demand is high and supply is low, clamped to range [0.2x, 5x]
			const multiplier = Math.max(0.2, Math.min(5.0, d / s));
			prices[gId] = Number((baseValue * multiplier).toFixed(2));
		}

		markets.push({
			burgId: b.id,
			supply,
			demand,
			prices,
		});
	}

	return markets;
}
