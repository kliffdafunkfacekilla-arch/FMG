from enum import Enum
from pydantic import BaseModel
import random

class Tactic(str, Enum):
    PRESS = "press"
    HOLD = "hold"
    MANEUVER = "maneuver"
    TRICK = "trick"
    FEINT = "feint"
    DISENGAGE = "disengage"

class ClashParticipant(BaseModel):
    name: str
    tactic: Tactic
    body_stat: int
    mind_stat: int
    is_physical_attack: bool

class ClashResult(BaseModel):
    winner: str
    loser: str
    delivery: str
    vulnerability: str
    tie: bool = False
    chaos_ticks: int = 0

def resolve_clash(p1: ClashParticipant, p2: ClashParticipant) -> ClashResult:
    # Resolve 1d20 + stat for both
    p1_stat = p1.body_stat if p1.is_physical_attack else p1.mind_stat
    p2_stat = p2.body_stat if p2.is_physical_attack else p2.mind_stat
    
    p1_roll = random.randint(1, 20) + p1_stat
    p2_roll = random.randint(1, 20) + p2_stat
    
    if p1_roll == p2_roll:
        return ClashResult(winner="None", loser="None", delivery="Deadlock continues", vulnerability="Discard 1 S-Die and 1 F-Die", tie=True)
    
    winner = p1 if p1_roll > p2_roll else p2
    loser = p2 if winner == p1 else p1
    
    # Map tactics to outcomes
    outcomes = {
        Tactic.PRESS: ("Steps 1 space forward, overpowering the center.", "Overcommits; suffers amplified counter-damage."),
        Tactic.HOLD: ("Anchors in place; strike delivered from a fixed stance.", "Arcane Note: Spells detonate in the middle, dealing half damage to both and creating an environmental Hazard."),
        Tactic.MANEUVER: ("Shifts 1 space (Left/Right); strikes from flanking angle.", "Attempts to side-step; moves directly into the hit."),
        Tactic.TRICK: ("Alters strike frequency; bypasses all active blocks.", "Bluff exposed; left Stunned by psychological shock."),
        Tactic.FEINT: ("Bait & Switch: Instantly switches spaces with the loser.", "Staggered: Steps out of stance; absorbs strike unprotected."),
        Tactic.DISENGAGE: ("Delivers parting strike; leaps 1 space backward.", "Caught flat-footed; impact throws them farther backward.")
    }
    
    deliv, vul = outcomes[winner.tactic]
    
    # Check Momentum Arrest Rule (Momentum vs Hold/Press tie handled above, this is basic clash)
    
    return ClashResult(
        winner=winner.name,
        loser=loser.name,
        delivery=deliv,
        vulnerability=vul
    )
