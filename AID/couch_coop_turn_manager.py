"""
OSTRAKA COUCH CO-OP & MULTI-PLAYER TURN MANAGER
================================================
Manages local couch co-op seats (Controllers P1-P4), initiative turn rotation, 
action point / stamina economy, voice-to-text (STT) natural language intent parsing, 
reaction opportunity prompts, and real-time AI DM narrative generation.
"""

import json
import random
from typing import Dict, List, Any, Optional, Tuple


class CouchPlayerSeat:
    def __init__(self, seat_id: str, player_name: str, controller_index: int, character_data: Dict[str, Any]):
        self.seat_id = seat_id                    # e.g. "P1", "P2"
        self.player_name = player_name            # e.g. "Alex", "Sam"
        self.controller_index = controller_index  # e.g. Port 0, 1, 2, 3
        self.character_name = character_data.get("name", "Unknown Hero")
        self.character_id = character_data.get("id", "char_0")
        self.might = character_data.get("might", 2)
        self.finesse = character_data.get("finesse", 3)
        self.reflex = character_data.get("reflex", 3)
        self.willpower = character_data.get("willpower", 2)
        self.hp = character_data.get("hp", 30)
        self.max_hp = character_data.get("max_hp", 30)
        self.stamina = character_data.get("stamina", 20)
        self.max_stamina = character_data.get("max_stamina", 20)
        self.tags = set(character_data.get("tags", ["organic"]))
        self.is_null = character_data.get("is_null", False)
        self.active_status = set()

    def get_action_budget(self) -> Dict[str, int]:
        return {
            "movement_actions": 1,  # 30ft standard move
            "standard_actions": 1,  # Strike, Spell, Major Prop Interaction
            "quick_actions": 1,     # Draw item, Shout, Minor Tag trigger
            "reaction_actions": 1   # Opportunity strike, Null Exemption, Dodge
        }

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "seat": self.seat_id,
            "player": self.player_name,
            "controller": f"Port {self.controller_index}",
            "character": self.character_name,
            "hp": f"{self.hp}/{self.max_hp}",
            "stamina": f"{self.stamina}/{self.max_stamina}",
            "is_null": self.is_null,
            "tags": list(self.tags | self.active_status)
        }


