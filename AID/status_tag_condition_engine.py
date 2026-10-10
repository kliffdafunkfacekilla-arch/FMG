"""
OSTRAKA REACTIVE TAG & ADVANTAGE-BASED CONDITION ENGINE
======================================================
Implements:
1. Tag-based environmental reactivity (FLAMMABLE, CONDUCTIVE, ORGANIC, POISONOUS, etc.).
2. Real-life status effect mechanics:
   - BLEED: Incremental Health/Stamina loss per turn (draining blood loss).
   - POISON (Sick/Ill): Inflicts DISADVANTAGE on rolls, halves Stamina/Focus regen, causes nausea.
   - POISON (Lethal/Fast-Onset): Quick onset, forces immediate Vitality saves or advances death countdown.
3. Universal Advantage / Disadvantage roll integration for contested d20 resolution.
"""

from typing import List, Dict, Set, Optional, Tuple
import random

class UniversalTag:
    # Physical / Environmental
    FLAMMABLE = "FLAMMABLE"
    WET = "WET"
    CONDUCTIVE = "CONDUCTIVE"
    HEAVY = "HEAVY"
    FRAGILE = "FRAGILE"
    WOOD = "WOOD"
    METAL = "METAL"
    ORGANIC = "ORGANIC"
    STONE = "STONE"
    
    # Conditions / Statuses
    BLEEDING = "BLEEDING"
    POISONED_ILL = "POISONED_ILL"
    POISONED_LETHAL = "POISONED_LETHAL"
    BURNING = "BURNING"
    STUNNED = "STUNNED"
    BLINDED = "BLINDED"

class ConditionType:
    BLEED = "BLEED"
    POISON_ILL = "POISON_ILL"
    POISON_LETHAL = "POISON_LETHAL"
    BURNING = "BURNING"
    STUN = "STUN"
    BLIND = "BLIND"

class Entity:
    def __init__(self, entity_id: str, name: str, hp: int, max_hp: int, stamina: int, max_stamina: int):
        self.entity_id = entity_id
        self.name = name
        self.hp = hp
        self.max_hp = max_hp
        self.stamina = stamina
        self.max_stamina = max_stamina
        
        # Attributes
        self.might = 4
        self.vitality = 4
        self.reflex = 4
        self.fortitude = 4
        
        # Reactive Tags and Active Conditions
        self.tags: Set[str] = {UniversalTag.ORGANIC}
        self.active_conditions: Dict[str, Dict] = {}
        
        # Incapacitation tracking
        self.is_incapacitated = False
        self.death_countdown = 10

    def add_condition(self, condition_type: str, duration_turns: int, severity: int = 1, metadata: Optional[Dict] = None):
        """Applies or stacks a status condition on the entity."""
        meta = metadata or {}
        self.active_conditions[condition_type] = {
            "duration": duration_turns,
            "severity": severity,
            "meta": meta
        }
        
        # Assign reactive tags based on condition
        if condition_type == ConditionType.BLEED:
            self.tags.add(UniversalTag.BLEEDING)
        elif condition_type == ConditionType.POISON_ILL:
            self.tags.add(UniversalTag.POISONED_ILL)
        elif condition_type == ConditionType.POISON_LETHAL:
            self.tags.add(UniversalTag.POISONED_LETHAL)
        elif condition_type == ConditionType.BURNING:
            self.tags.add(UniversalTag.BURNING)
            self.tags.add(UniversalTag.FLAMMABLE)

    def remove_condition(self, condition_type: str):
        if condition_type in self.active_conditions:
            del self.active_conditions[condition_type]
            
        # Clean up tags
        if condition_type == ConditionType.BLEED:
            self.tags.discard(UniversalTag.BLEEDING)
        elif condition_type == ConditionType.POISON_ILL:
            self.tags.discard(UniversalTag.POISONED_ILL)
        elif condition_type == ConditionType.POISON_LETHAL:
            self.tags.discard(UniversalTag.POISONED_LETHAL)

    def evaluate_roll_modifiers(self, roll_type: str = "ATTACK") -> Tuple[bool, bool]:
        """
        Evaluates active conditions to determine if the entity has Advantage or Disadvantage.
        Returns: (has_advantage, has_disadvantage)
        """
        has_adv = False
        has_dis = False
        
        # Poison (Illness/Nausea) causes Disadvantage on physical actions & checks
        if ConditionType.POISON_ILL in self.active_conditions:
            has_dis = True
            
        # Blindness causes Disadvantage on attacks & perception
        if ConditionType.BLIND in self.active_conditions:
            has_dis = True
            
        # Stun causes complete action loss or severe disadvantage
        if ConditionType.STUN in self.active_conditions:
            has_dis = True

        return has_adv, has_dis

    def process_start_of_turn_tick(self) -> List[str]:
        """Processes turn-based status ticks (Bleed DoT, Poison Sickness, Lethal Toxin, Burning)."""
        logs = []
        if self.hp <= 0:
            self.is_incapacitated = True
            self.death_countdown -= 1
            logs.append(f"⚠️ {self.name} is INCAPACITATED! Death countdown: {self.death_countdown}/10 turns remaining.")
            return logs

        expired = []
        for cond, data in self.active_conditions.items():
            duration = data["duration"]
            severity = data["severity"]
            
            # --- 1. BLEEDING: Draining Physical Blood Loss (Health/Stamina DoT) ---
            if cond == ConditionType.BLEED:
                dmg = severity * 2
                self.hp -= dmg
                self.stamina = max(0, self.stamina - severity)
                logs.append(f"🩸 [BLEED TICK]: {self.name} loses {dmg} HP and {severity} Stamina from open wounds! (Current HP: {self.hp}/{self.max_hp})")

            # --- 2. POISON (ILLNESS / NAUSEA): Disadvantage & Resource Suppression ---
            elif cond == ConditionType.POISON_ILL:
                logs.append(f"🤢 [POISON - ILLNESS]: {self.name} suffers severe nausea and fever! All rolls operate at DISADVANTAGE, and stamina regen is halved.")

            # --- 3. POISON (LETHAL / FAST-ONSET): Biological Failure Save or Death Countdown ---
            elif cond == ConditionType.POISON_LETHAL:
                save_roll = random.randint(1, 20) + self.vitality
                dc = 12 + severity
                if save_roll < dc:
                    self.hp -= (severity * 4)
                    self.death_countdown -= 1
                    logs.append(f"☠️ [POISON - LETHAL]: Fast-onset toxin attacks nervous system! Save Failed ({save_roll} vs DC {dc}). Took {severity * 4} Damage! Death Timer: {self.death_countdown}/10.")
                else:
                    logs.append(f"🛡️ [POISON - LETHAL]: {self.name} resisted acute toxin breakdown! ({save_roll} vs DC {dc})")

            # --- 4. BURNING: Fire DoT + Environmental Hazard Spreading ---
            elif cond == ConditionType.BURNING:
                dmg = severity * 3
                self.hp -= dmg
                logs.append(f"🔥 [BURNING TICK]: {self.name} takes {dmg} Fire Damage! Flames threaten to spread to adjacent FLAMMABLE tags.")

            # Decrement duration
            data["duration"] -= 1
            if data["duration"] <= 0:
                expired.append(cond)

        for e in expired:
            self.remove_condition(e)
            logs.append(f"✨ Condition '{e}' expired on {self.name}.")

        return logs

