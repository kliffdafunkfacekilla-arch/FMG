import json

class TagCategory:
    MATERIAL = "MATERIAL"
    ACTIVE = "ACTIVE"
    REACTIVE = "REACTIVE"
    ACTIONABLE = "ACTIONABLE"
    ENVIRONMENTAL = "ENVIRONMENTAL"

class Prop:
    def __init__(self, prop_id, name, pos, tags, hp=10):
        self.prop_id = prop_id
        self.name = name
        self.pos = pos  # (x, y) tile
        self.tags = set(tags)
        self.hp = hp
        self.is_destroyed = False

    def has_tag(self, tag):
        return tag in self.tags

    def add_tag(self, tag):
        self.tags.add(tag)

    def remove_tag(self, tag):
        self.tags.discard(tag)

class RoomEnvironment:
    def __init__(self, width=10, height=10):
        self.width = width
        self.height = height
        self.props = {}
        # Floor tiles tags: default wood, walkable
        self.floor_tags = {(x, y): {"wood", "flammable", "walkable"} for x in range(width) for y in range(height)}

    def add_prop(self, prop):
        self.props[prop.prop_id] = prop

    def interact(self, actor_name, action_verb, target_id, tool_or_element=None):
        target = self.props.get(target_id)
        if not target:
            return {"status": "FAILED", "reason": f"Target {target_id} not found."}

        logs = []

        logs.append(f"🎭 [{actor_name.upper()} INTENT]: Performs '{action_verb}' on '{target.name}'")

        # --- ACTION MATCHING MATRIX ---
        if action_verb == "SEVER":
            if target.has_tag("severable") or target.has_tag("swinging"):
                logs.append(f"  └─► SUCCESS: The support holding '{target.name}' is SEVERED!")
                target.remove_tag("swinging")
                target.add_tag("falling")
                
                # Drop to floor logic
                target.pos = (target.pos[0], target.pos[1]) # Impact position
                logs.append(f"  └─► CASCADE: '{target.name}' crashes down onto Tile {target.pos}!")

                # Impact damage/reaction
                if target.has_tag("heavy"):
                    logs.append(f"      • Heavy Impact deals 2d10 bludgeoning damage to entities on Tile {target.pos}!")
                
                # Active trait transfer (e.g., hanging burning chandelier transfers fire)
                if target.has_tag("burning"):
                    floor_tile_tags = self.floor_tags.get(target.pos, set())
                    if "flammable" in floor_tile_tags:
                        self.floor_tags[target.pos].add("burning")
                        logs.append(f"      • FIRE SPREAD: The burning embers ignite the flammable wood floor on Tile {target.pos}!")

                    # Check for nearby flammable props on same tile (like rug or chair)
                    for other in self.props.values():
                        if other.pos == target.pos and other.prop_id != target.prop_id and other.has_tag("flammable"):
                            other.add_tag("burning")
                            logs.append(f"      • IGNITION: '{other.name}' catches fire from the falling chandelier!")

            else:
                logs.append(f"  └─► FAILED: '{target.name}' is not severable.")

        elif action_verb == "IGNITE" or action_verb == "FIRE_CAST":
            if target.has_tag("flammable"):
                target.add_tag("burning")
                logs.append(f"  └─► SUCCESS: '{target.name}' bursts into flames!")
                if target.has_tag("wood") or target.has_tag("fabric"):
                    logs.append("      • Smoke fills adjacent tiles, applying 'HINDER' (Disadvantage on sight checks).")
            else:
                logs.append(f"  └─► RESISTED: '{target.name}' is not flammable.")

        elif action_verb == "MOVE" or action_verb == "PUSH":
            if target.has_tag("movable") or target.has_tag("rolling"):
                logs.append(f"  └─► SUCCESS: '{target.name}' is pushed across the floor!")
                if target.has_tag("hinder") or target.has_tag("cover_light"):
                    logs.append(f"      • TACTICAL SHIFT: Creates temporary cover at new location!")
            else:
                logs.append(f"  └─► FAILED: '{target.name}' is immovable or fixed.")

        elif action_verb == "OPEN":
            if target.has_tag("openable"):
                target.remove_tag("impassable")
                target.add_tag("open")
                logs.append(f"  └─► SUCCESS: '{target.name}' swings open! Line of sight cleared.")
            else:
                logs.append(f"  └─► FAILED: '{target.name}' cannot be opened.")

        elif action_verb == "PULL_RUG":
            if target.has_tag("movable") and target.has_tag("fabric"):
                logs.append(f"  └─► SUCCESS: '{target.name}' is yanked violently!")
                # Trip entities standing on rug
                logs.append(f"      • TRAP TRIGGERED: Any entity standing on '{target.name}' must make a Reflex save or fall PRONE!")

        return {
            "status": "EXECUTED",
            "logs": logs,
            "target_final_tags": list(target.tags)
        }

def run_test():
    room = RoomEnvironment()

    # Populate room with user's exact scenario
    chandelier = Prop(
        "chandelier_1", "Hanging Brass Chandelier", (5, 5),
        ["metal", "burning", "swinging", "climbable", "severable", "heavy"]
    )
    table = Prop(
        "table_1", "Oak Dining Table", (5, 5),
        ["wood", "flammable", "movable", "hinder", "cover_light"]
    )
    rug = Prop(
        "rug_1", "Ornate Wool Rug", (5, 5),
        ["fabric", "flammable", "movable"]
    )
    door_north = Prop(
        "door_north", "Heavy Oak Door", (5, 0),
        ["wood", "flammable", "openable", "impassable"]
    )

    room.add_prop(chandelier)
    room.add_prop(table)
    room.add_prop(rug)
    room.add_prop(door_north)

    print("===========================================================================")
    print("🔮 OSTRAKA 5-FACET UNIVERSAL TAG MATRIX & EMERGENCE DEMO 🔮")
    print("===========================================================================\n")

    print("--- Room Setup ---")
    for p in room.props.values():
        print(f" • {p.name} at {p.pos} -> Tags: {sorted(list(p.tags))}")
    print()

    # Player Action 1: Sever chandelier rope above guards standing at (5,5)
    res1 = room.interact("Rogue Player", "SEVER", "chandelier_1")
    for line in res1["logs"]:
        print(line)
    print()

    # Player Action 2: Pull the burning rug to trip guards
    res2 = room.interact("Fighter Player", "PULL_RUG", "rug_1")
    for line in res2["logs"]:
        print(line)

if __name__ == "__main__":
    run_test()
