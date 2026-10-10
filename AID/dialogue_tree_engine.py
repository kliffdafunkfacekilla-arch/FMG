import random
from typing import Dict, List, Set, Any, Tuple

class SocialNPC:
    def __init__(self, npc_id: str, name: str, role: str, tags: List[str], disposition: int = 0, resistance: int = 10):
        self.npc_id = npc_id
        self.name = name
        self.role = role
        self.tags = set(tags)
        self.disposition = disposition  # -2: Hostile, -1: Unfriendly, 0: Neutral, 1: Friendly, 2: Allied
        self.resistance = resistance    # Interrogation Willpower threshold
        self.suspicion = 0
        self.disclosed_secrets = []

class DialogueOption:
    def __init__(self, option_id: str, label: str, action_type: str, required_player_tags: List[str] = None, required_npc_tags: List[str] = None):
        self.option_id = option_id
        self.label = label
        self.action_type = action_type # BRIBE, INTIMIDATE, PERSUADE, FACTION_APPEAL, EXPOSE_HERESY, REASON
        self.required_player_tags = set(required_player_tags or [])
        self.required_npc_tags = set(required_npc_tags or [])

class DialogueTreeManager:
    def __init__(self):
        self.master_options = [
            DialogueOption(
                "opt_bribe_gold", 
                "Offer 15 Aetherium Coins for information.", 
                "BRIBE", 
                required_player_tags=["gold"], 
                required_npc_tags=["bribeable"]
            ),
            DialogueOption(
                "opt_bribe_food", 
                "Hand over a warm ration bundle.", 
                "BRIBE", 
                required_player_tags=["food"], 
                required_npc_tags=["desperate"]
            ),
            DialogueOption(
                "opt_intimidate_force", 
                "Slam your weapon on the table and demand answers.", 
                "INTIMIDATE", 
                required_player_tags=["metal"], 
                required_npc_tags=[]
            ),
            DialogueOption(
                "opt_faction_compass", 
                "Present the Fulcrum Bank Official Writ.", 
                "FACTION_APPEAL", 
                required_player_tags=["gilded_compass", "official_seal"], 
                required_npc_tags=["gilded_compass"]
            ),
            DialogueOption(
                "opt_expose_heresy", 
                "Confront them with forbidden Worm Cult sigils.", 
                "EXPOSE_HERESY", 
                required_player_tags=["occult_knowledge"], 
                required_npc_tags=["worm_cult"]
            ),
            DialogueOption(
                "opt_logic_appeal", 
                "Explain how cooperation protects the burg's remaining reserves.", 
                "REASON", 
                required_player_tags=[], 
                required_npc_tags=["scholar"]
            )
        ]

    def generate_available_dialogue(self, player_tags: Set[str], npc: SocialNPC) -> List[Dict[str, Any]]:
        available = []
        for opt in self.master_options:
            # Check player requirements
            if not opt.required_player_tags.issubset(player_tags):
                continue
            
            # Evaluate Tag Advantages / Disadvantages
            advantage = False
            disadvantage = False
            notes = []

            if opt.action_type == "BRIBE":
                if "greedy" in npc.tags or "desperate" in npc.tags:
                    advantage = True
                    notes.append("NPC is GREEDY/DESPERATE (+2 to Bribe)")
            elif opt.action_type == "INTIMIDATE":
                if "veteran" in npc.tags or "unyielding" in npc.tags:
                    disadvantage = True
                    notes.append("NPC is VETERAN/UNYIELDING (-2 Penalty & Risk of Escalation)")
                if "fearful" in npc.tags or "fragile" in npc.tags:
                    advantage = True
                    notes.append("NPC is FEARFUL/FRAGILE (+2 to Intimidation)")
            elif opt.action_type == "FACTION_APPEAL":
                if "gilded_compass" in npc.tags and "gilded_compass" in player_tags:
                    advantage = True
                    notes.append("Shared Faction Authority (+3 Alignment Bonus)")
            elif opt.action_type == "EXPOSE_HERESY":
                if "worm_cult" in npc.tags:
                    advantage = True
                    notes.append("Target is SECRET CULTIST! Breaks resistance pool directly.")

            available.append({
                "option_id": opt.option_id,
                "label": opt.label,
                "action_type": opt.action_type,
                "advantage": advantage,
                "disadvantage": disadvantage,
                "notes": notes
            })
        return available

    def execute_dialogue_choice(self, option_id: str, player_tags: Set[str], player_charm_mod: int, npc: SocialNPC) -> Dict[str, Any]:
        options = {o.option_id: o for o in self.master_options}
        opt = options.get(option_id)
        if not opt:
            return {"error": "Invalid option selected"}

        # Roll 2d20 for Advantage/Disadvantage
        r1, r2 = random.randint(1, 20), random.randint(1, 20)
        
        # Evaluate Tag Modifiers
        has_adv = False
        has_dis = False
        if opt.action_type == "BRIBE" and ("greedy" in npc.tags or "desperate" in npc.tags):
            has_adv = True
        if opt.action_type == "INTIMIDATE" and ("veteran" in npc.tags or "unyielding" in npc.tags):
            has_dis = True
        if opt.action_type == "FACTION_APPEAL" and ("gilded_compass" in npc.tags):
            has_adv = True

        if has_adv and not has_dis:
            d20_val = max(r1, r2)
            roll_type = f"d20 ADV ({r1}, {r2})"
        elif has_dis and not has_adv:
            d20_val = min(r1, r2)
            roll_type = f"d20 DIS ({r1}, {r2})"
        else:
            d20_val = r1
            roll_type = f"d20 ({r1})"

        total_roll = d20_val + player_charm_mod
        margin = total_roll - npc.resistance

        outcome = {
            "option_executed": opt.label,
            "roll_type": roll_type,
            "total_roll": total_roll,
            "target_resistance": npc.resistance,
            "margin": margin,
            "success": margin >= 0
        }

        if margin >= 0:
            npc.resistance -= max(2, margin)
            npc.disposition = min(2, npc.disposition + 1)
            
            if opt.action_type == "EXPOSE_HERESY":
                npc.disclosed_secrets.append("Revealed location of subterranean Worm Cult ritual site in Old Aqueduct!")
                outcome["disclosure"] = "CRITICAL DISCLOSURE: 'I... I only took their coin to feed my family! The ritual site is in the Old Aqueduct under Tile (120, 85)!'"
            elif opt.action_type == "BRIBE":
                npc.disclosed_secrets.append("Gave warehouse key and guard shift schedule.")
                outcome["disclosure"] = "DISCLOSURE: 'Take the side key. Guard captain changes watch at bell three.'"
            elif opt.action_type == "FACTION_APPEAL":
                npc.disclosed_secrets.append("Authorized passage through city gates.")
                outcome["disclosure"] = "DISCLOSURE: 'By order of the Fulcrum Bank, gate cleared. Move along.'"
            else:
                outcome["disclosure"] = "DISCLOSURE: NPC agrees to cooperate."
        else:
            npc.suspicion += 2
            if opt.action_type == "INTIMIDATE" and "unyielding" in npc.tags:
                npc.disposition = max(-2, npc.disposition - 2)
                outcome["backlash"] = "BACKLASH: Captain Kael snaps! 'You dare threaten a veteran of the Caldera Siege? Guards, seize them!'"
            else:
                outcome["backlash"] = "NPC closes up and refuses to speak further."

        return outcome

