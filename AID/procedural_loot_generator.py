"""
OSTRAKA PROCEDURAL LOOT & AETHER-RELIC GENERATOR
================================================
Generates procedurally generated weapons, armor, Aether-tech relics, and regional 
trade loot drops grounded in Ostraka's 12 Elemental Conductor Metals, 1-Rating 
equipment economy, Loadout Cost balance, and 5-Facet Universal Tag Matrix.

Supports container rolls, boss drops, regional wealth scaling, and faction style overlays.
"""

import random
import json
from typing import Dict, List, Any, Tuple, Optional

# --- THE 12 ELEMENTAL CONDUCTOR METALS & WOVEN POWERS ---
CONDUCTOR_METALS = {
    "Osmium": {
        "woven_power": "Force / Mass",
        "associated_attr": "might",
        "damage_element": "force",
        "active_tags": ["heavy_impact", "crushing", "knockback"],
        "reactive_tags": ["dense", "high_mass"],
        "color_desc": "deep bluish-black dense metal"
    },
    "Titanium": {
        "woven_power": "Cold / Ordo",
        "associated_attr": "endurance",
        "damage_element": "cold",
        "active_tags": ["chilling", "frost_bite", "rigid"],
        "reactive_tags": ["temperature_resistant", "unyielding"],
        "color_desc": "silver-grey frost-sheened alloy"
    },
    "Gold": {
        "woven_power": "Acid / Flux",
        "associated_attr": "finesse",
        "damage_element": "acid",
        "active_tags": ["corrosive", "flux_etching", "sharp"],
        "reactive_tags": ["conductive", "corrosion_immune"],
        "color_desc": "gleaming gilded acid-etched metal"
    },
    "Lead": {
        "woven_power": "Sonic / Motus",
        "associated_attr": "reflex",
        "damage_element": "sonic",
        "active_tags": ["vibrating", "sonic_disruption", "resonate"],
        "reactive_tags": ["heavy", "dampening"],
        "color_desc": "dull matte-grey resonating ore"
    },
    "Silver": {
        "woven_power": "Necro / Vita",
        "associated_attr": "vitality",
        "damage_element": "necrotic",
        "active_tags": ["life_siphon", "wounding", "decaying"],
        "reactive_tags": ["organic_reactive", "purifying"],
        "color_desc": "pale moon-lit silver weave"
    },
    "Tungsten": {
        "woven_power": "Fire / Nexus",
        "associated_attr": "fortitude",
        "damage_element": "fire",
        "active_tags": ["igniting", "searing", "thermal_pulse"],
        "reactive_tags": ["heat_resistant", "incandescent"],
        "color_desc": "dark charcoal heat-glowing steel"
    },
    "Bismuth": {
        "woven_power": "Arcane / Anuminus",
        "associated_attr": "knowledge",
        "damage_element": "arcane",
        "active_tags": ["aether_discharge", "magic_focus", "prismatic"],
        "reactive_tags": ["aether_attuned", "fragile_to_null"],
        "color_desc": "iridescent rainbow crystalline metal"
    },
    "Silicon": {
        "woven_power": "Shock / Ratio",
        "associated_attr": "logic",
        "damage_element": "shock",
        "active_tags": ["electric", "shocking", "conductive_arc"],
        "reactive_tags": ["conductive", "insulating_core"],
        "color_desc": "glassy crystalline semiconductor matrix"
    },
    "Chromium": {
        "woven_power": "Radiant / Lux",
        "associated_attr": "awareness",
        "damage_element": "radiant",
        "active_tags": ["blinding_flash", "radiant_sear", "illuminating"],
        "reactive_tags": ["reflective", "mirror_finish"],
        "color_desc": "mirror-polished blinding chrome"
    },
    "Iridium": {
        "woven_power": "Temporal / Omen",
        "associated_attr": "intuition",
        "damage_element": "temporal",
        "active_tags": ["time_blur", "haste_flicker", "precognitive"],
        "reactive_tags": ["phase_shifted", "rare"],
        "color_desc": "shimmering violet temporal alloy"
    },
    "Phosphorus": {
        "woven_power": "Spirit / Aura",
        "associated_attr": "charm",
        "damage_element": "spirit",
        "active_tags": ["mind_soothing", "spirit_flare", "beguiling"],
        "reactive_tags": ["bioluminescent", "aura_sensitive"],
        "color_desc": "glowing pale-green luminous crystal"
    },
    "Lithium": {
        "woven_power": "Psychic / Lex",
        "associated_attr": "willpower",
        "damage_element": "psychic",
        "active_tags": ["mind_shatter", "psychic_shock", "disorienting"],
        "reactive_tags": ["lightweight", "psi_attuned"],
        "color_desc": "silvery-white ultra-light reactive metal"
    }
}

