import json
import os
from typing import Dict, Any, List

# --- TAXONOMY MATRIX (Lineage x Mind Subtype x Secondary Mind -> 144 Species) ---
LINEAGES = ["Mammal", "Avian", "Reptile", "Aquatic", "Insect", "Plant"]

SPECIES_LOOKUP = {
    "Mammal": {
        "Predator (Canine/Feline)": {"Wolf": "Gray Timber Wolf", "Coyote": "Prairie Coyote", "Fox": "Red Sun Fox"},
        "Brute (Ursine/Bovine)": {"Bear": "Grizzly Mountain Bear", "Bison": "Plain Bison", "Boar": "Ironhide Boar"},
        "Rodent/Burrower": {"Rat": "Golden Warren Rat", "Beaver": "River Engineer Beaver", "Mole": "Subterranean Mole"}
    },
    "Avian": {
        "Raptor (Falcon/Hawk)": {"Eagle": "Imperial Crown Eagle", "Falcon": "Peregrine Wind Falcon", "Owl": "Silent Stalker Owl"},
        "Corvid (Crow/Raven)": {"Raven": "Shadow Raven", "Crow": "Scavenger Crow", "Magpie": "Gilded Magpie"},
        "Waterfowl": {"Heron": "Coastal Heron", "Pelican": "Bay Pelican", "Duck": "Pond Mallard"}
    },
    "Reptile": {
        "Crocodilian": {"Alligator": "Swamp Alligator", "Caiman": "River Caiman", "Gharial": "Narrow Snout Gharial"},
        "Serpentine": {"Viper": "Ash Viper", "Python": "Constrictor Python", "Cobra": "Hooded Cobra"},
        "Saurian/Lizard": {"Monitor": "Crag Monitor Lizard", "Gecko": "Night Wall Gecko", "Iguana": "Canopy Iguana"}
    },
    "Aquatic": {
        "Marine Apex": {"Orca": "Black-Fin Orca", "Shark": "Deep Reef Shark", "Dolphin": "Echo Dolphin"},
        "Abyssal/Cephalopod": {"Octopus": "Mimic Octopus", "Squid": "Abyssal Giant Squid", "Nautilus": "Spiral Nautilus"},
        "Cephaloid/Pinniped": {"Walrus": "Tusked Walrus", "Otter": "River Otter", "Seal": "Ice Pack Seal"}
    },
    "Insect": {
        "Arachnid/Scorpion": {"Spider": "Widow Weaver Spider", "Scorpion": "Dune Scorpion", "Tick": "Iron Tick"},
        "Chitinous/Coleoptera": {"Beetle": "Horned Rhino Beetle", "Ant": "War-Ant Soldier", "Mantis": "Blade Mantis"},
        "Winged/Hymenoptera": {"Wasp": "Stinger Wasp", "Moth": "Lunar Silk Moth", "Dragonfly": "Dart Dragonfly"}
    },
    "Plant": {
        "Floran": {"Rose": "Brier Guard Rose", "Lotus": "Aetheric White Lotus", "Orchid": "Vampiric Orchid"},
        "Arboreal": {"Oak": "Iron-Heart Oak", "Willow": "Weeping Moss Willow", "Pine": "Frost Needle Pine"},
        "Fungal/Carnivorous": {"Mycelium": "Spore Network Mycelium", "Flytrap": "Snap Trap Flytrap", "Pitcher": "Acid Pitcher Plant"}
    }
}

