from pydantic import BaseModel
import random

class DamageRequest(BaseModel):
    raw_damage: int
    armor_mod: int
    is_physical: bool

class TraumaResult(BaseModel):
    net_damage: int
    adrenaline_shock: bool = False
    location_tally: int = 0
    continuous_bleed: bool = False
    critical_escalation: bool = False

def calculate_trauma(req: DamageRequest) -> TraumaResult:
    net_damage = max(0, req.raw_damage - req.armor_mod)
    
    if net_damage <= 0:
        return TraumaResult(net_damage=0)
        
    if 1 <= net_damage <= 2:
        return TraumaResult(net_damage=net_damage)
        
    elif 3 <= net_damage <= 5:
        # Minor Injury
        return TraumaResult(
            net_damage=net_damage, 
            adrenaline_shock=True, 
            location_tally=1
        )
        
    elif 6 <= net_damage <= 10:
        # Major Injury
        return TraumaResult(
            net_damage=net_damage, 
            adrenaline_shock=True, 
            location_tally=1,
            continuous_bleed=True
        )
        
    else: # 11+
        # Critical Injury
        return TraumaResult(
            net_damage=net_damage, 
            adrenaline_shock=True, 
            location_tally=2,
            continuous_bleed=True,
            critical_escalation=True
        )

def roll_injury_location(is_physical: bool) -> str:
    roll = random.randint(1, 4)
    if is_physical:
        return ["Legs", "Arms", "Core", "Head"][roll - 1]
    else:
        return ["Confidence", "Reason", "Instinct", "Memory"][roll - 1]
