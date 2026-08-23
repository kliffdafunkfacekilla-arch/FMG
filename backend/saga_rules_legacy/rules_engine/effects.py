import random

def execute_effects(actor, target, skill, calculator):
    """
    Parses a skill's effect array and executes each effect in order.
    Returns a list of narrative log strings.
    """
    logs = []
    
    # Pre-check for modifier conditions
    if "immune_to_crit_fails" in actor.modifiers:
        actor.modifiers["ignore_fails"] = True
    
    for effect in skill.get("effects", []):
        effect_type = effect.get("type")
        
        if effect_type == "DAMAGE":
            log = apply_damage(actor, target, effect, calculator)
            logs.append(log)
        elif effect_type == "HEAL":
            log = apply_heal(actor, target, effect)
            logs.append(log)
        elif effect_type == "APPLY_TAG":
            log = apply_tag(actor, target, effect)
            logs.append(log)
        elif effect_type == "MOVE":
            log = apply_move(actor, target, effect)
            logs.append(log)
        elif effect_type == "MODIFY_RULE":
            log = modify_rule(actor, target, effect)
            logs.append(log)
            
    return logs

def apply_damage(actor, target, effect, calculator):
    # Functional damage logic incorporating tags
    base_stat = effect.get("base", "might")
    tags = effect.get("tags", [])
    
    # Check Brutal vs Brittle
    if "brutal" in tags and "brittle" in target.tags:
        return f"[NARRATIVE BYPASS] The Brutal force instantly shatters the Brittle {target.name} without a roll."
        
    roll_1 = random.randint(1, 20)
    roll_2 = random.randint(1, 20)
    
    disadvantage = False
    if actor.has_disadvantage and not effect.get("ignore_disadvantage"):
        disadvantage = True
        actor.has_disadvantage = False
        
    base_roll = min(roll_1, roll_2) if disadvantage else roll_1
    
    actor_roll = base_roll + actor.get_stat(base_stat)
    target_defense = 10 + target.get_stat("reflexes") # Simplification for now
    
    if "prone" in target.tags:
        target_defense -= 2
    if "exposed" in target.tags:
        target_defense -= 4
        
    if actor_roll > target_defense:
        damage = max(1, actor_roll - target_defense)
        
        # Apply tags logic
        if "impact" in tags:
            # Impact could have extra stagger chance, etc.
            pass
        if "fire" in tags and "flammable" in target.tags:
            damage += 2
            
        target.take_damage(damage)
        
        # Trauma Pipeline
        if damage >= 11:
            target.is_stabilized = False
            return f"[CRITICAL INJURY] {damage} Damage! {target.name}'s anatomy fails. They are bleeding out."
        elif damage >= 7:
            return f"[MAJOR INJURY] {damage} Damage! A brutal strike. {target.name} takes a permanent Trauma token."
        elif damage >= 3:
            target.has_disadvantage = True
            return f"[ADRENALINE SHOCK] {damage} Damage. {target.name} is staggered (Disadvantage on next action)."
        else:
            return f"{actor.name} strikes {target.name} for {damage} damage."
    else:
        return f"{actor.name} misses {target.name}."

def apply_heal(actor, target, effect):
    value = effect.get("value", 0)
    stat = effect.get("stat", "hp")
    
    if stat == "hp":
        target.current_hp = min(target.max_hp, target.current_hp + value)
        return f"{target.name} heals {value} HP."
    elif stat == "composure":
        target.current_composure = min(target.max_composure, target.current_composure + value)
        return f"{target.name} recovers {value} Composure."
    return f"{target.name} recovered."

def apply_tag(actor, target, effect):
    tag = effect.get("tag")
    target_entity = target if effect.get("target") == "enemy" else actor
    
    target_entity.tags.add(tag)
    return f"[{tag.upper()}] Applied to {target_entity.name}."

def apply_move(actor, target, effect):
    distance = effect.get("distance", 1)
    target_entity = target if effect.get("target") == "enemy" else actor
    return f"{target_entity.name} is forcefully moved {distance} Zone(s)."

def modify_rule(actor, target, effect):
    rule = effect.get("rule")
    value = effect.get("value")
    target_entity = target if effect.get("target") == "enemy" else actor
    
    target_entity.modifiers[rule] = value
    return f"Rule Override: {rule} set to {value} for {target_entity.name}."
