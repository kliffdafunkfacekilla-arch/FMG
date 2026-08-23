import json
import os
from pydantic import BaseModel
from google import genai
from google.genai import types
from backend.models import ActionRequest, DamageType, ParsedIntent
from backend.settings_manager import settings_manager

def parse_intent(player_text: str, char_data: dict, active_npcs: list) -> ParsedIntent:
    """
    Parses a player's raw text intent to determine if it's a mechanical action.
    Uses the configured LLM to map the action to B.R.U.T.A.L rules.
    """
    system_prompt = """
    You are the Rules Engine for SAGA TTRPG. 
    Your job is to read a player's declared action and decide if it requires a mechanical roll (attack, dodging a trap, forcing open a door, lying to a guard).
    If it is just conversational or observational (e.g. "I look around", "Hello bartender"), is_mechanical_action is false.
    
    If true, map it to the 12-stat mechanics (Body: might, endurance, finesse, reflex, vitality, fortitude. Mind: knowledge, logic, awareness, intuition, charm, willpower).
    
    If the player describes a combat tactic, map it to the Clash Matrix:
    - PRESS (Might/Knowledge): overpowering the center
    - HOLD (Endurance/Logic): anchoring in place
    - MANEUVER (Reflex/Intuition): flanking/shifting
    - TRICK (Finesse/Awareness): altering frequency/bypassing blocks
    - FEINT (Fortitude/Willpower): bait and switch
    - DISENGAGE (Vitality/Charm): leaping backward
    
    - Extract the attacker, defender.
    - Set the attacker_stat to the exact integer value from the provided Character Stats based on what stat they are using.
    - Determine damage_type (physical or mental).
    
    CRITICAL: For the defender_stat, look at the Active NPCs list. 
    If the defender matches an NPC in the list, you MUST use their exact stat value. Do not guess or estimate. 
    If the defender is NOT in the list (e.g. an inanimate object), you may estimate a defense stat (1-10).
    """

    # Format the active NPCs for the prompt
    npc_data = "\n".join([f"- {npc.name}: {npc.stats.model_dump()}" for npc in active_npcs]) if active_npcs else "None"

    prompt = f"""
    Character Stats: {json.dumps(char_data.get('stats', {}))}
    Active NPCs in Scene:
    {npc_data}
    
    Player Action: '{player_text}'
    
    Parse this into a ParsedIntent JSON object.
    """

    config = settings_manager.get()
    provider = config.llm_provider

    if provider == "gemini":
        try:
            api_key = config.gemini_api_key or os.getenv("GEMINI_API_KEY")
            client = genai.Client(api_key=api_key) if api_key else genai.Client()
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ParsedIntent,
                    system_instruction=system_prompt,
                    temperature=0.0,
                ),
            )
            output = json.loads(response.text)
            return ParsedIntent(**output)
        except Exception as e:
            print(f"Error parsing intent with Gemini: {e}")
            return ParsedIntent(is_mechanical_action=False)
    else:
        # Ollama
        import requests
        try:
            payload = {
                "model": "llama3",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "format": "json",
                "stream": False
            }
            res = requests.post("http://localhost:11434/api/chat", json=payload)
            res.raise_for_status()
            data = res.json()
            output = json.loads(data["message"]["content"])
            return ParsedIntent(**output)
        except Exception as e:
            print(f"Error parsing intent with Ollama: {e}")
            return ParsedIntent(is_mechanical_action=False)
