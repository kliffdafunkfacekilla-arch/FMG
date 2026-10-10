"""
OSTRAKA 1:1 EARTH-SCALE 3-TIER NESTED LOD & DELTA PROPAGATION ENGINE
=====================================================================
Scales:
  - Tier 3 Global Map: 35,000 Cells (~120 km x 120 km per cell)
  - Tier 2 Regional Map: 50,000 Sub-Cells per Global Cell (~535 m x 535 m per cell)
  - Tier 1 Tactical Battle Map: 351 x 351 Grid @ 5ft per tile (123,201 tiles / 1,755 ft x 1,755 ft = 535 m x 535 m)

Features:
  - 1:1 Universal coordinate mapping from 5ft Tile -> Regional Cell -> Global Cell
  - 16x16 Chunking & Spatial Prop Hashing on 351x351 Grid (22x22 Chunks)
  - Universal Tagged Props & Entities
  - Real-time Upstream Delta Cascade (Tactical Action -> Regional Reserves & Stability -> Global Faction Market Price)
"""

import json
import math
from typing import Dict, List, Tuple, Any, Optional

# --- CONSTANTS & SCALE BLUEPRINT ---
GLOBAL_CELL_COUNT = 35000       # Total Global Macro Cells (~500.5M km² total = Earth surface)
REGIONAL_SUB_CELLS = 50000      # Regional Sub-cells per Global Cell (~0.286 km² / ~535m x 535m)
TACTICAL_GRID_SIZE = 351        # 351 x 351 tiles @ 5ft = 1,755 ft x 1,755 ft (~535 m x 535 m)
TILE_SIZE_FEET = 5.0            # Exact 5ft TTRPG grid scale
CHUNK_SIZE_TILES = 16           # 16x16 tiles per render chunk (~22x22 chunks = 484 chunks per local map)

# --- TIER 3: GLOBAL MACRO CELL ---
class GlobalMacroCell:
    def __init__(self, global_id: int, faction_owner: str = "Avian Empire"):
        self.global_id = global_id
        self.faction_owner = faction_owner
        self.chaos_conduit_intensity = 0.25  # 0.0 to 1.0
        self.market_price_food_mod = 1.0     # Dynamic price multiplier
        self.wealth_rating = 80.0             # Regional treasury

    def apply_macro_delta(self, price_delta: float, wealth_delta: float):
        self.market_price_food_mod = round(max(0.2, self.market_price_food_mod + price_delta), 2)
        self.wealth_rating = round(max(0.0, self.wealth_rating + wealth_delta), 1)

# --- TIER 2: REGIONAL MESO CELL ---
class RegionalMesoCell:
    def __init__(self, subcell_id: int, global_parent_id: int, feature_type: str = "BURG_CENTER"):
        self.subcell_id = subcell_id
        self.global_parent_id = global_parent_id
        self.feature_type = feature_type
        
        # Local Burg State
        self.burg_name = "Excelsis High Burg"
        self.population = 4800
        self.food_reserves = 100.0
        self.stability = 100.0
        self.delta_history: List[Dict[str, Any]] = []

    def apply_meso_delta(self, delta_type: str, severity: float) -> Dict[str, Any]:
        impact_summary = {}
        if delta_type == "GRAIN_SILO_DESTROYED":
            food_loss = 60.0 * severity
            stability_loss = 25.0 * severity
            self.food_reserves = max(0.0, self.food_reserves - food_loss)
            self.stability = max(0.0, self.stability - stability_loss)
            
            impact_summary = {
                "delta_type": delta_type,
                "food_reserves_after": self.food_reserves,
                "stability_after": self.stability,
                "global_price_impact": +0.45 * severity,
                "global_wealth_impact": -15.0 * severity
            }
            self.delta_history.append(impact_summary)
        return impact_summary

# --- TIER 1: TACTICAL BATTLE MAP (351x351 @ 5ft) ---
class TacticalProp:
    def __init__(self, prop_id: str, name: str, x: int, y: int, hp: int, tags: List[str]):
        self.prop_id = prop_id
        self.name = name
        self.x = x
        self.y = y
        self.hp = hp
        self.max_hp = hp
        self.tags = tags
        self.destroyed = False

class TacticalEntity:
    def __init__(self, entity_id: str, name: str, x: int, y: int, hp: int, allegiance: str):
        self.entity_id = entity_id
        self.name = name
        self.x = x
        self.y = y
        self.hp = hp
        self.allegiance = allegiance

