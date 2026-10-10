"""
OSTRAKA MULTI-SCALE NESTED LOD & DELTA PROPAGATION ENGINE
=========================================================
Implements the 3-Tier Nested Simulation Architecture:
  - Tier 3: Global Macro Grid (~50,000 Cells) -> Macro Factions & Aetheric Chaos Flows
  - Tier 2: Regional Meso 3x3 Rolling Window -> Ecology, Burgs & Emergent Quests
  - Tier 1: Tactical Battle Map (5ft Grid) -> Tile Terrain, Tagged Props & Entities

Bi-Directional Delta Bridge:
  - Downstream: World Events -> Seed Tactical Battle Map Props & NPCs
  - Upstream: Player Tactical Actions -> Write Cell Deltas -> Cascade Up to Regional & Global
"""

import json
import math
import random
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


# ============================================================================
# 1. TIER 3: GLOBAL MACRO GRID (50,000 Macro Cells)
# ============================================================================

@dataclass
class GlobalMacroCell:
    cell_id: int
    grid_x: int
    grid_y: int
    macro_biome: str
    controlling_faction: str
    chaos_flow_intensity: float  # 0.0 to 1.0
    macro_wealth_rating: float    # 0.0 to 100.0
    market_price_food_modifier: float = 1.0


class GlobalMacroEngine:
    def __init__(self, total_cells: int = 50000):
        self.total_cells = total_cells
        self.side_dim = int(math.sqrt(total_cells))  # ~223 x 223
        self.cells: Dict[int, GlobalMacroCell] = {}
        self._seed_global_grid()

    def _seed_global_grid(self):
        factions = ["Avian Empire", "Heartland Alliance", "Iron Caldera", "Meridian Chain", "Free Sky-Baronies"]
        biomes = ["Sylvan Canopy", "Heartland Plains", "Shatter-Sands", "Caldera Crags", "Sump-Bogs"]
        
        for i in range(min(500, self.total_cells)):  # Seed local test region of cells
            x = i % self.side_dim
            y = i // self.side_dim
            biome = biomes[i % len(biomes)]
            faction = factions[(x + y) % len(factions)]
            chaos = round(0.1 + (0.8 * math.sin(i * 0.05) ** 2), 2)
            wealth = round(30.0 + (50.0 * math.cos(i * 0.03) ** 2), 1)
            
            self.cells[i] = GlobalMacroCell(
                cell_id=i, grid_x=x, grid_y=y,
                macro_biome=biome, controlling_faction=faction,
                chaos_flow_intensity=chaos, macro_wealth_rating=wealth
            )

    def get_cell(self, cell_id: int) -> GlobalMacroCell:
        return self.cells.get(cell_id, GlobalMacroCell(cell_id, 0, 0, "Sylvan Canopy", "Neutral", 0.1, 50.0))


# ============================================================================
# 2. TIER 2: REGIONAL MESO ROLLING WINDOW (Ecology, Burgs & Deltas)
# ============================================================================

@dataclass
class RegionalSubCellState:
    subcell_id: int
    global_macro_id: int
    local_x: int
    local_y: int
    feature_type: str  # "WILDERNESS", "BURG_CENTER", "FARMLANDS", "RUIN_POI"
    flora_count: float
    prey_count: float
    predator_count: float
    abiotic_reserves: float
    burg_population: int = 0
    burg_food_reserves: float = 100.0
    burg_stability: float = 100.0
    active_deltas: List[Dict[str, Any]] = field(default_factory=list)

    def apply_delta(self, delta: Dict[str, Any]):
        self.active_deltas.append(delta)
        delta_type = delta.get("type", "")
        
        if delta_type == "GRAIN_SILO_DESTROYED":
            self.burg_food_reserves = max(0.0, self.burg_food_reserves - 60.0)
            self.burg_stability = max(0.0, self.burg_stability - 25.0)
            self.flora_count = max(0.0, self.flora_count - 30.0)
        elif delta_type == "BEAST_SLAIN":
            self.predator_count = max(0.0, self.predator_count - 1.0)
            self.prey_count = min(150.0, self.prey_count + 2.0)  # Reduced predation pressure
        elif delta_type == "RESOURCE_HARVESTED":
            self.abiotic_reserves = max(0.0, self.abiotic_reserves - delta.get("amount", 10.0))


