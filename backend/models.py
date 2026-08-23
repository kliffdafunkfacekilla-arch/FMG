from pydantic import BaseModel, model_validator, Field
from typing import Optional
from enum import Enum

class DamageType(str, Enum):
    PHYSICAL = "physical" # Targets HP
    MENTAL = "mental"     # Targets Composure

class CharacterStats(BaseModel):
    # Body
    might: int = 0
    endurance: int = 0
    finesse: int = 0
    reflex: int = 0
    vitality: int = 0
    fortitude: int = 0
    
    # Mind
    knowledge: int = 0
    logic: int = 0
    awareness: int = 0
    intuition: int = 0
    charm: int = 0
    willpower: int = 0

class Character(BaseModel):
    id: str
    name: str
    stats: CharacterStats
    
    max_hp: int = 0
    hp: int = 0
    max_composure: int = 0
    composure: int = 0
    
    stamina_capacity: int = 0
    focus_capacity: int = 0
    active_stamina: int = 10
    active_focus: int = 10
    
    armor: int = 0
    mental_armor: int = 0

    perception: int = 0
    stealth: int = 0
    movement: int = 0
    balance: int = 0

    @model_validator(mode='after')
    def set_derived_stats(self) -> 'Character':
        s = self.stats
        self.perception = s.awareness + s.logic + s.vitality
        self.stealth = s.knowledge + s.charm + s.finesse
        self.movement = s.reflex + s.might + s.intuition
        self.balance = s.endurance + s.fortitude + s.willpower
        
        self.max_hp = s.endurance + s.fortitude + s.vitality
        self.max_composure = s.willpower + s.logic + s.charm
        
        self.stamina_capacity = s.might + s.reflex + s.finesse
        self.focus_capacity = s.knowledge + s.awareness + s.intuition
        
        if self.hp == 0: self.hp = self.max_hp
        if self.composure == 0: self.composure = self.max_composure
        return self

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
    defender_roll: int = 10
    attack_score: int
    defense_score: int
    margin_of_success: int
    raw_damage: int
    net_damage: int
    injury_tier: str = "None"
    adrenaline_shock: bool = False
    message: str

class ParsedIntent(BaseModel):
    is_mechanical_action: bool
    action_request: Optional[ActionRequest] = None

class PlayerActionPayload(BaseModel):
    player_text: str
    mechanics: Optional[ActionRequest] = None
    world_state: dict = Field(default_factory=dict)

class ProceduralPlotNode(BaseModel):
    id: str
    type: str  # 'seed' or 'beat'
    title: str
    description: str
    world_impact_flags: list[str] = Field(default_factory=list)