class TurnManager:
    def __init__(self):
        self.seats: List[CouchPlayerSeat] = []
        self.turn_queue: List[Dict[str, Any]] = [] # Sorted by initiative roll
        self.current_turn_index: int = 0
        self.round_number: int = 1
        self.turn_log: List[Dict[str, Any]] = []

    def register_seat(self, seat: CouchPlayerSeat):
        self.seats.append(seat)
        print(f"🎮 [SEAT CONNECTED]: {seat.seat_id} ({seat.player_name}) bound to Controller Port {seat.controller_index} -> Character: {seat.character_name}")

    def roll_initiative_round(self, npc_actors: List[Dict[str, Any]]):
        """
        Rolls initiative (Reflex + d20) for all registered player seats and NPC actors.
        Sorts turn queue descending.
        """
        self.turn_queue = []
        
        # Roll for Players
        for seat in self.seats:
            roll = random.randint(1, 20)
            init_score = roll + seat.reflex
            self.turn_queue.append({
                "type": "PLAYER",
                "id": seat.seat_id,
                "name": seat.character_name,
                "player_name": seat.player_name,
                "seat_obj": seat,
                "init_score": init_score,
                "roll_detail": f"d20({roll}) + Reflex({seat.reflex}) = {init_score}"
            })
            
        # Roll for NPCs
        for npc in npc_actors:
            roll = random.randint(1, 20)
            reflex = npc.get("reflex", 2)
            init_score = roll + reflex
            self.turn_queue.append({
                "type": "NPC",
                "id": npc.get("id", "npc_0"),
                "name": npc.get("name", "Hostile Guard"),
                "seat_obj": None,
                "init_score": init_score,
                "roll_detail": f"d20({roll}) + Reflex({reflex}) = {init_score}"
            })

        # Sort queue descending by initiative score
        self.turn_queue.sort(key=lambda x: x["init_score"], reverse=True)
        self.current_turn_index = 0
        
        print(f"\n🎲 [INITIATIVE ROLLED - ROUND {self.round_number}]:")
        for idx, entry in enumerate(self.turn_queue, 1):
            tag = f"[{entry['id']}]" if entry['type'] == "PLAYER" else "[NPC]"
            print(f"  {idx}. {tag} {entry['name']} -> Score: {entry['init_score']} ({entry['roll_detail']})")

    def get_active_actor(self) -> Dict[str, Any]:
        return self.turn_queue[self.current_turn_index]

    def parse_voice_stt_intent(self, raw_stt_transcript: str) -> Dict[str, Any]:
        """
        Simulates parsing natural language STT voice input from couch co-op player microphone 
        into structured game engine action primitives.
        """
        text = raw_stt_transcript.lower()
        actions = []
        action_tags = []
        target = "ENVIRONMENT"
        
        if "vault" in text or "jump" in text or "move" in text:
            actions.append("MOVE_VAULT")
            action_tags.append("climbable")
        if "slice" in text or "cut" in text or "slash" in text or "sever" in text:
            actions.append("SEVER_PROP")
            action_tags.extend(["cut", "slashing", "severable"])
        if "shoot" in text or "fire" in text or "cast" in text or "arc" in text:
            actions.append("CAST_SPELL")
            action_tags.extend(["electric", "shocking"])
        if "shout" in text or "warn" in text or "tell" in text:
            actions.append("COMMUNICATE")
            action_tags.append("social_taunt")

        if "chandelier" in text:
            target = "Brass Chandelier"
        elif "table" in text:
            target = "Oak Dining Table"
        elif "heresiarch" in text or "malakor" in text or "cultist" in text:
            target = "Heresiarch Malakor"
        elif "guard" in text or "kael" in text:
            target = "Captain Kael"

        return {
            "raw_transcript": raw_stt_transcript,
            "parsed_actions": actions if actions else ["STANDARD_ATTACK"],
            "action_tags": action_tags,
            "target": target
        }

    def execute_player_turn(self, seat: CouchPlayerSeat, stt_transcript: str) -> Dict[str, Any]:
        parsed_intent = self.parse_voice_stt_intent(stt_transcript)
        
        # Calculate Stamina / Action consumption
        stamina_cost = 2 if "MOVE_VAULT" in parsed_intent["parsed_actions"] else 0
        if "SEVER_PROP" in parsed_intent["parsed_actions"]:
            stamina_cost += 3
            
        seat.stamina = max(0, seat.stamina - stamina_cost)
        
        # Build AI DM Narrative Context
        narrative_prompt = (
            f"You are AI DM in Couch Co-Op mode. Active Player: {seat.player_name} controlling {seat.character_name} ({seat.seat_id}). "
            f"Voice Input: '{stt_transcript}'. Executed Actions: {parsed_intent['parsed_actions']} targeting {parsed_intent['target']}. "
            f"Tags Triggered: {parsed_intent['action_tags']}. Stamina remaining: {seat.stamina}/{seat.max_stamina}. "
            f"Describe the dynamic action smoothly in 2 second-person cinematic sentences."
        )
        
        # Generate Narrative Output
        ai_narration = (
            f"'{seat.character_name} vaults effortlessly across the obstacle, drawing their blade to sever the {parsed_intent['target']}'s support! "
            f"The metallic ringing echoes across the room as the object collapses onto the grid, igniting spark embers below!'"
        )

        turn_result = {
            "round": self.round_number,
            "seat_id": seat.seat_id,
            "character_name": seat.character_name,
            "stt_input": stt_transcript,
            "parsed_intent": parsed_intent,
            "stamina_drained": stamina_cost,
            "stamina_remaining": seat.stamina,
            "ai_narration": ai_narration
        }
        
        self.turn_log.append(turn_result)
        return turn_result

    def check_reaction_opportunities(self, triggering_action: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Checks all non-active player seats for potential Reaction triggers 
        (e.g., Null Exemption, Opportunity Parrying, Defensive Intercept).
        """
        reaction_prompts = []
        active_seat_id = triggering_action.get("seat_id")
        
        for seat in self.seats:
            if seat.seat_id == active_seat_id:
                continue
                
            # Null character reaction trigger
            if seat.is_null and "CAST_SPELL" in triggering_action["parsed_intent"]["parsed_actions"]:
                reaction_prompts.append({
                    "seat_id": seat.seat_id,
                    "player_name": seat.player_name,
                    "character_name": seat.character_name,
                    "reaction_type": "NULL_EXEMPTION_SHIELD",
                    "prompt_text": f"⚡ [REACTION PROMPT for {seat.seat_id} ({seat.player_name})]: Enemy spellcast detected! Activate Ontological Null Void to cancel spell tags in 15ft radius?"
                })
            # Physical parry / cover reaction trigger
            elif "climbable" in triggering_action["parsed_intent"]["action_tags"] or "cut" in triggering_action["parsed_intent"]["action_tags"]:
                reaction_prompts.append({
                    "seat_id": seat.seat_id,
                    "player_name": seat.player_name,
                    "character_name": seat.character_name,
                    "reaction_type": "TACTICAL_INTERCEPT",
                    "prompt_text": f"🛡️ [REACTION PROMPT for {seat.seat_id} ({seat.player_name})]: Physical collapse imminent! Spend 2 Stamina to dive behind Oak Table cover?"
                })

        return reaction_prompts

    def advance_turn(self):
        self.current_turn_index += 1
        if self.current_turn_index >= len(self.turn_queue):
            self.current_turn_index = 0
            self.round_number += 1
            print(f"\n🔄 [ROUND {self.round_number - 1} COMPLETE]: Advancing to Round {self.round_number}! Regenerating Stamina...")
            for seat in self.seats:
                stamina_regen = 4 if "POISON_ILL" not in seat.active_status else 2
                seat.stamina = min(seat.max_stamina, seat.stamina + stamina_regen)


def run_couch_coop_demo():
    print("===========================================================================")
    print("🎮 OSTRAKA COUCH CO-OP & MULTI-PLAYER TURN MANAGER DEMO 🎮")
    print("===========================================================================\n")

    # 1. Initialize Seats and Controllers
    p1_char = {
        "id": "char_vael",
        "name": "Vael Null-Warden",
        "might": 3, "finesse": 2, "reflex": 4, "willpower": 3,
        "hp": 32, "max_hp": 32, "stamina": 22, "max_stamina": 22,
        "is_null": True,
        "tags": ["organic", "null_void", "heavy_armor"]
    }
    
    p2_char = {
        "id": "char_ignis",
        "name": "Ignis Sparkborn Mage",
        "might": 1, "finesse": 3, "reflex": 3, "willpower": 4,
        "hp": 24, "max_hp": 24, "stamina": 18, "max_stamina": 18,
        "is_null": False,
        "tags": ["organic", "sparkborn", "fire_attuned"]
    }

    manager = TurnManager()
    seat_p1 = CouchPlayerSeat("P1", "Alex", 0, p1_char)
    seat_p2 = CouchPlayerSeat("P2", "Jordan", 1, p2_char)
    
    manager.register_seat(seat_p1)
    manager.register_seat(seat_p2)

    # 2. Roll Initiative for Round 1
    npcs = [
        {"id": "npc_cultist_1", "name": "Worm Cult Heresiarch", "reflex": 3},
        {"id": "npc_guard_1", "name": "Fulcrum Sentinel", "reflex": 2}
    ]
    
    manager.roll_initiative_round(npcs)

    # 3. Simulate Active Turn Execution with STT Voice Input
    active = manager.get_active_actor()
    print(f"\n📢 [ACTIVE TURN]: It is {active['name']}'s turn ({active['type']})!")

    if active["type"] == "PLAYER":
        stt_input = "I vault over the Oak Table, slice the Brass Chandelier rope with my sword, and shout to Jordan to grab the chest!"
        print(f"\n🎤 [STT VOICE INPUT from {active['seat_obj'].seat_id} ({active['seat_obj'].player_name})]:\n   \"{stt_input}\"")
        
        result = manager.execute_player_turn(active["seat_obj"], stt_input)
        
        print("\n⚙️ [ENGINE PARSED INTENT]:")
        print(f"  • Actions Detected: {result['parsed_intent']['parsed_actions']}")
        print(f"  • Action Tags: {result['parsed_intent']['action_tags']}")
        print(f"  • Target: {result['parsed_intent']['target']}")
        print(f"  • Stamina Drain: -{result['stamina_drained']} (Remaining: {result['stamina_remaining']})")
        
        print(f"\n📖 [AI DM NARRATION]:\n   \"{result['ai_narration']}\"")

        # 4. Reaction Opportunities for Non-Active Players
        reactions = manager.check_reaction_opportunities(result)
        print("\n⚡ [COUCH REACTION PROMPTS BROADCAST TO CONTROLLERS]:")
        for rx in reactions:
            print(f"  • {rx['prompt_text']}")

    # 5. Advance Turn
    manager.advance_turn()


if __name__ == "__main__":
    run_couch_coop_demo()
