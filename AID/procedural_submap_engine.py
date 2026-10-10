"""
OSTRAKA PROCEDURAL SUB-MAP FORMULA ENGINE
==========================================
Generates procedural interior and subterranean sub-maps (Tier 1 micro-grids) 
from structural archetypes, themes, socioeconomic tiers, faction styles, 
and operational variables (floors, occupancy, trespass security).

Integrates natively with the 351x351 parent outdoor map anchor, 5-Facet Universal 
Tag Matrix, and dynamic prop/NPC spawning.
"""

import random
import json
from typing import Dict, List, Any, Tuple, Optional

# --- STRUCTURAL ARCHETYPES ---
ARCHETYPES = [
    "BUILDING",     # Dwellings, shops, taverns, manors
    "CAVE",         # Natural caverns, tunnels, grottos
    "KEEP",         # Castles, fortresses, barracks, keeps
    "TOWER",        # Spires, observatories, lighthouses
    "UNDERWORLD",   # Sewers, subterranean aquifers, catacombs
    "VESSEL",       # Airships, skiffs, barges, galleons
    "TEMPLE",       # Shrines, sacred groves, sanctuaries
    "VAULT"         # Bunkers, clockwork archives, containment cells
]

# --- FACTION STYLE TAG OVERLAYS ---
FACTION_OVERLAYS = {
    "Gilded Compass": {
        "wall_mat": "polished_marble",
        "prop_tags": ["gilded", "ledger", "locked_chest", "official_seal", "marble"],
        "faction_tag": "gilded_compass",
        "guard_type": "Fulcrum Sentinel"
    },
    "Ivory Gate Syndicate": {
        "wall_mat": "bone_reinforced_stone",
        "prop_tags": ["bone", "heavy_chain", "iron_toll_gate", "ivory_chit", "spiked"],
        "faction_tag": "fuvuiku_syndicate",
        "guard_type": "Ivory Gate Enforcer"
    },
    "Clockwork Order": {
        "wall_mat": "riveted_brass_plate",
        "prop_tags": ["brass_pipe", "steam_vent", "gear_conduit", "pressure_door", "pentad_altar"],
        "faction_tag": "clockwork_order",
        "guard_type": "Clockwork Automaton"
    },
    "Worm Cult": {
        "wall_mat": "obsidian_and_decay",
        "prop_tags": ["obsidian_altar", "blood_brazier", "occult_sigil", "decay", "dark"],
        "faction_tag": "worm_cult",
        "guard_type": "Cult Heresiarch"
    },
    "Grey Warden": {
        "wall_mat": "chiseled_granite",
        "prop_tags": ["null_anchor", "silver_sigil", "weapon_rack", "ascetic_cot", "clean"],
        "faction_tag": "grey_warden",
        "guard_type": "Warden Purifier"
    },
    "Free Sky-Baronies": {
        "wall_mat": "weathered_timber",
        "prop_tags": ["contraband_barrel", "rope_rigging", "gambling_table", "hidden_trapdoor"],
        "faction_tag": "free_sky_baronies",
        "guard_type": "Sky-Baron Deckhand"
    },
    "Neutral Folk": {
        "wall_mat": "hewn_stone_or_wood",
        "prop_tags": ["wooden_table", "clay_pitcher", "hearth_fire", "wool_blanket"],
        "faction_tag": "civilian",
        "guard_type": "Town Watchman"
    }
}


