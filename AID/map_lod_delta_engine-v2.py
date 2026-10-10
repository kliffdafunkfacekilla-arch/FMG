"""
OSTRAKA MULTI-SCALE NESTED LOD & DELTA PROPAGATION ENGINE (128x128 GRID REVISED)
================================================================================
Implements 3-Tier Spatial Nesting with 128x128 Tactical Grid (640ft x 640ft):
  - Tier 3: Global Macro Grid (224x224 = ~50,000 cells)
  - Tier 2: Regional Meso Rolling Window (224x224 = ~50,000 sub-cells, 3x3 active window)
  - Tier 1: Tactical Battle Map (128x128 = 16,384 tiles @ 5ft scale, 8x8 chunks of 16x16 tiles)

Features:
  - Bitwise coordinate indexing: (y << 7) | x
  - 8x8 Chunking (64 chunks total of 16x16 tiles)
  - Prop tagging with Universal Reactive Tags
  - Upstream Delta Propagation (Player Action -> Sub-cell -> Macro Faction)
"""

import json
from typing import Dict, List, Tuple, Any


class PropTag:
    FLAMMABLE = "flammable"
    CONDUCTIVE = "conductive"
    WOOD = "wood"
    HEAVY_COVER = "heavy_cover"
    DESTRUCTIBLE = "destructible"
    SILO = "silo"


class TacticalTile:
    def __init__(self, tx: int, ty: int, terrain_type: str = "cobblestone"):
        self.tx = tx
        self.ty = ty
        self.flat_index = (ty << 7) | tx  # Bitwise 128x128 indexing
        self.chunk_x = tx >> 4           # 16 tiles per chunk (0..7)
        self.chunk_y = ty >> 4           # 16 tiles per chunk (0..7)
        self.terrain_type = terrain_type
        self.props: List[Dict[str, Any]] = []
        self.entities: List[Dict[str, Any]] = []


class TacticalBattleMapCanvas:
    """Tier 1: 128x128 Tactical Grid (16,384 Tiles = 640ft x 640ft)"""
    def __init__(self, subcell_id: int, feature_type: str = "BURG_CENTER"):
        self.subcell_id = subcell_id
        self.feature_type = feature_type
        self.grid_size = 128
        self.total_tiles = 128 * 128  # 16,384 tiles
        self.total_chunks = 8 * 8     # 64 chunks of 16x16
        
        # Spatial prop registry
        self.props: Dict[str, Dict[str, Any]] = {}
        self.entities: Dict[str, Dict[str, Any]] = {}
        
        self._seed_default_props()

    def _seed_default_props(self):
        # Seed props at 5ft grid coordinates within 128x128 canvas
        self.props["prop_silo_1"] = {
            "id": "prop_silo_1",
            "name": "Grain Silo Reserve",
            "pos": (64, 64),
            "flat_index": (64 << 7) | 64,
            "chunk": (64 >> 4, 64 >> 4),
            "hp": 50,
            "max_hp": 50,
            "tags": [PropTag.WOOD, PropTag.SILO, PropTag.FLAMMABLE, PropTag.DESTRUCTIBLE]
        }
        self.props["prop_barricade_1"] = {
            "id": "prop_barricade_1",
            "name": "Timber Barricade",
            "pos": (62, 63),
            "flat_index": (63 << 7) | 62,
            "chunk": (62 >> 4, 63 >> 4),
            "hp": 30,
            "max_hp": 30,
            "tags": [PropTag.WOOD, PropTag.HEAVY_COVER, PropTag.DESTRUCTIBLE]
        }
        self.entities["ent_guard_1"] = {
            "id": "ent_guard_1",
            "name": "Burg Militia Sentinel",
            "pos": (62, 60),
            "chunk": (62 >> 4, 60 >> 4),
            "hp": 18,
            "max_hp": 18,
            "allegiance": "BURG"
        }

    def execute_player_action(self, action_type: str, target_prop_id: str) -> Dict[str, Any]:
        """
        Executes tactical action on 128x128 grid and returns generated cell delta.
        """
        if target_prop_id not in self.props:
            return {"error": "Target prop not found"}

        prop = self.props[target_prop_id]
        delta_payload = {}

        if action_type == "BURN_GRAIN_SILO" and PropTag.FLAMMABLE in prop["tags"]:
            prop["hp"] = 0
            delta_payload = {
                "cell_id": self.subcell_id,
                "event_type": "GRAIN_SILO_DESTROYED",
                "target_prop": prop["name"],
                "location_tile": prop["pos"],
                "chunk_index": prop["chunk"],
                "delta_impact": {
                    "burg_food_reserve_change": -60.0,
                    "burg_stability_change": -25.0,
                    "regional_price_food_multiplier": 1.45
                }
            }
        return delta_payload


