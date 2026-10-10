"""
OSTRAKA VTT STATE EXPORTER PIPELINE
===================================
Serializes Tier 1 Micro Maps (351x351 outdoor grids and procedural sub-maps)
into lightweight, front-end ready VTT JSON canvas payloads.

Structures layer data for Canvas/PixiJS/React VTT renderers:
  - Canvas Metadata & Grid Specs (5ft tile scale, dimensions, ambient lighting)
  - Layer 1: Terrain & Ground Tiles (flattened tile array + movement costs)
  - Layer 2: Structural Barriers & Wall Poly-lines
  - Layer 3: Interactive Props (positions, sprite keys, 5-Facet Universal Tags)
  - Layer 4: Dynamic Tokens & Characters (positions, HP/Stamina, active status tags)
  - Layer 5: Fog-of-War & Vision Bitmask (0=Unexplored, 1=Fog Memory, 2=Visible)
  - Layer 6: Action Target Hotspots (interactive props/NPCs within player reach)
"""

import json
import time
from typing import Dict, List, Any, Tuple, Optional


class VTTStateExporter:
    def __init__(self, tile_pixel_size: int = 32):
        self.tile_pixel_size = tile_pixel_size

    def export_outdoor_canvas(
        self,
        cell_id: int,
        cell_name: str,
        grid_351: List[List[str]],
        props: List[Dict[str, Any]],
        tokens: List[Dict[str, Any]],
        fow_buffer: List[List[int]],
        active_player_pos: Tuple[int, int]
    ) -> Dict[str, Any]:
        """
        Exports a 351x351 outdoor tactical grid canvas into a optimized VTT payload.
        """
        width = len(grid_351[0]) if grid_351 else 351
        height = len(grid_351) if grid_351 else 351

        # Flatten grid for fast front-end array indexing
        flattened_terrain = []
        for y in range(height):
            for x in range(width):
                flattened_terrain.append(grid_351[y][x])

        # Flatten Fog of War buffer (0=Unexplored, 1=Fog, 2=Visible)
        flattened_fow = []
        if fow_buffer:
            for y in range(height):
                for x in range(width):
                    flattened_fow.append(fow_buffer[y][x])

        # Extract Action Hotspots within 15ft (3 tiles) of active player
        hotspots = self._extract_action_hotspots(active_player_pos, props, tokens, reach_tiles=3)

        payload = {
            "vtt_version": "1.0.0",
            "timestamp": time.time(),
            "map_type": "OUTDOOR_TACTICAL_GRID",
            "canvas_metadata": {
                "cell_id": cell_id,
                "map_name": cell_name,
                "grid_width_tiles": width,
                "grid_height_tiles": height,
                "tile_size_ft": 5,
                "tile_pixel_size": self.tile_pixel_size,
                "total_pixel_width": width * self.tile_pixel_size,
                "total_pixel_height": height * self.tile_pixel_size,
                "ambient_light": "DAYLIGHT"
            },
            "layers": {
                "terrain": {
                    "format": "FLAT_ARRAY_ROW_MAJOR",
                    "tiles": flattened_terrain
                },
                "props": [
                    {
                        "id": p.get("id"),
                        "name": p.get("name"),
                        "pos_xy": [p.get("pos")[0], p.get("pos")[1]],
                        "sprite_key": p.get("sprite_key", "default_prop"),
                        "universal_tags": p.get("tags", []),
                        "is_destroyed": p.get("is_destroyed", False)
                    }
                    for p in props
                ],
                "tokens": [
                    {
                        "id": t.get("id"),
                        "name": t.get("name"),
                        "pos_xy": [t.get("pos")[0], t.get("pos")[1]],
                        "allegiance": t.get("allegiance", "NEUTRAL"),
                        "hp": t.get("hp", 30),
                        "stamina": t.get("stamina", 20),
                        "status_tags": list(t.get("status_tags", []))
                    }
                    for t in tokens
                ],
                "fog_of_war": {
                    "format": "FLAT_BYTE_ARRAY",
                    "visibility": flattened_fow
                }
            },
            "active_player_state": {
                "pos_xy": list(active_player_pos),
                "action_hotspots": hotspots
            }
        }
        return payload

    def export_submap_canvas(
        self,
        submap_payload: Dict[str, Any],
        active_floor_idx: int = 0,
        fow_buffer: Optional[List[List[int]]] = None,
        active_player_pos: Optional[Tuple[int, int]] = None
    ) -> Dict[str, Any]:
        """
        Exports a procedural sub-map payload into a front-end VTT format.
        """
        floors = submap_payload.get("floors", [])
        if not floors or active_floor_idx >= len(floors):
            raise ValueError("Invalid floor index for sub-map export")

        floor = floors[active_floor_idx]
        grid = floor.get("grid", [])
        width = len(grid[0]) if grid else 20
        height = len(grid) if grid else 20

        flattened_grid = []
        for y in range(height):
            for x in range(width):
                flattened_grid.append(grid[y][x])

        props = floor.get("props", [])
        npcs = floor.get("npcs", [])

        hotspots = []
        if active_player_pos:
            hotspots = self._extract_action_hotspots(active_player_pos, props, npcs, reach_tiles=2)

        return {
            "vtt_version": "1.0.0",
            "timestamp": time.time(),
            "map_type": "SUBMAP_INTERIOR",
            "canvas_metadata": {
                "submap_id": submap_payload.get("submap_id"),
                "map_name": submap_payload.get("name"),
                "archetype": submap_payload.get("formula_matrix", {}).get("archetype"),
                "active_floor_index": active_floor_idx,
                "total_floors": len(floors),
                "grid_width_tiles": width,
                "grid_height_tiles": height,
                "tile_size_ft": 5,
                "tile_pixel_size": self.tile_pixel_size,
                "wall_material": floor.get("wall_material", "stone"),
                "trespass_security": submap_payload.get("formula_matrix", {}).get("trespass_security")
            },
            "layers": {
                "terrain": {
                    "format": "FLAT_ARRAY_ROW_MAJOR",
                    "tiles": flattened_grid
                },
                "props": [
                    {
                        "id": f"prop_{idx}",
                        "name": p.get("name"),
                        "pos_xy": [p.get("pos")[0], p.get("pos")[1]],
                        "tags": p.get("tags", [])
                    }
                    for idx, p in enumerate(props)
                ],
                "tokens": [
                    {
                        "id": f"npc_{idx}",
                        "name": n.get("name"),
                        "pos_xy": [n.get("pos")[0], n.get("pos")[1]],
                        "social_tags": n.get("social_tags", []),
                        "disposition": n.get("disposition", "NEUTRAL")
                    }
                    for idx, n in enumerate(npcs)
                ]
            },
            "active_player_state": {
                "pos_xy": list(active_player_pos) if active_player_pos else [1, 1],
                "action_hotspots": hotspots
            }
        }

    def _extract_action_hotspots(
        self,
        player_pos: Tuple[int, int],
        props: List[Dict[str, Any]],
        tokens: List[Dict[str, Any]],
        reach_tiles: int = 3
    ) -> List[Dict[str, Any]]:
        px, py = player_pos
        hotspots = []

        for p in props:
            pos = p.get("pos")
            if pos:
                dist = max(abs(px - pos[0]), abs(py - pos[1]))
                if dist <= reach_tiles:
                    hotspots.append({
                        "target_type": "PROP",
                        "target_id": p.get("id", p.get("name")),
                        "name": p.get("name"),
                        "pos_xy": list(pos),
                        "distance_tiles": dist,
                        "actionable_tags": [t for t in p.get("tags", []) if t in ["movable", "openable", "flammable", "severable", "climbable", "interactive"]]
                    })

        for t in tokens:
            pos = t.get("pos")
            if pos:
                dist = max(abs(px - pos[0]), abs(py - pos[1]))
                if dist <= reach_tiles and dist > 0:
                    hotspots.append({
                        "target_type": "TOKEN",
                        "target_id": t.get("id", t.get("name")),
                        "name": t.get("name"),
                        "pos_xy": list(pos),
                        "distance_tiles": dist,
                        "actionable_tags": [t for t in t.get("social_tags", []) if t in ["bribeable", "intimidatable", "flatterable", "hostile", "gullible"]]
                    })

        return hotspots


