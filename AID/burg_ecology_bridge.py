"""
OSTRAKA BURG EXPANSION & TROPHIC ECOLOGY BRIDGE MODULE
======================================================
Connects the Concentric Ring Burg Expansion System to the 4-Part Lotka-Volterra Ecology Engine.

Architecture:
  - Concentric Burg Rings (Ring 0: Citadel, Ring 1: High District, Ring 2: Common Urban, Ring 3: Industrial/Farms, Ring 4: Hinterlands)
  - Multi-Cell Ecology Grid (Center Cell + Surrounding Hinterland Cells)
  - Demand & Consumption Equations (Food, Water, Timber, Metals)
  - Feedback Loop:
      Population Demand -> Cell Harvest -> Ecological Trophic Ticks -> Yields/Deficits -> Burg Stability & Growth/Famine
"""

import sys
import os
import json
import math
from typing import Dict, List, Any

# Ensure artifacts directory is in path
sys.path.append('/workspace/artifacts')
sys.path.append('/workspace/scratch')

from ecology_simulation import CellEcologyState, BIOME_CATALOG


class BurgRing:
    def __init__(self, ring_id: int, name: str, min_pop_required: int, max_capacity: int):
        self.ring_id = ring_id
        self.name = name
        self.min_pop_required = min_pop_required
        self.max_capacity = max_capacity
        self.built = False
        self.structures: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ring_id": self.ring_id,
            "name": self.name,
            "built": self.built,
            "structures": self.structures,
            "capacity": self.max_capacity
        }


class ConcentricBurg:
    def __init__(self, burg_id: int, name: str, center_cell_id: int, starting_pop: int = 1200):
        self.burg_id = burg_id
        self.name = name
        self.center_cell_id = center_cell_id
        self.population = starting_pop
        self.stability = 85.0  # 0 to 100
        self.treasury = 500.0  # Aetherium Gold
        self.food_reserves = 100.0  # Reserve food units
        self.timber_reserves = 50.0
        self.metal_reserves = 20.0

        # Concentric Rings Layout
        self.rings: Dict[int, BurgRing] = {
            0: BurgRing(0, "Ring 0: High Citadel & Keep", 0, 500),
            1: BurgRing(1, "Ring 1: Inner Urban & Guilds", 500, 2000),
            2: BurgRing(2, "Ring 2: Common Urban & Markets", 2000, 5000),
            3: BurgRing(3, "Ring 3: Industrial Farmlands & Mills", 5000, 12000),
            4: BurgRing(4, "Ring 4: Outer Hinterland & Hunting Lodges", 12000, 30000)
        }
        self.update_ring_expansion()

    def update_ring_expansion(self):
        """Builds/unlocks concentric rings as population thresholds are met."""
        for ring_id, ring in self.rings.items():
            if self.population >= ring.min_pop_required and not ring.built:
                ring.built = True
                if ring_id == 0:
                    ring.structures = ["Citadel Keep", "Aetheric Beacon Tower", "Treasury Vault"]
                elif ring_id == 1:
                    ring.structures = ["Fulcrum Guild Hall", "Alchemical Lab", "High Market Square"]
                elif ring_id == 2:
                    ring.structures = ["Artisan Quarter", "Common Residential", "Town Barracks"]
                elif ring_id == 3:
                    ring.structures = ["Irrigated Crop Terraces", "Grain Silos", "Slaughterhouses", "Iron Smelter"]
                elif ring_id == 4:
                    ring.structures = ["Outer Perimeter Wall", "Foraging Camps", "Gamekeeper Lodges"]

    def calculate_per_tick_demands(self) -> Dict[str, float]:
        """
        Calculates per-season resource consumption based on population & active rings.
        Consumption constants:
          - Food demand: 0.002 units per capita
          - Timber demand: 0.0005 units per capita
          - Ore/Metal demand: 0.0002 units per capita
        """
        food_needed = self.population * 0.002
        timber_needed = self.population * 0.0005
        metal_needed = self.population * 0.0002

        # Higher rings increase efficiency but demand higher industrial inputs
        if self.rings[3].built:
            food_needed *= 0.85  # Farmland infrastructure efficiency
        
        return {
            "food_demand": round(food_needed, 2),
            "timber_demand": round(timber_needed, 2),
            "metal_demand": round(metal_needed, 2)
        }