class RegionalSubCellMeso:
    """Tier 2: Regional Sub-Cell (~50,000 sub-cells per global cell)"""
    def __init__(self, subcell_id: int, name: str = "Excelsis Foothills Burg Sub-cell"):
        self.subcell_id = subcell_id
        self.name = name
        self.burg_food_reserves = 100.0
        self.burg_stability = 100.0
        self.event_history: List[str] = []

    def apply_upstream_delta(self, delta: Dict[str, Any]) -> Dict[str, Any]:
        impact = delta.get("delta_impact", {})
        self.burg_food_reserves = max(0.0, self.burg_food_reserves + impact.get("burg_food_reserve_change", 0.0))
        self.burg_stability = max(0.0, self.burg_stability + impact.get("burg_stability_change", 0.0))
        self.event_history.append(f"Delta Event: {delta.get('event_type')} at Tile {delta.get('location_tile')} (Chunk {delta.get('chunk_index')})")
        
        # Upstream cascade payload to Tier 3
        return {
            "macro_cell_id": self.subcell_id // 100,
            "price_modifier_food": impact.get("regional_price_food_multiplier", 1.0),
            "faction_wealth_delta": -10.0
        }


class GlobalMacroCell:
    """Tier 3: Global Macro Cell (~50,000 cells)"""
    def __init__(self, global_id: int, controlling_faction: str = "Avian Empire"):
        self.global_id = global_id
        self.controlling_faction = controlling_faction
        self.food_price_modifier = 1.0
        self.faction_wealth = 75.0

    def apply_macro_cascade(self, macro_delta: Dict[str, Any]):
        self.food_price_modifier = macro_delta.get("price_modifier_food", 1.0)
        self.faction_wealth += macro_delta.get("faction_wealth_delta", 0.0)


def run_lod_delta_simulation():
    print("===========================================================================")
    print("🌐 OSTRAKA MULTI-SCALE LOD & DELTA ENGINE (128x128 REVISED) 🌐")
    print("===========================================================================")

    # 1. Initialize Hierarchy
    global_cell = GlobalMacroCell(global_id=105, controlling_faction="Avian Empire")
    meso_subcell = RegionalSubCellMeso(subcell_id=10522, name="Excelsis Foothills Burg")
    battle_canvas = TacticalBattleMapCanvas(subcell_id=10522, feature_type="BURG_CENTER")

    print("\n--- Step 1: Tactical Canvas Hydration (128x128 Grid / 640ft x 640ft) ---")
    print(f"Canvas Size: {battle_canvas.grid_size}x{battle_canvas.grid_size} ({battle_canvas.total_tiles:,} tiles)")
    print(f"Spatial Chunks: {battle_canvas.total_chunks} Chunks (8x8 grid of 16x16 tile chunks)")
    print(f"Active Props Loaded: {len(battle_canvas.props)}")
    for pid, p in battle_canvas.props.items():
        print(f"  • {p['name']} at Tile {p['pos']} (Flat Index: {p['flat_index']}, Chunk: {p['chunk']}) - Tags: {p['tags']}")

    print("\n--- Step 2: Player Executes Tactical Choice on 128x128 Battle Map ---")
    delta_tier1 = battle_canvas.execute_player_action("BURN_GRAIN_SILO", "prop_silo_1")
    print(f"⚡ [PLAYER AGENCY TRIGGERED]: Burned 'prop_silo_1' at Tile {delta_tier1['location_tile']} in Chunk {delta_tier1['chunk_index']}")

    print("\n--- Step 3: Upstream Delta Propagation Across Tiers ---")
    macro_cascade = meso_subcell.apply_upstream_delta(delta_tier1)
    global_cell.apply_macro_cascade(macro_cascade)

    print(f"  └─► [Tier 1 Micro]: Silo Destroyed at Tile {delta_tier1['location_tile']} (Chunk {delta_tier1['chunk_index']})")
    print(f"  └─► [Tier 2 Meso]: Burg Food Reserves: {meso_subcell.burg_food_reserves:.1f} | Stability: {meso_subcell.burg_stability:.1f}%")
    print(f"  └─► [Tier 3 Macro]: Global Faction Food Price Modifier: {global_cell.food_price_modifier:.2f}x | Faction Wealth: {global_cell.faction_wealth:.1f}")


if __name__ == "__main__":
    run_lod_delta_simulation()
