import { store } from "../../state/store";
import { TickSystem } from "./tick-system";
import { generateClimate, ClimateOptions } from "../climate/climate-generator";
import { generateBiomes } from "../biomes/biomes-generator";
import { generateStates } from "../civilization/state-generator";
import { runProductionCycles } from "../civilization/production-generator";
import { initializeEcology, simulateEcologyStep } from "../ecology/ecology-simulator";
import {
  generateMagicNodes,
  generateLeyLines,
  calculateMagicFlux,
  calculateMagePopulations,
  applyMagicGeopoliticalVectors,
  runMagicVolatilityChecks
} from "../magic/magic-system";
import {
  calculateOceanCurrents,
  calculateUpwellingFlux,
  calculateOceanNutrients
} from "../climate/marine-simulator";

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
      moons: currentState.moons || []
    };

    const prevCalendar = currentState.calendar;
    this.tickSystem = new TickSystem(cycles, prevCalendar || undefined);

    const calendar = this.tickSystem.advance(ticks);

    // Apply active climate modifiers to setup baseline
    if (calendar.activeModifiers) {
      this.climateOptions.temperatureEquator = (currentState.temp ? currentState.temp[0] : 20) + calendar.activeModifiers.tempMod;
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

    if (pointsN > 0 && currentState.grid && currentState.heights && currentState.biomes) {
      if (!magicNodes) {
        magicNodes = generateMagicNodes(currentState.grid, currentState.heights, currentState.biomes, 6);
        const leyLines = generateLeyLines(currentState.grid, magicNodes);
        magicFlux = calculateMagicFlux(currentState.grid, magicNodes, leyLines);
      }
      if (!magePopulation) {
        const safePops = currentState.grid.cells.prec 
          ? Float32Array.from(currentState.grid.cells.prec)
          : new Float32Array(pointsN).fill(100.0);
        magePopulation = calculateMagePopulations(magicFlux, safePops, magicTypes);
      }
    }

    // Initialize Marine Physical Simulation state if needed
    let oceanCurrents = currentState.oceanCurrents;
    let oceanNutrients = currentState.oceanNutrients;
    let upwellingFlux = currentState.upwellingFlux;

    if (pointsN > 0 && currentState.grid && currentState.heights) {
      if (!oceanCurrents) {
        oceanCurrents = calculateOceanCurrents(currentState.grid, currentState.heights);
      }
      if (!upwellingFlux) {
        upwellingFlux = calculateUpwellingFlux(currentState.grid, currentState.heights);
      }
      if (!oceanNutrients) {
        const flowDirs = currentState.flowDirections || new Int32Array(pointsN).fill(-1);
        const landFlux = currentState.flux || new Float32Array(pointsN).fill(1.0);
        oceanNutrients = calculateOceanNutrients(
          currentState.grid,
          currentState.heights,
          flowDirs,
          landFlux,
          upwellingFlux
        );
      }
    }

    // Fast Day-by-Day Geopolitical Logic Loop
    const daysPassed = Math.floor(ticks / 24);
    let updatedBurgs = currentState.burgs ? currentState.burgs.map((b: any) => ({ ...b })) : [];
    let updatedStates = currentState.states ? currentState.states.map((s: any) => ({ ...s })) : [];
    let updatedMarkets = currentState.markets ? currentState.markets.map((m: any) => ({ ...m, supply: Array.isArray(m.supply) ? [...m.supply] : { ...m.supply } })) : [];
    let biomes = currentState.biomes ? new Uint8Array(currentState.biomes) : new Uint8Array(pointsN).fill(3);

    if (daysPassed > 0 && updatedBurgs.length > 0 && updatedStates.length > 0) {
      const activeMods = calendar.activeModifiers || { tempMod: 0, precMod: 1.0, popMod: 1.0, prodMod: 1.0, diplomacyMod: 1.0 };
      
      const ecologyRates = {
        plantGrowthRate: 0.15,
        herbivoreGrazingRate: 0.001,
        herbivoreReproductionRate: 0.002,
        herbivoreDeathRate: 0.05,
        predatorHuntingRate: 0.005,
        predatorReproductionRate: 0.003,
        predatorDeathRate: 0.1
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
            const leverage = mageRatio * 5.0;
            ecoWeight += (config.weights.ecology - 1.0) * leverage;
          }
          magicEcologyWeights[i] = Math.max(0.1, ecoWeight);
        }
      }

      // Instantiate Hash Maps once outside the day loop to avoid hundreds of daily allocations
      const burgMap = new Map(updatedBurgs.map(b => [b.id, b]));
      const stateMap = new Map(updatedStates.map(s => [s.id, s]));

      // We run the daily loop
      for (let day = 0; day < daysPassed; day++) {
        // 1. Magic Volatility Checks
        if (magicFlux && magicTypes.length > 0) {
          const nextBiomes = runMagicVolatilityChecks(biomes, magicFlux, magicTypes);
          biomes = nextBiomes;
        }

        // 2. Coastal Nutrient Diffusion & Upwelling Run
        if (oceanNutrients && currentState.grid) {
          const flowDirs = currentState.flowDirections || new Int32Array(pointsN).fill(-1);
          const landFlux = currentState.flux || new Float32Array(pointsN).fill(1.0);
          oceanNutrients = calculateOceanNutrients(
            currentState.grid,
            currentState.heights,
            flowDirs,
            landFlux,
            upwellingFlux || new Float32Array(pointsN).fill(0)
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
            oceanNutrients
          );
          biomes = nextBiomes;
        }

        // 4. Crop/Food resource harvesting & collection (agricultural index 2 = Grain, 4 = Fruit)
        const grainId = 2;
        const fruitId = 4;
        const foodHarvest = Math.round(5 * activeMods.precMod * (activeMods.tempMod > -8 ? 1.2 : 0.2));

        for (const m of updatedMarkets) {
          const burg = burgMap.get(m.burgId);
          const localPlantDensity = (burg && plants) ? plants[burg.cell] : 100.0;
          const plantFactor = Math.max(0.1, localPlantDensity / 100.0);
          
          const finalHarvest = Math.round(foodHarvest * plantFactor);
          m.supply[grainId] = (m.supply[grainId] || 0) + finalHarvest;
          m.supply[fruitId] = (m.supply[fruitId] || 0) + Math.round(finalHarvest * 0.5);
        }

        // 5. Food Consumption, Manpower, and Demographics
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
            burg.population += Math.round(burg.population * 0.002 * activeMods.popMod);
            burg.growthRate = 0.02 * activeMods.popMod;
            // Consume foods proportionally
            const consumeGrain = Math.min(grainSupply, Math.round(foodRequired * 0.7));
            const consumeFruit = foodRequired - consumeGrain;
            m.supply[grainId] = Math.max(0, grainSupply - consumeGrain);
            m.supply[fruitId] = Math.max(0, fruitSupply - consumeFruit);
          }
        }

        // 6. State Treasury Accumulation & Military Payments
        // Zero state stats to accumulate daily totals
        for (const state of updatedStates) {
          state.population = 0;
        }

        for (const burg of updatedBurgs) {
          const stateId = currentState.cellStates ? currentState.cellStates[burg.cell] : 0;
          const stateObj = stateMap.get(stateId);
          if (stateObj) {
            stateObj.population += burg.population;
            // Collect taxes: population * 0.05 gold daily
            stateObj.treasury += Math.round(burg.population * 0.05);
          }
        }

        for (const state of updatedStates) {
          // Pay army upkeep: militaryPower * 0.2 upkeep daily
          const upkeep = Math.round(state.militaryPower * 0.2);
          state.treasury = Math.max(0, state.treasury - upkeep);

          // 7. Manpower recruitment & dynamic Military solvency
          if (state.treasury <= 0) {
            // Insolvency decay
            state.militaryPower = Math.max(0, state.militaryPower - 5);
          } else {
            // Treasury is healthy: recruit up to 5% of state population
            const targetMilitary = Math.round(state.population * 0.05);
            if (state.militaryPower < targetMilitary) {
              state.militaryPower = Math.min(targetMilitary, state.militaryPower + 2);
            }
          }

          // 8. Geopolitical Border Expansionism feedback
          const isStarving = state.population === 0 || updatedBurgs.some((b: any) => {
            const stateId = currentState.cellStates ? currentState.cellStates[b.cell] : 0;
            return stateId === state.id && b.growthRate < 0;
          });

          if (isStarving || state.treasury <= 0) {
            // Halts border expansion completely if population is declining or bankrupt!
            state.expansionism = 0;
          } else {
            state.expansionism = 1.0;
          }
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
        upwellingFlux
      } as any);
      return;
    }

    // Re-run climate once at the end
    const { temp, prec } = generateClimate(
      currentState.grid,
      currentState.heights,
      currentState.width,
      currentState.height,
      this.climateOptions
    );

    // Apply Magic Geopolitical Vectors to update states treasury and military
    if (updatedStates.length > 0 && magicFlux && magePopulation && magicTypes.length > 0 && currentState.cellStates) {
      applyMagicGeopoliticalVectors(
        updatedStates,
        updatedBurgs,
        currentState.cellStates,
        magicFlux,
        magePopulation,
        magicTypes
      );
    }

    // Re-run border expansion with updated states expansionism
    const cellCultures = currentState.cellCultures || new Uint8Array(currentState.heights.length);
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
      updatedStates
    );

    store.updateState({
      tick: calendar.tick,
      calendar,
      temp,
      prec,
      biomes,
      burgs: updatedBurgs,
      states: updatedStates,
      markets: updatedMarkets,
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
      upwellingFlux
    } as any);
  }

  public getCalendar() {
    const currentState = store.getState();
    if (!this.tickSystem) {
      const cycles = {
        ticksPerDay: 24,
        weekdays: currentState.weekdays || [],
        months: currentState.months || [],
        seasons: currentState.seasons || [],
        moons: currentState.moons || []
      };
      this.tickSystem = new TickSystem(cycles, currentState.calendar || undefined);
    }
    return this.tickSystem.getState();
  }
}