class OstrakaCharacterBuilder:
    def __init__(self, name: str):
        self.name = name
        self.attributes: Dict[str, int] = {
            # Body Attributes (6)
            "might": 0, "endurance": 0, "finesse": 0, "reflex": 0, "vitality": 0, "fortitude": 0,
            # Mind Attributes (6)
            "knowledge": 0, "logic": 0, "awareness": 0, "intuition": 0, "charm": 0, "willpower": 0
        }
        self.lineage = "Mammal"
        self.species = "Unknown Species"
        self.path_type = "Sparkborn" # Sparkborn or Null
        self.path_stat = "knowledge"
        self.offense_track = "might_heavy_bludgeons"
        self.defense_track = "fortitude_plate_armor"
        self.childhood_background = "Tribal Outlaw (+1 Might)"
        self.current_vocation = "Aetheric Scholar (+1 Knowledge)"
        
        self.equipped_gear = []
        self.slotted_abilities = []

    def set_body_array(self, lineage: str, stat_assignment: Dict[str, int]):
        """
        stat_assignment maps physical stat names to values from {7, 6, 5, 4, 3, 2}
        """
        self.lineage = lineage
        body_stats = ["might", "endurance", "finesse", "reflex", "vitality", "fortitude"]
        assigned_vals = sorted(list(stat_assignment.values()), reverse=True)
        if assigned_vals != [7, 6, 5, 4, 3, 2]:
            raise ValueError(f"Body array must use exact values [7, 6, 5, 4, 3, 2]. Got: {assigned_vals}")
        
        for k, v in stat_assignment.items():
            if k in body_stats:
                self.attributes[k] = v

    def set_mind_array(self, family: str, sub_family: str, species_name: str, stat_assignment: Dict[str, int]):
        """
        stat_assignment maps mind stat names to values from {7, 6, 5, 4, 3, 2}
        """
        mind_stats = ["knowledge", "logic", "awareness", "intuition", "charm", "willpower"]
        assigned_vals = sorted(list(stat_assignment.values()), reverse=True)
        if assigned_vals != [7, 6, 5, 4, 3, 2]:
            raise ValueError(f"Mind array must use exact values [7, 6, 5, 4, 3, 2]. Got: {assigned_vals}")
        
        for k, v in stat_assignment.items():
            if k in mind_stats:
                self.attributes[k] = v
        
        self.species = f"{self.lineage} - {species_name}"

    def apply_specialization_and_backgrounds(self, path_type: str, path_stat: str, 
                                             offense_stat: str, defense_stat: str,
                                             childhood_stat: str, vocation_stat: str):
        """
        Choice 7: Path (+2)
        Choice 8: Offense (+1)
        Choice 9: Defense (+1)
        Childhood: (+1)
        Vocation: (+1)
        Total bonus = +6 stat points.
        """
        self.path_type = path_type
        self.path_stat = path_stat
        
        self.attributes[path_stat] += 2
        self.attributes[offense_stat] += 1
        self.attributes[defense_stat] += 1
        self.attributes[childhood_stat] += 1
        self.attributes[vocation_stat] += 1

    def add_gear(self, name: str, slot: str, roll_mod: int, stamina_tax: int = 0, focus_tax: int = 0):
        self.equipped_gear.append({
            "name": name,
            "slot": slot,
            "roll_modifier": roll_mod,
            "stamina_tax": stamina_tax,
            "focus_tax": focus_tax
        })

    def add_ability(self, name: str, track_type: str, rank: int, stamina_tax: int, focus_tax: int, 
                    active_stamina_cost: int, active_focus_cost: int, description: str):
        self.slotted_abilities.append({
            "name": name,
            "track_type": track_type,
            "rank": rank,
            "loadout_tax": {
                "stamina": stamina_tax,
                "focus": focus_tax
            },
            "active_cost": {
                "stamina": active_stamina_cost,
                "focus": active_focus_cost
            },
            "description": description
        })

    def calculate_derived_pools(self) -> Dict[str, Any]:
        attrs = self.attributes
        
        # Derived Core Pools according to exact Ostraka rules formulas:
        hp = attrs["reflex"] + attrs["vitality"] + attrs["intuition"]
        cp = attrs["willpower"] + attrs["charm"] + attrs["might"]
        
        base_stamina = 10 + attrs["endurance"] + attrs["finesse"] + attrs["logic"]
        base_focus = 10 + attrs["knowledge"] + attrs["awareness"] + attrs["fortitude"]
        
        movement_speed = attrs["reflex"] + attrs["awareness"] + attrs["knowledge"]
        camo_rating = attrs["finesse"] + attrs["charm"] + attrs["logic"]
        hydro_rating = attrs["might"] + attrs["vitality"] + attrs["intuition"]
        thermo_rating = attrs["endurance"] + attrs["fortitude"] + attrs["willpower"]
        
        # Calculate Loadout Taxes
        total_stamina_tax = sum(g["stamina_tax"] for g in self.equipped_gear) + \
                            sum(a["loadout_tax"]["stamina"] for a in self.slotted_abilities)
        
        total_focus_tax = sum(g["focus_tax"] for g in self.equipped_gear) + \
                          sum(a["loadout_tax"]["focus"] for a in self.slotted_abilities)
        
        effective_stamina = max(0, base_stamina - total_stamina_tax)
        effective_focus = max(0, base_focus - total_focus_tax)
        
        # Calculate Drag and Regeneration Tier
        stamina_burden_ratio = total_stamina_tax / base_stamina if base_stamina > 0 else 0
        focus_burden_ratio = total_focus_tax / base_focus if base_focus > 0 else 0
        
        max_burden = max(stamina_burden_ratio, focus_burden_ratio)
        
        if max_burden >= 0.75:
            regen_tier = "Heavy Drag (Active Pool Capped at 5; +1 Regen every 2 turns)"
            stamina_regen_per_turn = 0.5
            focus_regen_per_turn = 0.5
            effective_stamina = min(5, effective_stamina)
            effective_focus = min(5, effective_focus)
        elif max_burden >= 0.50:
            regen_tier = "Moderate Drag (Halved Regen: +1 per turn)"
            stamina_regen_per_turn = 1.0
            focus_regen_per_turn = 1.0
        else:
            regen_tier = "Optimal Loadout (Full Regen: +2 per turn)"
            stamina_regen_per_turn = 2.0
            focus_regen_per_turn = 2.0

        return {
            "health_points_hp": hp,
            "composure_points_cp": cp,
            "base_stamina_pool": base_stamina,
            "base_focus_pool": base_focus,
            "total_stamina_tax": total_stamina_tax,
            "total_focus_tax": total_focus_tax,
            "active_stamina_capacity": effective_stamina,
            "active_focus_capacity": effective_focus,
            "stamina_regen_per_turn": stamina_regen_per_turn,
            "focus_regen_per_turn": focus_regen_per_turn,
            "loadout_burden_tier": regen_tier,
            "tactical_stats": {
                "movement_speed_ft": movement_speed * 5,
                "camo_rating": camo_rating,
                "hydro_rating": hydro_rating,
                "thermo_rating": thermo_rating
            }
        }

    def export_to_json(self, filepath: str) -> str:
        derived = self.calculate_derived_pools()
        total_stat_points = sum(self.attributes.values())
        
        character_data = {
            "schema_version": "1.0.0",
            "game_system": "Ostraka TTRPG Engine",
            "character_info": {
                "name": self.name,
                "lineage": self.lineage,
                "species": self.species,
                "path_type": self.path_type,
                "path_primary_stat": self.path_stat,
                "childhood_background": self.childhood_background,
                "current_vocation": self.current_vocation,
                "validation": {
                    "total_attribute_points": total_stat_points,
                    "stat_ceiling_60_check": total_stat_points == 60,
                    "is_valid_build": total_stat_points == 60
                }
            },
            "attributes": self.attributes,
            "derived_pools": derived,
            "equipped_gear": self.equipped_gear,
            "slotted_abilities": self.slotted_abilities
        }

        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(character_data, f, indent=2)
            
        return filepath


