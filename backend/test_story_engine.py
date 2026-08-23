import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

from backend.story_engine import story_engine, ProceduralPlotNode, CampaignArc

class MockResult:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def mock_call_llm(prompt, system, response_schema):
    if response_schema == ProceduralPlotNode:
        if "seed" in prompt.lower():
            return ProceduralPlotNode(id="123", type="seed", title="The Purple Cloaks", description="You see bandits wearing strange purple cloaks.", world_impact_flags=["[SPAWN: BANDITS]"])
        else:
            return ProceduralPlotNode(id="456", type="beat", title="The Cult's Trap", description="The bandits lead you to an altar of the Sunken Gods.", world_impact_flags=["[SPAWN: ALTAR]"])
    elif response_schema == story_engine.CampaignEvaluation:
        return story_engine.CampaignEvaluation(
            extracted_themes=["Purple Cloaks", "Sunken Gods"],
            updated_core_conflict="The Cult of the Sunken Gods is rising in power.",
            should_advance_phase=True,
            new_phase_description="Phase 2: Rising Tension. The cult is actively hunting the player."
        )
    return None

story_engine._call_llm = mock_call_llm

async def main():
    print("# SAGA Story Engine Test Report\n")
    
    char_data = {"name": "Kaelen", "class": "Warrior", "background": "Mercenary from the wastes."}
    world_id = "test_world"
    region_id = "test_region"
    
    print("## 1. Initializing Emergent Campaign Arc")
    arc = story_engine.generate_campaign_arc(char_data, world_id, region_id)
    print(f"**Framework**: {arc.framework_type}")
    print(f"**Initial Phase**: {arc.current_phase}")
    print(f"**Themes**: {arc.emergent_themes}")
    print(f"**Core Conflict**: {arc.core_conflict}\n")
    
    print("## 2. Generating Localized Story Seed (Phase 1)")
    tags = ["Coastal", "Poverty", "High Magic"]
    seed = story_engine.generate_poi(tags, arc)
    print(f"**Seed Title**: {seed.title}")
    print(f"**Description**: {seed.description}")
    print(f"**Impact Flags**: {seed.world_impact_flags}\n")
    
    print("## 3. Resolving the Seed & Generating Beat 1")
    resolution_data = {"outcome": "Success", "details": "Player successfully sneaked past the guards and found a strange purple crystal."}
    player_data = "I sneak past the guards to see what they are guarding."
    world_state = {"location": "Smuggler's Cove"}
    
    beat1 = story_engine.generate_next_beat(resolution_data, world_state, player_data, arc)
    print(f"**Beat 1 Title**: {beat1.title}")
    print(f"**Description**: {beat1.description}")
    print(f"**Impact Flags**: {beat1.world_impact_flags}\n")
    
    print("## 4. Evaluating Campaign Progression (End of Local Story 1)")
    # Simulate the story concluding
    completed_story_log = f"Seed: {seed.description}\nPlayer Action: {player_data}\nOutcome: {resolution_data['details']}\nResulting Beat: {beat1.description}"
    
    arc = story_engine.evaluate_campaign_progression(completed_story_log, arc)
    print(f"**New Phase**: {arc.current_phase}")
    print(f"**New Themes**: {arc.emergent_themes}")
    print(f"**New Core Conflict**: {arc.core_conflict}\n")
    
    print("## 5. Generating Localized Story Seed 2 (With Emergent Themes)")
    tags2 = ["Mountain", "Military", "Ruins"]
    seed2 = story_engine.generate_poi(tags2, arc)
    print(f"**Seed 2 Title**: {seed2.title}")
    print(f"**Description**: {seed2.description}")
    print(f"**Impact Flags**: {seed2.world_impact_flags}\n")
    
    print("## 6. Resolving Seed 2 & Generating Beat 2")
    resolution_data2 = {"outcome": "Failure", "details": "Player triggered a trap and was captured by a cult."}
    player_data2 = "I charge into the ruins to fight the soldiers."
    world_state2 = {"location": "The Iron Peak"}
    
    beat2 = story_engine.generate_next_beat(resolution_data2, world_state2, player_data2, arc)
    print(f"**Beat 2 Title**: {beat2.title}")
    print(f"**Description**: {beat2.description}")
    print(f"**Impact Flags**: {beat2.world_impact_flags}\n")
    
    print("## 7. Evaluating Campaign Progression (End of Local Story 2)")
    completed_story_log2 = f"Seed: {seed2.description}\nPlayer Action: {player_data2}\nOutcome: {resolution_data2['details']}\nResulting Beat: {beat2.description}"
    
    arc = story_engine.evaluate_campaign_progression(completed_story_log2, arc)
    print(f"**Final Phase**: {arc.current_phase}")
    print(f"**Final Themes**: {arc.emergent_themes}")
    print(f"**Final Core Conflict**: {arc.core_conflict}\n")
    
if __name__ == "__main__":
    asyncio.run(main())
