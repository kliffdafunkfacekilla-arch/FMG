import { GOODS } from "./goods-generator";
import type { BurgMarket } from "./markets-generator";

export interface ProductionReport {
	burgId: number;
	producedGoods: Record<string, number>;
}

export function runProductionCycles(markets: BurgMarket[]): ProductionReport[] {
	const reports: ProductionReport[] = [];

	// Map good names to IDs for fast lookup
	const nameToId: Record<string, number> = {};
	for (const gIdStr of Object.keys(GOODS)) {
		const gId = parseInt(gIdStr, 10);
		nameToId[GOODS[gId].name] = gId;
	}

	// Find all manufactured goods that have recipes
	const manufacturedGoods = Object.values(GOODS).filter(
		(g) => g.type === "manufactured" && g.recipes && g.recipes.length > 0,
	);

	for (const m of markets) {
		const producedGoods: Record<string, number> = {};

		for (const g of manufacturedGoods) {
			if (!g.recipes) continue;

			// Try each recipe until we find one we can produce
			for (const recipe of g.recipes) {
				let maxPossible = Infinity;

				// Check the bottleneck ingredient
				for (const [ingredientName, requiredQty] of Object.entries(recipe)) {
					const ingId = nameToId[ingredientName];
					if (!ingId) {
						maxPossible = 0;
						break;
					}
					const available = m.supply[ingId] || 0;
					const possible = Math.floor(available / requiredQty);
					if (possible < maxPossible) {
						maxPossible = possible;
					}
				}

				// Produce the maximum possible amount (cap at 10 to prevent feedback spirals)
				const toProduce = Math.min(maxPossible, 10);
				if (toProduce > 0 && toProduce !== Infinity) {
					// Consume ingredients
					for (const [ingredientName, requiredQty] of Object.entries(recipe)) {
						const ingId = nameToId[ingredientName];
						m.supply[ingId] = Math.max(
							0,
							m.supply[ingId] - toProduce * requiredQty,
						);
					}

					// Add finished product to market supply
					m.supply[g.i] = (m.supply[g.i] || 0) + toProduce;
					producedGoods[g.name] = toProduce;
					break; // successfully produced using this recipe
				}
			}
		}

		reports.push({
			burgId: m.burgId,
			producedGoods,
		});
	}

	return reports;
}