def build_sample_characters():
    # 1. Ignis - Sparkborn Arch-Mage
    ignis = OstrakaCharacterBuilder("Ignis the Pyromancer")
    ignis.set_body_array("Mammal", {
        "reflex": 7, "vitality": 6, "finesse": 5, "might": 4, "endurance": 3, "fortitude": 2
    })
    ignis.set_mind_array("Predator (Canine/Feline)", "Feline", "Gilded Sun Tiger", {
        "knowledge": 7, "awareness": 6, "willpower": 5, "logic": 4, "intuition": 3, "charm": 2
    })
    ignis.apply_specialization_and_backgrounds(
        path_type="Sparkborn",
        path_stat="knowledge",     # +2 -> Knowledge = 9
        offense_stat="awareness",  # +1 -> Awareness = 7
        defense_stat="reflex",     # +1 -> Reflex = 8
        childhood_stat="vitality", # +1 -> Vitality = 7
        vocation_stat="knowledge"  # +1 -> Knowledge = 10 -> Wait: 7+2+1=10
    )
    ignis.add_gear("Aetheric Weaver Robes", "armor", roll_mod=1, stamina_tax=1, focus_tax=2)
    ignis.add_gear("Bismuth Focus Staff", "weapon", roll_mod=2, stamina_tax=1, focus_tax=2)
    ignis.add_ability("Apex Inferno Arc", "Sparkborn Magic (Nexus Fire)", rank=4, stamina_tax=0, focus_tax=1, active_stamina_cost=0, active_focus_cost=3, description="Cone of forge-heat setting flammable targets ablaze.")
    ignis.add_ability("Vector Dart", "Sparkborn Magic (Anumis Arcane)", rank=2, stamina_tax=0, focus_tax=1, active_stamina_cost=0, active_focus_cost=2, description="Hard-light needle beam piercing light cover.")
    
    file1 = ignis.export_to_json("/workspace/scratch/ignis_sparkborn_mage.json")

    # 2. Vael - Null Warden
    vael = OstrakaCharacterBuilder("Vael the Null High Warden")
    vael.set_body_array("Reptile", {
        "might": 7, "fortitude": 6, "endurance": 5, "vitality": 4, "reflex": 3, "finesse": 2
    })
    vael.set_mind_array("Crocodilian", "Alligator", "Swamp Alligator", {
        "willpower": 7, "logic": 6, "intuition": 5, "awareness": 4, "knowledge": 3, "charm": 2
    })
    vael.apply_specialization_and_backgrounds(
        path_type="Null Discipline",
        path_stat="might",          # +2 -> Might = 9
        offense_stat="fortitude",   # +1 -> Fortitude = 7
        defense_stat="willpower",   # +1 -> Willpower = 8
        childhood_stat="endurance", # +1 -> Endurance = 6
        vocation_stat="logic"       # +1 -> Logic = 7
    )
    vael.add_gear("Gothic Heavy Plate", "armor", roll_mod=4, stamina_tax=6, focus_tax=1)
    vael.add_gear("Null-Forged Executioner Blade", "weapon", roll_mod=3, stamina_tax=4, focus_tax=1)
    vael.add_ability("Apex Master Null Sanctuary", "Null Discipline", rank=4, stamina_tax=2, focus_tax=2, active_stamina_cost=2, active_focus_cost=3, description="15ft anti-magic sphere unbinding incoming spells.")
    vael.add_ability("Null-Shatter Cleave", "Mundane Offense (Might)", rank=3, stamina_tax=1, focus_tax=0, active_stamina_cost=3, active_focus_cost=0, description="Heavy physical strike bypassing armor tags.")

    file2 = vael.export_to_json("/workspace/scratch/vael_null_warden.json")

    print(f"Exported character JSONs:\n - {file1}\n - {file2}")

if __name__ == "__main__":
    build_sample_characters()