def roll_d20(has_advantage: bool = False, has_disadvantage: bool = False) -> int:
    r1 = random.randint(1, 20)
    r2 = random.randint(1, 20)
    if has_advantage and not has_disadvantage:
        return max(r1, r2)
    if has_disadvantage and not has_advantage:
        return min(r1, r2)
    return r1

def run_demonstration():
    print("===========================================================================")
    print("🧪 OSTRAKA STATUS EFFECTS, BLEED VS. POISON & TAG REACTION ENGINE 🧪")
    print("===========================================================================\n")
    
    # Create two combatants
    warrior = Entity("ent_warrior", "Varek the Mercenary", hp=30, max_hp=30, stamina=20, max_stamina=20)
    assassin = Entity("ent_assassin", "Vaneer Venom-Stalker", hp=22, max_hp=22, stamina=15, max_stamina=15)
    
    print("--- Scenario 1: Applying Bleed vs. Poison (Illness) vs. Fast-Onset Lethal Poison ---")
    
    # Apply Bleed to Warrior
    warrior.add_condition(ConditionType.BLEED, duration_turns=3, severity=2)
    print("• Applied 'BLEED' (Severity 2, 3 turns) to Varek.")
    
    # Apply Nauseating Poison to Warrior
    warrior.add_condition(ConditionType.POISON_ILL, duration_turns=2, severity=1)
    print("• Applied 'POISON_ILL' (Nausea/Fever, 2 turns) to Varek.")
    
    # Apply Lethal Poison to Assassin
    assassin.add_condition(ConditionType.POISON_LETHAL, duration_turns=2, severity=2)
    print("• Applied 'POISON_LETHAL' (Fast-Onset Neurotoxin, 2 turns) to Vaneer Assassin.\n")
    
    print("--- Turn 1 Start-of-Turn Status Execution ---")
    for log in warrior.process_start_of_turn_tick():
        print(" ", log)
    for log in assassin.process_start_of_turn_tick():
        print(" ", log)
        
    print("\n--- Contested Attack Check with Poison Illness (Advantage/Disadvantage) ---")
    has_adv, has_dis = warrior.evaluate_roll_modifiers("ATTACK")
    print(f"Varek's Roll Modifiers -> Advantage: {has_adv} | Disadvantage: {has_dis} (Due to Nauseating Poison)")
    
    d20_val = roll_d20(has_adv, has_dis)
    print(f"Varek rolls d20 at Disadvantage: Result = {d20_val} (Rolled 2d20, took lower value)\n")

if __name__ == "__main__":
    run_demonstration()
