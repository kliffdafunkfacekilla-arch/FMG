"""
OSTRAKA FOG-OF-WAR & VISION LINE-OF-SIGHT (LoS) RAYCASTING ENGINE
==================================================================
Grid Scale: 351 x 351 Tiles (123,201 total 5ft tiles / 1:1 Earth-scale Canvas)
Chunking: 22 x 22 Spatial Chunks (16x16 tiles per chunk)

Features:
  - 3-State Visibility Buffer: UNEXPLORED (0), FOG_OF_WAR (1), VISIBLE (2)
  - Bresenham / Raycasting Line-of-Sight algorithm
  - Vision Radius scaling based on character Awareness/Intuition
  - Wall/Obstacle shadow casting & ray termination
  - Dynamic Entity visibility filter (entities hidden in Fog/Unexplored)
  - Persistent explored memory mask
"""

import math
import json
from typing import Dict, List, Set, Tuple, Any


# Visibility States
UNEXPLORED = 0
FOG_OF_WAR = 1
VISIBLE = 2


class TacticalTile:
    def __init__(self, x: int, y: int, is_blocking: bool = False, tags: List[str] = None):
        self.x = x
        self.y = y
        self.is_blocking = is_blocking
        self.tags = tags or []
        self.visibility_state = UNEXPLORED


class Entity:
    def __init__(self, entity_id: str, name: str, x: int, y: int, allegiance: str):
        self.entity_id = entity_id
        self.name = name
        self.x = x
        self.y = y
        self.allegiance = allegiance


class FogOfWarEngine:
    def __init__(self, grid_size: int = 351):
        self.grid_size = grid_size
        self.chunk_size = 16
        self.num_chunks_axis = math.ceil(grid_size / self.chunk_size)  # 22
        
        # Grid map storing blocking props / walls
        # Using a dictionary of blocking tile coordinates for efficiency
        self.blocking_tiles: Set[Tuple[int, int]] = set()
        self.tile_props: Dict[Tuple[int, int], Dict[str, Any]] = {}
        
        # Global Visibility State Memory: (x, y) -> visibility_state (0, 1, 2)
        self.explored_tiles: Set[Tuple[int, int]] = set()
        self.currently_visible_tiles: Set[Tuple[int, int]] = set()

    def add_blocking_obstacle(self, x: int, y: int, prop_name: str, tags: List[str]):
        """Adds a wall or solid prop that terminates vision rays."""
        if 0 <= x < self.grid_size and 0 <= y < self.grid_size:
            self.blocking_tiles.add((x, y))
            self.tile_props[(x, y)] = {"name": prop_name, "tags": tags}

    def _cast_ray(self, x0: int, y0: int, x1: int, y1: int, max_radius: float) -> List[Tuple[int, int]]:
        """
        Bresenham raycasting line-of-sight from (x0, y0) toward target perimeter point (x1, y1).
        Stops when encountering a blocking tile or exceeding max_radius.
        """
        visible_ray_tiles = []
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        x, y = x0, y0
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy

        while True:
            dist = math.hypot(x - x0, y - y0)
            if dist > max_radius:
                break

            if 0 <= x < self.grid_size and 0 <= y < self.grid_size:
                visible_ray_tiles.append((x, y))

                # Check if this tile blocks line-of-sight (excluding the origin tile itself)
                if (x, y) != (x0, y0) and (x, y) in self.blocking_tiles:
                    # Tile itself is visible, but ray terminates here (casting shadow behind)
                    break

            if x == x1 and y == y1:
                break

            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy

        return visible_ray_tiles

    def compute_field_of_view(self, token_x: int, token_y: int, vision_radius_ft: float = 60.0) -> Dict[str, Any]:
        """
        Computes Active Field of View (FoV) for a character token.
        1. Transitions previous 'VISIBLE' tiles to 'FOG_OF_WAR'.
        2. Casts rays in 360 degrees out to vision_radius_ft (converted to 5ft tile units).
        3. Updates newly visible tiles to 'VISIBLE' and adds to persistent 'explored' set.
        """
        radius_tiles = vision_radius_ft / 5.0  # e.g., 60 ft = 12 tiles
        
        # Transition previously visible tiles to FOG_OF_WAR
        for prev_tile in self.currently_visible_tiles:
            self.explored_tiles.add(prev_tile)
            
        self.currently_visible_tiles.clear()

        # Generate perimeter points for 360-degree raycasting
        r_int = math.ceil(radius_tiles)
        min_x = max(0, token_x - r_int)
        max_x = min(self.grid_size - 1, token_x + r_int)
        min_y = max(0, token_y - r_int)
        max_y = min(self.grid_size - 1, token_y + r_int)

        # Collect perimeter tiles along bounding box of vision radius
        perimeter_targets: List[Tuple[int, int]] = []
        for x in range(min_x, max_x + 1):
            perimeter_targets.append((x, min_y))
            perimeter_targets.append((x, max_y))
        for y in range(min_y + 1, max_y):
            perimeter_targets.append((min_x, y))
            perimeter_targets.append((max_x, y))

        # Cast rays to all perimeter targets
        for tx, ty in perimeter_targets:
            ray_tiles = self._cast_ray(token_x, token_y, tx, ty, radius_tiles)
            for tile in ray_tiles:
                self.currently_visible_tiles.add(tile)
                self.explored_tiles.add(tile)

        return {
            "token_pos": [token_x, token_y],
            "vision_radius_ft": vision_radius_ft,
            "vision_radius_tiles": radius_tiles,
            "active_visible_tile_count": len(self.currently_visible_tiles),
            "total_explored_tile_count": len(self.explored_tiles)
        }

    def filter_entities_by_visibility(self, entities: List[Entity]) -> List[Dict[str, Any]]:
        """
        Renders entities ONLY if they stand on an actively VISIBLE tile.
        Entities in FOG_OF_WAR or UNEXPLORED tiles are completely hidden.
        """
        visible_entities = []
        for entity in entities:
            pos = (entity.x, entity.y)
            if pos in self.currently_visible_tiles:
                visible_entities.append({
                    "id": entity.entity_id,
                    "name": entity.name,
                    "pos": [entity.x, entity.y],
                    "allegiance": entity.allegiance,
                    "visibility_status": "VISIBLE"
                })
        return visible_entities

    def get_tile_visibility_state(self, x: int, y: int) -> str:
        pos = (x, y)
        if pos in self.currently_visible_tiles:
            return "VISIBLE"
        elif pos in self.explored_tiles:
            return "FOG_OF_WAR"
        else:
            return "UNEXPLORED"


