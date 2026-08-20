import random
from models import ActionRequest, ActionResponse, DamageType

def resolve_action(req: ActionRequest) -> ActionResponse:
    # 1. Roll 1d20
    roll = random.randint(1, 20)
    
    # 2. Attack Score = 1d20 + Stat + Mod
    attack_score = roll + req.attacker_stat + req.modifier
    
    # 3. Defense Score = 10 + Stat + Armor
    defense_score = 10 + req.defender_stat + req.defender_armor
    
    # 4. Margin of Success
    margin = attack_score - defense_score
    
    # 5. Damage Dealt
    damage = max(0, margin)
    
    # Generate human-readable summary
    if margin > 0:
        msg = f"{req.attacker_name} successfully attacked {req.defender_name}! (Rolled {roll}, Total {attack_score} vs {defense_score}). Dealt {damage} {req.damage_type.value} damage."
    elif margin == 0:
        msg = f"{req.attacker_name} barely missed {req.defender_name}. (Rolled {roll}, Total {attack_score} vs {defense_score})."
    else:
        msg = f"{req.attacker_name} failed to attack {req.defender_name}. (Rolled {roll}, Total {attack_score} vs {defense_score})."

    return ActionResponse(
        roll=roll,
        attack_score=attack_score,
        defense_score=defense_score,
        margin_of_success=margin,
        damage_dealt=damage,
        message=msg
    )