class BurgEcologyBridge:
    def __init__(self, burg: ConcentricBurg, center_cell_biome: str = "FOREST", hinterland_biomes: List[str] = None):
        self.burg = burg
        
        # Center cell (Ring 0-3 location)
        self.center_cell = CellEcologyState(cell_id=burg.center_cell_id, biome_key=center_cell_biome)
        
        # Hinterland cells (Ring 4 surrounding geographic territory)
        if hinterland_biomes is None:
            hinterland_biomes = ["GRASSLAND", "FOREST", "SWAMP", "GRASSLAND"]
            
        self.hinterland_cells: List[CellEcologyState] = [
            CellEcologyState(cell_id=burg.center_cell_id + i + 1, biome_key=b)
            for i, b in enumerate(hinterland_biomes)
        ]

    def sync_burg_infrastructure_to_ecology(self):
        """Applies built Burg rings as infrastructure overrides on local & hinterland cells."""
        # If Ring 3 (Industrial Farmlands) is built, set farms and mines on the center cell
        if self.burg.rings[3].built:
            self.center_cell.has_farm = True
            self.center_cell.has_mine = True

        # Determine harvest rates from Burg demand
        demands = self.burg.calculate_per_tick_demands()
        food_req = demands["food_demand"]
        timber_req = demands["timber_demand"]

        # Center cell bears 50% of plant harvest & 40% of hunting
        self.center_cell.harvest_rate_plants = food_req * 0.50 + timber_req * 0.30
        self.center_cell.harvest_rate_prey = food_req * 0.20

        # Hinterland cells bear remaining 50% of agricultural & game hunting burden split evenly
        hinterland_count = len(self.hinterland_cells)
        for h_cell in self.hinterland_cells:
            h_cell.harvest_rate_plants = (food_req * 0.25) / hinterland_count
            h_cell.harvest_rate_prey = (food_req * 0.20) / hinterland_count

    def process_simulation_tick(self, season_tick: int, temp_c: float = 20.0, rainfall_factor: float = 1.0, chaos_intensity: float = 0.0):
        """
        Executes one integrated seasonal simulation tick:
          1. Syncs Burg infrastructure -> Cell harvest parameters
          2. Runs Lotka-Volterra trophic update across center & hinterland cells
          3. Collects ecological yields (Plants + Prey + Abiotic)
          4. Feeds Burg population and computes food deficit/surplus
          5. Updates Burg Stability, Population growth, and Ring Expansion
        """
        # Step 1: Sync demands to ecology
        self.sync_burg_infrastructure_to_ecology()

        # Step 2: Update ecology ticks
        self.center_cell.update_trophic_tick(season_tick, temp_c, rainfall_factor, chaos_intensity)
        for h_cell in self.hinterland_cells:
            h_cell.update_trophic_tick(season_tick, temp_c, rainfall_factor, chaos_intensity)

        # Step 3: Collect Harvest Yields
        demands = self.burg.calculate_per_tick_demands()
        food_required = demands["food_demand"]

        # Actual yield extracted from plant harvests & prey hunts
        actual_plant_yield = self.center_cell.harvest_rate_plants + sum(c.harvest_rate_plants for c in self.hinterland_cells)
        actual_prey_yield = self.center_cell.harvest_rate_prey + sum(c.harvest_rate_prey for c in self.hinterland_cells)
        total_food_yield = actual_plant_yield * 0.8 + actual_prey_yield * 1.5  # Meat has higher calorie/food value

        # Step 4: Evaluate Food Balance & Reserves
        net_food = total_food_yield - food_required
        if net_food >= 0:
            # Surplus food goes into reserves (capped at 500)
            self.burg.food_reserves = min(500.0, self.burg.food_reserves + net_food)
            food_deficit = 0.0
        else:
            # Deficit: Draw from reserves first
            needed = abs(net_food)
            if self.burg.food_reserves >= needed:
                self.burg.food_reserves -= needed
                food_deficit = 0.0
            else:
                food_deficit = needed - self.burg.food_reserves
                self.burg.food_reserves = 0.0

        # Step 5: Update Burg Dynamics (Stability & Population Growth)
        if food_deficit > 0:
            # Famine penalty: Stability drops, population contracts
            stability_loss = (food_deficit / food_required) * 15.0
            self.burg.stability = max(0.0, self.burg.stability - stability_loss)
            pop_loss = int(self.burg.population * (food_deficit / food_required) * 0.05)
            self.burg.population = max(100, self.burg.population - pop_loss)
        else:
            # Prosperity: Stability recovers, population grows
            self.burg.stability = min(100.0, self.burg.stability + 1.5)
            # Growth rate scales with stability & food surplus
            growth_rate = 0.02 * (self.burg.stability / 100.0)
            self.burg.population = int(self.burg.population * (1.0 + growth_rate))

        # Check for new Concentric Ring unlocks
        self.burg.update_ring_expansion()

    def get_integrated_status(self) -> Dict[str, Any]:
        demands = self.burg.calculate_per_tick_demands()
        return {
            "burg_summary": {
                "burg_id": self.burg.burg_id,
                "name": self.burg.name,
                "population": self.burg.population,
                "stability": round(self.burg.stability, 1),
                "food_reserves": round(self.burg.food_reserves, 1),
                "active_rings": [r.name for r in self.burg.rings.values() if r.built],
                "unlocked_structures": [s for r in self.burg.rings.values() if r.built for s in r.structures],
                "seasonal_demands": demands
            },
            "center_cell_ecology": self.center_cell.to_json_dict(),
            "hinterland_cells_count": len(self.hinterland_cells),
            "hinterlands_avg_plants": round(sum(c.plants for c in self.hinterland_cells) / len(self.hinterland_cells), 2),
            "hinterlands_avg_prey": round(sum(c.prey for c in self.hinterland_cells) / len(self.hinterland_cells), 2)
        }