# --- ITEM CATEGORIES & BASE TYPES ---
ITEM_BASE_TYPES = {
    "WEAPON": [
        {"name": "Longsword", "slot": "MAIN_HAND", "base_tags": ["metal", "cut", "slashing", "parrying"]},
        {"name": "Warhammer", "slot": "MAIN_HAND", "base_tags": ["metal", "bludgeon", "heavy", "crushing"]},
        {"name": "Spear", "slot": "TWO_HANDED", "base_tags": ["wood", "metal", "pierce", "reach"]},
        {"name": "Shortbow", "slot": "TWO_HANDED", "base_tags": ["wood", "pierce", "ranged", "flexible"]},
        {"name": "Aether-Conduit Wand", "slot": "MAIN_HAND", "base_tags": ["aether_attuned", "magic_focus", "ranged"]},
        {"name": "Greatsword", "slot": "TWO_HANDED", "base_tags": ["metal", "cut", "slashing", "heavy", "cleaving"]}
    ],
    "ARMOR": [
        {"name": "Cuirass", "slot": "BODY", "base_tags": ["metal", "heavy_plate", "protective", "conductive"]},
        {"name": "Shield", "slot": "OFF_HAND", "base_tags": ["wood", "metal", "cover_heavy", "deflective"]},
        {"name": "Great-Helm", "slot": "HEAD", "base_tags": ["metal", "rigid", "head_protection"]},
        {"name": "Brigandine Coat", "slot": "BODY", "base_tags": ["leather", "metal", "flexible", "light_protection"]}
    ],
    "RELIC": [
        {"name": "Aether-Core Focus", "slot": "TRINKET", "base_tags": ["aether_attuned", "magic_focus", "fragile_to_null"]},
        {"name": "Clockwork Chronometer", "slot": "TRINKET", "base_tags": ["brass", "gear_conduit", "mechanical", "precision"]},
        {"name": "Null Void Sigil", "slot": "TRINKET", "base_tags": ["null_void", "anti_magic", "grounded"]},
        {"name": "Worm Cult Occult Reliquary", "slot": "TRINKET", "base_tags": ["occult", "dark", "blood_bound", "unsettling"]}
    ]
}

# --- QUALITY TIERS & RATING ECONOMY ---
QUALITY_TIERS = {
    "MUNDANE": {"rating_bonus": 1, "loadout_cost": 4, "prefix": "Rugged", "extra_tags": []},
    "FINE": {"rating_bonus": 2, "loadout_cost": 3, "prefix": "Forged", "extra_tags": ["well_balanced"]},
    "MASTERWORK": {"rating_bonus": 3, "loadout_cost": 2, "prefix": "Masterwork", "extra_tags": ["well_balanced", "durable"]},
    "CONDUCTOR_FORGED": {"rating_bonus": 4, "loadout_cost": 2, "prefix": "Sky-Conductor", "extra_tags": ["conductor_woven", "elemental_surge"]},
    "MYTHIC_RELIC": {"rating_bonus": 5, "loadout_cost": 1, "prefix": "Ancestral", "extra_tags": ["legendary", "reality_warp", "ultra_light"]}
}


