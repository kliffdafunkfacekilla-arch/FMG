from pydantic import BaseModel, computed_field
from typing import Optional

class BodyStats(BaseModel):
    might: int = 0
    endurance: int = 0
    finesse: int = 0
    reflex: int = 0
    vitality: int = 0
    fortitude: int = 0

class MindStats(BaseModel):
    knowledge: int = 0
    logic: int = 0
    awareness: int = 0
    intuition: int = 0
    charm: int = 0
    willpower: int = 0

class CharacterAttributes(BaseModel):
    body: BodyStats
    mind: MindStats

    @computed_field
    def perception(self) -> int:
        return self.mind.awareness + self.mind.logic + self.body.vitality

    @computed_field
    def stealth(self) -> int:
        return self.mind.knowledge + self.mind.charm + self.body.finesse

    @computed_field
    def movement(self) -> int:
        return self.body.reflex + self.body.might + self.mind.intuition

    @computed_field
    def balance(self) -> int:
        return self.body.endurance + self.body.fortitude + self.mind.willpower

    @computed_field
    def max_hp(self) -> int:
        return self.body.endurance + self.body.fortitude + self.body.vitality

    @computed_field
    def max_composure(self) -> int:
        return self.mind.willpower + self.mind.logic + self.mind.charm

    @computed_field
    def stamina_capacity(self) -> int:
        return self.body.might + self.body.reflex + self.body.finesse

    @computed_field
    def focus_capacity(self) -> int:
        return self.mind.knowledge + self.mind.awareness + self.mind.intuition

class ResourcePools(BaseModel):
    hp: int
    composure: int
    
    active_stamina: int = 10
    active_focus: int = 10
    
    reserve_stamina: int
    reserve_focus: int
    
    physical_gear_tax: int = 0
    mental_gear_tax: int = 0
    
    overburdened: bool = False
