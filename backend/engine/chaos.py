import random
from pydantic import BaseModel

class ChaosState(BaseModel):
    ticks: int = 0
    active_number: int = 10

class ChaosResult(BaseModel):
    glitch_triggered: bool = False
    glitch_type: str = ""
    ticks_added: int = 0

def check_chaos(state: ChaosState, roll: int) -> ChaosResult:
    # Margin calculation
    if state.ticks <= 3:
        margin = 0
    elif 4 <= state.ticks <= 6:
        margin = 1
    elif 7 <= state.ticks <= 9:
        margin = 2
    else:
        margin = 3 # handled specially by zone envelopment 
        
    lower_bound = state.active_number - margin
    upper_bound = state.active_number + margin
    
    if lower_bound <= roll <= upper_bound:
        glitch_roll = random.randint(1, 6)
        if glitch_roll <= 2:
            return ChaosResult(glitch_triggered=True, glitch_type="Full Hijack", ticks_added=1)
        elif glitch_roll <= 4:
            return ChaosResult(glitch_triggered=True, glitch_type="Targeted Hijack", ticks_added=1)
        else:
            return ChaosResult(glitch_triggered=True, glitch_type="Pure Luck", ticks_added=1)
            
    return ChaosResult(glitch_triggered=False, ticks_added=0)
