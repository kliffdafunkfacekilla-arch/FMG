"""
OSTRAKA TACTICAL PATHFINDING & MOVEMENT COST ENGINE (351x351 EARTH-SCALE CANVAS)
================================================================================
Implements A* (A-Star) Pathfinding over a 351x351 5ft grid canvas (123,201 tiles).
Features:
  - Movement Cost Penalties based on Universal Terrain Tags (Road, Normal, Mud/Thicket, Water, Impassable Wall)
  - 8-Directional Movement (Cardinals = 1.0x cost, Diagonals = 1.414x cost)
  - Action Economy Integration (Calculates Movement Actions / Stamina required)
  - Dynamic Obstacle Detouring around Line-of-Sight Barriers & Barricades
"""

import heapq
import math
import json
import time
from typing import List, Tuple, Dict, Set, Optional, Any

GRID_DIM = 351  # 351x351 tiles (1,755 ft x 1,755 ft)

# Terrain Movement Cost Multipliers
TERRAIN_COSTS = {
    "ROAD": 0.75,          # Paved / Highway (Fast)
    "CLEAR": 1.0,          # Standard Open Ground
    "MUD": 2.0,            # Difficult Terrain (Double Movement Cost)
    "THICKET": 2.5,        # Heavy Brush / Forest Undergrowth
    "SHALLOW_WATER": 3.0,  # Wading Water
    "IMPASSABLE": 999.0    # Wall, Deep Water, Solid Prop
}

