import { store } from "../../state/store";
import { generateBiomes } from "../biomes/biomes-generator";
import { GOODS } from "../civilization/goods-generator";
import { runProductionCycles } from "../civilization/production-generator";
import { generateStates } from "../civilization/state-generator";
import {
	type ClimateOptions,
	generateClimate,
} from "../climate/climate-generator";
import {
	calculateOceanCurrents,
	calculateOceanNutrients,
	calculateUpwellingFlux,
} from "../climate/marine-simulator";
import {
	initializeEcology,
	simulateEcologyStep,
} from "../ecology/ecology-simulator";
import { generateFringeGroups } from "../fringe/fringe-generator";
import {
	applyMagicDailyCostsAndEffects,
	applyMagicGeopoliticalVectors,
	calculateMagePopulations,
	calculateMagicFlux,
	generateLeyLines,
	generateMagicNodes,
	runMagicVolatilityChecks,
} from "../magic/magic-system";
import { TickSystem } from "./tick-system";

export class SimulationLoop {
	private tickSystem: TickSystem | null = null;
	private climateOptions: ClimateOptions;

	constructor(initialOptions: ClimateOptions) {
		this.climateOptions = { ...initialOptions };
	}

	public advanceTick(ticks: number = 1): void {
		const currentState = store.getState() as any;

		const cycles = {
			ticksPerDay: 24,
			weekdays: currentState.weekdays || [],
			months: currentState.months || [],
			seasons: currentState.seasons || [],
			moons: currentState.moons || [],
		};

		const prevCalendar = currentState.calendar;
		this.tickSystem = new TickSystem(cycles, prevCalendar || undefined);

		const calendar = this.tickSystem.advance(ticks);

		// Apply active climate modifiers to setup baseline
		if (calendar.activeModifiers) {
			this.climateOptions.temperatureEquator =
				(currentState.temp ? currentState.temp[0] : 20) +
				calendar.activeModifiers.tempMod;
			this.climateOptions.precInput = 100 * calendar.activeModifiers.precMod;
		}

		this.climateOptions.seasonOffset = calendar.seasonOffset;

		const pointsN = currentState.heights ? currentState.heights.length : 0;

		// Initialize Ecology state if needed
		let plants = currentState.plants;
		let herbivores = currentState.herbivores;
		let predators = currentState.predators;
		let farmingCells = currentState.farmingCells;
		let loggingCells = currentState.loggingCells;

		if (pointsN > 0) {
			if (!plants) {
				const eco = initializeEcology(pointsN, currentState.heights);
				plants = eco.plants;
				herbivores = eco.herbivores;
				predators = eco.predators;
			}
			if (!farmingCells) {
				farmingCells = new Uint8Array(pointsN).fill(0);
			}
			if (!loggingCells) {
				loggingCells = new Uint8Array(pointsN).fill(0);
			}
		}

		// Initialize Magic state if needed
		let magicNodes = currentState.magicNodes;
		let magicFlux = currentState.magicFlux;
		let magePopulation = currentState.magePopulation;
		const magicTypes = currentState.magicTypes || [];

		if (
			pointsN > 0 &&
			currentState.grid &&
			currentState.heights &&
			currentState.biomes
		) {
			if (!magicNodes) {
				magicNodes = generateMagicNodes(
					currentState.grid,
					currentState.heights,
					currentState.biomes,
					6,
				);
				const leyLines = generateLeyLines(currentState.grid, magicNodes);
				magicFlux = calculateMagicFlux(currentState.grid, magicNodes, leyLines);
			}
			if (!magePopulation) {
				const safePops = currentState.grid.cells.prec
					? Float32Array.from(currentState.grid.cells.prec)
					: new Float32Array(pointsN).fill(100.0);
				magePopulation = calculateMagePopulations(
					magicFlux,
					safePops,
					magicTypes,
					currentState.cellStates || undefined,
					currentState.states || undefined,
					currentState.cellReligions || undefined,
				);
			}
		}

		// Initialize Marine Physical Simulation state if needed
		let oceanCurrents = currentState.oceanCurrents;
		let oceanNutrients = currentState.oceanNutrients;
		let upwellingFlux = currentState.upwellingFlux;

		if (pointsN > 0 && currentState.grid && currentState.heights) {
			if (!oceanCurrents) {
				oceanCurrents = calculateOceanCurrents(
					currentState.grid,
					currentState.heights,
				);
			}
			if (!upwellingFlux) {
				upwellingFlux = calculateUpwellingFlux(
					currentState.grid,
					currentState.heights,
				);
			}
			if (!oceanNutrients) {
				const flowDirs =
					currentState.flowDirections || new Int32Array(pointsN).fill(-1);
				const landFlux =
					currentState.flux || new Float32Array(pointsN).fill(1.0);
				oceanNutrients = calculateOceanNutrients(
					currentState.grid,
					currentState.heights,
					flowDirs,
					landFlux,
					upwellingFlux,
				);
			}
		}

		// Fast Day-by-Day Geopolitical Logic Loop
		const daysPassed = Math.floor(ticks / 24);
		const updatedBurgs = currentState.burgs
			? currentState.burgs.map((b: any) => ({ ...b }))
			: [];
		const updatedStates = currentState.states
			? currentState.states.map((s: any) => ({ ...s }))
			: [];
		const updatedMarkets = currentState.markets
			? currentState.markets.map((m: any) => ({
					...m,
					supply: Array.isArray(m.supply) ? [...m.supply] : { ...m.supply },
				}))
			: [];
		let biomes = currentState.biomes
			? new Uint8Array(currentState.biomes)
			: new Uint8Array(pointsN).fill(3);
		let fringeGroups = currentState.fringeGroups || [];

		if (daysPassed > 0 && updatedBurgs.length > 0 && updatedStates.length > 0) {
			const activeMods = calendar.activeModifiers || {
				tempMod: 0,
				precMod: 1.0,
				popMod: 1.0,
				prodMod: 1.0,
				diplomacyMod: 1.0,
			};

			const preyMod = (currentState.preyRate ?? 100) / 100;
			const predMod = (currentState.predRate ?? 100) / 100;
			const magicSens = currentState.magicSens ?? 1.0;

			const ecologyRates = {
				plantGrowthRate: 0.15,
				herbivoreGrazingRate: 0.001 * preyMod,
				herbivoreReproductionRate: 0.002 * preyMod,
				herbivoreDeathRate: 0.05,
				predatorHuntingRate: 0.005 * predMod,
				predatorReproductionRate: 0.003 * predMod,
				predatorDeathRate: 0.1,
			};

			const magicEcologyWeights = new Float32Array(pointsN).fill(1.0);
			if (magicFlux && magePopulation && magicTypes.length > 0) {
				const safePops = currentState.grid.cells.prec
					? Float32Array.from(currentState.grid.cells.prec)
					: new Float32Array(pointsN).fill(100.0);

				for (let i = 0; i < pointsN; i++) {
					const magesCount = magePopulation[i] || 0;
					const totalPop = safePops[i] || 100.0;
					const mageRatio = magesCount / Math.max(1, totalPop);

					let ecoWeight = 1.0;
					for (const config of magicTypes) {
						const leverage = mageRatio * 5.0 * magicSens;
						ecoWeight += (config.weights.ecology - 1.0) * leverage;
					}
					magicEcologyWeights[i] = Math.max(0.1, ecoWeight);
				}
			}

			// Instantiate Hash Maps once outside the day loop to avoid hundreds of daily allocations
			const burgMap = new Map(updatedBurgs.map((b) => [b.id, b]));
			const stateMap = new Map(updatedStates.map((s) => [s.id, s]));

			// We run the daily loop
			for (let day = 0; day < daysPassed; day++) {
				// 1. Magic Volatility Checks
				if (magicFlux && magicTypes.length > 0) {
					const nextBiomes = runMagicVolatilityChecks(
						biomes,
						magicFlux,
						magicTypes,
					);
					biomes = nextBiomes;
				}

				// 2. Coastal Nutrient Diffusion & Upwelling Run
				if (oceanNutrients && currentState.grid) {
					const flowDirs =
						currentState.flowDirections || new Int32Array(pointsN).fill(-1);
					const landFlux =
						currentState.flux || new Float32Array(pointsN).fill(1.0);
					oceanNutrients = calculateOceanNutrients(
						currentState.grid,
						currentState.heights,
						flowDirs,
						landFlux,
						upwellingFlux || new Float32Array(pointsN).fill(0),
					);
				}

				// 3. Ecology CA step (processes marine plants growth using oceanNutrients)
				if (plants && currentState.grid) {
					const ecoState = { plants, herbivores, predators };
					const nextBiomes = simulateEcologyStep(
						ecoState,
						currentState.grid,
						currentState.heights,
						currentState.temp || new Float32Array(pointsN).fill(20),
						currentState.prec || new Uint8Array(pointsN).fill(100),
						biomes,
						farmingCells,
						loggingCells,
						ecologyRates,
						magicEcologyWeights,
						oceanNutrients,
					);
					biomes = nextBiomes;
				}

				// 4. Dynamic Weather Seasonality & Fluctuation
				const dayOfYear = (calendar.day || 1) % 360;
				// Seasonal temperature wave (uses user-configured seasonal tempMod if available, else standard sine wave)
				const seasonalTemp =
					calendar.activeModifiers?.tempMod !== undefined
						? calendar.activeModifiers.tempMod
						: Math.sin((dayOfYear / 360) * Math.PI * 2) * 10;
				// Daily weather volatility noise
				const dailyNoise = Math.sin(day * 0.5) * 3 + (Math.random() - 0.5) * 4;
				activeMods.tempMod = seasonalTemp + dailyNoise;

				// Precipitation fluctuates based on atmospheric seasonal cycles (uses user-configured seasonal precMod if available, else cosine wave) and storm fronts
				const seasonalPrec =
					calendar.activeModifiers?.precMod !== undefined
						? calendar.activeModifiers.precMod
						: 1.0 + Math.cos((dayOfYear / 360) * Math.PI * 2) * 0.3; // 0.7 to 1.3
				const weatherFront =
					Math.random() < 0.12 ? 1.8 : Math.random() < 0.06 ? 0.25 : 1.0; // sudden storms or dry spells
				activeMods.precMod = Math.max(0.15, seasonalPrec * weatherFront);

				// Retrieve custom moon phase effects
				const moonEffects = (calendar.moonPhases || [])
					.map((m: any) => m.effect)
					.filter(Boolean);

				// Moon Phase effects on general modifiers
				if (moonEffects.includes("mana_surge")) {
					activeMods.prodMod = (activeMods.prodMod || 1.0) * 1.5;
					if (Math.random() < 0.05) {
						if (!calendar.activeModifiers) calendar.activeModifiers = {};
						if (!calendar.activeModifiers.notifications)
							calendar.activeModifiers.notifications = [];
						calendar.activeModifiers.notifications.push(
							`✨ Mana Surge active: Ley-Magic lines are pulsating with celestial lunar energies!`,
						);
					}
				}
				if (moonEffects.includes("harvest_surge") && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`🌙 Harvest Blessing active: Moon phases encourage crop fertility across all farmlands.`,
					);
				}
				if (moonEffects.includes("outlaw_surge") && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`🌘 Lunacy & Outlaw Surge active: Roadside bandits thrive under darkened celestial alignments.`,
					);
				}
				if (moonEffects.includes("plague_surge") && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`🌑 Crimson Eclipse active: A pestilential celestial aura settles over the realm.`,
					);
				}
				if (moonEffects.includes("peace_surge") && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`🌕 Celestial Harmony active: A peaceful light settles over the lands, calming provincial borders.`,
					);
				}

				// Apply active holiday notifications
				const activeHolidays = (currentState.holidays || []).filter(
					(h: any) => h.month === calendar.month && h.day === calendar.day,
				);

				for (const h of activeHolidays) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];

					const msg =
						h.type === "holiday"
							? `🎉 Holiday observed: "${h.name}" brings festive celebrations and public joy to the cities!`
							: `💀 Dark Event: "${h.name}" casts an ominous shadow of despair and unholy foreboding today.`;

					if (!calendar.activeModifiers.notifications.includes(msg)) {
						calendar.activeModifiers.notifications.push(msg);
					}
				}

				// Log major climate alerts to the notification center
				if (activeMods.tempMod < -12 && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`❄️ Freeze Warning: A freezing winter front has gripped the region! High risk of crop frostbite.`,
					);
				}
				if (activeMods.precMod < 0.3 && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`☀️ Drought Warning: An extreme lack of precipitation is dehydrating the local soils.`,
					);
				}
				if (activeMods.precMod > 1.6 && Math.random() < 0.05) {
					if (!calendar.activeModifiers) calendar.activeModifiers = {};
					if (!calendar.activeModifiers.notifications)
						calendar.activeModifiers.notifications = [];
					calendar.activeModifiers.notifications.push(
						`🌧️ Flood Warning: Heavy storms and high precipitation are inundating lowland crop fields.`,
					);
				}

				// 5. Crop/Food resource harvesting & collection (agricultural index 2 = Grain, 4 = Fruit)
				const grainId = 2;
				const fruitId = 4;
				let landFoodHarvest = Math.round(
					5 * activeMods.precMod * (activeMods.tempMod > -8 ? 1.2 : 0.2),
				);
				if (moonEffects.includes("harvest_surge")) {
					landFoodHarvest = Math.round(landFoodHarvest * 1.5);
				}

				for (const m of updatedMarkets) {
					const burg = burgMap.get(m.burgId);
					if (!burg) continue;

					const localPlantDensity = plants ? plants[burg.cell] : 100.0;
					const plantFactor = Math.max(0.1, localPlantDensity / 100.0);

					const isUnderwater =
						currentState.heights && currentState.heights[burg.cell] < 20;
					let foodHarvest = landFoodHarvest;

					if (isUnderwater) {
						// Undersea burg food harvesting is driven by ocean nutrients and temp, not land rain!
						const localNutrients = oceanNutrients
							? oceanNutrients[burg.cell]
							: 15.0;
						const nutrientFactor = 0.5 + localNutrients / 40.0;
						foodHarvest = Math.round(
							5 * nutrientFactor * (activeMods.tempMod > -8 ? 1.2 : 0.2),
						);
					}
					if (moonEffects.includes("harvest_surge")) {
						foodHarvest = Math.round(foodHarvest * 1.5);
					}

					const finalHarvest = Math.round(foodHarvest * plantFactor);
					m.supply[grainId] = (m.supply[grainId] || 0) + finalHarvest;
					m.supply[fruitId] =
						(m.supply[fruitId] || 0) + Math.round(finalHarvest * 0.5);
				}

				// 6. Food Consumption, Manpower, and Demographics
				for (const m of updatedMarkets) {
					const burg = burgMap.get(m.burgId);
					if (!burg) continue;

					const foodRequired = Math.ceil(burg.population * 0.05);
					const grainSupply = m.supply[grainId] || 0;
					const fruitSupply = m.supply[fruitId] || 0;
					const foodAvailable = grainSupply + fruitSupply;

					if (foodAvailable < foodRequired) {
						// Starvation: pop declines, zero food supply left
						const shortage = foodRequired - foodAvailable;
						burg.population = Math.max(0, burg.population - shortage * 2);
						burg.growthRate = -0.05; // declining
						m.supply[grainId] = 0;
						m.supply[fruitId] = 0;
					} else {
						// Food surplus: pop grows
						burg.population += Math.round(
							burg.population * 0.002 * activeMods.popMod,
						);
						burg.growthRate = 0.02 * activeMods.popMod;
						// Consume foods proportionally
						const consumeGrain = Math.min(
							grainSupply,
							Math.round(foodRequired * 0.7),
						);
						const consumeFruit = foodRequired - consumeGrain;
						m.supply[grainId] = Math.max(0, grainSupply - consumeGrain);
						m.supply[fruitId] = Math.max(0, fruitSupply - consumeFruit);
					}
				}

				// 7. Manufacturing Production Cycles (Transforms raw resources to manufactured goods)
				runProductionCycles(updatedMarkets);

				// 8. Autonomous Regional Commerce & Trade Caravan Hijack Loop
				if (updatedMarkets.length > 1) {
					for (let t = 0; t < 3; t++) {
						// Run 3 trade attempts across random city pairs daily
						const idxA = Math.floor(Math.random() * updatedMarkets.length);
						const idxB = Math.floor(Math.random() * updatedMarkets.length);
						if (idxA === idxB) continue;

						const marketA = updatedMarkets[idxA];
						const marketB = updatedMarkets[idxB];
						const burgA = burgMap.get(marketA.burgId);
						const burgB = burgMap.get(marketB.burgId);
						if (!burgA || !burgB) continue;

						// Determine sovereignty of each city
						const cellStates = currentState.cellStates || [];
						const stateAId = cellStates[burgA.cell] || 0;
						const stateBId = cellStates[burgB.cell] || 0;

						// Check diplomacy: cities can trade if they belong to the same state, or if relations are friendly/allied
						let canTrade = stateAId === stateBId;
						if (!canTrade && currentState.relations) {
							const rel = currentState.relations.find(
								(r: any) =>
									(r.stateA === stateAId && r.stateB === stateBId) ||
									(r.stateA === stateBId && r.stateB === stateAId),
							);
							if (
								rel &&
								(rel.type === "Alliance" ||
									rel.type === "Friendly" ||
									rel.type === "Neutral")
							) {
								canTrade = true;
							}
						}

						// Apply Xenophobia penalty to trade volume if they belong to different states
						let tradeVolumeMultiplier = 1.0;
						if (stateAId !== stateBId) {
							const sA = currentState.states?.find((s: any) => s.id === stateAId);
							const sB = currentState.states?.find((s: any) => s.id === stateBId);
							const xenoA = sA?.xenophobia || 1.0;
							const xenoB = sB?.xenophobia || 1.0;
							if (xenoA > 1.5 || xenoB > 1.5) {
								tradeVolumeMultiplier = 0.5; // High xenophobia cuts trade in half
							}
						}

						if (canTrade) {
							// Find a commodity that A has in surplus (>15) and B has in deficit (<5)
							let tradeGoodIdStr = "";
							let maxDeficitDiff = 0;

							for (const gIdStr of Object.keys(marketA.supply)) {
								const valA = marketA.supply[gIdStr] || 0;
								const valB = marketB.supply[gIdStr] || 0;
								if (valA > 15 && valB < 5) {
									const diff = valA - valB;
									if (diff > maxDeficitDiff) {
										maxDeficitDiff = diff;
										tradeGoodIdStr = gIdStr;
									}
								}
							}

							if (tradeGoodIdStr) {
								const gId = parseInt(tradeGoodIdStr, 10);
								const goodName = GOODS[gId]?.name || `Good #${gId}`;
								const tradeQty = Math.floor(Math.min(
									6,
									Math.floor(((marketA.supply[gId] || 15) - 10) / 2)
								) * tradeVolumeMultiplier);

								if (tradeQty > 0) {
									// Route safety calculation based on local law enforcement levels of both terminals
									const routeSafety =
										((burgA.security !== undefined ? burgA.security : 100) +
											(burgB.security !== undefined ? burgB.security : 100)) /
										2;
									const plunderedProb = (1.0 - routeSafety / 100) * 0.45; // Up to 45% risk if security is totally broken

									if (Math.random() < plunderedProb) {
										// CARAVAN HIJACKED!
										// Remove goods from seller but buyer receives nothing!
										marketA.supply[gId] = Math.max(
											0,
											(marketA.supply[gId] || 0) - tradeQty,
										);

										// Plundered cargo feeds outlaws, increasing their manpower
										let localOutlaws = fringeGroups.find(
											(g: any) =>
												(g.originBurgId === burgA.id ||
													g.originBurgId === burgB.id) &&
												(g.type === "Bandits" || g.type === "Pirates"),
										);

										if (!localOutlaws) {
											const nextId =
												Math.max(1, ...fringeGroups.map((g: any) => g.id)) + 1;
											localOutlaws = {
												id: nextId,
												type:
													currentState.heights &&
													currentState.heights[burgA.cell] < 20
														? "Pirates"
														: "Bandits",
												originBurgId: burgA.id,
												originBurgName: burgA.name,
												size: 15,
												name: `${burgA.name} Highwaymen`,
												description: `A ring of roadside robbers and thieves thriving on plundering local trade networks.`,
												habitat:
													currentState.heights &&
													currentState.heights[burgA.cell] < 20
														? "water"
														: "land",
												hideoutDiscovered: false,
												hideoutType: "Forest Camp",
											};
											fringeGroups.push(localOutlaws);
										}

										// Caravan looting increases outlaw faction size
										const muscleGain = tradeQty * 4;
										localOutlaws.size += muscleGain;

										if (!calendar.activeModifiers)
											calendar.activeModifiers = {};
										if (!calendar.activeModifiers.notifications)
											calendar.activeModifiers.notifications = [];
										calendar.activeModifiers.notifications.push(
											`📦 Trade Caravan Plundered! A cargo of ${tradeQty} ${goodName} traveling between ${burgA.name} and ${burgB.name} was hijacked. Stolen riches attracted +${muscleGain} outlaws to the ${localOutlaws.name}.`,
										);
									} else {
										// Trade completed successfully!
										marketA.supply[gId] = Math.max(
											0,
											(marketA.supply[gId] || 0) - tradeQty,
										);
										marketB.supply[gId] = (marketB.supply[gId] || 0) + tradeQty;

										// Add tariffs / taxes to seller's state treasury!
										const sellerState = updatedStates.find(
											(s: any) => s.id === stateAId,
										);
										if (sellerState) {
											sellerState.treasury += tradeQty * 3; // Tariff revenue feeds sovereign state coffers
										}
									}
								}
							}
						}
					}
				}

				// --- FRINGE GROUPS ACTIVE CRIME AND DRUG EFFECTS ENGINE ---
				const getGoodIdByName = (name: string): number => {
					const found = Object.entries(GOODS).find(([_, g]) => g.name === name);
					return found ? Number(found[0]) : -1;
				};
				const armsId = getGoodIdByName("Arms");
				const toolsId = getGoodIdByName("Tools");
				const incenseId = getGoodIdByName("Incense");
				const algaeId = getGoodIdByName("Luminescent Algae");
				const wineId = getGoodIdByName("Wine");

				const activeFringeByBurg = new Map<number, any[]>();
				for (const g of fringeGroups) {
					if (
						moonEffects.includes("outlaw_surge") &&
						(g.type === "Bandits" ||
							g.type === "Pirates" ||
							g.type === "Rebels")
					) {
						g.size += 2;
					}
					if (!activeFringeByBurg.has(g.originBurgId)) {
						activeFringeByBurg.set(g.originBurgId, []);
					}
					activeFringeByBurg.get(g.originBurgId)!.push(g);
				}

				for (const burg of updatedBurgs) {
					if (burg.security === undefined) burg.security = 100;
					if (burg.happiness === undefined) burg.happiness = 75;
					if (burg.health === undefined) burg.health = 85;
					if (burg.drugSupply === undefined) burg.drugSupply = 0;

					// Apply Religion Modifiers
					if (currentState.cellReligions && currentState.religions) {
						const relId = currentState.cellReligions[burg.cell];
						const religion = currentState.religions.find((r: any) => r.id === relId);
						if (religion) {
							if (religion.isCult) {
								burg.happiness = Math.max(0, burg.happiness - 0.2);
								burg.security = Math.max(0, burg.security - 0.1);
							}
							if (religion.divineBlessing) {
								burg.health = Math.min(100, burg.health + 0.15);
								burg.happiness = Math.min(100, burg.happiness + 0.1);
							}
						}
					}

					// Apply custom Moon Phase effects on cities
					if (moonEffects.includes("outlaw_surge")) {
						burg.security = Math.max(0, burg.security - 3.0);
					}
					if (moonEffects.includes("plague_surge")) {
						burg.health = Math.max(10, burg.health - 4.0);
						burg.happiness = Math.max(10, burg.happiness - 3.0);
					}
					if (moonEffects.includes("peace_surge")) {
						burg.happiness = Math.min(100, burg.happiness + 3.0);
						burg.security = Math.min(100, burg.security + 2.0);
					}

					// Apply custom Holiday/Event effects on cities
					for (const h of activeHolidays) {
						if (h.effect === "happiness") {
							burg.happiness = Math.max(
								10,
								Math.min(100, burg.happiness + h.modifier),
							);
						} else if (h.effect === "safety") {
							burg.security = Math.max(
								10,
								Math.min(100, burg.security + h.modifier),
							);
						} else if (h.effect === "health") {
							burg.health = Math.max(
								10,
								Math.min(100, burg.health + h.modifier),
							);
						} else if (h.effect === "population") {
							// Population growth / loss modifier
							const popChange = Math.round(
								burg.population * (h.modifier / 100),
							);
							burg.population = Math.max(10, burg.population + popChange);
						}
					}

					const localGroups = activeFringeByBurg.get(burg.id) || [];
					const hasSmugglers = localGroups.some((g) => g.type === "Smugglers");
					const hasBanditsOrPirates = localGroups.some(
						(g) => g.type === "Bandits" || g.type === "Pirates",
					);

					// 1. Security Level Dynamics
					if (localGroups.length > 0) {
						const totalSize = localGroups.reduce(
							(acc, curr) => acc + curr.size,
							0,
						);
						const decayRate = Math.min(2.5, totalSize * 0.003);
						burg.security = Math.max(0, burg.security - decayRate);
					} else {
						burg.security = Math.min(100, burg.security + 0.35);
					}

					// 2. Lost Goods and Population Deaths (Crime consequence)
					if (hasBanditsOrPirates) {
						const m = updatedMarkets.find(
							(market) => market.burgId === burg.id,
						);
						if (m) {
							const lossFactor = 0.03 * (1.0 - burg.security / 100);
							for (const key of Object.keys(m.supply)) {
								const gId = Number(key);
								m.supply[gId] = Math.max(
									0,
									Math.floor((m.supply[gId] || 0) * (1.0 - lossFactor)),
								);
							}
						}

						const totalOutlawSize = localGroups
							.filter((g) => g.type === "Bandits" || g.type === "Pirates")
							.reduce((acc, curr) => acc + curr.size, 0);
						const deaths = Math.ceil(
							totalOutlawSize * 0.012 * (1.0 - burg.security / 100),
						);
						burg.population = Math.max(10, burg.population - deaths);
					}

					// 3. Smuggling Contraband and Narcotics
					if (hasSmugglers) {
						const totalSmugglersSize = localGroups
							.filter((g) => g.type === "Smugglers")
							.reduce((acc, curr) => acc + curr.size, 0);

						burg.drugSupply = Math.min(
							100,
							burg.drugSupply + totalSmugglersSize * 0.015,
						);

						const m = updatedMarkets.find(
							(market) => market.burgId === burg.id,
						);
						if (m) {
							if (armsId !== -1)
								m.supply[armsId] = Math.max(
									0,
									(m.supply[armsId] || 0) -
										Math.ceil(totalSmugglersSize * 0.01),
								);
							if (toolsId !== -1)
								m.supply[toolsId] = Math.max(
									0,
									(m.supply[toolsId] || 0) -
										Math.ceil(totalSmugglersSize * 0.005),
								);
						}

						if (plants) {
							plants[burg.cell] = Math.max(
								0,
								plants[burg.cell] - totalSmugglersSize * 0.008,
							);
						}

						if (m) {
							if (incenseId !== -1)
								m.supply[incenseId] = Math.max(
									0,
									(m.supply[incenseId] || 0) -
										Math.ceil(totalSmugglersSize * 0.005),
								);
							if (algaeId !== -1)
								m.supply[algaeId] = Math.max(
									0,
									(m.supply[algaeId] || 0) -
										Math.ceil(totalSmugglersSize * 0.005),
								);
							if (wineId !== -1)
								m.supply[wineId] = Math.max(
									0,
									(m.supply[wineId] || 0) -
										Math.ceil(totalSmugglersSize * 0.005),
								);
						}
					} else {
						const preDecay = burg.drugSupply;
						burg.drugSupply = Math.max(0, burg.drugSupply - 0.5);

						if (preDecay > 10 && burg.drugSupply <= 0) {
							burg.happiness = Math.max(0, burg.happiness - 20);
							if (calendar.activeModifiers) {
								if (!calendar.activeModifiers.notifications) {
									calendar.activeModifiers.notifications = [];
								}
								calendar.activeModifiers.notifications.push(
									`⚠️ ${burg.name} Narcotic supply eradicated! Local populace undergoes withdrawal, dropping happiness by 20.`,
								);
							}
						}
					}

					// 4. Morale/Happiness and Health stabilization
					if (burg.drugSupply > 10) {
						const diff = 65 - burg.happiness;
						burg.happiness += diff * 0.05; // artificially stabilizes happiness (medicated state)
						burg.health = Math.max(10, burg.health - burg.drugSupply * 0.004);
					} else {
						burg.health = Math.min(100, burg.health + 0.1);
						if (burg.security < 70) {
							burg.happiness = Math.max(0, burg.happiness - 0.15);
						} else {
							burg.happiness = Math.min(100, burg.happiness + 0.08);
						}
					}
				}

				// 6. State Treasury Accumulation & Military Payments
				// Zero state stats to accumulate daily totals
				for (const state of updatedStates) {
					state.population = 0;
				}

				for (const burg of updatedBurgs) {
					const stateId = currentState.cellStates
						? currentState.cellStates[burg.cell]
						: 0;
					const stateObj = stateMap.get(stateId);
					if (stateObj) {
						stateObj.population += burg.population;
						// Collect taxes: drugSupply drains wealth by diverting trade to the black market (collected daily)
						const taxFactor = burg.drugSupply > 10 ? 0.032 : 0.05;
						stateObj.treasury += Math.round(burg.population * taxFactor);
					}
				}

				for (const state of updatedStates) {
					// Pay army upkeep: militaryPower * 0.2 upkeep daily
					const upkeep = Math.round(state.militaryPower * 0.2);
					state.treasury = Math.max(0, state.treasury - upkeep);

					const prevMilitaryPower = state.militaryPower;

					// 7. Manpower recruitment & dynamic Military solvency
					if (state.treasury <= 0) {
						// Insolvency decay
						state.militaryPower = Math.max(0, state.militaryPower - 5);
					} else {
						// Treasury is healthy: recruit up to 5% of state population
						const targetMilitary = Math.round(state.population * 0.05);
						if (state.militaryPower < targetMilitary) {
							state.militaryPower = Math.min(
								targetMilitary,
								state.militaryPower + 2,
							);
						}
					}
					
					// Tech Progression Phase
					if (state.treasury > 500 && state.population > 1000) {
						if (!state.technologies) state.technologies = [];
						const availableTechs = ['agriculture', 'bronze_working', 'sailing', 'gunpowder', 'airships', 'cartography', 'banking'];
						const toResearch = availableTechs.filter(t => !state.technologies!.includes(t));
						if (toResearch.length > 0) {
							// E.g. chance to research tech based on wealth and pop
							const researchChance = 0.005 + (state.treasury / 100000) + (state.population / 200000);
							if (Math.random() < researchChance) {
								const unlocked = toResearch[Math.floor(Math.random() * toResearch.length)];
								state.technologies.push(unlocked);
								if (calendar.activeModifiers) {
									if (!calendar.activeModifiers.notifications) {
										calendar.activeModifiers.notifications = [];
									}
									calendar.activeModifiers.notifications.push(
										`🔬 Tech Breakthrough! The State of ${state.name} has unlocked the secrets of ${unlocked.toUpperCase()}!`
									);
								}
							}
						}
					}
					
					// State Expansionism Cell Stealing
					if (state.expansionism > 1.0 && currentState.cellStates && currentState.grid && currentState.grid.cells) {
						// Small chance per tick per state to steal a border cell
						if (Math.random() < (state.expansionism - 1.0) * 0.1) {
							const stateBurgs = updatedBurgs.filter(b => currentState.cellStates![b.cell] === state.id);
							if (stateBurgs.length > 0) {
								const b = stateBurgs[Math.floor(Math.random() * stateBurgs.length)];
								const neighbors = currentState.grid.cells.c[b.cell] || [];
								for (const n of neighbors) {
									// If neighbor is neutral or belongs to another state, claim it!
									if (currentState.cellStates[n] !== state.id) {
										currentState.cellStates[n] = state.id;
										if (calendar.activeModifiers) {
											if (!calendar.activeModifiers.notifications) {
												calendar.activeModifiers.notifications = [];
											}
											calendar.activeModifiers.notifications.push(
												`🗺️ Expansion! The State of ${state.name} has aggressively expanded its borders into neighboring territory.`
											);
										}
										break;
									}
								}
							}
						}
					}

					// Rogue Desertion System (70% of military shrink goes rogue)
					const diffMilitary = prevMilitaryPower - state.militaryPower;
					if (diffMilitary > 0) {
						const goesRogue = Math.random() < 0.7;
						if (goesRogue) {
							const rogueManpower = Math.round(diffMilitary * 12);
							if (rogueManpower > 0) {
								const stateBurgs = updatedBurgs.filter(
									(b) =>
										(currentState.cellStates
											? currentState.cellStates[b.cell]
											: 0) === state.id,
								);
								if (stateBurgs.length > 0) {
									// Decay security of state's burgs
									for (const b of stateBurgs) {
										b.security = Math.max(0, (b.security || 100) - 15);
									}

									const randomBurg =
										stateBurgs[Math.floor(Math.random() * stateBurgs.length)];
									const isUnderwater = currentState.heights
										? currentState.heights[randomBurg.cell] < 20
										: false;
									const preferType = isUnderwater ? "Pirates" : "Bandits";

									let existingGroup = fringeGroups.find(
										(g) =>
											g.originBurgId === randomBurg.id && g.type === preferType,
									);
									if (!existingGroup) {
										existingGroup = fringeGroups.find(
											(g) =>
												stateBurgs.some((sb) => sb.id === g.originBurgId) &&
												g.type === preferType,
										);
									}

									if (existingGroup) {
										existingGroup.size += rogueManpower;
									} else {
										const nextId =
											Math.max(1, ...fringeGroups.map((g: any) => g.id)) + 1;
										const newGroup = {
											id: nextId,
											type: preferType,
											originBurgId: randomBurg.id,
											originBurgName: randomBurg.name,
											size: rogueManpower,
											name:
												preferType === "Pirates"
													? `${randomBurg.name} Corsair Renegades`
													: `${randomBurg.name} Rogue Deserters`,
											description: `Demobilized veterans from the forces of ${state.name} who turned to out-and-out lawlessness.`,
											habitat: isUnderwater
												? ("ocean" as const)
												: ("land" as const),
											hideoutDiscovered: false,
											hideoutType:
												preferType === "Pirates"
													? ("Cove Hideout" as const)
													: ("Mountain Fortress" as const),
										};
										fringeGroups.push(newGroup);
									}

									if (calendar.activeModifiers) {
										if (!calendar.activeModifiers.notifications) {
											calendar.activeModifiers.notifications = [];
										}
										calendar.activeModifiers.notifications.push(
											`⚠️ Desertion! ${rogueManpower} demobilized soldiers from ${state.name} have formed rogue outlaws due to budget cuts.`,
										);
									}
								}
							}
						}
					}

					// --- STATE AUTONOMOUS STRATEGY AI ---
					// Factions autonomously handle outlaw suppression and launch covert operations against rivals
					if (state.treasury > 80) {
						// 1. Domestic Outlaw Faction Suppression
						const stateBurgIds = updatedBurgs
							.filter(
								(b: any) =>
									(currentState.cellStates
										? currentState.cellStates[b.cell]
										: 0) === state.id,
							)
							.map((b: any) => b.id);

						const localFactions = fringeGroups.filter((g: any) =>
							stateBurgIds.includes(g.originBurgId),
						);

						if (localFactions.length > 0) {
							// Target the biggest active domestic threat
							const largestThreat = localFactions.sort(
								(a: any, b: any) => b.size - a.size,
							)[0];
							const localBurg = updatedBurgs.find(
								(b: any) => b.id === largestThreat.originBurgId,
							);

							if (largestThreat.hideoutDiscovered) {
								const raidCost = Math.max(
									80,
									Math.floor(largestThreat.size * 1.5),
								);
								if (state.treasury >= raidCost + 100) {
									state.treasury -= raidCost;
									// Eradicate faction completely
									const fIdx = fringeGroups.findIndex(
										(fg: any) => fg.id === largestThreat.id,
									);
									if (fIdx !== -1) {
										fringeGroups.splice(fIdx, 1);
									}
									if (localBurg) {
										localBurg.security = Math.min(
											100,
											(localBurg.security || 100) + 35,
										);
										if (
											largestThreat.type === "Smugglers" &&
											localBurg.drugSupply > 15
										) {
											localBurg.happiness = Math.max(
												0,
												(localBurg.happiness || 75) - 20,
											);
										}
									}

									if (calendar.activeModifiers) {
										if (!calendar.activeModifiers.notifications) {
											calendar.activeModifiers.notifications = [];
										}
										calendar.activeModifiers.notifications.push(
											`⚔️ Autonomous Raid! ${state.name} launched a full military strike on the ${largestThreat.hideoutType} of the ${largestThreat.name}, dismantling their cell (Cost: ${raidCost} gold).`,
										);
									}
								}
							} else {
								const scoutCost = Math.max(
									30,
									Math.floor(largestThreat.size * 0.4),
								);
								if (state.treasury >= scoutCost + 100 && Math.random() < 0.06) {
									state.treasury -= scoutCost;
									largestThreat.hideoutDiscovered = true;

									if (calendar.activeModifiers) {
										if (!calendar.activeModifiers.notifications) {
											calendar.activeModifiers.notifications = [];
										}
										calendar.activeModifiers.notifications.push(
											`🔍 Autonomous Recon! Scouts of ${state.name} located the secret ${largestThreat.hideoutType} of the ${largestThreat.name} near ${largestThreat.originBurgName} (Cost: ${scoutCost} gold).`,
										);
									}
								} else {
									const skirmishCost = Math.max(
										40,
										Math.floor(largestThreat.size * 0.8),
									);
									const currentSec = localBurg
										? localBurg.security !== undefined
											? localBurg.security
											: 100
										: 100;
									if (
										state.treasury >= skirmishCost + 100 &&
										currentSec < 60 &&
										Math.random() < 0.12
									) {
										state.treasury -= skirmishCost;
										const oldSize = largestThreat.size;
										largestThreat.size = Math.max(
											5,
											Math.floor(largestThreat.size * 0.55),
										);

										if (calendar.activeModifiers) {
											if (!calendar.activeModifiers.notifications) {
												calendar.activeModifiers.notifications = [];
											}
											calendar.activeModifiers.notifications.push(
												`⚔️ Autonomous Skirmish! Troops of ${state.name} clashed with the ${largestThreat.name}, thinning their numbers from ${oldSize} to ${largestThreat.size} men (Cost: ${skirmishCost} gold).`,
											);
										}
									}
								}
							}
						}

						// 2. Foreign Espionage & Covert Proxy Operations
						const stateRelations = currentState.relations || [];
						const rivals = stateRelations
							.filter((r: any) => {
								return (
									(r.stateA === state.id || r.stateB === state.id) &&
									(r.type === "War" || r.type === "Suspicious")
								);
							})
							.map((r: any) => (r.stateA === state.id ? r.stateB : r.stateA));

						if (
							rivals.length > 0 &&
							state.treasury > 250 &&
							Math.random() < 0.03
						) {
							const targetRivalId =
								rivals[Math.floor(Math.random() * rivals.length)];
							const targetRivalState = updatedStates.find(
								(s: any) => s.id === targetRivalId,
							);

							if (targetRivalState) {
								const ops = [
									"arm_rebels",
									"sabotage_production",
									"incite_unrest",
								];
								const chosenOp = ops[Math.floor(Math.random() * ops.length)];

								if (chosenOp === "arm_rebels" && state.treasury >= 150 + 100) {
									state.treasury -= 150;
									const rivalBurgs = updatedBurgs.filter(
										(b: any) =>
											(currentState.cellStates
												? currentState.cellStates[b.cell]
												: 0) === targetRivalState.id,
									);
									if (rivalBurgs.length > 0) {
										for (const rb of rivalBurgs) {
											rb.security = Math.max(0, (rb.security || 100) - 15);
										}
										const rbBurg =
											rivalBurgs[Math.floor(Math.random() * rivalBurgs.length)];
										const existingRebel = fringeGroups.find(
											(g: any) =>
												g.originBurgId === rbBurg.id && g.type === "Rebels",
										);
										if (existingRebel) {
											existingRebel.size += 60;
										} else {
											const nextId =
												Math.max(1, ...fringeGroups.map((g: any) => g.id)) + 1;
											fringeGroups.push({
												id: nextId,
												type: "Rebels",
												originBurgId: rbBurg.id,
												originBurgName: rbBurg.name,
												size: 60,
												name: `${rbBurg.name} Liberty Front`,
												description: `Dissident faction covertly funded and equipped by spy networks from ${state.name}.`,
												habitat: "land",
												hideoutDiscovered: false,
												hideoutType: "Underground Syndicate",
											});
										}

										if (calendar.activeModifiers) {
											if (!calendar.activeModifiers.notifications) {
												calendar.activeModifiers.notifications = [];
											}
											calendar.activeModifiers.notifications.push(
												`🕵️ Covert Operation! Spies of ${state.name} smuggled weapons to rebels in ${targetRivalState.name}, forming the ${rbBurg.name} Liberty Front (Cost: 150 gold).`,
											);
										}
									}
								} else if (
									chosenOp === "sabotage_production" &&
									state.treasury >= 120 + 100
								) {
									state.treasury -= 120;
									for (const m of updatedMarkets) {
										const targetBurg = updatedBurgs.find(
											(b: any) => b.id === m.burgId,
										);
										if (
											targetBurg &&
											(currentState.cellStates
												? currentState.cellStates[targetBurg.cell]
												: 0) === targetRivalState.id
										) {
											const updatedSupply = { ...m.supply };
											for (const key of Object.keys(updatedSupply)) {
												updatedSupply[key] = Math.max(
													0,
													Math.floor((updatedSupply[key] || 0) * 0.5),
												);
											}
											m.supply = updatedSupply;
										}
									}

									if (calendar.activeModifiers) {
										if (!calendar.activeModifiers.notifications) {
											calendar.activeModifiers.notifications = [];
										}
										calendar.activeModifiers.notifications.push(
											`🔥 Covert Sabotage! Infiltrators from ${state.name} burned grain stocks in ${targetRivalState.name}, cutting local food supply in half (Cost: 120 gold).`,
										);
									}
								} else if (
									chosenOp === "incite_unrest" &&
									state.treasury >= 100 + 100
								) {
									state.treasury -= 100;
									const rivalBurgs = updatedBurgs.filter(
										(b: any) =>
											(currentState.cellStates
												? currentState.cellStates[b.cell]
												: 0) === targetRivalState.id,
									);
									for (const rb of rivalBurgs) {
										rb.happiness = Math.max(
											0,
											(rb.happiness !== undefined ? rb.happiness : 75) - 15,
										);
										rb.security = Math.max(0, (rb.security || 100) - 10);
									}

									if (calendar.activeModifiers) {
										if (!calendar.activeModifiers.notifications) {
											calendar.activeModifiers.notifications = [];
										}
										calendar.activeModifiers.notifications.push(
											`📣 Covert Unrest! Operatives from ${state.name} incited massive civilian riots inside the borders of ${targetRivalState.name} (Cost: 100 gold).`,
										);
									}
								}
							}
						}
					}

					// 8. Geopolitical Border Expansionism feedback
					const isStarving =
						state.population === 0 ||
						updatedBurgs.some((b: any) => {
							const stateId = currentState.cellStates
								? currentState.cellStates[b.cell]
								: 0;
							return stateId === state.id && b.growthRate < 0;
						});

					if (isStarving || state.treasury <= 0) {
						// Halts border expansion completely if population is declining or bankrupt!
						state.expansionism = 0;
					} else {
						state.expansionism = 1.0;
					}

					// 9. Sovereign Governance: Autonomous Infrastructure Investments
					if (state.treasury > 500 && Math.random() < 0.05) {
						// Spend 200g on infrastructure
						state.treasury -= 200;
						const stateBurgs = updatedBurgs.filter(
							(b: any) =>
								(currentState.cellStates
									? currentState.cellStates[b.cell]
									: 0) === state.id,
						);
						if (stateBurgs.length > 0) {
							// Boost security, health and happiness of all of their cities!
							for (const b of stateBurgs) {
								b.security = Math.min(100, (b.security || 100) + 12);
								b.health = Math.min(100, (b.health || 85) + 10);
								b.happiness = Math.min(100, (b.happiness || 75) + 8);
							}

							if (calendar.activeModifiers) {
								if (!calendar.activeModifiers.notifications) {
									calendar.activeModifiers.notifications = [];
								}
								calendar.activeModifiers.notifications.push(
									`🏛️ Sovereign Investment! Monarchs of ${state.name} invested 200 gold in public infrastructure, raising security, health, and happiness across all domestic cities.`,
								);
							}
						}
					}
				}

				// Apply active Ley-Magic costs and effects saps daily
				if (magicTypes.length > 0 && magePopulation) {
					applyMagicDailyCostsAndEffects(
						magicTypes,
						magePopulation,
						currentState.cellStates,
						updatedStates,
						updatedBurgs,
						updatedMarkets,
						plants,
						magicFlux,
					);
				}
			}

			// Generate and sync updated fringe groups
			fringeGroups = generateFringeGroups(
				updatedBurgs,
				updatedMarkets,
				magicFlux || new Float32Array(pointsN),
				currentState.heights,
				fringeGroups,
			);
		}

		// Advanced Dynamic Religion Simulation
		let religions: any[] = currentState.religions ? currentState.religions.map((r: any) => ({ ...r })) : [];
		let cellReligions = currentState.cellReligions ? new Uint8Array(currentState.cellReligions) : new Uint8Array(pointsN);
		
		if (religions.length > 0 && currentState.grid && currentState.heights && pointsN > 0) {
			const grid = currentState.grid;
			// Maintain a cell-level religion influence mapping
			const cellInfluences = Array.from({ length: pointsN }, () => new Float32Array(religions.length + 1)); // religions.length + 1 for Folk Beliefs at index 0

			// Initialize base influence: Folk Beliefs (index 0) has base influence 15
			for (let i = 0; i < pointsN; i++) {
				cellInfluences[i][0] = 15.0;
			}

			// Active religions base influence
			religions.forEach((r: any, rIdx: number) => {
				const religionSlot = rIdx + 1;
				// If religion has center, set high influence there
				if (r.center !== undefined && r.center < pointsN) {
					cellInfluences[r.center][religionSlot] = 100.0;
				}
				// Also seed from currently painted cellReligions
				for (let i = 0; i < pointsN; i++) {
					if (cellReligions[i] === r.id) {
						cellInfluences[i][religionSlot] = Math.max(cellInfluences[i][religionSlot], 40.0);
					}
				}
			});

			// Spread simulation across neighboring cells (1 iteration of adjacency flow)
			const tempInfluences = cellInfluences.map(arr => new Float32Array(arr));
			for (let i = 0; i < pointsN; i++) {
				const neighbors = grid.cells.c[i] || [];
				for (const n of neighbors) {
					for (let rIdx = 0; rIdx <= religions.length; rIdx++) {
						cellInfluences[i][rIdx] += tempInfluences[n][rIdx] * 0.12;
					}
				}
			}

			// Apply Multipliers based on "influenceFactor"
			for (let i = 0; i < pointsN; i++) {
				const burg = updatedBurgs.find((b: any) => b.cell === i);
				const cellSecurity = burg && burg.security !== undefined ? burg.security : 85;
				const cellHappiness = burg && burg.happiness !== undefined ? burg.happiness : 75;
				const cellUnrest = 100 - cellSecurity;
				const cellMagic = magicFlux ? magicFlux[i] : 0;
				
				religions.forEach((r: any, rIdx: number) => {
					const religionSlot = rIdx + 1;
					let multiplier = 1.0;
					
					if (r.influenceFactor === "happiness") {
						multiplier *= (cellHappiness / 50.0);
					} else if (r.influenceFactor === "unrest") {
						multiplier *= (cellUnrest / 30.0);
					} else if (r.influenceFactor === "magic") {
						multiplier *= (1.0 + cellMagic / 25.0);
					} else if (r.influenceFactor === "wealth") {
						const cellStateId = currentState.cellStates ? currentState.cellStates[i] : 0;
						const sovereignState = updatedStates.find((s: any) => s.id === cellStateId);
						const stateTreasury = sovereignState ? sovereignState.treasury : 0;
						if (stateTreasury > 500) {
							multiplier *= Math.min(3.0, 1.0 + (stateTreasury - 500) / 1000.0);
						}
					} else if (r.influenceFactor === "population") {
						if (burg) {
							multiplier *= Math.max(1.0, burg.population / 400.0);
						}
					}

					cellInfluences[i][religionSlot] *= multiplier;
				});
			}

			// CULTS VS NON-CULTS CONFLICT SIMULATION
			for (let i = 0; i < pointsN; i++) {
				religions.forEach((r1: any, idx1: number) => {
					const slot1 = idx1 + 1;
					const isCult1 = !!r1.isCult;
					const inf1 = cellInfluences[i][slot1];
					if (inf1 <= 0.01) return;

					religions.forEach((r2: any, idx2: number) => {
						const slot2 = idx2 + 1;
						const isCult2 = !!r2.isCult;
						const inf2 = cellInfluences[i][slot2];
						if (inf2 <= 0.01 || idx1 === idx2) return;

						if (isCult1 !== isCult2) {
							if (inf1 > inf2) {
								cellInfluences[i][slot2] = Math.max(0, inf2 - (inf1 - inf2) * 0.15);
							} else if (inf2 > inf1) {
								cellInfluences[i][slot1] = Math.max(0, inf1 - (inf2 - inf1) * 0.15);
							}
						}
					});
				});
			}

			// Assign follower ratios and apply Divine Blessings & Cult Unrest effects
			for (let i = 0; i < pointsN; i++) {
				const sumInfluence = religions.reduce((acc, r, rIdx) => acc + cellInfluences[i][rIdx + 1], cellInfluences[i][0]);
				
				if (sumInfluence > 0) {
					let dominantSlot = 0; // default to Folk Beliefs
					let maxInf = cellInfluences[i][0];
					
					religions.forEach((r, rIdx) => {
						const slot = rIdx + 1;
						if (cellInfluences[i][slot] > maxInf) {
							maxInf = cellInfluences[i][slot];
							dominantSlot = slot;
						}
					});

					cellReligions[i] = dominantSlot === 0 ? 0 : religions[dominantSlot - 1].id;

					const burg = updatedBurgs.find((b: any) => b.cell === i);
					
					religions.forEach((r, rIdx) => {
						const slot = rIdx + 1;
						const ratio = cellInfluences[i][slot] / sumInfluence;
						if (ratio <= 0.05) return;

						// 1. Cult status effect: increase crime and unrest
						if (r.isCult && burg) {
							burg.security = Math.max(10, (burg.security || 85) - ratio * 1.5);
							burg.happiness = Math.max(10, (burg.happiness || 75) - ratio * 1.0);
						}

						// 2. Divine Blessing effect variable
						if (r.effectVariable === "wealth") {
							const cellStateId = currentState.cellStates ? currentState.cellStates[i] : 0;
							const sovereignState = updatedStates.find((s: any) => s.id === cellStateId);
							if (sovereignState) {
								sovereignState.treasury += Math.round(ratio * 2.5);
							}
						} else if (r.effectVariable === "happiness" && burg) {
							burg.happiness = Math.min(100, (burg.happiness || 75) + ratio * 1.0);
						} else if (r.effectVariable === "populationGrowth" && burg) {
							burg.population += Math.round(ratio * 1.2);
						} else if (r.effectVariable === "security" && burg) {
							burg.security = Math.min(100, (burg.security || 85) + ratio * 1.2);
						}
					});
				} else {
					cellReligions[i] = 0;
				}
			}
		}

		if (!currentState.grid || !currentState.heights || !currentState.rivers) {
			store.updateState({
				tick: calendar.tick,
				calendar,
				burgs: updatedBurgs,
				states: updatedStates,
				markets: updatedMarkets,
				fringeGroups,
				religions,
				cellReligions,
				plants,
				herbivores,
				predators,
				farmingCells,
				loggingCells,
				magicNodes,
				magicFlux,
				magePopulation,
				oceanCurrents,
				oceanNutrients,
				upwellingFlux,
			} as any);
			return;
		}

		// Re-run climate once at the end
		const { temp, prec } = generateClimate(
			currentState.grid,
			currentState.heights,
			currentState.width,
			currentState.height,
			this.climateOptions,
		);

		// Apply Magic Geopolitical Vectors to update states treasury and military
		if (
			updatedStates.length > 0 &&
			magicFlux &&
			magePopulation &&
			magicTypes.length > 0 &&
			currentState.cellStates
		) {
			applyMagicGeopoliticalVectors(
				updatedStates,
				updatedBurgs,
				currentState.cellStates,
				magicFlux,
				magePopulation,
				magicTypes,
			);
		}

		// Re-run border expansion with updated states expansionism
		const cellCultures =
			currentState.cellCultures || new Uint8Array(currentState.heights.length);
		const { cellStates } = generateStates(
			currentState.grid,
			currentState.heights,
			cellCultures,
			updatedBurgs,
			updatedStates.length,
			biomes,
			currentState.rivers,
			currentState.flux,
			undefined,
			currentState.cultures,
			updatedStates,
		);

		const lodUpdates = this.simulateNestedLOD(currentState, ticks, calendar);

		// Project micro-ecology changes back to parent state if zoomed in
		let parentStates = currentState.parentStates || [];
		if (parentStates.length > 0 && currentState.zoomTier !== "global" && currentState.focusBounds) {
			const bounds = currentState.focusBounds;
			const parentIndex = parentStates.length - 1;
			const parent = { ...parentStates[parentIndex] };
			const parentGrid = parent.grid;
			if (parentGrid) {
				const parentPoints = parentGrid.points;
				const parentN = parentPoints.length;
				
				const binXCount = 50;
				const binYCount = 50;
				const binW = currentState.width / binXCount;
				const binH = currentState.height / binYCount;
				const bins: number[][] = Array.from({ length: binXCount * binYCount }, () => []);
				
				for (let i = 0; i < parentN; i++) {
					const [px, py] = parentPoints[i];
					const bx = Math.min(binXCount - 1, Math.max(0, Math.floor(px / binW)));
					const by = Math.min(binYCount - 1, Math.max(0, Math.floor(py / binH)));
					bins[by * binXCount + bx].push(i);
				}
				
				const findNearestParentCell = (px: number, py: number): number => {
					let nearestId = 0;
					let minDist = Infinity;
					const centerBx = Math.min(binXCount - 1, Math.max(0, Math.floor(px / binW)));
					const centerBy = Math.min(binYCount - 1, Math.max(0, Math.floor(py / binH)));
					for (let dy = -1; dy <= 1; dy++) {
						const by = centerBy + dy;
						if (by < 0 || by >= binYCount) continue;
						for (let dx = -1; dx <= 1; dx++) {
							const bx = centerBx + dx;
							if (bx < 0 || bx >= binXCount) continue;
							const binIndices = bins[by * binXCount + bx];
							for (const idx of binIndices) {
								const [x2, y2] = parentPoints[idx];
								const dx2 = px - x2;
								const dy2 = py - y2;
								const dist = dx2 * dx2 + dy2 * dy2;
								if (dist < minDist) {
									minDist = dist;
									nearestId = idx;
								}
							}
						}
					}
					if (minDist === Infinity) {
						for (let i = 0; i < parentN; i++) {
							const [x2, y2] = parentPoints[i];
							const dx2 = px - x2;
							const dy2 = py - y2;
							const dist = dx2 * dx2 + dy2 * dy2;
							if (dist < minDist) {
								minDist = dist;
								nearestId = i;
							}
						}
					}
					return nearestId;
				};
				
				const parentPlants = parent.plants ? new Float32Array(parent.plants) : new Float32Array(parentN).fill(10);
				const parentHerbivores = parent.herbivores ? new Float32Array(parent.herbivores) : new Float32Array(parentN).fill(5);
				const parentPredators = parent.predators ? new Float32Array(parent.predators) : new Float32Array(parentN).fill(1);
				
				const parentCounts = new Uint32Array(parentN);
				const parentPlantSums = new Float32Array(parentN);
				const parentHerbSums = new Float32Array(parentN);
				const parentPredSums = new Float32Array(parentN);
				
				const subN = pointsN;
				const subPoints = currentState.grid.points;
				
				for (let i = 0; i < subN; i++) {
					const [x, y] = subPoints[i];
					const px = bounds.minX + (x / currentState.width) * (bounds.maxX - bounds.minX);
					const py = bounds.minY + (y / currentState.height) * (bounds.maxY - bounds.minY);
					const pId = findNearestParentCell(px, py);
					
					parentCounts[pId]++;
					parentPlantSums[pId] += plants[i];
					parentHerbSums[pId] += herbivores[i];
					parentPredSums[pId] += predators[i];
				}
				
				for (let i = 0; i < parentN; i++) {
					if (parentCounts[i] > 0) {
						parentPlants[i] = parentPlantSums[i] / parentCounts[i];
						parentHerbivores[i] = parentHerbSums[i] / parentCounts[i];
						parentPredators[i] = parentPredSums[i] / parentCounts[i];
					} else {
						// Macro step for background cells outside the active zoom region bounds
						const px = parentPoints[i][0];
						const py = parentPoints[i][1];
						const isOutside = px < bounds.minX || px > bounds.maxX || py < bounds.minY || py > bounds.maxY;
						if (isOutside) {
							const pVal = parentPlants[i];
							const hVal = parentHerbivores[i];
							const cVal = parentPredators[i];
							const K = parent.heights ? (parent.heights[i] < 20 ? 100.0 : 800.0) : 400.0;
							const plantGrowth = 0.1 * pVal * (1 - pVal / Math.max(1, K));
							parentPlants[i] = Math.max(0, pVal + plantGrowth);
							parentHerbivores[i] = Math.max(0, hVal * 0.99 + hVal * (parentPlants[i] > 50 ? 0.01 : -0.02));
							parentPredators[i] = Math.max(0, cVal * 0.98 + cVal * (parentHerbivores[i] > 10 ? 0.01 : -0.03));
						}
					}
				}
				
				parent.plants = parentPlants;
				parent.herbivores = parentHerbivores;
				parent.predators = parentPredators;
				
				parentStates = [...parentStates];
				parentStates[parentIndex] = parent;
			}
		}

		// ─── TRADE CARAVAN ADVANCEMENT ──────────────────────────────────────
		const caravans = currentState.tradeCaravans || [];
		const routes = currentState.routes || [];
		const updatedCaravans = caravans.map((caravan: any) => {
			const newProgress = Math.min(1.0, caravan.progress + caravan.speed * ticks);
			// If arrived, log delivery and reset to start
			if (newProgress >= 1.0) {
				const goodName = GOODS[caravan.goodId]?.name || "Goods";
				let multiplier = 1;
				const route = routes.find((r: any) => r.id === caravan.routeId);
				let routeTypeStr = "route";
				
				if (route) {
					if (route.type === "trail") multiplier = 1;
					else if (route.type === "road") multiplier = 2;
					else if (route.type === "sea") multiplier = 3;
					else if (route.type === "airship") multiplier = 5;
					routeTypeStr = route.type;
				}
				
				const valueGenerated = Math.floor(10 * multiplier * Math.random());
				const receivingState = updatedStates.find((s: any) => s.id === caravan.stateId);
				if (receivingState) {
					receivingState.treasury += valueGenerated;
				}

				if (lodUpdates.globalLogs) {
					const timeStr = `Day ${calendar.day + 1}, Year ${calendar.year + 1}`;
					lodUpdates.globalLogs.unshift({ time: timeStr, msg: `Caravan delivered ${goodName} cargo via ${routeTypeStr} (+${valueGenerated} 🪙 to ${receivingState ? receivingState.name : 'Unknown'}).`, type: "caravan" });
					if (lodUpdates.globalLogs.length > 30) lodUpdates.globalLogs.pop();
				}
				return { ...caravan, progress: 0 };
			}
			return { ...caravan, progress: newProgress };
		});

		store.updateState({
			tick: calendar.tick,
			calendar,
			temp,
			prec,
			biomes,
			burgs: updatedBurgs,
			states: updatedStates,
			markets: updatedMarkets,
			fringeGroups,
			religions,
			cellReligions,
			cellStates,
			plants,
			herbivores,
			predators,
			farmingCells,
			loggingCells,
			magicNodes,
			magicFlux,
			magePopulation,
			oceanCurrents,
			oceanNutrients,
			upwellingFlux,
			regions: lodUpdates.regions,
			globalLogs: lodUpdates.globalLogs,
			regionalLogs: lodUpdates.regionalLogs,
			localLogs: lodUpdates.localLogs,
			parentStates,
			tradeCaravans: updatedCaravans,
		} as any);

	}

	private simulateNestedLOD(
		currentState: any,
		ticks: number,
		calendar: any,
	): any {
		const regions = currentState.regions
			? JSON.parse(JSON.stringify(currentState.regions))
			: null;
		const globalLogs = [...(currentState.globalLogs || [])];
		const regionalLogs = { ...(currentState.regionalLogs || {}) };
		const localLogs = { ...(currentState.localLogs || {}) };

		if (!regions) {
			return { regions, globalLogs, regionalLogs, localLogs };
		}

		const zoom = currentState.zoom || 1.0;
		let lod: "global" | "regional" | "local" = "global";
		if (zoom >= 8.0) {
			lod = "local";
		} else if (zoom >= 3.0) {
			lod = "regional";
		}

		const curMonth =
			currentState.months?.[calendar.month]?.name ||
			`Month ${calendar.month + 1}`;
		const timeStr = `Day ${calendar.day + 1} ${curMonth}, Year ${calendar.year + 1}`;

		const addLog = (list: any[], msg: string, type: string) => {
			list.unshift({ time: timeStr, msg, type });
			if (list.length > 30) list.pop();
		};

		if (lod === "global") {
			// 1. Simulate Global level
			if (Math.random() < 0.2) {
				const globalEvents = [
					"Grand Alliance tournament announced in the central valley.",
					"Stargazers report a luminous astral alignment in the southern skies.",
					"Bards sing of ancient elven relics unearthed in remote forests.",
					"Continental trade agreements drafted across regional capitals.",
					"A massive migration of wild geese signals seasonal shifts.",
				];
				const ev =
					globalEvents[Math.floor(Math.random() * globalEvents.length)];
				addLog(globalLogs, `🌍 [Global Event] ${ev}`, "info");
			}
		} else if (lod === "regional") {
			// 2. Simulate active Regional level
			const activeRegId = currentState.activeRegionId ?? 0;
			const r = regions.find((x: any) => x.id === activeRegId);
			if (r) {
				if (!regionalLogs[activeRegId]) regionalLogs[activeRegId] = [];

				// Simulate Units
				for (const u of r.units) {
					u.x += u.speedX * (ticks / 24) * 1.5;
					u.y += u.speedY * (ticks / 24) * 1.5;

					const dx = u.x - r.centerX;
					const dy = u.y - r.centerY;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist > r.radius) {
						u.speedX = -u.speedX;
						u.speedY = -u.speedY;
						u.x = r.centerX + (dx / dist) * (r.radius - 5);
						u.y = r.centerY + (dy / dist) * (r.radius - 5);
					}
				}

				// Trigger Regional Events
				if (Math.random() < 0.3) {
					const regionalEvents = [
						"Provincial patrols reinforce the borders against hostile incursions.",
						"A trading caravan sets off, laden with spices and fine silks.",
						"Local spellcasters witness an aura of high mana near the ley-lines.",
						"A celebratory folk festival unites neighboring settlements.",
						"Heavy seasonal downpours muddy regional trails, slowing transit.",
					];
					const ev =
						regionalEvents[Math.floor(Math.random() * regionalEvents.length)];
					addLog(regionalLogs[activeRegId], `🏰 [${r.name}] ${ev}`, "info");

					// Bubble up to Global
					addLog(globalLogs, `🏰 [Region: ${r.name}] ${ev}`, "info");
				}
			}
		} else if (lod === "local") {
			// 3. Simulate active Local level
			const activeRegId = currentState.activeRegionId ?? 0;
			const activeLocId = currentState.activeLocalId ?? 0;
			const r = regions.find((x: any) => x.id === activeRegId);
			if (r) {
				const lz = r.localZones.find((x: any) => x.id === activeLocId);
				if (lz) {
					const localKey = `${activeRegId}-${activeLocId}`;
					if (!localLogs[localKey]) localLogs[localKey] = [];
					if (!regionalLogs[activeRegId]) regionalLogs[activeRegId] = [];

					// Simulate local units
					for (const u of lz.units) {
						u.x += u.speedX * (ticks / 24) * 0.8;
						u.y += u.speedY * (ticks / 24) * 0.8;

						const dx = u.x - lz.centerX;
						const dy = u.y - lz.centerY;
						const dist = Math.sqrt(dx * dx + dy * dy);
						if (dist > lz.radius) {
							u.speedX = -u.speedX;
							u.speedY = -u.speedY;
							u.x = lz.centerX + (dx / dist) * (lz.radius - 2);
							u.y = lz.centerY + (dy / dist) * (lz.radius - 2);
						}
					}

					// Trigger Local events
					if (Math.random() < 0.35) {
						const localEvents = [
							"Ranger scouts report sighting wolf tracks in the nearby woods.",
							"Local farm hands rejoice at another bumper wheat crop harvest.",
							"A wandering minstrel drops by, singing tales of the high kings.",
							"A wild beast wanders close to town borders before retreating.",
							"Town guards practice standard maneuvers at the regional outpost.",
						];
						const ev =
							localEvents[Math.floor(Math.random() * localEvents.length)];
						addLog(localLogs[localKey], `🏡 [${lz.name}] ${ev}`, "info");

						// Bubble up to Regional
						addLog(
							regionalLogs[activeRegId],
							`🏡 [Zone: ${lz.name}] Minor activity: ${ev}`,
							"info",
						);
					}
				}
			}
		}

		return { regions, globalLogs, regionalLogs, localLogs };
	}

	public getCalendar() {
		const currentState = store.getState();
		if (!this.tickSystem) {
			const cycles = {
				ticksPerDay: 24,
				weekdays: currentState.weekdays || [],
				months: currentState.months || [],
				seasons: currentState.seasons || [],
				moons: currentState.moons || [],
			};
			this.tickSystem = new TickSystem(
				cycles,
				currentState.calendar || undefined,
			);
		}
		return this.tickSystem.getState();
	}
}