class SubMapFormula:
    def __init__(
        self,
        archetype: str,
        name: str,
        parent_cell_id: int,
        parent_tile_xy: Tuple[int, int],
        theme_environment: str = "MANMADE_URBAN", # NATURAL vs MANMADE, RURAL vs URBAN
        socioeconomic_tier: str = "MODERATE",    # POOR, MODERATE, WEALTHY
        faction_theme: str = "Neutral Folk",
        floor_count: int = 1,
        occupancy_state: str = "LIVED_IN",      # LIVED_IN, ABANDONED, RUINED
        trespass_security: str = "PUBLIC"        # PUBLIC, PRIVATE, FORBIDDEN
    ):
        if archetype not in ARCHETYPES:
            raise ValueError(f"Invalid archetype: {archetype}. Must be one of {ARCHETYPES}")
        
        self.archetype = archetype
        self.name = name
        self.parent_cell_id = parent_cell_id
        self.parent_tile_xy = parent_tile_xy
        self.theme_environment = theme_environment
        self.socioeconomic_tier = socioeconomic_tier
        self.faction_theme = faction_theme
        self.floor_count = max(1, floor_count)
        self.occupancy_state = occupancy_state
        self.trespass_security = trespass_security

    def generate_submap_payload(self) -> Dict[str, Any]:
        """
        Procedurally constructs multi-floor layouts, props, walls, doors, 
        and NPC actor spawns based on the formula matrix.
        """
        floors_payload = []
        
        # Calculate dimensions based on archetype
        width, height = self._get_archetype_dimensions()
        
        for floor_idx in range(self.floor_count):
            floor_level = floor_idx  # 0 = Ground, 1 = Upper Floor 1, -1 = Cellar/Basement if named so
            floor_data = self._generate_single_floor(floor_level, width, height)
            floors_payload.append(floor_data)
            
        return {
            "submap_id": f"SUBMAP_{self.archetype}_{self.parent_cell_id}_{self.parent_tile_xy[0]}_{self.parent_tile_xy[1]}",
            "name": self.name,
            "parent_anchor": {
                "cell_id": self.parent_cell_id,
                "outdoor_tile_x": self.parent_tile_xy[0],
                "outdoor_tile_y": self.parent_tile_xy[1]
            },
            "formula_matrix": {
                "archetype": self.archetype,
                "theme_environment": self.theme_environment,
                "socioeconomic_tier": self.socioeconomic_tier,
                "faction_theme": self.faction_theme,
                "floor_count": self.floor_count,
                "occupancy_state": self.occupancy_state,
                "trespass_security": self.trespass_security
            },
            "floors": floors_payload
        }

    def _get_archetype_dimensions(self) -> Tuple[int, int]:
        dims = {
            "BUILDING": (20, 20),
            "CAVE": (35, 35),
            "KEEP": (50, 50),
            "TOWER": (18, 18),
            "UNDERWORLD": (40, 40),
            "VESSEL": (30, 14),
            "TEMPLE": (30, 45),
            "VAULT": (25, 25)
        }
        return dims.get(self.archetype, (25, 25))

    def _generate_single_floor(self, floor_level: int, width: int, height: int) -> Dict[str, Any]:
        grid = [["FLOOR" for _ in range(width)] for _ in range(height)]
        props = []
        npcs = []
        
        # 1. Perimeter Walls
        for x in range(width):
            grid[0][x] = "WALL"
            grid[height-1][x] = "WALL"
        for y in range(height):
            grid[y][0] = "WALL"
            grid[y][width-1] = "WALL"
            
        # 2. Main Entrance Door on Ground Floor
        entrance_pos = (width // 2, height - 1)
        if floor_level == 0:
            grid[entrance_pos[1]][entrance_pos[0]] = "DOOR"
            
        # 3. Structural Partitioning based on Archetype
        if self.archetype == "BUILDING":
            # Add mid room partition wall
            mid_x = width // 2
            for y in range(3, height - 3):
                grid[y][mid_x] = "WALL"
            grid[height // 2][mid_x] = "DOOR" # Door connecting rooms
            
        elif self.archetype == "CAVE":
            # Irregular cavern stalagmites / stone pillars
            for _ in range(int(width * height * 0.15)):
                rx, ry = random.randint(2, width-3), random.randint(2, height-3)
                grid[ry][rx] = "CAVERN_WALL"

        elif self.archetype == "TOWER":
            # Circular corner walls
            grid[1][1] = "WALL"; grid[1][width-2] = "WALL"
            grid[height-2][1] = "WALL"; grid[height-2][width-2] = "WALL"

        # 4. Vertical Connections (Stairs / Elevators)
        if self.floor_count > 1:
            if floor_level < self.floor_count - 1:
                stair_up_pos = (width - 3, 3)
                grid[stair_up_pos[1]][stair_up_pos[0]] = "STAIR_UP"
            if floor_level > 0:
                stair_down_pos = (width - 3, 3)
                grid[stair_down_pos[1]][stair_down_pos[0]] = "STAIR_DOWN"

        # 5. Populate Props using Faction & Socioeconomic Overlay
        faction_info = FACTION_OVERLAYS.get(self.faction_theme, FACTION_OVERLAYS["Neutral Folk"])
        
        # Add primary thematic focal prop
        focal_x, focal_y = width // 2, height // 3
        primary_prop_tag = faction_info["prop_tags"][0]
        
        prop_condition = "broken" if self.occupancy_state in ["ABANDONED", "RUINED"] else "intact"
        
        props.append({
            "id": f"prop_focal_{floor_level}",
            "name": f"{self.faction_theme} {primary_prop_tag.replace('_', ' ').title()}",
            "pos": [focal_x, focal_y],
            "tags": [
                primary_prop_tag,
                faction_info["faction_tag"],
                self.socioeconomic_tier.lower(),
                prop_condition,
                "interactive"
            ]
        })
        
        # Add secondary decor/furniture props
        if self.occupancy_state == "LIVED_IN":
            props.append({
                "id": f"prop_furn_1_{floor_level}",
                "name": "Oak Table & Bench",
                "pos": [4, 4],
                "tags": ["wood", "movable", "cover_light", "flammable"]
            })
            if self.trespass_security != "PUBLIC":
                props.append({
                    "id": f"prop_chest_{floor_level}",
                    "name": "Lockbox Chest",
                    "pos": [width - 4, height - 4],
                    "tags": ["metal", "locked", "storage", "container", "valuable" if self.socioeconomic_tier == "WEALTHY" else "standard"]
                })

        # 6. Populate NPCs based on Security and Occupancy
        if self.occupancy_state == "LIVED_IN":
            if self.trespass_security in ["PRIVATE", "FORBIDDEN"]:
                npcs.append({
                    "id": f"npc_guard_{floor_level}_1",
                    "name": faction_info["guard_type"],
                    "pos": [width // 2, height // 2],
                    "allegiance": "HOSTILE" if self.trespass_security == "FORBIDDEN" else "NEUTRAL_GUARD",
                    "social_tags": [
                        "suspicious", "guard", faction_info["faction_tag"],
                        "unyielding" if self.socioeconomic_tier == "WEALTHY" else "bribeable"
                    ]
                })

        return {
            "floor_level": floor_level,
            "dimensions": {"width": width, "height": height},
            "wall_material": faction_info["wall_mat"],
            "grid": grid,
            "props": props,
            "npcs": npcs
        }


def run_submap_procedural_test():
    print("===========================================================================")
    print("🏛️ OSTRAKA PROCEDURAL SUB-MAP FORMULA ENGINE DEMO 🏛️")
    print("===========================================================================\n")

    # Scenario 1: A Wealthy 3-Story Spire owned by the Gilded Compass
    spire_formula = SubMapFormula(
        archetype="TOWER",
        name="The Obsidian Gilded Observatory",
        parent_cell_id=10522,
        parent_tile_xy=(175, 120),
        theme_environment="MANMADE_URBAN",
        socioeconomic_tier="WEALTHY",
        faction_theme="Gilded Compass",
        floor_count=3,
        occupancy_state="LIVED_IN",
        trespass_security="FORBIDDEN"
    )
    spire_data = spire_formula.generate_submap_payload()

    print(f"✨ [SUBMAP GENERATED]: '{spire_data['name']}'")
    print(f"  • Parent Anchor: Cell {spire_data['parent_anchor']['cell_id']} at Tile ({spire_data['parent_anchor']['outdoor_tile_x']}, {spire_data['parent_anchor']['outdoor_tile_y']})")
    print(f"  • Formula Parameters: Archetype={spire_formula.archetype} | Floors={spire_formula.floor_count} | Security={spire_formula.trespass_security} | Faction={spire_formula.faction_theme}")
    print(f"  • Floor 0 (Ground): {spire_data['floors'][0]['dimensions']['width']}x{spire_data['floors'][0]['dimensions']['height']} grid | Wall Material: {spire_data['floors'][0]['wall_material']}")
    print(f"  • Injected Props on Floor 0: {[p['name'] + ' ' + str(p['tags']) for p in spire_data['floors'][0]['props']]}")
    print(f"  • Injected NPCs on Floor 0: {[n['name'] + ' ' + str(n['social_tags']) for n in spire_data['floors'][0]['npcs']]}\n")

    # Scenario 2: An Abandoned Worm Cult Cave System
    cave_formula = SubMapFormula(
        archetype="CAVE",
        name="The Whispering Rot Cavern",
        parent_cell_id=10522,
        parent_tile_xy=(210, 85),
        theme_environment="NATURAL_WILDERNESS",
        socioeconomic_tier="POOR",
        faction_theme="Worm Cult",
        floor_count=1,
        occupancy_state="ABANDONED",
        trespass_security="FORBIDDEN"
    )
    cave_data = cave_formula.generate_submap_payload()

    print(f"✨ [SUBMAP GENERATED]: '{cave_data['name']}'")
    print(f"  • Parent Anchor: Cell {cave_data['parent_anchor']['cell_id']} at Tile ({cave_data['parent_anchor']['outdoor_tile_x']}, {cave_data['parent_anchor']['outdoor_tile_y']})")
    print(f"  • Formula Parameters: Archetype={cave_formula.archetype} | Occupancy={cave_formula.occupancy_state} | Faction={cave_formula.faction_theme}")
    print(f"  • Injected Props: {[p['name'] + ' ' + str(p['tags']) for p in cave_data['floors'][0]['props']]}\n")

    # Scenario 3: A Free Sky-Baronies Outlaw Tavern
    tavern_formula = SubMapFormula(
        archetype="BUILDING",
        name="The Drifting Anchor Saloon",
        parent_cell_id=10522,
        parent_tile_xy=(150, 200),
        theme_environment="MANMADE_URBAN",
        socioeconomic_tier="MODERATE",
        faction_theme="Free Sky-Baronies",
        floor_count=2,
        occupancy_state="LIVED_IN",
        trespass_security="PUBLIC"
    )
    tavern_data = tavern_formula.generate_submap_payload()

    print(f"✨ [SUBMAP GENERATED]: '{tavern_data['name']}'")
    print(f"  • Formula Parameters: Archetype={tavern_formula.archetype} | Security={tavern_formula.trespass_security} | Faction={tavern_formula.faction_theme}")
    print(f"  • Injected Props on Floor 0: {[p['name'] + ' ' + str(p['tags']) for p in tavern_data['floors'][0]['props']]}")


if __name__ == "__main__":
    run_submap_procedural_test()