class TacticalMapGrid:
    def __init__(self, dim: int = GRID_DIM):
        self.dim = dim
        # Terrain tag matrix
        self.terrain_matrix: Dict[Tuple[int, int], str] = {}
        # Impassable obstacles
        self.blocked_tiles: Set[Tuple[int, int]] = set()

    def set_tile_terrain(self, x: int, y: int, terrain_type: str):
        if 0 <= x < self.dim and 0 <= y < self.dim:
            self.terrain_matrix[(x, y)] = terrain_type
            if terrain_type in ["IMPASSABLE", "WALL", "SOLID"]:
                self.blocked_tiles.add((x, y))

    def get_movement_cost(self, x: int, y: int) -> float:
        if (x, y) in self.blocked_tiles:
            return TERRAIN_COSTS["IMPASSABLE"]
        terrain = self.terrain_matrix.get((x, y), "CLEAR")
        return TERRAIN_COSTS.get(terrain, 1.0)

    def is_walkable(self, x: int, y: int) -> bool:
        return 0 <= x < self.dim and 0 <= y < self.dim and (x, y) not in self.blocked_tiles

    def get_neighbors(self, x: int, y: int) -> List[Tuple[int, int, float]]:
        """
        Returns valid neighboring tiles (nx, ny, step_cost).
        Diagonal steps cost sqrt(2) * tile_multiplier.
        """
        neighbors = []
        # 8 Directions: (dx, dy, distance_multiplier)
        directions = [
            (0, 1, 1.0), (0, -1, 1.0), (1, 0, 1.0), (-1, 0, 1.0), # Cardinals
            (1, 1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (-1, -1, 1.414) # Diagonals
        ]

        for dx, dy, dist_mult in directions:
            nx, ny = x + dx, y + dy
            if self.is_walkable(nx, ny):
                base_cost = self.get_movement_cost(nx, ny)
                if base_cost < 900.0:
                    step_cost = base_cost * dist_mult
                    neighbors.append((nx, ny, step_cost))
        return neighbors


def heuristic_distance(p1: Tuple[int, int], p2: Tuple[int, int]) -> float:
    """Octile distance heuristic for 8-directional grid."""
    dx = abs(p1[0] - p2[0])
    dy = abs(p1[1] - p2[1])
    return (dx + dy) + (1.414 - 2) * min(dx, dy)


def a_star_pathfind(
    grid: TacticalMapGrid, 
    start: Tuple[int, int], 
    goal: Tuple[int, int]
) -> Dict[str, Any]:
    """
    Executes A* search from start to goal.
    Returns path coordinates, total movement cost (in feet and points), and performance metrics.
    """
    start_time = time.perf_counter()

    if not grid.is_walkable(goal[0], goal[1]):
        return {"status": "FAILED", "reason": "Goal tile is blocked or impassable"}

    open_set = []
    heapq.heappush(open_set, (0.0, start))

    came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
    g_score: Dict[Tuple[int, int], float] = {start: 0.0}
    f_score: Dict[Tuple[int, int], float] = {start: heuristic_distance(start, goal)}

    nodes_evaluated = 0

    while open_set:
        _, current = heapq.heappop(open_set)
        nodes_evaluated += 1

        if current == goal:
            # Reconstruct path
            path = []
            curr_step = goal
            while curr_step in came_from:
                path.append(curr_step)
                curr_step = came_from[curr_step]
            path.append(start)
            path.reverse()

            total_cost_multiplier = g_score[goal]
            total_feet = total_cost_multiplier * 5.0  # 5ft per base tile unit
            stamina_cost = round(total_cost_multiplier * 0.5, 2)
            movement_actions_required = math.ceil(total_feet / 30.0) # 30ft per Move Action

            exec_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

            return {
                "status": "SUCCESS",
                "start": start,
                "goal": goal,
                "path_tile_count": len(path),
                "total_movement_cost_units": round(total_cost_multiplier, 2),
                "effective_distance_feet": round(total_feet, 1),
                "stamina_cost": stamina_cost,
                "movement_actions_required": movement_actions_required,
                "nodes_evaluated": nodes_evaluated,
                "exec_time_ms": exec_time_ms,
                "path_sample": path[:5] + ["..."] + path[-3:] if len(path) > 10 else path
            }

        for nx, ny, step_cost in grid.get_neighbors(current[0], current[1]):
            neighbor = (nx, ny)
            tentative_g = g_score[current] + step_cost

            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f = tentative_g + heuristic_distance(neighbor, goal)
                f_score[neighbor] = f
                heapq.heappush(open_set, (f, neighbor))

    exec_time_ms = round((time.perf_counter() - start_time) * 1000, 3)
    return {
        "status": "NO_PATH_FOUND",
        "nodes_evaluated": nodes_evaluated,
        "exec_time_ms": exec_time_ms
    }


def run_pathfinding_test():
    print("===========================================================================")
    print("🏃 OSTRAKA A* TACTICAL PATHFINDING & MOVEMENT COST SIMULATION (351x351) 🏃")
    print("===========================================================================")

    grid = TacticalMapGrid(GRID_DIM)

    # 1. Construct Obstacles & Difficult Terrain
    start_pos = (170, 175)
    goal_pos = (185, 175)

    print(f"\nSetting up Scenario on 351x351 Grid (Center Map Sector):")
    print(f"  • Start Position: {start_pos}")
    print(f"  • Goal Position:  {goal_pos}")

    # Build a solid Stone Wall in between at X=178 (from Y=170 to Y=182)
    print("  • Erecting Impassable Stone Wall along X=178 (Y=170 to Y=182)...")
    for y in range(170, 183):
        grid.set_tile_terrain(178, y, "IMPASSABLE")

    # Lay down a Mud Patch around the north detour route (X=175 to 180, Y=167 to 169)
    print("  • Spreading Difficult Mud Patch (Cost: 2.0x) around North Detour Corridor...")
    for x in range(175, 181):
        for y in range(167, 170):
            grid.set_tile_terrain(x, y, "MUD")

    # Lay down a Road on the south detour route (X=175 to 182, Y=183 to 185)
    print("  • Paving Cobblestone Road (Cost: 0.75x) along South Detour Corridor...")
    for x in range(175, 183):
        for y in range(183, 186):
            grid.set_tile_terrain(x, y, "ROAD")

    # 2. Run A* Pathfinding
    print("\n--- Executing A* Pathfinding Calculation ---")
    result = a_star_pathfind(grid, start_pos, goal_pos)

    print("\nPathfinding Execution Summary:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run_pathfinding_test()
