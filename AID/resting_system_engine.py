"""
OSTRAKA UNIFIED RESTING & CAMP SKILL ENGINE
===========================================
Implements the unified resting mechanics where camping in the wild and staying at an inn 
follow the exact same core recovery rules. Injury and trauma regeneration are scaled 
by 3 party skill check components executed during the rest:

1. Meal Component (Cooking / Survival) -> Buffs HP/Stamina recovery rate
2. Security Rating (Tactics / Perception) -> Ensures safety margin & mitigates ambushes
3. Entertainment Factor (Performance / Charm / Lore) -> Boosts Composure/Focus & grants skill check bonuses
"""

import random
from typing import Dict, List, Any


class PartyMemberRestContribution:
    def __init__(self, name: str, skill_name: str, roll_result: int, difficulty_class: int = 12):
        self.name = name
        self.skill_name = skill_name
        self.roll_result = roll_result
        self.difficulty_class = difficulty_class
        self.is_success = roll_result >= difficulty_class
        self.margin = roll_result - difficulty_class


class UnifiedRestSession:
    def __init__(self, location_name: str, location_type: str = "CAMPING"): # CAMPING or INN
        self.location_name = location_name
        self.location_type = location_type
        self.meal_tier = "Basic Rations"
        self.security_level = "Unguarded"
        self.entertainment_level = "Quiet Rest"

    def resolve_rest_checks(
        self,
        cooking_check: PartyMemberRestContribution,
        security_check: PartyMemberRestContribution,
        entertainment_check: PartyMemberRestContribution
    ) -> Dict[str, Any]:
        """
        Resolves the 3 party skill checks to determine injury regeneration rates 
        and party-wide skill check bonuses for the following day.
        """
        # 1. Meal Component Calculation
        meal_bonus = 0
        if cooking_check.is_success:
            if cooking_check.margin >= 5:
                self.meal_tier = "Gourmet Feast (+3 HP/Turn Regen, +20% Injury Healing)"
                meal_bonus = 3
            else:
                self.meal_tier = "Hearty Stew (+2 HP/Turn Regen, +10% Injury Healing)"
                meal_bonus = 2
        else:
            self.meal_tier = "Meager Rations (Standard Recovery)"
            meal_bonus = 0

        # 2. Security Rating Calculation
        security_bonus = 0
        ambush_chance = 0.0
        if security_check.is_success:
            if security_check.margin >= 5:
                self.security_level = "Fortified Perimeter (0% Ambush Chance, Deep Sleep Granted)"
                ambush_chance = 0.0
                security_bonus = 2
            else:
                self.security_level = "Secured Watch (5% Ambush Chance)"
                ambush_chance = 0.05
                security_bonus = 1
        else:
            self.security_level = "Vulnerable Camp (25% Ambush Chance)"
            ambush_chance = 0.25
            security_bonus = 0

        # 3. Entertainment Factor Calculation (Grants party-wide skill bonuses)
        party_skill_bonus = 0
        if entertainment_check.is_success:
            if entertainment_check.margin >= 5:
                self.entertainment_level = "Masterful Campfire Performance (+2 to ALL Skill Checks Next Day)"
                party_skill_bonus = 2
            else:
                self.entertainment_level = "Encouraging Tales (+1 to ALL Skill Checks Next Day)"
                party_skill_bonus = 1
        else:
            self.entertainment_level = "Somber Silence (No Skill Bonus)"
            party_skill_bonus = 0

        # Injury & Trauma Regeneration Metrics
        base_injury_regen = 25 # Base 25% injury repair per rest
        total_injury_regen = base_injury_regen + (meal_bonus * 5) + (security_bonus * 5)

        return {
            "location": f"{self.location_name} ({self.location_type})",
            "meal_component": {
                "chef": cooking_check.name,
                "skill": cooking_check.skill_name,
                "roll": cooking_check.roll_result,
                "result_tier": self.meal_tier
            },
            "security_rating": {
                "sentry": security_check.name,
                "skill": security_check.skill_name,
                "roll": security_check.roll_result,
                "status": self.security_level,
                "ambush_chance_percent": int(ambush_chance * 100)
            },
            "entertainment_factor": {
                "performer": entertainment_check.name,
                "skill": entertainment_check.skill_name,
                "roll": entertainment_check.roll_result,
                "tier": self.entertainment_level,
                "party_skill_check_buff": f"+{party_skill_bonus} to all party skill rolls"
            },
            "injury_regeneration_rate": f"{total_injury_regen}% of max health/trauma repaired",
            "next_day_party_buffs": {
                "all_skill_checks_bonus": party_skill_bonus,
                "injury_recovery_multiplier": 1.0 + (meal_bonus * 0.1)
            }
        }


def run_rest_demo():
    print("===========================================================================")
    print("🏕️ OSTRAKA UNIFIED RESTING & CAMP SKILL ENGINE DEMO 🏕️")
    print("===========================================================================\n")

    rest = UnifiedRestSession("Excelsis Foothills Campsite", location_type="WILDERNESS_CAMP")

    # Party Skill Checks during Camp
    chef_roll = PartyMemberRestContribution("Jordan", "Survival (Cooking)", roll_result=17, difficulty_class=12) # Success +5
    sentry_roll = PartyMemberRestContribution("Alex", "Tactics (Fortification)", roll_result=14, difficulty_class=12) # Success +2
    bard_roll = PartyMemberRestContribution("Kaelen", "Performance (Storytelling)", roll_result=18, difficulty_class=12) # Success +6

    results = rest.resolve_rest_checks(chef_roll, sentry_roll, bard_roll)

    print(f"📍 Location: {results['location']}")
    print(f"🍲 Meal Component: {results['meal_component']['result_tier']}")
    print(f"🛡️ Security Rating: {results['security_rating']['status']}")
    print(f"🎭 Entertainment Factor: {results['entertainment_factor']['tier']}")
    print(f"❤️ Injury Regeneration Rate: {results['injury_regeneration_rate']}")
    print(f"✨ Party Buff Next Day: {results['entertainment_factor']['party_skill_check_buff']}")


if __name__ == "__main__":
    run_rest_demo()
