"""
OSTRAKA 12-BASED CHARACTER PROGRESSION ENGINE
=============================================
Encodes the 1-12 Attribute & Level Scale, 12 Level Milestones,
48 Track Registries (Sparkborn Power, Null Discipline, Mundane Offense, Mundane Defense),
and Rank 1-4 Effect Scaling.
"""

import json
from typing import Dict, List, Any, Optional

# --- 12-BASED ATTRIBUTE & LEVEL QUALITATIVE SCALE ---
ATTRIBUTE_SCALE_12 = {
    1: "Barely functional",
    2: "Flawed / Below Average",
    3: "Average Baseline (Commoner)",
    4: "Average Baseline (Seasoned)",
    5: "Skilled (Professional)",
    6: "Skilled (Veteran)",
    7: "Elite (Specialist)",
    8: "Elite (Master Craftsman)",
    9: "Master (Champion)",
    10: "Master (Apex Leader)",
    11: "Legendary (Mythic Tier)",
    12: "Ascendant (Cosmic Reality Anchor)"
}

# --- 12 LEVEL MILESTONES & CAP MATRIX ---
LEVEL_MILESTONES_12 = [
    {"level": 1, "title": "Initiate / Novice", "stat_cap": 4, "rank_unlock": "Rank 1 (Base Effect Unlocked +1 Mod)", "trigger": "Character Creation"},
    {"level": 2, "title": "Adept", "stat_cap": 5, "rank_unlock": "Rank 1 Enhancement", "trigger": "Complete Chapter 1"},
    {"level": 3, "title": "Operative", "stat_cap": 6, "rank_unlock": "Rank 2 (Loadout Cost Reduction)", "trigger": "Secure Safehaven"},
    {"level": 4, "title": "Incanter / Veteran", "stat_cap": 6, "rank_unlock": "Rank 2 Enhancement", "trigger": "Defeat Sector Threat"},
    {"level": 5, "title": "Sorcerer / Specialist", "stat_cap": 7, "rank_unlock": "Rank 3 (Expanded Range & AoE +2 Mod)", "trigger": "Uncover Major World Secret"},
    {"level": 6, "title": "Master", "stat_cap": 8, "rank_unlock": "Rank 3 Enhancement", "trigger": "Survive Regional Chaos Surge"},
    {"level": 7, "title": "Arch-Adept", "stat_cap": 8, "rank_unlock": "Rank 4 (Master Threshold Perk)", "trigger": "Purge High-Chaos Anomaly"},
    {"level": 8, "title": "Champion", "stat_cap": 9, "rank_unlock": "Rank 4 Enhancement", "trigger": "Conquer Sector Boss"},
    {"level": 9, "title": "Paragon / Ley-Lord", "stat_cap": 10, "rank_unlock": "Dual-Track Synergy", "trigger": "Forge Inter-Faction Alliance"},
    {"level": 10, "title": "Vanguard Prime", "stat_cap": 10, "rank_unlock": "Absolute Exemption", "trigger": "Stave Off Regional Collapse"},
    {"level": 11, "title": "Mythic Weaver", "stat_cap": 11, "rank_unlock": "Cosmic Resonance", "trigger": "Seal Primordial Dragon Leyline"},
    {"level": 12, "title": "Ascendant / Apex Entity", "stat_cap": 12, "rank_unlock": "Reality Anchor (All Tracks Maxed)", "trigger": "Resolve World Narrative Arc"}
]


class CharacterProgression12:
    def __init__(self, character_name: str, path_type: str = "SPARKBORN"):
        self.character_name = character_name
        self.path_type = path_type  # SPARKBORN or NULL
        self.current_level = 1
        
        # 12 Base Attributes (Scaled 1-12)
        self.attributes = {
            "might": 4, "endurance": 3, "finesse": 4, "reflex": 4,
            "vitality": 4, "fortitude": 3, "knowledge": 4, "logic": 3,
            "awareness": 4, "intuition": 3, "charm": 3, "willpower": 3
        }
        
        # Track Progressions (48 Total Tracks: 4 per Attribute)
        # Each track contains 3 effects scaling Rank 1 -> 4
        self.active_track_ranks: Dict[str, int] = {}

    def get_level_info(self) -> Dict[str, Any]:
        return LEVEL_MILESTONES_12[self.current_level - 1]

    def advance_level(self, milestone_achieved: str) -> Dict[str, Any]:
        if self.current_level >= 12:
            return {"status": "MAX_LEVEL", "message": f"{self.character_name} is already at Level 12 (Ascendant)!"}
        
        self.current_level += 1
        info = self.get_level_info()
        return {
            "status": "LEVEL_UP_SUCCESS",
            "new_level": self.current_level,
            "title": info["title"],
            "new_stat_cap": info["stat_cap"],
            "rank_unlock": info["rank_unlock"],
            "milestone": milestone_achieved
        }

    def upgrade_track_effect(self, track_name: str) -> Dict[str, Any]:
        current_rank = self.active_track_ranks.get(track_name, 0)
        if current_rank >= 4:
            return {"status": "MAX_RANK", "message": f"Track {track_name} is already at Rank 4 (Master Threshold)!"}
        
        self.active_track_ranks[track_name] = current_rank + 1
        new_rank = self.active_track_ranks[track_name]
        
        perk_description = {
            1: "Rank 1: Unlocked Base Effect (+1 Gear/Roll Modifier)",
            2: "Rank 2: Loadout Cost Reduction (Reduces Stamina/Focus Tax)",
            3: "Rank 3: Advanced Range/Strength/AoE Expansion (+2 Roll Modifier)",
            4: "Rank 4: Master Threshold Perk (Advantage Negation / Immunity)"
        }[new_rank]

        return {
            "status": "RANK_UP_SUCCESS",
            "track_name": track_name,
            "new_rank": new_rank,
            "perk": perk_description
        }

    def export_summary(self) -> Dict[str, Any]:
        info = self.get_level_info()
        return {
            "character_name": self.character_name,
            "path_type": self.path_type,
            "current_level": self.current_level,
            "title": info["title"],
            "attribute_cap": info["stat_cap"],
            "attributes": self.attributes,
            "active_track_ranks": self.active_track_ranks
        }


def run_progression_demo():
    print("===========================================================================")
    print("📈 OSTRAKA 12-BASED PROGRESSION ENGINE DEMO 📈")
    print("===========================================================================\n")

    char = CharacterProgression12("Ignis the Sparkborn", "SPARKBORN")
    print(f"Loaded Character: {char.character_name} | Level {char.current_level} ({char.get_level_info()['title']})")
    print(f"Current Stat Cap: {char.get_level_info()['stat_cap']} (Scale 1-12)")

    # Simulate Level Up
    print("\nSimulating Level Ups across Milestones...")
    for lvl in range(2, 13):
        res = char.advance_level(f"Completed Milestone {lvl}")
        print(f"  • Advanced to Level {res['new_level']} ({res['title']}) | New Stat Cap: {res['new_stat_cap']} | Rank Unlocked: {res['rank_unlock']}")

    # Upgrade a Track
    print("\nUpgrading Track 'Mass_Power_Mass_Acceleration'...")
    for _ in range(4):
        rank_res = char.upgrade_track_effect("Mass_Power_Mass_Acceleration")
        print(f"  • {rank_res['track_name']} -> {rank_res['perk']}")


if __name__ == "__main__":

    run_progression_demo()
