import json
import asyncio
from backend.character_manager import character_manager
from backend.saga_agent import generate_dm_response
from backend.story_engine import story_engine
import random

class StoryDirector:
    def __init__(self):
        self.active_character_id = None
        self.active_world_id = None
        self.active_region_id = None
        self.active_campaign_arc = None
        self.story_context = ""
        self.active_npcs = []
        
    async def start_session(self, character_id: str, world_id: str, region_id: str) -> str:
        """
        Initializes a new game session.
        Reads world data, finds the character, selects a starting Burg within the region, 
        generates the Grand Campaign Arc, and generates an opening narrative hook.
        """
        self.active_character_id = character_id
        self.active_world_id = world_id
        self.active_region_id = region_id
        self.active_npcs = []
        
        char = character_manager.get_character(character_id)
        char_name = char.name if char else "Wanderer"
        char_data = char.model_dump() if char else {}
        
        # Mock burg selection for the given region until we parse .map files
        mock_burgs = ["Oakhaven", "Rustwatch", "Gloom's End", "The Iron Citadel"]
        start_burg = random.choice(mock_burgs)
        
        # Generate the overarching Campaign Arc
        self.active_campaign_arc = story_engine.generate_campaign_arc(char_data, world_id, region_id)
        
        self.story_context = f"The player has just started the game. They are in the world of {world_id.replace('.map', '')}, region of {region_id.upper()}, in the settlement of {start_burg}. Their character's name is {char_name}.\n\n--- EMERGENT CAMPAIGN ARC ---\nFramework: {self.active_campaign_arc.framework_type}\nPhase {self.active_campaign_arc.current_phase}: {self.active_campaign_arc.phase_description}\nEmergent Themes: {self.active_campaign_arc.emergent_themes}\nCore Conflict: {self.active_campaign_arc.core_conflict}\n"
        
        prompt = "Describe the opening scene as the player arrives in the settlement."
        
        try:
            response = generate_dm_response(
                player_action=prompt,
                mechanical_results={},
                world_state={"world": world_id.replace('.map', ''), "region": region_id, "burg": start_burg},
                story_context=self.story_context
            )
            return response.narrative_text
        except Exception as e:
            return f"SYSTEM ALIGNMENT COMPLETE.\n\nWelcome to {world_id.replace('.map', '')}, {char_name}.\n\nYou have arrived in the region of {region_id.upper()}. The air here tastes of ozone and ancient dust. You stand at the edge of {start_burg}. A rusted signpost points towards the settlement's center, but the path is obscured by thick, rolling fog. What do you do?"
        
    async def process_message(self, message: str, context: dict = None) -> str:
        """
        Simulates the full Golden Rule Loop:
        1. Parse player intent.
        2. Resolve mechanical actions via the rules engine.
        3. Pass the mathematical outcome to the AI for narration.
        """
        from backend.rules_engine import parse_intent
        from backend.combat import resolve_action
        
        char = character_manager.get_character(self.active_character_id)
        char_name = char.name if char else "Wanderer"
        char_data = char.model_dump() if char else {}
        
        world_state = {
            "world": self.active_world_id,
            "region": self.active_region_id,
            "character_name": char_name
        }
        
        # 1. Parse Intent
        intent = parse_intent(message, char_data, self.active_npcs)
        
        # 2. Resolve Mechanics
        mechanical_results = {}
        if intent.is_mechanical_action and intent.action_request:
            outcome = resolve_action(intent.action_request)
            mechanical_results = outcome.model_dump()
            
            # HP tracking for NPCs
            if outcome.damage_dealt > 0:
                for npc in self.active_npcs:
                    if npc.name.lower() in intent.action_request.defender_name.lower():
                        if intent.action_request.damage_type == "physical":
                            npc.hp -= outcome.damage_dealt
                        else:
                            npc.composure -= outcome.damage_dealt
                
                # Prune dead NPCs
                self.active_npcs = [npc for npc in self.active_npcs if npc.hp > 0 and npc.composure > 0]
        
        # 3. Narrate Outcome
        try:
            response = generate_dm_response(
                player_action=message,
                mechanical_results=mechanical_results,
                world_state=world_state,
                story_context=self.story_context
            )
            
            # 4. Handle World Flags (NPC Spawning)
            from backend.npc_generator import generate_npc
            for flag in response.world_flags:
                if "[SPAWN_NPC:" in flag:
                    # Extract concept, e.g. "[SPAWN_NPC: Goblin Archer]" -> "Goblin Archer"
                    concept = flag.replace("[SPAWN_NPC:", "").replace("]", "").strip()
                    new_npc = generate_npc(concept)
                    self.active_npcs.append(new_npc)
                    
            return response.narrative_text
        except Exception as e:
            return f"The Story Director contemplates your action: '{message}'.\n\nShadows lengthen across the rusted grating as you speak. The air is thick with the smell of ozone and old blood. Something shifts in the darkness ahead—a scraping of metal against stone."

director = StoryDirector()
