from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class StoryPayload(BaseModel):
    player_id: str = Field(..., description="Unique identifier for the player")
    state: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional initial state overrides")

class RuleResponse(BaseModel):
    rule: str
    description: str

class CombatPayload(BaseModel):
    attacker: Dict[str, Any]
    defender: Dict[str, Any]
