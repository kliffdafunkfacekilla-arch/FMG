import random
from typing import Set, Dict, List, Any

# --- SOCIAL TAG TAXONOMY ---
# 1. Disposition & Mood Tags: desperate, hostile, suspicious, greedy, fearful, devout, fanatical, corrupt
# 2. Status & Role Tags: noble, outlaw, merchant, guard, beggar, scholar, diplomat, veteran
# 3. Faction & Identity Tags: gilded_compass, fuvuiku_syndicate, clockwork_order, grey_warden, worm_cult, null, sparkborn
# 4. Social Actionable Traits: bribeable, intimidatable, flatterable, blackmailable, provokable, gullible, unyielding

class NPC:
    def __init__(self, name: str, role: str, tags: List[str], charm_dc: int = 12):
        self.name = name
        self.role = role
        self.tags = set(tags)
        self.charm_dc = charm_dc
        self.disposition_level = 0 # -2 Hostile, -1 Unfriendly, 0 Neutral, +1 Friendly, +2 Allied

    def evaluate_social_action(self, actor_name: str, action_verb: str, action_tags: Set[str], roll_result: int) -> Dict[str, Any]:
        """
        Evaluates a social action (e.g. BRIBE, INTIMIDATE, PERSUADE, TAUNT) by comparing
        the action's tags + actor's tags against the NPC's social tags.
        """
        combined_tags = action_tags
        has_adv = False
        has_dis = False
        modifiers = []

        # Tag-based Advantage / Disadvantage Rules
        # Bribing a greedy/desperate NPC
        if "bribe" in action_verb.lower() and ("greedy" in self.tags or "desperate" in self.tags):
            has_adv = True
            modifiers.append("NPC is GREEDY/DESPERATE -> ADVANTAGE on Bribe")
        elif "bribe" in action_verb.lower() and ("devout" in self.tags or "unyielding" in self.tags):
            has_dis = True
            modifiers.append("NPC is DEVOUT/UNYIELDING -> DISADVANTAGE on Bribe")

        # Intimidating a fearful/beggar NPC vs noble/veteran
        if "intimidate" in action_verb.lower() and ("fearful" in self.tags or "beggar" in self.tags):
            has_adv = True
            modifiers.append("NPC is FEARFUL -> ADVANTAGE on Intimidation")
        elif "intimidate" in action_verb.lower() and ("veteran" in self.tags or "unyielding" in self.tags):
            has_dis = True
            modifiers.append("NPC is VETERAN/UNYIELDING -> DISADVANTAGE on Intimidation")

        # Faction Synergy / Hostility
        if "gilded_compass" in combined_tags and "gilded_compass" in self.tags:
            has_adv = True
            modifiers.append("Shared Faction (Gilded Compass) -> ADVANTAGE")
        elif "null_zealot" in combined_tags and "sparkborn" in self.tags:
            has_dis = True
            modifiers.append("Null Zealot vs Sparkborn -> DISADVANTAGE & Increased Hostility")

        # Resolve Roll vs DC
        effective_dc = self.charm_dc
        if has_adv and not has_dis:
            margin = roll_result - effective_dc + 3
        elif has_dis and not has_adv:
            margin = roll_result - effective_dc - 3
        else:
            margin = roll_result - effective_dc

        success = margin >= 0
        if success:
            self.disposition_level = min(2, self.disposition_level + 1)
        else:
            self.disposition_level = max(-2, self.disposition_level - 1)

        return {
            "npc": self.name,
            "action": action_verb,
            "success": success,
            "margin": margin,
            "new_disposition": self.disposition_level,
            "modifiers": modifiers,
            "active_npc_tags": list(self.tags)
        }

def run_social_sim():
    print("===========================================================================")
    print("💬 OSTRAKA SOCIAL TAG MATRIX & DYNAMIC INTERACTION SIMULATION 💬")
    print("===========================================================================\n")

    # Setup NPCs with Social Tags
    guard = NPC("Captain Kael (Guard Captain)", "Guard", ["guard", "veteran", "unyielding", "gilded_compass", "suspicious"])
    beggar = NPC("Old Maren (Market Informant)", "Beggar", ["beggar", "desperate", "greedy", "bribeable", "fearful"])
    cult_sleeper = NPC("Acolyte Vane (Sleeper Agent)", "Scholar", ["scholar", "worm_cult", "sparkborn", "provokable", "secretive"])

    print("--- NPC Registry & Social Tags ---")
    print(f" • {guard.name}: Tags = {list(guard.tags)}")
    print(f" • {beggar.name}: Tags = {list(beggar.tags)}")
    print(f" • {cult_sleeper.name}: Tags = {list(cult_sleeper.tags)}\n")

    # Scenario 1: Bribing the Desperate Beggar with Gold / Food
    print("🎭 Scenario 1: Player attempts 'BRIBE' on Old Maren (Beggar)")
    res1 = beggar.evaluate_social_action("Player", "BRIBE", {"gold_offering", "food"}, roll_result=11)
    print(f"  └─► Success: {res1['success']} | Margin: {res1['margin']} | New Disposition Level: {res1['new_disposition']}")
    print(f"  └─► Tag Modifiers applied: {res1['modifiers']}\n")

    # Scenario 2: Intimidating the Veteran Guard Captain
    print("🎭 Scenario 2: Player attempts 'INTIMIDATE' on Captain Kael (Veteran Guard)")
    res2 = guard.evaluate_social_action("Player", "INTIMIDATE", {"might_flex", "weapon_drawn"}, roll_result=14)
    print(f"  └─► Success: {res2['success']} | Margin: {res2['margin']} | New Disposition Level: {res2['new_disposition']}")
    print(f"  └─► Tag Modifiers applied: {res2['modifiers']}\n")

    # Scenario 3: Faction Alignment Check (Gilded Compass Member talking to Guard Captain)
    print("🎭 Scenario 3: Gilded Compass Diplomat attempts 'PERSUADE' on Captain Kael")
    res3 = guard.evaluate_social_action("Diplomat Vael", "PERSUADE", {"gilded_compass", "official_seal"}, roll_result=12)
    print(f"  └─► Success: {res3['success']} | Margin: {res3['margin']} | New Disposition Level: {res3['new_disposition']}")
    print(f"  └─► Tag Modifiers applied: {res3['modifiers']}\n")

if __name__ == "__main__":
    run_social_sim()
