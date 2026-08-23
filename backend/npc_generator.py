import json
import uuid
import os
from google import genai
from google.genai import types
from backend.models import Character, CharacterStats
from backend.settings_manager import settings_manager

def generate_npc(concept: str) -> Character:
    """
    Dynamically generates a full B.R.U.T.A.L character sheet for an NPC based on a string concept.
    """
    system_prompt = """
    You are the NPC Generator for the SAGA TTRPG. 
    Your job is to generate a valid B.R.U.T.A.L Character sheet for a given NPC concept.
    
    CRITICAL RULE: You must use the 12 Core Attributes (Body: might, endurance, finesse, reflex, vitality, fortitude. Mind: knowledge, logic, awareness, intuition, charm, willpower).
    You must assign a total of exactly 36 points across these 12 stats based on the Biological Kingdoms.
    Kingdom 1 (Mammals) - balanced, sturdy.
    Kingdom 2 (Reptiles) - stealth, toxic, heavy environment.
    Kingdom 3 (Avians) - perception, speed, air.
    Kingdom 4 (Aquatics) - water, pressure.
    Kingdom 5 (Insects) - chitin armor, swarms.
    Kingdom 6 (Plants) - roots, slow, tough.
    
    Set armor (0-3) and mental_armor (0-3).
    Do NOT output derived stats (hp, composure, etc.) as the models.py engine calculates them automatically.
    Make up a fitting name if none is provided.
    """

    prompt = f"Concept: '{concept}'\nGenerate a Character JSON object."

    config = settings_manager.get()
    provider = config.llm_provider
    
    char_id = "npc_" + str(uuid.uuid4())[:8]

    if provider == "gemini":
        try:
            api_key = config.gemini_api_key or os.getenv("GEMINI_API_KEY")
            client = genai.Client(api_key=api_key) if api_key else genai.Client()
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Character,
                    system_instruction=system_prompt,
                    temperature=0.4,
                ),
            )
            output = json.loads(response.text)
            output['id'] = char_id
            return Character(**output)
        except Exception as e:
            print(f"Error generating NPC with Gemini: {e}")
            # Fallback
            return _get_fallback_npc(char_id, concept)
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
            output['id'] = char_id
            return Character(**output)
        except Exception as e:
            print(f"Error generating NPC with Ollama: {e}")
            return _get_fallback_npc(char_id, concept)

def _get_fallback_npc(char_id: str, concept: str) -> Character:
    # Generic baseline fallback that sums exactly to 36
    stats = CharacterStats(
        might=3, endurance=3, finesse=3, reflex=3, vitality=3, fortitude=3,
        knowledge=3, logic=3, awareness=3, intuition=3, charm=3, willpower=3
    )
    return Character(
        id=char_id,
        name=f"Generic {concept}",
        stats=stats,
        armor=0,
        mental_armor=0
    )