class EarthScaleTacticalCanvas:
    def __init__(self, subcell_parent: RegionalMesoCell):
        self.subcell_parent = subcell_parent
        self.grid_size = TACTICAL_GRID_SIZE  # 351
        self.props: Dict[str, TacticalProp] = {}
        self.entities: Dict[str, TacticalEntity] = {}
        self.spatial_chunks: Dict[Tuple[int, int], List[str]] = {}

    def _get_chunk_coords(self, x: int, y: int) -> Tuple[int, int]:
        return (x // CHUNK_SIZE_TILES, y // CHUNK_SIZE_TILES)

    def add_prop(self, prop: TacticalProp):
        self.props[prop.prop_id] = prop
        chunk = self._get_chunk_coords(prop.x, prop.y)
        if chunk not in self.spatial_chunks:
            self.spatial_chunks[chunk] = []
        self.spatial_chunks[chunk].append(prop.prop_id)

    def add_entity(self, entity: TacticalEntity):
        self.entities[entity.entity_id] = entity

    def execute_tactical_action(self, action_type: str, target_prop_id: str, global_world: GlobalMacroCell) -> Dict[str, Any]:
        prop = self.props.get(target_prop_id)
        if not prop or prop.destroyed:
            return {"status": "FAILED", "reason": "Target unavailable"}

        if action_type == "BURN_GRAIN_SILO" and "flammable" in prop.tags:
            prop.hp = 0
            prop.destroyed = True
            
            # Upstream Cascade to Tier 2 (Regional)
            meso_impact = self.subcell_parent.apply_meso_delta("GRAIN_SILO_DESTROYED", severity=1.0)
            
            # Upstream Cascade to Tier 3 (Global)
            global_world.apply_macro_delta(
                price_delta=meso_impact["global_price_impact"],
                wealth_delta=meso_impact["global_wealth_impact"]
            )
            
            return {
                "status": "SUCCESS",
                "action": action_type,
                "target_destroyed": prop.name,
                "location_tile": (prop.x, prop.y),
                "chunk": self._get_chunk_coords(prop.x, prop.y),
                "meso_impact": meso_impact,
                "global_state_after": {
                    "faction": global_world.faction_owner,
                    "food_price_mod": global_world.market_price_food_mod,
                    "wealth_rating": global_world.wealth_rating
                }
            }
        return {"status": "NO_EFFECT"}

# --- SIMULATION & VALIDATION RUNNER ---
def run_earth_scale_lod_simulation():
    print("===========================================================================")
    print("🌍 OSTRAKA 1:1 EARTH-SCALE 3-TIER NESTED LOD ENGINE (351x351 TACTICAL) 🌍")
    print("===========================================================================")
    
    # 1. Initialize Global Macro Cell (Tier 3)
    global_cell = GlobalMacroCell(global_id=105, faction_owner="Avian Empire")
    
    # 2. Initialize Regional Meso Cell (Tier 2)
    regional_cell = RegionalMesoCell(subcell_id=10522, global_parent_id=105, feature_type="BURG_CENTER")
    
    # 3. Hydrate 1:1 Tactical Battle Canvas (Tier 1: 351x351 @ 5ft)
    canvas = EarthScaleTacticalCanvas(subcell_parent=regional_cell)
    
    # Seed props on 351x351 canvas
    # Tile (175, 175) is exact center of 351x351 map (~875ft from borders)
    silo_prop = TacticalProp("prop_silo_1", "Grand Granary Silo", x=175, y=175, hp=100, tags=["wood", "silo", "flammable", "destructible"])
    barricade_prop = TacticalProp("prop_barricade_1", "Iron-Reinforced Wall", x=170, y=172, hp=80, tags=["iron", "heavy_cover"])
    
    canvas.add_prop(silo_prop)
    canvas.add_prop(barricade_prop)
    
    militia = TacticalEntity("ent_guard_1", "Burg High Sentinel", x=172, y=170, hp=24, allegiance="BURG")
    canvas.add_entity(militia)
    
    print("\n--- Step 1: 1:1 Earth-Scale Canvas Hydration (351x351 Grid / 1,755ft x 1,755ft) ---")
    print(f"Canvas Grid Size: {canvas.grid_size} x {canvas.grid_size} ({canvas.grid_size * canvas.grid_size:,} total 5ft tiles)")
    print(f"Physical Map Footprint: {canvas.grid_size * TILE_SIZE_FEET:.0f} ft x {canvas.grid_size * TILE_SIZE_FEET:.0f} ft (~535m x 535m / 71 acres)")
    print(f"Loaded Props at Center: {silo_prop.name} at Tile ({silo_prop.x}, {silo_prop.y}) - Chunk {canvas._get_chunk_coords(silo_prop.x, silo_prop.y)}")
    
    print("\n--- Step 2: Player Executes Tactical Choice on 351x351 Battle Map ---")
    result = canvas.execute_tactical_action("BURN_GRAIN_SILO", "prop_silo_1", global_cell)
    print(json.dumps(result, indent=2))
    
    print("\n--- Step 3: Upstream State Audit Across All 3 Tiers ---")
    print(f" Tier 1 (Micro Battle Map): {silo_prop.name} Destroyed? -> {silo_prop.destroyed}")
    print(f" Tier 2 (Meso Regional Cell 10522): Burg Food Reserves = {regional_cell.food_reserves:.1f} | Burg Stability = {regional_cell.stability:.1f}%")
    print(f" Tier 3 (Macro Global Cell 105): Faction Food Price Modifier = {global_cell.market_price_food_mod:.2f}x | Faction Wealth = {global_cell.wealth_rating:.1f}")

if __name__ == "__main__":
    run_earth_scale_lod_simulation()
