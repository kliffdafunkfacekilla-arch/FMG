import json
import os
import shutil
import tempfile
from pathlib import Path

# Base data directory (shared with director)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "taleweavers_legacy", "saga_director", "data")

# Ensure the data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# File paths
PLAYER_FILE = os.path.join(DATA_DIR, "player_state.json")
MAP_FILE = os.path.join(DATA_DIR, "Saga_Master_World.json")
CHRONICLE_FILE = os.path.join(DATA_DIR, "Chronicle_Log.json")

def _atomic_write(file_path: str, data: dict) -> None:
    """Write JSON data atomically to avoid corruption.

    Writes to a temporary file in the same directory and then replaces the target.
    """
    # Create a temporary file in the same directory
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(file_path), text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            json.dump(data, tmp_file, ensure_ascii=False, indent=2)
        # Replace the original file atomically
        shutil.move(tmp_path, file_path)
    finally:
        # Clean up the temporary file if something went wrong
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def save_player_state(state: dict) -> None:
    """Persist the *player_data* portion of the game state.

    If *state* is empty the file will contain an empty JSON object.
    """
    _atomic_write(PLAYER_FILE, state or {})

def save_map(state: dict) -> None:
    """Persist the *current_hex* (map) portion of the game state."""
    _atomic_write(MAP_FILE, state or {})

def save_chronicle(state: dict) -> None:
    """Persist the *chronicle* (war events, tension, etc.) portion of the game state."""
    _atomic_write(CHRONICLE_FILE, state or {})
