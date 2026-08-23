from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from fastapi.staticfiles import StaticFiles
import json
from dotenv import load_dotenv

load_dotenv()

from backend.models import Character, CharacterStats
from backend.combat import resolve_action
from backend.story_engine import story_engine
# Import Pydantic request schemas
from backend.schemas import StoryPayload, RuleResponse, CombatPayload
from backend.utils.persistence import save_player_state, save_map, save_chronicle
# Legacy TALEWEAVERS story director (AI DM)
from backend.taleweavers_legacy.saga_director import director as taleweavers_director
# Legacy SAGA rules engine (combat, trauma, etc.)
from backend.saga_rules_legacy.rules_engine import clash_calculator


app = FastAPI(title="B.R.U.T.A.L. Engine Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)\n# Mount static asset directories\napp.mount("/tokens", StaticFiles(directory="tokens"), name="tokens")\napp.mount("/objects", StaticFiles(directory="objects"), name="objects")\napp.mount("/terrian", StaticFiles(directory="terrian"), name="terrian")

from backend.character_manager import character_manager
from backend.settings_manager import settings_manager, SettingsModel
import os

@app.get("/api/brutal/health")
def health_check():
    return {"status": "ok", "engine": "B.R.U.T.A.L. Active"}

@app.get("/api/brutal/settings")
def get_settings():
    return settings_manager.get().model_dump()

@app.post("/api/brutal/settings")
def update_settings(settings: SettingsModel):
    settings_manager.save(settings)
    return {"status": "success"}

@app.get("/api/brutal/characters")
def list_characters():
    chars = character_manager.list_characters()
    return [c.model_dump() for c in chars]

@app.get("/api/brutal/worlds")
def list_worlds():
    worlds_dir = os.path.join(os.path.dirname(__file__), "data", "worlds")
    if not os.path.exists(worlds_dir):
        return []
    
    worlds = []
    for file in os.listdir(worlds_dir):
        if file.endswith(".map"):
            # Mock parsing - just return filename for now
            worlds.append({"id": file, "name": file.replace(".map", "")})
    return worlds

@app.get("/api/brutal/worlds/{world_id}/regions")
def list_regions(world_id: str):
    # Mocking regions until we parse the .map files
    return [
        {"id": "reg_1", "name": "The Northern Wastes"},
        {"id": "reg_2", "name": "The Sunken Coast"},
        {"id": "reg_3", "name": "The Imperial Heartland"}
    ]

@app.post("/api/brutal/create_character")
def create_character(char: Character):
    """
    Validates a character build and saves it.
    Throws HTTP 422 if validation fails (handled by Pydantic).
    """
    character_manager.save_character(char)
    return {
        "id": char.id,
        "max_hp": char.max_hp,
        "max_composure": char.max_composure,
        "stamina_capacity": char.stamina_capacity,
        "focus_capacity": char.focus_capacity
    }

# New endpoint – run the TALEWEAVERS story director for a player action
@app.post("/api/story/next", response_model=Dict[str, Any])
async def story_next(payload: StoryPayload):
    """Run the story director with optional initial state.
    Returns the full director payload (including narrative_output and any updated state).
    """
    init_state = {
        "player_id": payload.player_id,
        "player_data": {},
        "current_hex": {},
        "weather": "",
        "active_quest": None,
        "active_encounter": None,
        "war_events": [],
        "tension": 0,
        "event_trigger": None,
        "narrative_output": "",
    }
    if payload.state:
        init_state.update(payload.state)
    try:
        result = await taleweavers_director.saga_director_app.ainvoke(init_state)
        # Persist key parts of the state atomically
        if isinstance(result, dict):
            save_player_state(result.get('player_data', {}))
            save_map(result.get('current_hex', {}))
            save_chronicle({'war_events': result.get('war_events', []), 'tension': result.get('tension', 0)})
        return result  # full payload
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/story/director", response_model=Dict[str, Any])
async def story_director(payload: StoryPayload):
    """Thin wrapper around the TALEWEAVERS story director returning full payload."""
    try:
        result = await taleweavers_director.saga_director_app.ainvoke(payload.dict())
        if isinstance(result, dict):
            save_player_state(result.get('player_data', {}))
            save_map(result.get('current_hex', {}))
            save_chronicle({'war_events': result.get('war_events', []), 'tension': result.get('tension', 0)})
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# New endpoint – simple combat resolution using legacy SAGA rules
@app.post("/api/brutal/combat")
async def combat_endpoint(request: dict):
    """Thin wrapper around the legacy clash calculator.
    Expects the same schema as the original `/api/brutal/resolve_clash`.
    """
    # The legacy function works synchronously; we call it directly.
    from backend.saga_rules_legacy.rules_engine import clash_calculator as cc
    result = cc.resolve_clash(request.get("attacker"), request.get("defender"))
    return result


# Legacy rules engine wrappers
@app.get("/api/brutal/rules/{rule_name}", response_model=RuleResponse)
def get_rule(rule_name: str):
    """Return metadata for a legacy rule. Currently only 'clash' is implemented."""
    # Dispatch table for legacy rules
    RULE_HANDLERS = {"clash": clash_calculator.resolve_clash}
    if rule_name not in RULE_HANDLERS:
        raise HTTPException(status_code=404, detail="Rule not found")
    return RuleResponse(rule=rule_name, description=f"Legacy rule {rule_name} handler.")

@app.post("/api/brutal/rules/{rule_name}")
def run_rule(rule_name: str, payload: CombatPayload):
    """Execute a legacy rule. Supports 'clash' which uses the clash calculator."""
    # Use dispatch table for execution
    RULE_HANDLERS = {"clash": clash_calculator.resolve_clash}
    handler = RULE_HANDLERS.get(rule_name)
    if not handler:
        raise HTTPException(status_code=404, detail="Rule not found")
    # Assuming each handler accepts attacker and defender named arguments
+    try:
+        result = handler(payload.attacker, payload.defender)
+    except Exception as exc:
+        raise HTTPException(status_code=500, detail=str(exc))
+    return result

connection_state: Dict[WebSocket, dict] = {}

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Initialise a fresh state for this connection and store it
    connection_state[websocket] = {
        "player_id": "unknown",
        "player_data": {},
        "current_hex": {},
        "weather": "",
        "active_quest": None,
        "active_encounter": None,
        "war_events": [],
        "tension": 0,
        "event_trigger": None,
        "narrative_output": "",
    }
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "session_init":
                player_id = message_data.get("character_id", "unknown")
                conn_state = connection_state[websocket]
                conn_state["player_id"] = player_id
                result = await taleweavers_director.saga_director_app.ainvoke(conn_state)
                # Persist state after initialization
                if isinstance(result, dict):
                    save_player_state(result.get('player_data', {}))
                    save_map(result.get('current_hex', {}))
                    save_chronicle({'war_events': result.get('war_events', []), 'tension': result.get('tension', 0)})
                welcome = result.get("narrative_output", f"Welcome {player_id}!")
                connection_state[websocket] = result
                await websocket.send_text(json.dumps({"narrative_text": welcome}))

            elif message_data.get("type") == "player_input":
                player_text = message_data.get("content", "")
                conn_state = connection_state[websocket]
                conn_state["player_input"] = player_text
                result = await taleweavers_director.saga_director_app.ainvoke(conn_state)
                # Persist state after each turn
                if isinstance(result, dict):
                    save_player_state(result.get('player_data', {}))
                    save_map(result.get('current_hex', {}))
                    save_chronicle({'war_events': result.get('war_events', []), 'tension': result.get('tension', 0)})
                connection_state[websocket] = result
                response_text = result.get("narrative_output", "")
                await websocket.send_text(json.dumps({"narrative_text": response_text}))
    except WebSocketDisconnect:
        connection_state.pop(websocket, None)
        print("Player disconnected from VTT chat")
