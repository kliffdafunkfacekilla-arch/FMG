# rules_engine/skills_data.py

# The Passive Hardware (Assault & Aegis)
# Refactored for the Functional Effects Engine
PASSIVE_HARDWARE = {
    "might": {
        "Assault": {
            "T1": {
                "name": "Drive Back",
                "type": "ACTIVE",
                "cost": {"stamina": 1},
                "effects": [
                    {"type": "DAMAGE", "base": "might", "tags": ["impact", "brutal"]},
                    {"type": "MOVE", "target": "enemy", "distance": 1}
                ]
            },
            "T2": {
                "name": "-1 S-Die",
                "type": "PASSIVE",
                "effects": [
                    {"type": "MODIFY_RULE", "rule": "stamina_cost", "value": -1}
                ]
            },
            "T3": {
                "name": "Cleave",
                "type": "ACTIVE",
                "cost": {"stamina": 1},
                "effects": [
                    {"type": "DAMAGE", "base": "might", "tags": ["slashing"]},
                    {"type": "APPLY_TAG", "target": "enemy", "tag": "bleeding"}
                ]
            },
            "T7": {
                "name": "Broken Armor",
                "type": "ACTIVE",
                "cost": {"stamina": 2},
                "effects": [
                    {"type": "APPLY_TAG", "target": "enemy", "tag": "exposed"}
                ]
            }
        }
    }
}

# Subconscious Magic (Active Martial Tactics)
SUBCONSCIOUS_MAGIC = {
    "The Wrangler": {
        "T1": {
            "name": "The Basic (Grapple/Throw)",
            "type": "ACTIVE",
            "cost": {"stamina": 1, "focus": 1},
            "effects": [
                {"type": "APPLY_TAG", "target": "enemy", "tag": "grappled"},
                {"type": "MOVE", "target": "enemy", "distance": 1},
                {"type": "DAMAGE", "base": "might", "tags": ["impact"]}
            ]
        },
        "T9": {
            "name": "Orbital Drop",
            "type": "ACTIVE",
            "cost": {"stamina": 5, "focus": 5},
            "effects": [
                {"type": "DAMAGE", "base": "might", "tags": ["impact", "brutal", "lethal"]},
                {"type": "APPLY_TAG", "target": "enemy", "tag": "prone"}
            ]
        }
    },
    "The Sponge": {
        "T1": {
            "name": "Brace",
            "type": "ACTIVE",
            "cost": {"stamina": 1, "focus": 1},
            "effects": [
                {"type": "APPLY_TAG", "target": "self", "tag": "braced"},
                {"type": "MODIFY_RULE", "rule": "defense_bonus", "value": 4}
            ]
        }
    }
}

# The Anomalies
ANOMALIES = {
    "Mass": {
        "T1": {
            "name": "Rooted (P1) + Slowed (K1)",
            "type": "ACTIVE",
            "cost": {"stamina": 2, "focus": 2},
            "effects": [
                {"type": "APPLY_TAG", "target": "enemy", "tag": "slowed"},
                {"type": "APPLY_TAG", "target": "self", "tag": "rooted"}
            ]
        }
    },
    "Nexus": {
        "T1": {
            "name": "Thermal Plating (P1) + Burn (K1)",
            "type": "ACTIVE",
            "cost": {"stamina": 2, "focus": 2},
            "effects": [
                {"type": "APPLY_TAG", "target": "self", "tag": "thermal_plating"},
                {"type": "APPLY_TAG", "target": "enemy", "tag": "fire"},
                {"type": "DAMAGE", "base": "knowledge", "tags": ["fire"]}
            ]
        }
    }
}
