import json
import os
from pydantic import BaseModel
from typing import Optional

class SettingsModel(BaseModel):
    llm_provider: str = "gemini" # 'gemini' or 'ollama'
    gemini_api_key: Optional[str] = ""

class SettingsManager:
    def __init__(self, filepath: str = "backend/data/settings.json"):
        self.filepath = filepath
        self._ensure_file()
        self.settings = self._load()

    def _ensure_file(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w") as f:
                json.dump(SettingsModel().model_dump(), f, indent=4)

    def _load(self) -> SettingsModel:
        try:
            with open(self.filepath, "r") as f:
                data = json.load(f)
                return SettingsModel(**data)
        except Exception:
            return SettingsModel()

    def save(self, new_settings: SettingsModel):
        self.settings = new_settings
        with open(self.filepath, "w") as f:
            json.dump(self.settings.model_dump(), f, indent=4)

    def get(self) -> SettingsModel:
        return self.settings

settings_manager = SettingsManager()
