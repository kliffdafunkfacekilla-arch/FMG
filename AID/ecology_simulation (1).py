"""
OSTRAKA TACTICAL ECOLOGY ENGINE - LOTKA-VOLTERRA TROPHIC SIMULATION (CALIBRATED)
=================================================================================
Models the 4-part ecological vector per cell:
  1. Plants (P)     - Primary Producers
  2. Prey (H)       - Herbivores / Primary Consumers
  3. Predators (C)  - Carnivores / Secondary Consumers
  4. Abiotic (R)    - Natural Resources (Water, Ores, Stone, Wood)

Features:
  - Calibrated Lotka-Volterra differential oscillation
  - Biome species taxonomy & carrying capacities
  - Human farm/mine overrides & concentric harvesting
  - Environmental perturbation response (Drought, Famine, Migration)
  - Chaos Flow surge & mutation triggers
"""

import json
import math
from typing import Dict, List, Any


class BiomeProfile:
    def __init__(self, name: str, plant_capacity: float, species_prey: str, species_predator: str, abiotic_yield: str):
        self.name = name
        self.plant_capacity = plant_capacity
        self.species_prey = species_prey
        self.species_predator = species_predator
        self.abiotic_yield = abiotic_yield


BIOME_CATALOG: Dict[str, BiomeProfile] = {
    "FOREST": BiomeProfile("Sylvan Canopy", 150.0, "Ash-Bison / Cloud-Ram", "Night-Carapace / Timber-Wolf", "Timber & Medicinal Herbs"),
    "GRASSLAND": BiomeProfile("Heartland Plains", 120.0, "Ash-Bison / Dune-Dogs", "Razor-Strider / Prairie-Raptor", "Fertile Soil & Fresh Water"),
    "DESERT": BiomeProfile("Shatter-Sands", 40.0, "Dust-Skipper / Dune-Dogs", "Glass-Scale Sand-Eel", "Salt, Glass-Sand & Quartz"),
    "VOLCANIC": BiomeProfile("Caldera Crags", 30.0, "Furnace-Tick", "Furnace-Drake / Quake-Stalker", "Iron Ore, Tungsten & Obsidian"),
    "SWAMP": BiomeProfile("Sump-Bogs", 100.0, "Toad-Kin Fauna", "Titan-Boa / Mire-Stalker", "Alchemical Sludge & Drugs")
}


class CellEcologyState:
    def __init__(self, cell_id: int, biome_key: str = "FOREST"):
        self.cell_id = cell_id
        self.biome = BIOME_CATALOG.get(biome_key, BIOME_CATALOG["FOREST"])
        
        # 4 Ecological Vectors
        self.plants = self.biome.plant_capacity * 0.75  # e.g. 112.5 for Forest
        self.prey = 40.0
        self.predators = 12.0
        self.resources = 100.0
        
        # Human Infrastructure Overrides
        self.has_farm = False
        self.has_mine = False
        self.harvest_rate_plants = 0.0
        self.harvest_rate_prey = 0.0
        
        # Status Tracking
        self.anomaly_status = "STABLE"
        self.history_log: List[str] = []

    def update_trophic_tick(self, season_tick: int, temp_c: float, rainfall_factor: float, chaos_intensity: float = 0.0):
        """
        Executes one monthly trophic update using calibrated Lotka-Volterra equations.
        """
        kp = self.biome.plant_capacity + (30.0 if self.has_farm else 0.0)
        
        # Coefficients
        alpha = 0.25 * (rainfall_factor / 1.0)  # Plant growth rate scaled by rainfall
        beta = 0.0025                           # Grazing coefficient (consumption of plants per herbivore)
        epsilon_h = 0.50                        # Herbivore conversion efficiency
        delta = 0.005                           # Predation coefficient (hunting of prey per predator)
        epsilon_c = 0.40                        # Predator conversion efficiency
        gamma_h = 0.04                          # Herbivore natural death rate
        gamma_c = 0.08                          # Predator natural death/starvation rate
        
        # 1. Flora Calculation: Growth - Grazing - Human Harvest
        plant_regen = alpha * self.plants * (1.0 - (self.plants / kp)) if self.plants > 0.5 else 1.5
        plants_grazed = beta * self.plants * self.prey
        d_plants = plant_regen - plants_grazed - self.harvest_rate_plants
        
        # 2. Herbivore / Prey Calculation: Feeding conversion - Predation - Natural Mortality - Human Hunt
        prey_fed = epsilon_h * plants_grazed
        prey_hunted = delta * self.prey * self.predators
        d_prey = prey_fed - prey_hunted - (gamma_h * self.prey) - self.harvest_rate_prey
        
        # 3. Predator Calculation: Hunting conversion - Mortality + Chaos Mutations
        predators_fed = epsilon_c * prey_hunted
        d_preds = predators_fed - (gamma_c * self.predators)
        if chaos_intensity > 0.5:
            d_preds += (chaos_intensity * 1.8)  # Chaos-surge mutation spawn
        
        # Apply Deltas with floor safeguards
        self.plants = max(0.5, min(kp * 1.2, self.plants + d_plants))
        self.prey = max(0.5, min(150.0, self.prey + d_prey))
        self.predators = max(0.2, min(100.0, self.predators + d_preds))

        # Abiotic Resource Extraction
        if self.has_mine:
            self.resources = max(0.0, self.resources - 0.5)

        # Anomaly & Migration Checks
        self._evaluate_anomalies(chaos_intensity)

    def _evaluate_anomalies(self, chaos_intensity: float):
        if chaos_intensity > 0.7:
            self.anomaly_status = "CHAOS_MUTATED_FLORA_FAUNA"
            self.history_log.append("Chaos-surge mutated local wildlife into aggressive aberrations.")
        elif self.prey > 90.0 and self.predators < 6.0:
            self.anomaly_status = "BOOM_HERBIVORE_OVERABUNDANCE"
            self.history_log.append("Herbivore population exploded due to predator depletion!")
        elif self.plants < 15.0 and self.prey < 8.0:
            self.anomaly_status = "FAMINE_MIGRATION_TRIGGER"
            self.history_log.append("Ecology collapsed from drought/over-harvesting. Wildlife triggering migration event.")
        else:
            self.anomaly_status = "STABLE"

    def to_json_dict(self) -> Dict[str, Any]:
        return {
            "cell_id": self.cell_id,
            "biome": self.biome.name,
            "species_profile": {
                "prey": self.biome.species_prey,
                "predator": self.biome.species_predator,
                "abiotic": self.biome.abiotic_yield
            },
            "vectors": {
                "plants": round(self.plants, 2),
                "prey": round(self.prey, 2),
                "predators": round(self.predators, 2),
                "abiotic_resources": round(self.resources, 2)
            },
            "infrastructure": {
                "has_farm": self.has_farm,
                "has_mine": self.has_mine,
                "plant_harvest_rate": self.harvest_rate_plants,
                "prey_harvest_rate": self.harvest_rate_prey
            },
            "anomaly_status": self.anomaly_status,
            "recent_events": self.history_log[-3:] if self.history_log else ["Ecology functioning within normal parameters."]
        }