class RegionalMesoEngine:
    def __init__(self, global_engine: GlobalMacroEngine):
        self.global_engine = global_engine
        self.subcells: Dict[int, RegionalSubCellState] = {}

    def get_or_create_subcell(self, global_id: int, local_x: int, local_y: int) -> RegionalSubCellState:
        subcell_id = (global_id * 100) + (local_y * 10) + local_x
        if subcell_id not in self.subcells:
            macro = self.global_engine.get_cell(global_id)
            feature = "BURG_CENTER" if (local_x == 2 and local_y == 2) else ("FARMLANDS" if (local_x in [1,3] and local_y in [1,3]) else "WILDERNESS")
            
            self.subcells[subcell_id] = RegionalSubCellState(
                subcell_id=subcell_id,
                global_macro_id=global_id,
                local_x=local_x,
                local_y=local_y,
                feature_type=feature,
                flora_count=90.0,
                prey_count=35.0,
                predator_count=10.0,
                abiotic_reserves=100.0,
                burg_population=2500 if feature == "BURG_CENTER" else 0
            )
        return self.subcells[subcell_id]

    def get_rolling_3x3_window(self, center_global_id: int, center_lx: int, center_ly: int) -> List[RegionalSubCellState]:
        window = []
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                lx = (center_lx + dx) % 5
                ly = (center_ly + dy) % 5
                window.append(self.get_or_create_subcell(center_global_id, lx, ly))
        return window


# ============================================================================
# 3. TIER 1: TACTICAL BATTLE MAP CANVAS (5ft Grid Engine)
# ============================================================================

@dataclass
class BattleTile:
    x: int
    y: int
    terrain: str         # "GRASS", "MUD", "WATER", "STONE"
    movement_cost: int   # 1 = Normal, 2 = Difficult
    tags: List[str]      # ["flammable", "conductive", "wet"]

@dataclass
class BattleProp:
    prop_id: str
    name: str
    x: int
    y: int
    hp: int
    max_hp: int
    tags: List[str]      # ["wood", "heavy_cover", "destructible", "silo"]

@dataclass
class BattleEntity:
    entity_id: str
    name: str
    x: int
    y: int
    hp: int
    max_hp: int
    faction_allegiance: str
    tags: List[str]      # ["npc", "hostile", "wildlife"]


class TacticalBattleMapCanvas:
    def __init__(self, subcell: RegionalSubCellState, grid_size: int = 10):
        self.subcell = subcell
        self.grid_size = grid_size
        self.tiles: List[List[BattleTile]] = []
        self.props: List[BattleProp] = []
        self.entities: List[BattleEntity] = []
        self._seed_tactical_canvas()

    def _seed_tactical_canvas(self):
        # 1. Generate Tile Grid
        for y in range(self.grid_size):
            row = []
            for x in range(self.grid_size):
                terrain = "STONE" if self.subcell.feature_type == "BURG_CENTER" else ("MUD" if x == 3 else "GRASS")
                tags = ["conductive"] if terrain == "MUD" else (["flammable"] if terrain == "GRASS" else [])
                row.append(BattleTile(x=x, y=y, terrain=terrain, movement_cost=2 if terrain=="MUD" else 1, tags=tags))
            self.tiles.append(row)

        # 2. Seed Props based on Regional Feature
        if self.subcell.feature_type == "BURG_CENTER" or self.subcell.feature_type == "FARMLANDS":
            self.props.append(BattleProp("prop_silo_1", "Grain Silo Reserve", x=5, y=5, hp=50, max_hp=50, tags=["wood", "silo", "flammable", "destructible"]))
            self.props.append(BattleProp("prop_barricade_1", "Timber Barricade", x=4, y=4, hp=30, max_hp=30, tags=["wood", "heavy_cover", "destructible"]))

        # 3. Seed Entities based on Ecology & Feature
        if self.subcell.predator_count > 12.0:
            self.entities.append(BattleEntity("ent_beast_1", "Mutated Timber-Wolf", x=7, y=7, hp=16, max_hp=16, faction_allegiance="WILD", tags=["hostile", "wildlife"]))
        if self.subcell.feature_type == "BURG_CENTER":
            self.entities.append(BattleEntity("ent_guard_1", "Burg Militia Sentinel", x=4, y=3, hp=18, max_hp=18, faction_allegiance="BURG", tags=["npc", "guard"]))

    def to_json_dict(self) -> Dict[str, Any]:
        return {
            "subcell_id": self.subcell.subcell_id,
            "feature_type": self.subcell.feature_type,
            "grid_size": f"{self.grid_size}x{self.grid_size} (5ft tiles)",
            "props_count": len(self.props),
            "entities_count": len(self.entities),
            "props": [{"id": p.prop_id, "name": p.name, "pos": [p.x, p.y], "hp": f"{p.hp}/{p.max_hp}", "tags": p.tags} for p in self.props],
            "entities": [{"id": e.entity_id, "name": e.name, "pos": [e.x, e.y], "hp": f"{e.hp}/{e.max_hp}", "allegiance": e.faction_allegiance} for e in self.entities]
        }


