from pydantic import BaseModel, model_validator, Field
from typing import List, Dict, Optional
from backend.models.core import CharacterAttributes, BodyStats, MindStats, ResourcePools

class LoadoutItem(BaseModel):
    name: str
    tax: int
    is_physical: bool

class CharacterBuilder(BaseModel):
    name: str
    kingdom: int = Field(..., ge=1, le=6)
    sub_type: int = Field(..., ge=1, le=4)
    base_attributes: CharacterAttributes
    
    loadout: List[LoadoutItem]
    
    @model_validator(mode='after')
    def validate_biological_ceiling(self) -> 'CharacterBuilder':
        # Hard cap of 8 for any attribute
        for stat_name, val in self.base_attributes.body.dict().items():
            if val > 8:
                raise ValueError(f"Biological Ceiling Exceeded: {stat_name} is {val}, cannot exceed 8.")
        for stat_name, val in self.base_attributes.mind.dict().items():
            if val > 8:
                raise ValueError(f"Biological Ceiling Exceeded: {stat_name} is {val}, cannot exceed 8.")
        return self

    @model_validator(mode='after')
    def validate_loadout(self) -> 'CharacterBuilder':
        phys_count = sum(1 for item in self.loadout if item.is_physical)
        ment_count = sum(1 for item in self.loadout if not item.is_physical)
        
        if phys_count != 3 or ment_count != 3:
            raise ValueError(f"Loadout invalid: must have exactly 3 Physical and 3 Mental items. Found {phys_count} Phys, {ment_count} Mental.")
        return self

    def generate_pools(self) -> ResourcePools:
        phys_tax = sum(item.tax for item in self.loadout if item.is_physical)
        ment_tax = sum(item.tax for item in self.loadout if not item.is_physical)
        
        res_stam = self.base_attributes.stamina_capacity - phys_tax
        res_foc = self.base_attributes.focus_capacity - ment_tax
        
        if res_stam < 0 or res_foc < 0:
            raise ValueError("Capacity Non-Negativity violated: Gear tax exceeds capacity.")
            
        overburdened = (phys_tax > self.base_attributes.stamina_capacity / 2) or \
                       (ment_tax > self.base_attributes.focus_capacity / 2)
                       
        return ResourcePools(
            hp=self.base_attributes.max_hp,
            composure=self.base_attributes.max_composure,
            active_stamina=10,
            active_focus=10,
            reserve_stamina=res_stam,
            reserve_focus=res_foc,
            physical_gear_tax=phys_tax,
            mental_gear_tax=ment_tax,
            overburdened=overburdened
        )