def run_test():
    print("===========================================================================")
    print("💬 OSTRAKA DYNAMIC DIALOGUE & INTERROGATION TREE ENGINE 💬")
    print("===========================================================================\n")

    tree_mgr = DialogueTreeManager()

    # Create NPCs with distinct social tags
    maren = SocialNPC("npc_maren", "Old Maren", "Beggar Informant", ["desperate", "greedy", "beggar", "bribeable"], disposition=-1, resistance=10)
    kael = SocialNPC("npc_kael", "Captain Kael", "Guard Captain", ["veteran", "unyielding", "guard", "gilded_compass"], disposition=0, resistance=14)
    vane = SocialNPC("npc_vane", "Acolyte Vane", "Sleeper Cultist", ["secretive", "scholar", "worm_cult", "sparkborn"], disposition=-1, resistance=16)

    # Player Profile 1: Rogue Trader
    player_rogue_tags = {"gold", "food", "metal", "gilded_compass", "official_seal", "occult_knowledge"}
    player_charm = 3

    print("--- Scenario 1: Interrogating Old Maren (Beggar) ---")
    opts_maren = tree_mgr.generate_available_dialogue(player_rogue_tags, maren)
    print(f"Available Options for {maren.name}:")
    for o in opts_maren:
        print(f" • [{o['action_type']}] {o['label']} (Advantage: {o['advantage']} | Disadvantage: {o['disadvantage']})")
        if o['notes']:
            print(f"   └─► Tag Rule: {o['notes'][0]}")

    res_maren = tree_mgr.execute_dialogue_choice("opt_bribe_food", player_rogue_tags, player_charm, maren)
    print(f"\nExecution Result: {res_maren['option_executed']}")
    print(f"  Roll: {res_maren['roll_type']} + {player_charm} = {res_maren['total_roll']} vs Resistance {res_maren['target_resistance']}")
    print(f"  Outcome: {res_maren.get('disclosure', res_maren.get('backlash'))}\n")

    print("--- Scenario 2: Intimidating vs Appealing to Captain Kael (Veteran Guard) ---")
    opts_kael = tree_mgr.generate_available_dialogue(player_rogue_tags, kael)
    print(f"Available Options for {kael.name}:")
    for o in opts_kael:
        print(f" • [{o['action_type']}] {o['label']} (Advantage: {o['advantage']} | Disadvantage: {o['disadvantage']})")
        if o['notes']:
            print(f"   └─► Tag Rule: {o['notes'][0]}")

    res_kael = tree_mgr.execute_dialogue_choice("opt_faction_compass", player_rogue_tags, player_charm, kael)
    print(f"\nExecution Result: {res_kael['option_executed']}")
    print(f"  Roll: {res_kael['roll_type']} + {player_charm} = {res_kael['total_roll']} vs Resistance {res_kael['target_resistance']}")
    print(f"  Outcome: {res_kael.get('disclosure', res_kael.get('backlash'))}\n")

    print("--- Scenario 3: Interrogating Acolyte Vane (Sleeper Cultist) ---")
    opts_vane = tree_mgr.generate_available_dialogue(player_rogue_tags, vane)
    print(f"Available Options for {vane.name}:")
    for o in opts_vane:
        print(f" • [{o['action_type']}] {o['label']} (Advantage: {o['advantage']} | Disadvantage: {o['disadvantage']})")
        if o['notes']:
            print(f"   └─► Tag Rule: {o['notes'][0]}")

    res_vane = tree_mgr.execute_dialogue_choice("opt_expose_heresy", player_rogue_tags, player_charm, vane)
    print(f"\nExecution Result: {res_vane['option_executed']}")
    print(f"  Roll: {res_vane['roll_type']} + {player_charm} = {res_vane['total_roll']} vs Resistance {res_vane['target_resistance']}")
    print(f"  Outcome: {res_vane.get('disclosure', res_vane.get('backlash'))}\n")

if __name__ == "__main__":
    run_test()
