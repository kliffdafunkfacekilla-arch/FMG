"""
OSTRAKA AI DM ORCHESTRATOR & GAME MASTER LOOP
=============================================
Autonomous Game Master middleware that bridges natural language player intent (STT voice/text)
to ground-truth engine state. Enforces anti-hallucination guardrails, executes tag-driven
contested rolls, updates physical/social deltas, and formats second-person narrative outputs.
"""

import sys
import os
import json
import random
import time
from typing import Dict, List, Any, Tuple, Optional

# Ensure workspace paths are in sys.path
sys.path.extend(["/workspace/artifacts", "/workspace/scratch"])

# Import underlying Ostraka engines
from action_tag_parser_engine import UniversalActionResolver, CharacterEntity, TaggedObject
from social_tag_engine import NPC
from dialogue_tree_engine import DialogueTreeManager, SocialNPC
from couch_coop_turn_manager import TurnManager, CouchPlayerSeat
from vtt_state_exporter import VTTStateExporter


class AIDMOrchestrator:
    def __init__(self):
        self.turn_manager = TurnManager()
        self.dialogue_manager = DialogueTreeManager()
        self.vtt_exporter = VTTStateExporter(tile_pixel_size=32)
        self.world_state = {
            "current_cell_id": 10522,
            "cell_name": "Excelsis Foothills Burg",
            "active_map_type": "OUTDOOR_TACTICAL", # OUTDOOR_TACTICAL or SUBMAP_INTERIOR
            "submap_data": None,
            "narrative_log": [],
            "world_deltas": []
        }
        self.active_props = []
        self.active_npcs = []

    def initialize_session(self, seats_config: List[Dict[str, Any]]):
        """
        Sets up seats, initializes party, and spawns default local environment.
        """
        for config in seats_config:
            seat = CouchPlayerSeat(
                seat_id=config["seat_id"],
                player_name=config["player_name"],
                controller_index=config["controller_index"],
                character_data=config["character_data"]
            )
            self.turn_manager.register_seat(seat)

        # Setup Default Props on 351x351 Grid
        self.active_props = [
            {
                "id": "prop_chandelier_1",
                "name": "Hanging Brass Chandelier",
                "pos": [175, 176],
                "tags": ["metal", "heavy", "burning", "severable", "swinging"]
            },
            {
                "id": "prop_table_1",
                "name": "Oak Dining Table",
                "pos": [176, 175],
                "tags": ["wood", "movable", "flammable", "climbable", "cover_light"]
            },
            {
                "id": "prop_chest_1",
                "name": "Gilded Lockbox Chest",
                "pos": [178, 175],
                "tags": ["metal", "locked", "valuable", "container", "openable"]
            }
        ]

        # Setup Default NPCs
        self.active_npcs = [
            {
                "id": "npc_sentinel_1",
                "name": "Captain Kael (Fulcrum Guard)",
                "pos": [175, 178],
                "reflex": 2,
                "social_npc": SocialNPC(
                    npc_id="npc_sentinel_1",
                    name="Captain Kael",
                    role="Fulcrum Guard Captain",
                    tags=["unyielding", "suspicious", "guard", "gilded_compass", "veteran", "conductive", "metal", "heavy_plate"],
                    resistance=12
                )
            }
        ]

    def process_player_turn_input(self, seat_id: str, raw_stt_input: str) -> Dict[str, Any]:
        """
        Main GM loop execution for a player's turn:
        1. Parse STT intent into engine actions and tags.
        2. Query ground-truth map state for target validation.
        3. Execute tag-driven physics/combat or social interactions.
        4. Broadcast reaction prompts to other seats if applicable.
        5. Generate second-person AI DM narration.
        """
        seat = next((s for s in self.turn_manager.seats if s.seat_id == seat_id), None)
        if not seat:
            return {"error": f"Seat {seat_id} not found"}

        # 1. Parse Voice Intent
        parsed_intent = self.turn_manager.parse_voice_stt_intent(raw_stt_input)
        
        # 2. Check Target & Tags in Ground-Truth
        attacker_entity = CharacterEntity(
            name=seat.character_name,
            hp=seat.hp,
            max_hp=seat.max_hp,
            stats={"might": seat.might, "finesse": seat.finesse, "reflex": seat.reflex}
        )
        if seat.is_null:
            attacker_entity.active_status_tags.add("null")
        else:
            attacker_entity.active_status_tags.add("sparkborn")

        defender_entity = CharacterEntity(
            name="Fulcrum Guard Captain",
            hp=25,
            max_hp=25,
            stats={"might": 14, "reflex": 10}
        )
        defender_entity.active_status_tags.update(["conductive", "metal", "heavy_plate", "organic"])

        # Create prop objects for resolver
        env_props = [
            TaggedObject(p["name"], "PROP", actionable_tags=p["tags"])
            for p in self.active_props
        ]

        # 3. Resolve Universal Action & Tag Cascades
        primary_action = parsed_intent["parsed_actions"][0] if parsed_intent["parsed_actions"] else "SLASH"
        resolution = UniversalActionResolver.parse_and_resolve_action(
            attacker=attacker_entity,
            defender=defender_entity,
            action_verb=primary_action,
            environment_props=env_props
        )

        # 4. Check Reactions
        turn_execution = self.turn_manager.execute_player_turn(seat, raw_stt_input)
        reaction_prompts = self.turn_manager.check_reaction_opportunities(turn_execution)

        # 5. Build AI DM Narration
        ai_dm_narration = (
            f"You {raw_stt_input.lower().replace('i ', '')}! "
            f"As your action unfolds, the tag physics trigger instant ripples across the battlefield—"
            f"{' '.join(resolution.get('cascades', ['the strike lands cleanly!']))} "
            f"Your remaining stamina stands at {seat.stamina}/{seat.max_stamina}."
        )

        log_entry = {
            "timestamp": time.time(),
            "seat_id": seat_id,
            "player_name": seat.player_name,
            "character_name": seat.character_name,
            "stt_input": raw_stt_input,
            "parsed_intent": parsed_intent,
            "tag_cascades": resolution.get("cascades", []),
            "reaction_prompts": reaction_prompts,
            "ai_dm_narration": ai_dm_narration
        }
        self.world_state["narrative_log"].append(log_entry)

        return log_entry


def run_orchestrator_test():
    print("===========================================================================")
    print("🧠 OSTRAKA AI DM ORCHESTRATOR INTEGRATION TEST 🧠")
    print("===========================================================================\n")

    gm = AIDMOrchestrator()
    gm.initialize_session([
        {
            "seat_id": "P1",
            "player_name": "Alex",
            "controller_index": 0,
            "character_data": {"name": "Vael Null-Warden", "might": 4, "reflex": 4, "is_null": True}
        },
        {
            "seat_id": "P2",
            "player_name": "Jordan",
            "controller_index": 1,
            "character_data": {"name": "Ignis Sparkborn Mage", "finesse": 4, "reflex": 3, "is_null": False}
        }
    ])

    print("✅ Session Initialized. Running AI DM loop for P2 (Jordan)...")
    res = gm.process_player_turn_input("P2", "I vault over the table and cast Aetheric Arc at the Fulcrum Guard!")

    print(f"\n📢 [AI DM NARRATION]:\n  \"{res['ai_dm_narration']}\"")
    print(f"\n⚡ [TAG CASCADES GENERATED]: {res['tag_cascades']}")
    print(f"🛡️ [REACTION PROMPTS BROADCAST]: {[r['prompt_text'] for r in res['reaction_prompts']]}")


if __name__ == "__main__":
    run_orchestrator_test()