def run_fog_of_war_test():
    print("===========================================================================")
    print("👁️ OSTRAKA FOG-OF-WAR & LINE-OF-SIGHT (LoS) RAYCASTING SIMULATION 👁️")
    print("===========================================================================")
    
    # Initialize Engine on 351x351 Grid
    engine = FogOfWarEngine(grid_size=351)
    
    # 1. Place Obstacles & Walls (Stone Wall & Heavy Pillar)
    # Token starts at (175, 175)
    # Place a solid wall spanning from (180, 170) to (180, 180) - blocking east vision
    for wy in range(170, 181):
        engine.add_blocking_obstacle(180, wy, "Reinforced Stone Wall", ["stone", "wall", "full_cover"])
        
    # Place a pillar at (172, 178)
    engine.add_blocking_obstacle(172, 178, "Aetheric Conduit Pillar", ["stone", "pillar", "full_cover"])

    print("\n--- Map Setup ---")
    print("Center Token Start Position: (175, 175)")
    print("Obstacle 1: Stone Wall spanning (180, 170) -> (180, 180) [Blocks East Vision]")
    print("Obstacle 2: Pillar at (172, 178) [Blocks North-West Vision]")

    # 2. Add Test Entities
    entities = [
        Entity("ent_guard_1", "Gilded Sentinel (Visible in open)", 175, 170, "ALLY"),
        Entity("ent_sniper_1", "Shadow Sniper (Behind Stone Wall)", 183, 175, "ENEMY"), # Should be shadowed
        Entity("ent_cultist_1", "Worm Cultist (Behind Pillar)", 171, 179, "ENEMY"),    # Should be shadowed
        Entity("ent_patrol_1", "Hinterland Scout (Far away / Unexplored)", 210, 210, "NEUTRAL") # Beyond vision radius
    ]

    # 3. Step 1: Initial Compute FoV at (175, 175) with 60ft (12 tiles) vision
    print("\n--- Step 1: Compute FoV at Position (175, 175) [Vision Radius: 60 ft / 12 Tiles] ---")
    fov_stats = engine.compute_field_of_view(175, 175, vision_radius_ft=60.0)
    print(json.dumps(fov_stats, indent=2))

    visible_entities = engine.filter_entities_by_visibility(entities)
    print(f"\nVisible Entities Rendered to Player ({len(visible_entities)}):")
    print(json.dumps(visible_entities, indent=2))

    print("\nTile Visibility Check around Obstacles:")
    print(f"  Tile (179, 175) [In front of Wall]: {engine.get_tile_visibility_state(179, 175)}")
    print(f"  Tile (180, 175) [On Stone Wall]: {engine.get_tile_visibility_state(180, 175)}")
    print(f"  Tile (183, 175) [Behind Wall - Enemy Sniper]: {engine.get_tile_visibility_state(183, 175)} (SHADOWED!)")

    # 4. Step 2: Player Moves around Wall to (181, 175)
    print("\n--- Step 2: Player Flanks Around Wall to Position (181, 175) ---")
    fov_stats_2 = engine.compute_field_of_view(181, 175, vision_radius_ft=60.0)
    print(json.dumps(fov_stats_2, indent=2))

    visible_entities_2 = engine.filter_entities_by_visibility(entities)
    print(f"\nVisible Entities Rendered after Flanking ({len(visible_entities_2)}):")
    print(json.dumps(visible_entities_2, indent=2))

    print("\nTile Visibility Check after Flanking:")
    print(f"  Tile (175, 175) [Old Player Position]: {engine.get_tile_visibility_state(175, 175)} (RETAINS FOG OF WAR MEMORY)")
    print(f"  Tile (183, 175) [Behind Wall - Enemy Sniper]: {engine.get_tile_visibility_state(183, 175)} (NOW VISIBLE!)")


if __name__ == "__main__":
    run_fog_of_war_test()
