import type { AppState, StorySeed, Paragon } from "../../state/store";

export function calculateStoryHooks(cell: number, radius: number, state: AppState): StorySeed[] {
	const seeds: StorySeed[] = [];
	
	if (!state.grid || !state.markers || !state.paragons) return seeds;

	let threatScore = 0;
	let opportunityScore = 0;
	const issues: string[] = [];
	const actors: string[] = [];
	let openness: "secret" | "rumor" | "well-known" = "rumor";

	// Simple BFS to find nearby cells
	const visited = new Set<number>();
	const queue = [{ c: cell, dist: 0 }];
	const localCells = new Set<number>();
	
	while(queue.length > 0) {
		const curr = queue.shift()!;
		if(visited.has(curr.c)) continue;
		visited.add(curr.c);
		localCells.add(curr.c);
		
		if(curr.dist < radius) {
			const n = state.grid.cells.c[curr.c];
			if (n) {
				for(const next of n) {
					if(!visited.has(next)) {
						queue.push({ c: next, dist: curr.dist + 1 });
					}
				}
			}
		}
	}

	// 1. Analyze Markers in local radius
	for (const marker of state.markers) {
		if (localCells.has(marker.cell)) {
			// Find marker type
			const mType = state.markerTypes?.find(mt => mt.id === marker.type);
			if (mType) {
				if (mType.effect === "danger") {
					threatScore += 5;
					issues.push(`A dangerous ${mType.name} threatens the area.`);
				} else if (mType.effect === "wealth") {
					opportunityScore += 5;
					issues.push(`Untold wealth lies hidden in a local ${mType.name}.`);
				} else if (mType.effect === "happiness") {
					opportunityScore += 2;
				}
				
				if (mType.frequentedByNPCs) {
					openness = "well-known";
				} else if (openness === "rumor" && Math.random() > 0.5) {
					openness = "secret";
				}
			}
		}
	}

	// 2. Analyze Local Paragons
	// Find burgs in local area
	const localBurgs = (state.burgs || []).filter(b => localCells.has(b.cell));
	const localBurgIds = new Set(localBurgs.map(b => b.i));
	
	// Find states of those burgs
	const localStateIds = new Set(localBurgs.map(b => b.state));

	const localParagons = state.paragons.filter(p => {
		if (p.affiliationType === "burg" && localBurgIds.has(p.affiliationId as number)) return true;
		if (p.affiliationType === "state" && localStateIds.has(p.affiliationId as number)) return true;
		return false;
	});

	for (const paragon of localParagons) {
		if (paragon.negativeTrait === "Cruel" || paragon.negativeTrait === "Greedy" || paragon.negativeTrait === "Paranoid") {
			threatScore += 3;
			issues.push(`The local ${paragon.role} (${paragon.name}) is ${paragon.negativeTrait.toLowerCase()}, causing unrest.`);
			actors.push(paragon.id);
		}
		
		if (paragon.positiveTrait === "Generous" || paragon.positiveTrait === "Benevolent") {
			opportunityScore += 3;
			issues.push(`The ${paragon.positiveTrait.toLowerCase()} ${paragon.role} is looking for adventurers to help the people.`);
			if (!actors.includes(paragon.id)) actors.push(paragon.id);
		}
	}

	// 3. Analyze Logs
	if (state.globalLogs) {
		const recentLogs = state.globalLogs.slice(-10); // Look at last 10 events
		for (const log of recentLogs) {
			if (log.type === "military" && log.entities?.some((e: number) => localStateIds.has(e))) {
				threatScore += 4;
				issues.push(`Recent military conflict involves the local ruling state.`);
				openness = "well-known";
			}
		}
	}

	// If there's enough material, generate a seed
	if (threatScore > 0 || opportunityScore > 0) {
		seeds.push({
			id: `seed_${Date.now()}_${cell}`,
			cell,
			threatScore,
			opportunityScore,
			issues,
			actors,
			openness
		});
	}

	return seeds;
}