# ============================================================================
# 4. UPSTREAM DELTA CASCADE CONTROLLER
# ============================================================================

class LODMasterSystemController:
    def __init__(self):
        self.global_engine = GlobalMacroEngine(total_cells=50000)
        self.regional_engine = RegionalMesoEngine(self.global_engine)
        self.active_battle_map: Optional[TacticalBattleMapCanvas] = None

    def load_player_position(self, global_id: int, local_x: int, local_y: int) -> TacticalBattleMapCanvas:
        subcell = self.regional_engine.get_or_create_subcell(global_id, local_x, local_y)
        self.active_battle_map = TacticalBattleMapCanvas(subcell)
        return self.active_battle_map

    def execute_player_tactical_action(self, action_type: str, target_id: str):
        """
        Processes player tactical choices on the Battle Map and cascades deltas UPWARDS.
        """
        if not self.active_battle_map:
            return

        subcell = self.active_battle_map.subcell
        global_cell = self.global_engine.get_cell(subcell.global_macro_id)

        print(f"\n⚡ [PLAYER AGENCY TRIGGERED]: Action = '{action_type}' on Target = '{target_id}'")

        if action_type == "BURN_GRAIN_SILO":
            # 1. Update Battle Map Prop State
            for p in self.active_battle_map.props:
                if p.prop_id == target_id:
                    p.hp = 0
                    p.tags.append("burned")

            # 2. Write Delta to Tier 2 Regional Sub-cell
            delta = {
                "type": "GRAIN_SILO_DESTROYED",
                "source": "Player Tactical Fire Spell",
                "timestamp_tick": 1
            }
            subcell.apply_delta(delta)

            # 3. Cascade Upward to Tier 3 Global Macro Layer
            global_cell.market_price_food_modifier += 0.45  # Food market price spikes!
            global_cell.macro_wealth_rating = max(0.0, global_cell.macro_wealth_rating - 15.0)

            print(f"  └─► [Tier 1 Micro]: Grain Silo HP reduced to 0 (Destroyed & Burned).")
            print(f"  └─► [Tier 2 Meso]: Regional Burg Food Reserves dropped to {subcell.burg_food_reserves:.1f} | Stability dropped to {subcell.burg_stability:.1f}%.")
            print(f"  └─► [Tier 3 Macro]: Global Faction Market Price Modifier for Food spiked to {global_cell.market_price_food_modifier:.2f}x!")


# ============================================================================
# 5. TEST SUITE EXECUTION
# ============================================================================

def run_lod_test_suite():
    print("===========================================================================")
    print("🌐 OSTRAKA MULTI-SCALE NESTED LOD & DELTA PROPAGATION ENGINE 🌐")
    print("===========================================================================")

    controller = LODMasterSystemController()

    # 1. Load Player into Global Cell 105, Sub-cell (2,2) - Burg Center
    print("\n--- Step 1: Hydrating Level-of-Detail for Player Location (Global 105, Sub-cell 2,2) ---")
    battle_map = controller.load_player_position(global_id=105, local_x=2, local_y=2)
    print("Battle Map Rendered Canvas State:")
    print(json.dumps(battle_map.to_json_dict(), indent=2))

    # 2. Player takes a destructive tactical choice on the Battle Map
    print("\n--- Step 2: Player Executes Tactical Choice on Battle Map ---")
    controller.execute_player_tactical_action(action_type="BURN_GRAIN_SILO", target_id="prop_silo_1")

    # 3. Inspect updated regional and global state
    print("\n--- Step 3: Verifying Upstream Cascaded State ---")
    subcell = battle_map.subcell
    macro = controller.global_engine.get_cell(105)
    
    print(f"Regional Sub-cell (ID: {subcell.subcell_id}) -> Burg Food Reserves: {subcell.burg_food_reserves:.1f} | Burg Stability: {subcell.burg_stability:.1f}%")
    print(f"Global Macro Cell (ID: {macro.cell_id}) -> Controlling Faction: {macro.controlling_faction} | Food Price Modifier: {macro.market_price_food_modifier:.2f}x | Wealth Rating: {macro.macro_wealth_rating:.1f}")


if __name__ == "__main__":
    run_lod_test_suite()
