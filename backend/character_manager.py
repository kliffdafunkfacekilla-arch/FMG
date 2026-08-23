import json
import os
from typing import Dict, Optional, List
from models import Character

DB_FILE = "characters.json"

class CharacterManager:
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self._ensure_db()

    def _ensure_db(self):
        if not os.path.exists(self.db_path):
            with open(self.db_path, "w") as f:
                json.dump({}, f)

    def _load(self) -> Dict[str, dict]:
        try:
            with open(self.db_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save(self, data: Dict[str, dict]):
        with open(self.db_path, "w") as f:
            json.dump(data, f, indent=2)

    def get_character(self, char_id: str) -> Optional[Character]:
        data = self._load()
        if char_id in data:
            return Character(**data[char_id])
        return None

    def list_characters(self) -> List[Character]:
        data = self._load()
        return [Character(**v) for v in data.values()]

    def save_character(self, char: Character) -> Character:
        data = self._load()
        data[char.id] = char.model_dump()
        self._save(data)
        return char

    def update_hp(self, char_id: str, hp_change: int) -> Optional[Character]:
        char = self.get_character(char_id)
        if char:
            char.hp = max(0, char.hp + hp_change)
            self.save_character(char)
            return char
        return None

    def update_composure(self, char_id: str, comp_change: int) -> Optional[Character]:
        char = self.get_character(char_id)
        if char:
            char.composure = max(0, char.composure + comp_change)
            self.save_character(char)
            return char
        return None

# Singleton instance
character_manager = CharacterManager()
