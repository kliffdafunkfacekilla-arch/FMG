import { createPRNG } from "../../core/random";
import type { Paragon } from "../../state/store";

const POSITIVE_TRAITS = ["Benevolent", "Brave", "Charismatic", "Diligent", "Generous", "Honest", "Just", "Patient", "Wise", "Loyal", "Merciful"];
const NEUTRAL_TRAITS = ["Ambitious", "Cautious", "Determined", "Frugal", "Proud", "Reserved", "Strict", "Traditional", "Unpredictable", "Zealous"];
const NEGATIVE_TRAITS = ["Cruel", "Cowardly", "Deceitful", "Greedy", "Lazy", "Paranoid", "Selfish", "Vindictive", "Gluttonous", "Arrogant"];

const FIRST_NAMES = ["Aelar", "Bram", "Cael", "Darius", "Eldon", "Faelar", "Gareth", "Haldor", "Iannis", "Jarek", "Kaelen", "Lorin", "Marius", "Nael", "Orion", "Pavel", "Quinn", "Rowan", "Soren", "Taurin", "Ulric", "Vael", "Willem", "Xander", "Yorick", "Zane", "Alara", "Brisa", "Caelia", "Daria", "Elara", "Faelynn", "Gael", "Halia", "Ilyse", "Jara", "Kaelia", "Lyra", "Mireia", "Naia", "Oria", "Pyra", "Qira", "Rhea", "Sira", "Tyra", "Ulia", "Vira", "Wyla", "Xira", "Yara", "Zira"];

const SURNAMES = ["Ironfist", "Stormrider", "Bloodaxe", "Swiftfoot", "Shadowwalker", "Lightbringer", "Dragonbane", "Wolfheart", "Bearclaw", "Eagleeye", "Hawkmoon", "Ravenwing", "Frostweaver", "Fireforge", "Stonebreaker", "Windwhisper", "Oakenshield", "Pinecaller", "Riverdancer", "Seafoam", "Starfall", "Moonwatcher", "Sunstrider", "Dawnchaser", "Duskweaver", "Nightshade", "Grimward", "Blightbane", "Doomweaver", "Soulbinder"];

function getRandomItem(rng: () => number, arr: string[]): string {
	return arr[Math.floor(rng() * arr.length)];
}

function rollStat(rng: () => number): number {
	// 1 to 10 scale with a slight center curve
	const roll1 = rng() * 5;
	const roll2 = rng() * 5;
	let total = Math.floor(roll1 + roll2) + 1;
	if (total > 10) total = 10;
	if (total < 1) total = 1;
	return total;
}

export function generateParagons(
	states: any[],
	burgs: any[],
	religions: any[],
	seed: string
): Paragon[] {
	const paragons: Paragon[] = [];
	const rng = createPRNG(seed);
	let nextId = 1;

	const createParagon = (affiliationType: "state"|"burg"|"religion", id: number, role: string): Paragon => {
		const pos = getRandomItem(rng, POSITIVE_TRAITS);
		const neut1 = getRandomItem(rng, NEUTRAL_TRAITS);
		let neut2 = getRandomItem(rng, NEUTRAL_TRAITS);
		while (neut2 === neut1) {
			neut2 = getRandomItem(rng, NEUTRAL_TRAITS);
		}
		const neg = getRandomItem(rng, NEGATIVE_TRAITS);

		const fname = getRandomItem(rng, FIRST_NAMES);
		const lname = getRandomItem(rng, SURNAMES);

		return {
			id: `p_${nextId++}`,
			name: `${fname} ${lname}`,
			affiliationType,
			affiliationId: id,
			role,
			stats: {
				might: rollStat(rng),
				endurance: rollStat(rng),
				finesse: rollStat(rng),
				reflex: rollStat(rng),
				vitality: rollStat(rng),
				fortitude: rollStat(rng),
				knowledge: rollStat(rng),
				logic: rollStat(rng),
				awareness: rollStat(rng),
				intuition: rollStat(rng),
				charm: rollStat(rng),
				willpower: rollStat(rng),
			},
			positiveTrait: pos,
			neutralTraits: [neut1, neut2],
			negativeTrait: neg
		};
	};

	// Generate a ruler for every state
	for (const state of states) {
		paragons.push(createParagon("state", state.i, "Ruler"));
	}

	// Generate a mayor for every populated burg
	for (const burg of burgs) {
		if (burg.population > 0) {
			paragons.push(createParagon("burg", burg.i, "Mayor"));
		}
	}

	// Generate a high priest for every religion
	for (const religion of religions) {
		paragons.push(createParagon("religion", religion.i, "High Priest"));
	}

	return paragons;
}
