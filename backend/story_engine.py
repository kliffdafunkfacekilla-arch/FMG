import json
import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from google import genai
from google.genai import types

class ProceduralPlotNode(BaseModel):
    id: str
    type: str  # 'seed' or 'beat'
    title: str
    description: str
    world_impact_flags: List[str]

class CampaignArc(BaseModel):
    id: str
    framework_type: str = "The Hero's Journey"
    current_phase: int = 1  # 1: Ordinary World, 2: Call to Adventure, 3: Crossing the Threshold
    phase_description: str = "Phase 1: The Ordinary World. The player is experiencing normal, localized stories. The overarching plot is unknown."
    emergent_themes: List[str] = []
    core_conflict: str = ""

class ProceduralStoryEngine:
    def __init__(self, provider: str = "gemini"):
        from backend.settings_manager import settings_manager
        config = settings_manager.get()
        self.provider = config.llm_provider
        self.active_node: Optional[ProceduralPlotNode] = None

    def _call_llm(self, prompt: str, system: str, response_schema: Any = ProceduralPlotNode) -> Any:
        """Helper to call LLM and extract a structured response."""
        from backend.settings_manager import settings_manager
        import os
        config = settings_manager.get()
        self.provider = config.llm_provider
        
        if self.provider == "gemini":
            try:
                api_key = config.gemini_api_key or os.getenv("GEMINI_API_KEY")
                client = genai.Client(api_key=api_key) if api_key else genai.Client()
                
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        system_instruction=system,
                        temperature=0.8,
                    ),
                )
                output = json.loads(response.text)
                return response_schema(**output)
            except Exception as e:
                print(f"StoryEngine Gemini Error: {e}")
                return None
        else:
            # Ollama
            import requests
            try:
                payload = {
                    "model": "llama3",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt}
                    ],
                    "format": "json",
                    "stream": False
                }
                res = requests.post("http://localhost:11434/api/chat", json=payload)
                res.raise_for_status()
                data = res.json()
                output = json.loads(data["message"]["content"])
                return response_schema(**output)
            except Exception as e:
                print(f"StoryEngine Ollama Error: {e}")
                return None

    def _fallback_node(self) -> ProceduralPlotNode:
        return ProceduralPlotNode(
            id=str(uuid.uuid4()),
            type="seed",
            title="A Quiet Moment",
            description="The simulation yields nothing but silence.",
            world_impact_flags=[]
        )

    def generate_campaign_arc(self, char_data: dict, world_id: str, region_id: str) -> CampaignArc:
        """
        Initializes a blank structural canvas for the emergent campaign.
        No LLM generation is needed here; the story builds organically later.
        """
        return CampaignArc(
            id=str(uuid.uuid4()),
            framework_type="The Hero's Journey",
            current_phase=1,
            phase_description="Phase 1: The Ordinary World. The player is experiencing normal, localized stories. The overarching plot is unknown.",
            emergent_themes=[],
            core_conflict=""
        )

    class CampaignEvaluation(BaseModel):
        extracted_themes: List[str]
        updated_core_conflict: str
        should_advance_phase: bool
        new_phase_description: str

    def evaluate_campaign_progression(self, completed_story_log: str, arc: CampaignArc) -> CampaignArc:
        """
        Phase 4: After a local story concludes, extract themes and organically build the grand campaign.
        """
        system = "You are a master RPG Campaign Designer. Analyze a completed local story. Extract recurring factions, NPCs, or items. Slowly piece them together to form an overarching 'core conflict' for the grand campaign. If the plot has thickened significantly, advance the phase."
        
        prompt = f"""
        Current Campaign State:
        Phase: {arc.current_phase}
        Emergent Themes: {arc.emergent_themes}
        Core Conflict: {arc.core_conflict}
        
        Recently Completed Story:
        {completed_story_log}
        
        Extract new themes, update the core conflict organically, and decide if the campaign phase advances.
        """
        
        eval_result = self._call_llm(prompt, system, response_schema=self.CampaignEvaluation)
        if eval_result:
            # Merge themes, removing duplicates
            arc.emergent_themes = list(set(arc.emergent_themes + eval_result.extracted_themes))
            arc.core_conflict = eval_result.updated_core_conflict
            if eval_result.should_advance_phase and arc.current_phase < 4:
                arc.current_phase += 1
                arc.phase_description = eval_result.new_phase_description
                
        return arc

    def generate_poi(self, tags: List[str], arc: Optional[CampaignArc] = None) -> ProceduralPlotNode:
        """
        Phase 1: Generate a simple Story Seed or Point of Interest from World Data tags.
        """
        system = "You are a master RPG worldbuilder. Given geographical tags, generate a single intriguing Point of Interest or Story Seed (id, type='seed', title, description, world_impact_flags)."
        
        arc_context = f"\nEmergent Campaign Context ({arc.framework_type} - Phase {arc.current_phase}):\nThemes: {arc.emergent_themes}\nCore Conflict: {arc.core_conflict}\nWeave these themes subtly into the seed." if arc else ""
        prompt = f"World Tags: {', '.join(tags)}{arc_context}\nGenerate a mysterious story seed."
        
        node = self._call_llm(prompt, system, response_schema=ProceduralPlotNode)
        if not node: node = self._fallback_node()
        node.id = str(uuid.uuid4())
        node.type = "seed"
        self.active_node = node
        return node

    def generate_next_beat(self, resolution_data: Dict[str, Any], world_state: Dict[str, Any], player_data: str, arc: Optional[CampaignArc] = None) -> ProceduralPlotNode:
        """
        Phase 3: Generate the next Story Beat based on the player's resolution of the previous beat.
        """
        system = "You are a dynamic DM shaping a Directed Acyclic Graph. Based on the previous story beat, how the player resolved it, and the world state, generate the NEXT story beat that follows logically. Provide world_impact_flags that should alter the simulation (e.g. [SPAWN: DUNGEON], [SPAWN: PIRATE_FLEET @ 1024])."
        
        prev_node = self.active_node.model_dump() if self.active_node else "No active story."
        arc_context = f"\nEmergent Campaign Context ({arc.framework_type} - Phase {arc.current_phase}):\nThemes: {arc.emergent_themes}\nCore Conflict: {arc.core_conflict}\nThe plot should organically build upon these themes." if arc else ""
        
        prompt = f"""
        Previous Beat: {json.dumps(prev_node)}
        Mechanical Resolution: {json.dumps(resolution_data)}
        Player Intent & Data: {player_data}
        World State: {json.dumps(world_state)}
        {arc_context}
        
        Write the next node in this story graph.
        """
        
        node = self._call_llm(prompt, system, response_schema=ProceduralPlotNode)
        if not node: node = self._fallback_node()
        node.id = str(uuid.uuid4())
        node.type = "beat"
        self.active_node = node
        return node

# Global singleton
story_engine = ProceduralStoryEngine()
