import json
import random
import time

# =============================================================================
# OSTRAKA UNIVERSAL TAG PARSER & COMBAT/ENVIRONMENT INTERACTION ENGINE
# =============================================================================

class TaggedObject:
    def __init__(self, name, obj_type, material_tags=None, active_tags=None, 
                 reactive_tags=None, actionable_tags=None, environmental_tags=None):
        self.name = name
        self.obj_type = obj_type  # 'WEAPON', 'ARMOR', 'SPELL', 'ENTITY', 'PROP', 'TILE'
        self.tags = set()
        
        if material_tags: self.tags.update(material_tags)
        if active_tags: self.tags.update(active_tags)
        if reactive_tags: self.tags.update(reactive_tags)
        if actionable_tags: self.tags.update(actionable_tags)
        if environmental_tags: self.tags.update(environmental_tags)

    def has_tag(self, tag):
        return tag in self.tags

    def add_tag(self, tag):
        self.tags.add(tag)

    def remove_tag(self, tag):
        self.tags.discard(tag)

class CharacterEntity:
    def __init__(self, name, hp, max_hp, stats):
        self.name = name
        self.hp = hp
        self.max_hp = max_hp
        self.stats = stats # dict of stats e.g. {'might': 14, 'reflex': 12}
        self.equipped_weapon = None
        self.equipped_armor = None
        self.active_status_tags = set(['organic']) # default organic entity

    def equip_weapon(self, weapon):
        self.equipped_weapon = weapon

    def equip_armor(self, armor):
        self.equipped_armor = armor

    def get_all_active_tags(self):
        combined = set(self.active_status_tags)
        if self.equipped_weapon:
            combined.update(self.equipped_weapon.tags)
        if self.equipped_armor:
            combined.update(self.equipped_armor.tags)
        return combined

class UniversalActionResolver:
    @staticmethod
    def parse_and_resolve_action(attacker, defender, action_verb, spell=None, environment_props=None):
        """
        Parses intent by merging:
        - Attacker's active tags + Weapon/Spell tags + Action Verb tags
        - Defender's active tags + Armor tags
        - Environmental Prop/Tile tags at target location
        """
        if environment_props is None:
            environment_props = []

        combined_attack_tags = attacker.get_all_active_tags()
        action_verb = action_verb.upper()

        # Map action verb to intrinsic damage/interaction tags
        verb_tag_map = {
            "SLASH": {"cut", "slashing"},
            "STAB": {"pierce", "piercing"},
            "THRUST": {"pierce", "piercing", "reach"},
            "SMASH": {"bludgeon", "heavy"},
            "CAST_FIRE": {"ignite", "hot", "fire"},
            "CAST_LIGHTNING": {"shocking", "electric", "conductive_arc"},
            "SHOOT": {"pierce", "ranged"}
        }

        action_tags = verb_tag_map.get(action_verb, {action_verb.lower()})
        combined_attack_tags.update(action_tags)

        if spell:
            combined_attack_tags.update(spell.tags)

        defender_tags = defender.get_all_active_tags()

        # Logs
        cascade_events = []
        advantage_reasons = []
        disadvantage_reasons = []

        # 1. Check Advantage / Disadvantage from Tag Intersections
        if "blinded" in attacker.active_status_tags or "poisoned_ill" in attacker.active_status_tags:
            disadvantage_reasons.append("Attacker is impaired/poisoned")
        if "prone" in defender_tags and ("cut" in combined_attack_tags or "bludgeon" in combined_attack_tags):
            advantage_reasons.append("Defender is PRONE against melee attack")

        # 2. Check Conductive & Shock interactions
        if "shocking" in combined_attack_tags or "electric" in combined_attack_tags:
            if "conductive" in defender_tags:
                cascade_events.append("⚡ [CONDUCTIVE OVERLOAD]: Metal armor conducts electricity! Extra 1d8 shock damage and Defender is STUNNED!")
                defender.active_status_tags.add("stunned")

        # 3. Check Ignitable / Flammable interactions
        if "ignite" in combined_attack_tags or "hot" in combined_attack_tags or "burning" in combined_attack_tags:
            if "flammable" in defender_tags:
                cascade_events.append("🔥 [FLAMMABLE IGNITION]: Target armor/clothing catches fire! Applies 'BURNING' status.")
                defender.active_status_tags.add("burning")

        # 4. Weapon Cut / Pierce vs Material Armor
        if "cut" in combined_attack_tags:
            if "heavy_plate" in defender_tags or "stone" in defender_tags:
                cascade_events.append("🛡️ [RESISTED]: Slashing weapon glance off rigid plate armor (Damage reduced by 4).")

        if "bludgeon" in combined_attack_tags:
            if "heavy_plate" in defender_tags:
                cascade_events.append("🔨 [CRUSHING IMPACT]: Bludgeoning force cracks through rigid plate armor (Bonus +3 impact damage).")

        # 5. Environment Prop Reactions
        for prop in environment_props:
            prop_tags = prop.tags
            if ("cut" in combined_attack_tags or "severable" in combined_attack_tags) and prop.has_tag("severable"):
                cascade_events.append(f"💥 [ENVIRONMENTAL CASCADE]: Action severing '{prop.name}'! It collapses onto the battlefield!")
                if prop.has_tag("burning"):
                    cascade_events.append(f"🔥 [AREA IGNITION]: Burning fragments from '{prop.name}' ignite nearby tiles!")

        # Resolve Attack Roll
        has_adv = len(advantage_reasons) > 0 and len(disadvantage_reasons) == 0
        has_dis = len(disadvantage_reasons) > 0 and len(advantage_reasons) == 0

        r1 = random.randint(1, 20)
        r2 = random.randint(1, 20)
        if has_adv:
            final_roll = max(r1, r2)
            roll_str = f"d20 ADVANTAGE -> Rolled ({r1}, {r2}) = {final_roll}"
        elif has_dis:
            final_roll = min(r1, r2)
            roll_str = f"d20 DISADVANTAGE -> Rolled ({r1}, {r2}) = {final_roll}"
        else:
            final_roll = r1
            roll_str = f"d20 STANDARD -> Rolled {final_roll}"

        return {
            "attacker": attacker.name,
            "defender": defender.name,
            "action_verb": action_verb,
            "attack_tags": list(combined_attack_tags),
            "defender_tags": list(defender_tags),
            "roll_result": roll_str,
            "advantage_reasons": advantage_reasons,
            "disadvantage_reasons": disadvantage_reasons,
            "cascades": cascade_events
        }