def run_ecology_test_suite():
    print("==========================================================================")
    print("🌿 OSTRAKA 4-PART TROPHIC ECOLOGY ENGINE TEST SIMULATION (CALIBRATED) 🌿")
    print("==========================================================================")
    
    # 1. Initialize Forest Cell
    forest_cell = CellEcologyState(cell_id=101, biome_key="FOREST")
    print(f"\nInitial Forest Cell State:")
    print(json.dumps(forest_cell.to_json_dict(), indent=2))
    
    # 2. Simulate 12 Seasons (Normal Baseline Cycle)
    print("\n--- Running 12 Seasons of Baseline Climate Ticks ---")
    for tick in range(1, 13):
        rain = 1.2 if (tick % 12) in [3, 4, 5, 6] else 0.9
        forest_cell.update_trophic_tick(season_tick=tick, temp_c=20.0, rainfall_factor=rain)
    
    print("Forest Cell State after 12 Seasons:")
    print(json.dumps(forest_cell.to_json_dict(), indent=2))
    
    # 3. Simulate Severe Drought Event (3 Seasons)
    print("\n--- Injecting Severe Drought Event (3 Seasons, Rainfall = 0.15) ---")
    for tick in range(13, 16):
        forest_cell.update_trophic_tick(season_tick=tick, temp_c=35.0, rainfall_factor=0.15)
    
    print("Forest Cell State after Severe Drought:")
    print(json.dumps(forest_cell.to_json_dict(), indent=2))
    
    # 4. Construct Farm Infrastructure & Recover
    print("\n--- Constructing Farm Infrastructure & Sustainable Harvesting ---")
    forest_cell.has_farm = True
    forest_cell.harvest_rate_plants = 3.0
    for tick in range(16, 24):
        forest_cell.update_trophic_tick(season_tick=tick, temp_c=22.0, rainfall_factor=1.0)
        
    print("Forest Cell State after Farm Establishment & 8 Recovery Ticks:")
    print(json.dumps(forest_cell.to_json_dict(), indent=2))

    # 5. Inject Chaos Flow Surge
    print("\n--- Injecting Chaos Flow Surge (Chaos Intensity = 0.85) ---")
    for tick in range(24, 27):
        forest_cell.update_trophic_tick(season_tick=tick, temp_c=22.0, rainfall_factor=1.0, chaos_intensity=0.85)

    print("Forest Cell State after Chaos Flow Surge:")
    print(json.dumps(forest_cell.to_json_dict(), indent=2))


if __name__ == "__main__":
    run_ecology_test_suite()
