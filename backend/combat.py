import random
from backend.models import ActionRequest, ActionResponse, DamageType

def resolve_action(req: ActionRequest) -> ActionResponse:
    # 1. Contested Rolls
    attacker_roll = random.randint(1, 20)
    defender_roll = random.randint(1, 20)
    
    # 2. Attack Score = 1d20 + Stat + Mod
    attack_score = attacker_roll + req.attacker_stat + req.modifier
    
    # 3. Defense Score = 1d20 + Stat
    defense_score = defender_roll + req.defender_stat
    
    # 4. Margin of Success
    margin = attack_score - defense_score
    
    # 5. Damage Dealt (Armor Mitigation)
    raw_damage = max(0, margin)
    net_damage = max(0, raw_damage - req.defender_armor) if raw_damage > 0 else 0
    
    # 6. Injury Thresholds
    injury_tier = "None"
    adrenaline_shock = False
    
    if net_damage >= 11:
        injury_tier = "Critical Injury"
        adrenaline_shock = True
    elif net_damage >= 6:
        injury_tier = "Major Injury"
        adrenaline_shock = True
    elif net_damage >= 3:
        injury_tier = "Minor Injury"
        adrenaline_shock = True
    elif net_damage >= 1:
        injury_tier = "Flinch"
    
    # Generate human-readable summary
    if margin > 0:
        msg = f"{req.attacker_name} successfully attacked {req.defender_name}! (Atk: {attacker_roll}+{req.attacker_stat} vs Def: {defender_roll}+{req.defender_stat}). Raw Dmg: {raw_damage}, Armor Mod: -{req.defender_armor}. Net Damage: {net_damage} {req.damage_type.value}.\nResult: {injury_tier}."
    elif margin == 0:
        msg = f"{req.attacker_name} clashed with {req.defender_name} in a deadlock! (Atk: {attack_score} vs Def: {defense_score}). Both lose 1 Stamina and 1 Focus."
    else:
        msg = f"{req.attacker_name} failed to hit {req.defender_name}. (Atk: {attack_score} vs Def: {defense_score})."

    return ActionResponse(
        roll=attacker_roll,
        defender_roll=defender_roll,
        attack_score=attack_score,
        defense_score=defense_score,
        margin_of_success=margin,
        raw_damage=raw_damage,
        net_damage=net_damage,
        injury_tier=injury_tier,
        adrenaline_shock=adrenaline_shock,
        message=msg
    )
