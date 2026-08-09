import { Grid, Pack } from "../core/types";
import { CalendarState } from "../simulation/time/tick-system";

export interface CustomMonth {
  name: string;
  weekCount: number;
}

export interface CustomSeason {
  name: string;
  startMonth: number; // 0-indexed
  endMonth: number;   // 0-indexed
  tempMod: number;    // e.g. -10 for cold, +10 for hot
  precMod: number;    // e.g. 0.5 for dry, 1.5 for wet
  popMod: number;     // population growth modifier e.g. 0.9, 1.1
  prodMod: number;    // production modifier e.g. 0.8, 1.2
}

export interface CustomMoonPhase {
  name: string;
  ratio: number;     // relative duration weight of this phase
  modifier: number;  // modifier assigned to this phase
}

export interface CustomMoon {
  name: string;
  cycleLength: number; // in days
  customPhases: CustomMoonPhase[];
}

export interface AppState {
  width: number;
  height: number;
  seed: string;
  cellsDesired: number;
  tick: number;
  calendar: CalendarState | null;
  grid: Grid | null;
  heights: Uint8Array | null;
  temp: Float32Array | null;
  prec: Uint8Array | null;
  flowDirections: Int32Array | null;
  flux: Float32Array | null;
  rivers: Uint16Array | null;
  biomes: Uint8Array | null;

  // Custom Calendar settings
  weekdays: string[];
  months: CustomMonth[];
  seasons: CustomSeason[];
  moons: CustomMoon[];

  // Ecology & Stressors
  plants: Float32Array | null;
  herbivores: Float32Array | null;
  predators: Float32Array | null;
  farmingCells: Uint8Array | null;
  loggingCells: Uint8Array | null;

  // Magic System
  magicTypes: MagicTypeConfig[];
  magicNodes: number[] | null;
  magicFlux: Float32Array | null;
  magePopulation: Uint32Array | null;

  // Marine Physical Simulation
  oceanCurrents: Float32Array | null;  // packed x,y wind-driven current vectors
  oceanNutrients: Float32Array | null; // nutrient level mapping
  upwellingFlux: Float32Array | null;  // reverse-flux ocean current upwelling
}

export interface MagicVectorWeights {
  production: number;   // production modifier
  military: number;     // military modifier
  ecology: number;      // ecology (plant growth) modifier
  growth: number;       // population growth modifier
  taxation: number;     // taxation modifier
}

export interface MagicTypeConfig {
  name: string;
  wieldability: "innate" | "learned" | "divine";
  rarity: number;       // base chance of mages
  cost: number;         // mana cost
  volatility: {
    accidents: number; // probability of local accidents
    crime: number;
    instability: number;
  };
  weights: MagicVectorWeights;
}

type StateListener = (state: AppState) => void;

class StateStore {
  private state: AppState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = {
      width: 1000,
      height: 600,
      seed: "rebuild-seed",
      cellsDesired: 10000,
      tick: 0,
      calendar: null,
      grid: null,
      heights: null,
      temp: null,
      prec: null,
      flowDirections: null,
      flux: null,
      rivers: null,
      biomes: null,

      plants: null,
      herbivores: null,
      predators: null,
      farmingCells: null,
      loggingCells: null,

      magicNodes: null,
      magicFlux: null,
      magePopulation: null,

      oceanCurrents: null,
      oceanNutrients: null,
      upwellingFlux: null,

      magicTypes: [
        {
          name: "Pyromancy",
          wieldability: "innate",
          rarity: 0.005,
          cost: 25,
          volatility: { accidents: 0.3, crime: 0.05, instability: 0.1 },
          weights: { production: 1.25, military: 1.35, ecology: 0.7, growth: 0.95, taxation: 1.05 }
        },
        {
          name: "Restoration",
          wieldability: "learned",
          rarity: 0.02,
          cost: 15,
          volatility: { accidents: 0.02, crime: 0.01, instability: 0.01 },
          weights: { production: 1.05, military: 0.9, ecology: 1.3, growth: 1.25, taxation: 1.0 }
        },
        {
          name: "Divination",
          wieldability: "divine",
          rarity: 0.01,
          cost: 20,
          volatility: { accidents: 0.05, crime: 0.15, instability: 0.05 },
          weights: { production: 1.15, military: 1.0, ecology: 1.0, growth: 1.05, taxation: 1.25 }
        }
      ],

      // Defaults
      weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      months: [
        { name: "January", weekCount: 4 },
        { name: "February", weekCount: 4 },
        { name: "March", weekCount: 4 },
        { name: "April", weekCount: 4 },
        { name: "May", weekCount: 4 },
        { name: "June", weekCount: 4 },
        { name: "July", weekCount: 4 },
        { name: "August", weekCount: 4 },
        { name: "September", weekCount: 4 },
        { name: "October", weekCount: 4 },
        { name: "November", weekCount: 4 },
        { name: "December", weekCount: 4 }
      ],
      seasons: [
        { name: "Winter", startMonth: 11, endMonth: 1, tempMod: -15, precMod: 0.8, popMod: 0.85, prodMod: 0.9 },
        { name: "Spring", startMonth: 2, endMonth: 4, tempMod: 5, precMod: 1.2, popMod: 1.1, prodMod: 1.0 },
        { name: "Summer", startMonth: 5, endMonth: 7, tempMod: 15, precMod: 0.9, popMod: 1.15, prodMod: 1.15 },
        { name: "Autumn", startMonth: 8, endMonth: 10, tempMod: -5, precMod: 1.1, popMod: 1.0, prodMod: 0.95 }
      ],
      moons: [
        {
          name: "Selene",
          cycleLength: 30, // 30 days
          customPhases: [
            { name: "New Moon", ratio: 1.0, modifier: 0.9 },
            { name: "Waxing", ratio: 1.0, modifier: 1.0 },
            { name: "Full Moon", ratio: 1.0, modifier: 1.2 },
            { name: "Waning", ratio: 1.0, modifier: 1.0 }
          ]
        }
      ]
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  updateState(updatedFields: Partial<AppState>) {
    this.state = {
      ...this.state,
      ...updatedFields
    };
    this.notify();
  }
}

export const store = new StateStore();
export default store;
