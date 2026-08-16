import type { Burg } from "../civilization/burg-generator";
import type { BurgMarket } from "../civilization/markets-generator";

export interface FringeGroup {
	id: number;
	type: "Rebels" | "Bandits" | "Cultists" | "Smugglers" | "Pirates" | "Vice Dealers";
	originBurgId: number;
	originBurgName: string;
	size: number;
	name: string;
	description: string;
	habitat: "land" | "ocean";
	hideoutDiscovered: boolean;
	hideoutType:
		| "Cove Hideout"
		| "Mountain Fortress"
		| "Underground Syndicate"
		| "Leyline Sanctum";
	influenceRadius?: number; // Spread / area of influence (1 to 6 cells)
}

export function generateFringeGroups(
	burgs: Burg[],
	markets: BurgMarket[],
	magicLevels: Float32Array,
	heights: Uint8Array | null = null,
	existingGroups: FringeGroup[] = [],
): FringeGroup[] {
	// Let's create a map of existing groups to prevent duplicate spawns
	const existingKeys = new Set(
		existingGroups.map((g) => `${g.originBurgId}-${g.type}`),
	);
	const updatedGroups = existingGroups.map((g) => ({ ...g }));

	// Find next ID
	let nextId = Math.max(1, ...existingGroups.map((g) => g.id)) + 1;

	// Calculate smuggling factor for equipment boosts
	const smugglers = existingGroups.filter((g) => g.type === "Smugglers");
	const smugglingSize = smugglers.reduce((acc, curr) => acc + curr.size, 0);
	const smugglingFactor = 1.0 + smugglingSize * 0.001; // More smugglers = stronger bandits/pirates

	// 1. Process existing groups and update their sizes based on local burg security
	for (const g of updatedGroups) {
		const burg = burgs.find((b) => b.id === g.originBurgId);
		const security =
			burg && (burg as any).security !== undefined
				? (burg as any).security
				: 100;
		const crimeMultiplier = (100 - security) / 50; // lower security = more crime/growth

		// Initialize Area of Influence (influenceRadius) if missing
		if (g.influenceRadius === undefined) {
			g.influenceRadius = 2; // Default starting radius
		}

		// Growth rates & Spread / Contraction Logic based on Security & Crime Levels
		let dailyGrowth = 0.001; // base rate

		if (security < 50) {
			// SPREAD: Outlaws thrive when security is low
			dailyGrowth += crimeMultiplier * 0.004 * smugglingFactor;
			
			// Small chance daily to spread their Area of Influence (influenceRadius)
			if (Math.random() < 0.15) {
				g.influenceRadius = Math.min(6, (g.influenceRadius || 2) + 1);
			}

			// Underworld effects of Vice Dealers & Outlaws on their host burg
			if (burg) {
				if (g.type === "Vice Dealers") {
					// Vice Dealers actively decrease security and flood the city with narcotics
					(burg as any).security = Math.max(10, (burg as any).security - 1.5);
					(burg as any).drugSupply = Math.min(100, ((burg as any).drugSupply || 0) + 3.0);
					(burg as any).happiness = Math.max(10, (burg as any).happiness - 0.8);
				} else if (g.type === "Bandits" || g.type === "Pirates") {
					// Bandits/Pirates decrease security and drain state happiness through raiding
					(burg as any).security = Math.max(10, (burg as any).security - 1.0);
					(burg as any).happiness = Math.max(10, (burg as any).happiness - 0.5);
				} else if (g.type === "Cultists") {
					// Cults cause localized unrest & crime
					(burg as any).security = Math.max(10, (burg as any).security - 0.5);
					(burg as any).happiness = Math.max(10, (burg as any).happiness - 0.3);
				}
			}
		} else if (security >= 75) {
			// CONTRACT: Outlaws wither under high security
			dailyGrowth = -0.015 - (security - 75) * 0.001; // negative growth
			
			// Small chance daily to contract their Area of Influence
			if (Math.random() < 0.2) {
				g.influenceRadius = Math.max(1, (g.influenceRadius || 2) - 1);
			}
		} else {
			// Stable maintenance state
			if (g.type === "Bandits" || g.type === "Pirates") {
				dailyGrowth += crimeMultiplier * 0.002 * smugglingFactor;
			} else if (g.type === "Smugglers" || g.type === "Vice Dealers") {
				dailyGrowth += crimeMultiplier * 0.001;
			} else if (g.type === "Rebels") {
				dailyGrowth += crimeMultiplier * 0.003;
			}
		}

		// Update size (limit up to 25% of burg population when growing)
		const maxPossible = burg ? Math.floor(burg.population * 0.25) : 5000;
		g.size = Math.min(
			maxPossible,
			Math.max(5, g.size + Math.round(g.size * dailyGrowth)),
		);
	}

	// 2. Spawn new groups if conditions are met and they don't already exist
	for (const burg of burgs) {
		// Initialize lazy properties if missing on the burg
		if ((burg as any).security === undefined) (burg as any).security = 100;
		if ((burg as any).happiness === undefined) (burg as any).happiness = 75;
		if ((burg as any).health === undefined) (burg as any).health = 85;
		if ((burg as any).drugSupply === undefined) (burg as any).drugSupply = 0;

		const market = markets.find((m) => m.burgId === burg.id);
		if (!market) continue;

		// Support both direct test mock crop supply and combined Grain + Fruit supply
		const cropSupply =
			market.supply[3] !== undefined
				? market.supply[3]
				: (market.supply[2] || 0) + (market.supply[4] || 0);

		const isUnderwater = heights ? heights[burg.cell] < 20 : false;
		const habitat: "land" | "ocean" = isUnderwater ? "ocean" : "land";

		const burgSecurity = (burg as any).security;

		// Low security significantly increases the chance of spawning outlaws
		const spawnModifier = burgSecurity < 60 ? 1.5 : 1.0;

		// Severe food shortage -> Rebels / Pirates
		if (cropSupply < 1.0 * spawnModifier) {
			if (habitat === "ocean" && !existingKeys.has(`${burg.id}-Pirates`)) {
				updatedGroups.push({
					id: nextId++,
					type: "Pirates",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.05),
					name: `${burg.name} Corsair Fleet`,
					description:
						"Desperate underwater raiders preying on deep-sea trade routes due to severe starvation.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Cove Hideout",
				});
				existingKeys.add(`${burg.id}-Pirates`);
			} else if (habitat === "land" && !existingKeys.has(`${burg.id}-Rebels`)) {
				updatedGroups.push({
					id: nextId++,
					type: "Rebels",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.05),
					name: `${burg.name} Peasant Rebellion`,
					description:
						"Desperate starving citizens who have risen in open revolt against the crown.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Mountain Fortress",
				});
				existingKeys.add(`${burg.id}-Rebels`);
			}
		}

		// Moderate food shortage or poor security -> Bandits / Smugglers
		if ((cropSupply < 2.0 * spawnModifier && cropSupply >= 1.0 * spawnModifier) || burgSecurity < 50) {
			if (habitat === "ocean" && !existingKeys.has(`${burg.id}-Smugglers`)) {
				updatedGroups.push({
					id: nextId++,
					type: "Smugglers",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.02),
					name: `${burg.name} Cove Smugglers`,
					description:
						"Contraband runners moving tax-free narcotics through secret ocean trenches.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Underground Syndicate",
				});
				existingKeys.add(`${burg.id}-Smugglers`);
			} else if (
				habitat === "land" &&
				!existingKeys.has(`${burg.id}-Bandits`)
			) {
				updatedGroups.push({
					id: nextId++,
					type: "Bandits",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.02),
					name: `${burg.name} Highwaymen`,
					description:
						"Outlaws and bandits raiding overland caravan routes for basic survival.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Mountain Fortress",
				});
				existingKeys.add(`${burg.id}-Bandits`);
			}
		}

		// Magic density trigger -> Cultists
		const cellMagicLevel = magicLevels[burg.cell] || 0;
		if (cellMagicLevel > 80.0 && !existingKeys.has(`${burg.id}-Cultists`)) {
			if (habitat === "ocean") {
				updatedGroups.push({
					id: nextId++,
					type: "Cultists",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.03),
					name: `Abyssal Cult of ${burg.name}`,
					description:
						"Worshippers of the deep ocean trenches and ancient, leviathan magic.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Leyline Sanctum",
				});
			} else {
				updatedGroups.push({
					id: nextId++,
					type: "Cultists",
					originBurgId: burg.id,
					originBurgName: burg.name,
					size: Math.floor(burg.population * 0.03),
					name: `Mage Cult of ${burg.name}`,
					description:
						"Esoteric magic-worshippers gathered around radioactive ley line nodes.",
					habitat,
					hideoutDiscovered: false,
					hideoutType: "Leyline Sanctum",
				});
			}
			existingKeys.add(`${burg.id}-Cultists`);
		}
	}

	return updatedGroups;
}