class ProceduralLootEngine:
    def __init__(self):
        pass

    def generate_loot_drop(
        self,
        item_category: str = "WEAPON",
        tier: str = "CONDUCTOR_FORGED",
        conductor_metal: Optional[str] = None,
        faction_overlay: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Procedurally constructs a 1-Rating item with 5-Facet Universal Tags,
        elemental conductor properties, and loadout cost trade-offs.
        """
        if item_category not in ITEM_BASE_TYPES:
            item_category = random.choice(list(ITEM_BASE_TYPES.keys()))
        
        if tier not in QUALITY_TIERS:
            tier = "FINE"

        # Select base item
        base_item = random.choice(ITEM_BASE_TYPES[item_category])
        
        # Select Conductor Metal if applicable or random
        if not conductor_metal or conductor_metal not in CONDUCTOR_METALS:
            conductor_metal = random.choice(list(CONDUCTOR_METALS.keys()))

        metal_info = CONDUCTOR_METALS[conductor_metal]
        tier_info = QUALITY_TIERS[tier]

        # Assemble Name
        item_name = f"{tier_info['prefix']} {conductor_metal} {base_item['name']}"
        if faction_overlay:
            item_name = f"{faction_overlay} {item_name}"

        # Build 5-Facet Tag Set
        material_tags = set([conductor_metal.lower(), metal_info['damage_element']])
        for t in base_item['base_tags']:
            material_tags.add(t)

        active_tags = set(metal_info['active_tags'])
        reactive_tags = set(metal_info['reactive_tags'])
        actionable_tags = set(["equipable", "inspectable", "salvageable"])
        environmental_tags = set()

        # Add Tier & Base Tags
        for et in tier_info['extra_tags']:
            active_tags.add(et)

        # Faction overlay tag adjustments
        if faction_overlay == "Gilded Compass":
            actionable_tags.add("gilded_seal")
            material_tags.add("valuable")
        elif faction_overlay == "Ivory Gate Syndicate":
            reactive_tags.add("bone_reinforced")
            active_tags.add("spiked")
        elif faction_overlay == "Clockwork Order":
            reactive_tags.add("mechanical")
            active_tags.add("steam_venting")
        elif faction_overlay == "Worm Cult":
            active_tags.add("decaying")
            reactive_tags.add("occult_curse")
        elif faction_overlay == "Grey Warden":
            reactive_tags.add("null_attuned")
            active_tags.add("purifying")

        # Compile final Universal Tag Structure
        tag_payload = {
            "material": list(material_tags),
            "active": list(active_tags),
            "reactive": list(reactive_tags),
            "actionable": list(actionable_tags),
            "environmental": list(environmental_tags)
        }

        # Value estimation in Aetherium Coins
        base_value = tier_info['rating_bonus'] * 120
        if tier in ["CONDUCTOR_FORGED", "MYTHIC_RELIC"]:
            base_value *= 3

        return {
            "item_id": f"ITEM_{item_category}_{random.randint(1000, 9999)}",
            "name": item_name,
            "category": item_category,
            "slot": base_item['slot'],
            "tier": tier,
            "conductor_metal": conductor_metal,
            "woven_power": metal_info['woven_power'],
            "associated_attribute": metal_info['associated_attr'],
            "stats": {
                "item_rating": f"+{tier_info['rating_bonus']}",
                "loadout_cost": tier_info['loadout_cost'],
                "damage_element": metal_info['damage_element'],
                "estimated_value_gp": base_value
            },
            "description": f"A masterfully crafted {base_item['name']} forged with {metal_info['color_desc']}. Channels the primordial power of {metal_info['woven_power']}.",
            "universal_tags_5_facet": tag_payload
        }


def run_loot_generator_test():
    print("===========================================================================")
    print("💎 OSTRAKA PROCEDURAL LOOT & AETHER-RELIC GENERATOR DEMO 💎")
    print("===========================================================================\n")

    generator = ProceduralLootEngine()

    # Generate 3 representative drops across tiers and factions
    drop_1 = generator.generate_loot_drop(
        item_category="WEAPON",
        tier="CONDUCTOR_FORGED",
        conductor_metal="Silicon",
        faction_overlay="Clockwork Order"
    )

    drop_2 = generator.generate_loot_drop(
        item_category="RELIC",
        tier="MYTHIC_RELIC",
        conductor_metal="Bismuth",
        faction_overlay="Gilded Compass"
    )

    drop_3 = generator.generate_loot_drop(
        item_category="ARMOR",
        tier="FINE",
        conductor_metal="Tungsten",
        faction_overlay="Grey Warden"
    )

    drops = [drop_1, drop_2, drop_3]

    for idx, drop in enumerate(drops, 1):
        print(f"✨ [LOOT DROP {idx}]: {drop['name']}")
        print(f"  • Category: {drop['category']} ({drop['slot']}) | Tier: {drop['tier']}")
        print(f"  • Conductor Metal: {drop['conductor_metal']} ({drop['woven_power']} -> {drop['associated_attribute'].upper()})")
        print(f"  • Item Rating: {drop['stats']['item_rating']} | Loadout Cost: {drop['stats']['loadout_cost']} | Value: {drop['stats']['estimated_value_gp']} Gold")
        print(f"  • Description: \"{drop['description']}\"")
        print(f"  • 5-Facet Universal Tags:")
        print(f"    - Material: {drop['universal_tags_5_facet']['material']}")
        print(f"    - Active: {drop['universal_tags_5_facet']['active']}")
        print(f"    - Reactive: {drop['universal_tags_5_facet']['reactive']}")
        print(f"    - Actionable: {drop['universal_tags_5_facet']['actionable']}\n")


if __name__ == "__main__":
    run_loot_generator_test()