def run_vtt_exporter_demo():
    print("===========================================================================")
    print("🎨 OSTRAKA VTT STATE EXPORTER PIPELINE DEMO 🎨")
    print("===========================================================================")

    exporter = VTTStateExporter(tile_pixel_size=32)

    # 1. Sample 351x351 Outdoor Canvas Setup
    grid_351 = [["CLEAR" for _ in range(351)] for _ in range(351)]
    grid_351[175][180] = "STONE_WALL"
    grid_351[175][181] = "MUD"

    sample_props = [
        {
            "id": "prop_chandelier_1",
            "name": "Hanging Brass Chandelier",
            "pos": (175, 176),
            "sprite_key": "chandelier_brass",
            "tags": ["metal", "burning", "severable", "swinging", "heavy"]
        },
        {
            "id": "prop_table_1",
            "name": "Oak Dining Table",
            "pos": (176, 175),
            "sprite_key": "table_wood_oak",
            "tags": ["wood", "movable", "flammable", "cover_light"]
        }
    ]

    sample_tokens = [
        {
            "id": "char_kaelen",
            "name": "Kaelen (Player)",
            "pos": (175, 175),
            "allegiance": "PLAYER",
            "hp": 30,
            "stamina": 20,
            "status_tags": ["organic"]
        },
        {
            "id": "npc_guard_1",
            "name": "Captain Kael",
            "pos": (175, 177),
            "allegiance": "NEUTRAL",
            "hp": 28,
            "stamina": 18,
            "status_tags": ["guard", "unyielding", "gilded_compass"]
        }
    ]

    fow_buffer = [[2 if abs(x-175)<=12 and abs(y-175)<=12 else 0 for x in range(351)] for y in range(351)]

    # Export Outdoor VTT Canvas
    outdoor_json = exporter.export_outdoor_canvas(
        cell_id=10522,
        cell_name="Excelsis Foothills Market Square",
        grid_351=grid_351,
        props=sample_props,
        tokens=sample_tokens,
        fow_buffer=fow_buffer,
        active_player_pos=(175, 175)
    )

    print("\n✨ [VTT EXPORT SUCCESS] Outdoor 351x351 Canvas Payload Generated:")
    print(f"  • Map Name: {outdoor_json['canvas_metadata']['map_name']}")
    print(f"  • Dimensions: {outdoor_json['canvas_metadata']['grid_width_tiles']}x{outdoor_json['canvas_metadata']['grid_height_tiles']} tiles ({outdoor_json['canvas_metadata']['total_pixel_width']}x{outdoor_json['canvas_metadata']['total_pixel_height']} px)")
    print(f"  • Terrain Tiles Flattened: {len(outdoor_json['layers']['terrain']['tiles'])} tiles")
    print(f"  • Fog-of-War Array Length: {len(outdoor_json['layers']['fog_of_war']['visibility'])} tiles")
    print(f"  • Active Props: {len(outdoor_json['layers']['props'])} props")
    print(f"  • Tokens: {len(outdoor_json['layers']['tokens'])} tokens")
    print(f"  • Action Hotspots (within 15ft reach): {len(outdoor_json['active_player_state']['action_hotspots'])} targets")

    print("\nAction Hotspots in Reach of Player at (175, 175):")
    for h in outdoor_json['active_player_state']['action_hotspots']:
        print(f"  • Target: {h['name']} ({h['target_type']}) at Tile {h['pos_xy']} | Distance: {h['distance_tiles']} tiles | Action Tags: {h['actionable_tags']}")


if __name__ == "__main__":
    run_vtt_exporter_demo()