def run_universal_demo():
    print("===========================================================================")
    print("⚔️ OSTRAKA UNIVERSAL TAG INTEGRATION ENGINE (WEAPONS, ARMOR, SPELLS, PROPS) ⚔️")
    print("===========================================================================\n")

    # 1. Define Items with Automatic Tag Archetypes
    iron_broadsword = TaggedObject("Iron Broadsword", "WEAPON", 
                                   material_tags=["metal"], 
                                   active_tags=["cut", "slashing"], 
                                   reactive_tags=["conductive"], 
                                   actionable_tags=["parrying"])

    wooden_spear = TaggedObject("Ashwood Spear", "WEAPON", 
                                material_tags=["wood"], 
                                active_tags=["pierce", "piercing"], 
                                reactive_tags=["flammable"], 
                                actionable_tags=["reach"])

    steel_plate_armor = TaggedObject("Full Steel Plate", "ARMOR", 
                                     material_tags=["metal"], 
                                     reactive_tags=["conductive", "heavy_plate"], 
                                     environmental_tags=["cover_heavy"])

    leather_robes = TaggedObject("Oiled Leather Robe", "ARMOR", 
                                 material_tags=["organic"], 
                                 reactive_tags=["flammable"])

    lightning_spell = TaggedObject("Aetheric Arc", "SPELL", 
                                   active_tags=["shocking", "electric", "conductive_arc"])

    # 2. Define Characters
    hero = CharacterEntity("Kaelen the Warden", hp=35, max_hp=35, stats={"might": 14})
    hero.equip_weapon(iron_broadsword)

    enemy_knight = CharacterEntity("Ironclad Sentinel", hp=40, max_hp=40, stats={"might": 16})
    enemy_knight.equip_armor(steel_plate_armor)

    enemy_scout = CharacterEntity("Cultist Scout", hp=22, max_hp=22, stats={"might": 10})
    enemy_scout.equip_armor(leather_robes)
    enemy_scout.equipped_weapon = wooden_spear

    # 3. Define Environmental Prop
    hanging_chandelier = TaggedObject("Brass Chandelier", "PROP", 
                                      material_tags=["metal"], 
                                      active_tags=["burning", "light"], 
                                      reactive_tags=["severable", "heavy"], 
                                      actionable_tags=["swinging"])

    # --- Scenario 1: Attacking Steel Plate with Broadsword (Cut Tag vs Conductive Metal) ---
    print("--- Scenario 1: Kaelen Slashes Ironclad Sentinel with Broadsword ---")
    res1 = UniversalActionResolver.parse_and_resolve_action(hero, enemy_knight, "SLASH")
    print(f"Attacker Active Tags: {res1['attack_tags']}")
    print(f"Defender Active Tags: {res1['defender_tags']}")
    print(f"Roll: {res1['roll_result']}")
    for c in res1['cascades']:
        print(f"  └─► {c}")
    print()

    # --- Scenario 2: Casting Lightning Spell on Steel Plate Armor ---
    print("--- Scenario 2: Kaelen Casts 'Aetheric Arc' (Lightning) on Ironclad Sentinel ---")
    res2 = UniversalActionResolver.parse_and_resolve_action(hero, enemy_knight, "CAST_LIGHTNING", spell=lightning_spell)
    print(f"Attacker Active Tags: {res2['attack_tags']}")
    print(f"Defender Active Tags: {res2['defender_tags']}")
    print(f"Roll: {res2['roll_result']}")
    for c in res2['cascades']:
        print(f"  └─► {c}")
    print()

    # --- Scenario 3: Slashing Chandelier Wire while Attacking Scout wearing Oiled Leather ---
    print("--- Scenario 3: Kaelen Slashes at Cultist Scout while Severing Hanging Chandelier ---")
    res3 = UniversalActionResolver.parse_and_resolve_action(hero, enemy_scout, "SLASH", environment_props=[hanging_chandelier])
    print(f"Attacker Active Tags: {res3['attack_tags']}")
    print(f"Defender Active Tags: {res3['defender_tags']}")
    print(f"Roll: {res3['roll_result']}")
    for c in res3['cascades']:
        print(f"  └─► {c}")
    print()

if __name__ == "__main__":
    run_universal_demo()