def run_bridge_test_simulation():
    print("===========================================================================")
    print("🏰 OSTRAKA BURG EXPANSION & TROPHIC ECOLOGY BRIDGE TEST SIMULATION 🏰")
    print("===========================================================================")

    # Initialize Burg at Excelsis Foothills (Pop: 1,200)
    burg = ConcentricBurg(burg_id=1, name="Excelsis Foothills Burg", center_cell_id=500, starting_pop=1200)
    bridge = BurgEcologyBridge(burg=burg, center_cell_biome="FOREST")

    print("\n--- PHASE 1: Initial Settlement State (Pop: 1,200) ---")
    print(json.dumps(bridge.get_integrated_status(), indent=2))

    # Run 10 Seasons of Growth
    print("\n--- Running 10 Seasons of Growth & Prosperity ---")
    for tick in range(1, 11):
        bridge.process_simulation_tick(season_tick=tick, temp_c=20.0, rainfall_factor=1.0)

    print("Status after 10 Seasons:")
    print(json.dumps(bridge.get_integrated_status(), indent=2))

    # Trigger Rapid Population Expansion to unlock Ring 3 (Industrial Farmlands)
    print("\n--- PHASE 2: Population Surge to 6,000 (Unlocking Ring 3 Farmlands) ---")
    burg.population = 6000
    bridge.process_simulation_tick(season_tick=11, temp_c=20.0, rainfall_factor=1.0)
    print(json.dumps(bridge.get_integrated_status(), indent=2))

    # Run 8 Seasons of High Industrial Harvest
    print("\n--- Running 8 Seasons under High Population Demand (Pop ~6,500) ---")
    for tick in range(12, 20):
        bridge.process_simulation_tick(season_tick=tick, temp_c=20.0, rainfall_factor=1.0)

    print("Status after High Industrial Harvest Period:")
    print(json.dumps(bridge.get_integrated_status(), indent=2))

    # Inject Severe Drought & Chaos Surge
    print("\n--- PHASE 3: Environmental Crisis (Severe Drought + Chaos Flow Surge) ---")
    for tick in range(20, 24):
        bridge.process_simulation_tick(season_tick=tick, temp_c=34.0, rainfall_factor=0.20, chaos_intensity=0.80)

    print("Status after Environmental Crisis:")
    print(json.dumps(bridge.get_integrated_status(), indent=2))


if __name__ == "__main__":
    run_bridge_test_simulation()
