import chromadb
import json
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

# Initialize ChromaDB Local Client for RAG context
chroma_client = chromadb.PersistentClient(path="./chroma_db")
events_collection = chroma_client.get_or_create_collection(name="saga_events")
lore_collection = chroma_client.get_or_create_collection(name="saga_lore")

# Pydantic schema for structured output
class DMResponse(BaseModel):
    narrative_text: str = Field(description="The immersive description read aloud to the players, describing the outcome of their action and the world's reaction.")
    world_flags: List[str] = Field(description="Subtle tags or state modifications to apply to the simulation tick (e.g., [NPC_DISPOSITION: HOSTILE], [TIME_ADVANCED: 4_HOURS]).")

SYSTEM_PROMPT = """
You are the AI Director (Dungeon Master) for SAGA, an immersive Virtual Tabletop RPG.
You exist to narrate the mathematical truth determined by the Python physics engine.
You must NEVER invent game mechanics, calculate damage, or hallucinate combat outcomes.

Your job is to read the provided context (World State, Mechanical Results, Player Action, and Canon Lore) and narrate the outcome in visceral, atmospheric prose. 
Make sure your response strictly adheres to the Canon Lore provided in the context.

You must output exactly two things in JSON format:
1. 'narrative_text': The prose that the players will read.
2. 'world_flags': Any state tags the engine should apply next based on the narrative consequences (e.g., [WEATHER: RAIN], [NPC: FLEEING]).
"""

def retrieve_local_context(player_action: str) -> str:
    """
    RAG: Fetch recent events or relevant lore from ChromaDB based on the player's action.
    """
    try:
        results = events_collection.query(
            query_texts=[player_action],
            n_results=3
        )
        if results and results['documents'] and results['documents'][0]:
            context = "\n".join(results['documents'][0])
            return context
        return "No significant recent events in memory."
    except Exception as e:
        print(f"Error querying ChromaDB: {e}")
        return "Memory unavailable."

def retrieve_lore_context(query: str) -> str:
    """
    RAG: Fetch relevant canon lore chunks from ChromaDB.
    """
    try:
        results = lore_collection.query(
            query_texts=[query],
            n_results=2
        )
        if results and results['documents'] and results['documents'][0]:
            # Format lore chunks
            lore_text = ""
            for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
                lore_text += f"\n--- Lore: {meta.get('title', 'Unknown')} ({meta.get('category', 'misc')}) ---\n"
                lore_text += doc + "\n"
            return lore_text
        return "No specific lore relevant to this action."
    except Exception as e:
        print(f"Error querying lore in ChromaDB: {e}")
        return "Lore unavailable."

from backend.settings_manager import settings_manager

def generate_dm_response(player_action: str, mechanical_results: Dict[str, Any], world_state: Dict[str, Any] = None, story_context: str = "") -> DMResponse:
    """
    Orchestrates the AI generation loop.
    """
    # 1. Retrieve Context
    context = retrieve_local_context(player_action)
    lore_context = retrieve_lore_context(player_action + " " + json.dumps(world_state or {}))
    
    # 2. Build Prompt
    prompt = f"""
--- CURRENT GAME REALITY ---
Local Context/History:
{context}

Relevant Canon Lore:
{lore_context}

Story Engine Context:
{story_context}

World State:
{json.dumps(world_state or {}, indent=2)}

--- MECHANICAL RESOLUTION ---
The engine has processed the action with the following irrefutable outcome:
{json.dumps(mechanical_results, indent=2)}

--- PLAYER ACTION ---
{player_action}

Please provide the narrative response and any resulting world flags.
"""
    
    # 3. Call LLM
    try:
        config = settings_manager.get()
        provider = config.llm_provider
        
        if provider == "gemini":
            api_key = config.gemini_api_key
            if not api_key:
                api_key = os.getenv("GEMINI_API_KEY")
            
            client = genai.Client(api_key=api_key) if api_key else genai.Client()
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DMResponse,
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.7,
                ),
            )
            output = json.loads(response.text)
            return DMResponse(**output)
        else:
            # Ollama Support
            import requests
            ollama_url = "http://localhost:11434/api/chat"
            payload = {
                "model": "llama3",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "format": "json",
                "stream": False
            }
            res = requests.post(ollama_url, json=payload)
            res.raise_for_status()
            data = res.json()
            output = json.loads(data["message"]["content"])
            return DMResponse(**output)
        
    except Exception as e:
        print(f"LLM Generation Error: {e}")
        return DMResponse(
            narrative_text=f"The world stutters as the AI Director encounters an error: {e}",
            world_flags=[]
        )
