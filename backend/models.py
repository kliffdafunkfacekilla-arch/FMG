from pydantic import BaseModel, model_validator, Field
from typing import Optional
from enum import Enum

class DamageType(str, Enum):
    PHYSICAL = "physical" # Targets HP
    MENTAL = "mental"     # Targets Composure

class CharacterStats(BaseModel):
    # Physical
    strength: int = 0
    agility: int = 0
    constitution: int = 0
    toughness: int = 0
    reflexes: int = 0
    
    # Mental/Social
    intellect: int = 0
    willpower: int = 0
    charisma: int = 0
    perception: int = 0
    guile: int = 0
    resolve: int = 0
    presence: int = 0

    @model_validator(mode='after')
    def check_stat_total(self) -> 'CharacterStats':
        total = (self.strength + self.agility + self.constitution + 
                 self.toughness + self.reflexes + self.intellect + 
                 self.willpower + self.charisma + self.perception + 
                 self.guile + self.resolve + self.presence)
        if total != 26:
            raise ValueError(f"Total stats must exactly equal 26. Current sum is {total}.")
        return self

class Character(BaseModel):
    id: str
    name: str
    stats: CharacterStats
    hp: int = 10
    composure: int = 10
    armor: int = 0
    mental_armor: int = 0

class ActionRequest(BaseModel):
    attacker_name: str
    attacker_stat: int
    modifier: int = 0
    
    defender_name: str
    defender_stat: int
    defender_armor: int = 0
    
    damage_type: DamageType = DamageType.PHYSICAL
    
class ActionResponse(BaseModel):
    roll: int
    attack_score: int
    defense_score: int
    margin_of_success: int
    damage_dealt: int
    message: str
