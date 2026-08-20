from pydantic import BaseModel
from typing import Dict, Any
import random

class GuideSuggestion(BaseModel):
    prompt_text: str
    suggested_action: str
    action_payload: Dict[str, Any]

def get_next_suggestion(world_state: Dict[str, Any]) -> GuideSuggestion:
    """
    Analyzes the current world state and uses a mock LLM to suggest the next 
    logical step in world-building.
    """
    
    # Motivational challenge-based mock for now
    # Motivational challenge-based mock for now
    if not world_state.get("heightmap_generated", False):
        prompts = [
            "🌟 Challenge 1: The Canvas of Creation. Every great world begins with a foundation. Generating a heightmap teaches the engine where mountains rise and oceans fall. Can you forge a new continent?",
            "🌟 Challenge 1: Sculpting the Earth. The void is empty until you shape it. A heightmap determines the very bones of your world. Let's raise some mountains and carve out the seas!",
            "🌟 Challenge 1: The First Act. It all starts with the land. Generate a heightmap to define the topography—this will decide where rivers flow and civilizations eventually settle."
        ]
        return GuideSuggestion(
            prompt_text=random.choice(prompts),
            suggested_action="generate_heightmap",
            action_payload={"template": "High Island"}
        )
        
    if not world_state.get("biomes_generated", False):
        prompts = [
            "🌟 Challenge 2: Breathe Life into the Land. A barren rock is no place for a story! By calculating the climate and establishing biomes, you teach the simulation where forests grow and deserts spread. Let's paint the world with life.",
            "🌟 Challenge 2: The Winds and the Rain. Mountains block the rain, creating deserts and jungles. Generate biomes to establish the climate zones that will shape the evolution of your cultures.",
            "🌟 Challenge 2: Seeding the Wilds. The geography is set; now it needs ecosystems. Establish biomes to blanket your world in lush rainforests, frozen tundras, and rolling plains."
        ]
        return GuideSuggestion(
            prompt_text=random.choice(prompts),
            suggested_action="generate_biomes",
            action_payload={}
        )
        
    if not world_state.get("cultures_generated", False):
        prompts = [
            "🌟 Challenge 3: The Spark of Civilization. Now that the world is lush, it's time for people to emerge. Seeding cultures will scatter distinct languages and traditions across the habitable zones. Can you guide the first migrations?",
            "🌟 Challenge 3: Rise of the Nomads. A world needs voices. Generate cultures to populate your biomes with diverse societies, each with their own unique naming conventions and customs.",
            "🌟 Challenge 3: The First Peoples. Life finds a way. It's time to scatter the seeds of civilization. Create cultures to bring language, identity, and history to your lands."
        ]
        return GuideSuggestion(
            prompt_text=random.choice(prompts),
            suggested_action="generate_cultures",
            action_payload={"count": 5}
        )
        
    if not world_state.get("states_generated", False):
        prompts = [
            "🌟 Challenge 4: The Game of Thrones. Your world has terrain, climate, and distinct peoples. The next step in world-building is creating political tension. Add some states or factions to claim borders and set the stage for your story!",
            "🌟 Challenge 4: Drawing the Lines. Cultures eventually form nations. Generate states to carve out borders, establish capitals, and set the foundation for diplomacy and war.",
            "🌟 Challenge 4: The Birth of Empires. The people are uniting under banners. Create states to bring politics, governance, and inevitable conflict to your thriving world."
        ]
        return GuideSuggestion(
            prompt_text=random.choice(prompts),
            suggested_action="open_state_editor",
            action_payload={}
        )

    # Infinite motivation loop
    advanced_challenges = [
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: Gods and Myths. Cultures and States need belief systems. Let's establish a Pantheon or scattered local religions to influence your civilizations. Who do they pray to?",
                "🌟 Challenge: The Divine Spark. What do your people believe in? Create a new religion to unite (or divide) your states. A strong faith can shape the course of history.",
                "🌟 Challenge: Temples and Taboos. Every culture has its sacred rituals. Flesh out the religious landscape of your world by adding a new faith system."
            ]),
            suggested_action="open_religion_editor",
            action_payload={}
        ),
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: The Arteries of Trade. Borders are drawn, but isolation kills empires. Draw some trade routes connecting the major capitals to simulate a thriving economy.",
                "🌟 Challenge: Caravans and Coin. Wealth flows along the roads. Connect your major cities with trade routes to boost their prosperity and simulate the exchange of goods.",
                "🌟 Challenge: The Silk Road. Establishing trade routes doesn't just move money—it moves ideas, culture, and sometimes, disease. Connect your empire's hubs!"
            ]),
            suggested_action="open_route_editor",
            action_payload={}
        ),
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: Blades and Banners. Peace is fragile. Build up a military force for one of your border nations. Will it be a standing army or a rapid cavalry unit?",
                "🌟 Challenge: The Drums of War. Tension is rising at the border. It's time to draft a new military regiment for one of your states. What is their specialty?",
                "🌟 Challenge: Defenders of the Realm. A state without an army is a target. Create a new military unit to protect a vulnerable capital or prepare for an invasion."
            ]),
            suggested_action="open_military_editor",
            action_payload={}
        ),
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: Uncharted Dangers. Not all threats are armies. Let's add some wild Ecology—monster lairs, wild beast migrations, or haunted forests to the unmapped fringes of your world.",
                "🌟 Challenge: Here Be Dragons. The wilds hold untamed terrors. Place an ecological hazard—a monster's den or a magical anomaly—to challenge any adventurers.",
                "🌟 Challenge: The Apex Predators. Civilization hasn't conquered everything. Add some dangerous ecology to the remote biomes to keep the locals on edge."
            ]),
            suggested_action="open_ecology_editor",
            action_payload={}
        ),
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: Heroes and Villains. Every great saga needs Paragons. Select a state and forge a legendary character—a rebel leader, an ancient king, or a cunning diplomat—to drive the narrative.",
                "🌟 Challenge: The Chosen One. History is shaped by extraordinary individuals. Create a new Paragon—perhaps a legendary general, a revered saint, or an infamous pirate.",
                "🌟 Challenge: Faces of the Realm. Add a named Paragon to your world. Give them a backstory, traits, and an agenda that could disrupt the current political balance."
            ]),
            suggested_action="open_paragons_editor",
            action_payload={}
        ),
        GuideSuggestion(
            prompt_text=random.choice([
                "🌟 Challenge: The Pen is Mightier. Sometimes wars are fought with words and alliances. Open diplomacy and forge a treaty or declare a rivalry between two neighboring powers.",
                "🌟 Challenge: Web of Alliances. Politics is a delicate dance. Adjust the diplomatic relations between two states—will they sign a non-aggression pact, or declare a bitter rivalry?",
                "🌟 Challenge: The Cold War. Tension makes for great storytelling. Set two states to be hostile toward each other and see how it affects their neighbors."
            ]),
            suggested_action="open_diplomacy_editor",
            action_payload={}
        )
    ]

    return random.choice(advanced_challenges)
