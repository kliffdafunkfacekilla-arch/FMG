import random
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple

# ==========================================
# 1. CORE DATA MODELS & CHARACTER SHEET
# ==========================================

@dataclass
class Attributes:
    might: int = 5
    endurance: int = 5
    finesse: int = 5
    reflex: int = 5
    vitality: int = 5
    fortitude: int = 5
    knowledge: int = 5
    logic: int = 5
    awareness: int = 5
    intuition: int = 5
    charm: int = 5
    willpower: int = 5

@dataclass
class GearItem:
    name: str
    slot: str  # "weapon" or "armor"
    associated_stat: str
    roll_modifier: int
    stamina_tax: int = 0
    focus_tax: int = 0
    tags: List[str] = field(default_factory=list)

@dataclass
class Skill:
    name: str
    track_type: str  # "mundane", "sparkborn", "null"
    associated_stat: str
    stamina_loadout_tax: int = 0
    focus_loadout_tax: int = 0
    stamina_cost: int = 0
    focus_cost: int = 0
    tags: List[str] = field(default_factory=list)

class Character:
    def __init__(self, name: str, attributes: Attributes, gear: List[GearItem], skills: List[Skill]):
        self.name = name
        self.attrs = attributes
        self.gear = gear
        self.skills = skills
        
        # Calculate Base Pools
        self.max_hp = self.attrs.vitality + self.attrs.reflex + self.attrs.intuition
        self.current_hp = self.max_hp
        
        self.max_cp = self.attrs.willpower + self.attrs.charm + self.attrs.might
        self.current_cp = self.max_cp
        
        self.base_stamina_capacity = self.attrs.endurance + self.attrs.finesse + self.attrs.logic
        self.base_focus_capacity = self.attrs.knowledge + self.attrs.awareness + self.attrs.fortitude
        
        # Calculate Loadout Taxes
        self.stamina_tax = sum(g.stamina_tax for g in gear) + sum(s.stamina_loadout_tax for s in skills)
        self.focus_tax = sum(g.focus_tax for g in gear) + sum(s.focus_loadout_tax for s in skills)
        
        # Effective Max Capacities after Loadout Reservations
        self.effective_stamina_max = max(1, self.base_stamina_capacity - self.stamina_tax)
        self.effective_focus_max = max(1, self.base_focus_capacity - self.focus_tax)
        
        # Loadout Drag % (using baseline 10 capacity as scale anchor)
        self.stamina_burden_pct = (self.stamina_tax / max(1, self.base_stamina_capacity)) * 100
        self.focus_burden_pct = (self.focus_tax / max(1, self.base_focus_capacity)) * 100
        
        # Active Pools
        self.current_stamina = self.effective_stamina_max
        self.current_focus = self.effective_focus_max
        
        # Status Effects
        self.status_effects: List[str] = []

    def get_regen_rates(self) -> Tuple[int, int]:
        """Calculates stamina/focus regen per turn based on loadout drag."""
        stamina_regen = 2 if self.stamina_burden_pct < 50 else (1 if self.stamina_burden_pct < 75 else 0)
        focus_regen = 2 if self.focus_burden_pct < 50 else (1 if self.focus_burden_pct < 75 else 0)
        return stamina_regen, focus_regen

    def start_turn_regen(self):
        st_regen, fc_regen = self.get_regen_rates()
        self.current_stamina = min(self.effective_stamina_max, self.current_stamina + st_regen)
        self.current_focus = min(self.effective_focus_max, self.current_focus + fc_regen)

    def get_stat_value(self, stat_name: str) -> int:
        return getattr(self.attrs, stat_name.lower(), 3)


# ==========================================
# 2. REACTIVE TAG ENGINE
# ==========================================

class TagEngine:
    """Evaluates environmental or elemental interactions using set logic."""
    INTERACTION_MATRIX = {
        ("fire", "flammable"): "burning",
        ("fire", "oil"): "blaze_aoe",
        ("shock", "conductive"): "electrified",
        ("shock", "wet"): "stun_arc",
        ("force", "brittle"): "shatter",
        ("acid", "metal"): "corrode_armor",
        ("shock", "conductive_water_puddle"): "electrified_puddle_aoe",
    }

    @classmethod
    def evaluate_interaction(cls, attack_tags: List[str], target_tags: List[str]) -> List[str]:
        triggered_effects = []
        for atk_tag in attack_tags:
            for tgt_tag in target_tags:
                key = (atk_tag.lower(), tgt_tag.lower())
                if key in cls.INTERACTION_MATRIX:
                    triggered_effects.append(cls.INTERACTION_MATRIX[key])
        return triggered_effects


# ==========================================
# 3. CONTESTED COMBAT & CLASH RESOLUTION
# ==========================================

class CombatArena:
    def __init__(self, c1: Character, c2: Character, arena_tags: List[str] = None):
        self.c1 = c1
        self.c2 = c2
        self.arena_tags = arena_tags or ["heavy_cover", "conductive_water_puddle"]
        self.log: List[str] = []

    def print_log(self, text: str):
        self.log.append(text)
        print(text)

    def roll_d20(self) -> int:
        return random.randint(1, 20)

    def resolve_clash(self, attacker: Character, defender: Character) -> str:
        """Resolves tie-breaker Clash tactics (Press, Feint, Disengage, Hold)."""
        tactics = ["Press", "Feint", "Disengage", "Hold"]
        t_atk = random.choice(tactics)
        t_def = random.choice(tactics)
        
        self.print_log(f"  ⚔️ CLASH TIE! Attacker locked [{t_atk}], Defender locked [{t_def}].")
        
        # Deduct Clash stamina/focus cost
        attacker.current_stamina = max(0, attacker.current_stamina - 1)
        attacker.current_focus = max(0, attacker.current_focus - 1)
        defender.current_stamina = max(0, defender.current_stamina - 1)
        defender.current_focus = max(0, defender.current_focus - 1)

        matrix = {
            ("Press", "Disengage"): ("Attacker wins Press!", "Defender Pushed Back & Takes Normal Damage"),
            ("Feint", "Press"): ("Attacker wins Feint!", "Defender Disarmed"),
            ("Disengage", "Hold"): ("Attacker wins Disengage!", "Defender Staggered"),
            ("Hold", "Feint"): ("Attacker wins Hold!", "Defender Stunned"),
            ("Disengage", "Press"): ("Defender wins Press!", "Attacker Tripped"),
            ("Press", "Feint"): ("Defender wins Feint!", "Attacker Disarmed"),
            ("Hold", "Disengage"): ("Defender wins Disengage!", "Attacker Staggered"),
            ("Feint", "Hold"): ("Defender wins Hold!", "Attacker Stunned"),
        }
        
        if t_atk == t_def:
            return f"  ⚔️ Clash stalemated: Both locked [{t_atk}]. No breakthrough."
        
        result = matrix.get((t_atk, t_def))
        if result:
            return f"  ⚔️ Clash Outcome: {result[0]} -> {result[1]}"
        else:
            return f"  ⚔️ Clash stalemate between [{t_atk}] vs [{t_def}]."

    def execute_attack_turn(self, attacker: Character, defender: Character):
        self.print_log(f"\n--- {attacker.name}'s Turn (HP: {attacker.current_hp}/{attacker.max_hp} | ST: {attacker.current_stamina}/{attacker.effective_stamina_max} | FC: {attacker.current_focus}/{attacker.effective_focus_max}) ---")
        
        # Start turn regen
        attacker.start_turn_regen()
        
        # Pick weapon & skill
        weapon = next((g for g in attacker.gear if g.slot == "weapon"), GearItem("Unarmed", "weapon", "might", 0))
        armor = next((g for g in defender.gear if g.slot == "armor"), GearItem("Unarmored", "armor", "reflex", 0))
        
        atk_stat_val = attacker.get_stat_value(weapon.associated_stat)
        def_stat_val = defender.get_stat_value(armor.associated_stat)
        
        # Rolls
        d20_atk = self.roll_d20()
        d20_def = self.roll_d20()
        
        total_atk = d20_atk + atk_stat_val + weapon.roll_modifier
        total_def = d20_def + def_stat_val + armor.roll_modifier
        
        self.print_log(f"  🎲 {attacker.name} Attacks with {weapon.name}: Roll {d20_atk} + Stat {atk_stat_val} + Mod {weapon.roll_modifier} = Total [{total_atk}]")
        self.print_log(f"  🛡️ {defender.name} Defends with {armor.name}: Roll {d20_def} + Stat {def_stat_val} + Mod {armor.roll_modifier} = Total [{total_def}]")
        
        diff = total_atk - total_def
        
        if diff < 0:
            self.print_log(f"  ❌ Defense Successful! {defender.name} parries completely (Diff: {diff}). Counter-Attack Window opened!")
        elif diff == 0:
            clash_res = self.resolve_clash(attacker, defender)
            self.print_log(clash_res)
        else:
            # Damage Tiers
            if diff in (1, 2):
                damage = 1
                tier = "Graze"
            elif 3 <= diff <= 5:
                damage = 2
                tier = "Minor Hit"
            elif 6 <= diff <= 9:
                damage = 3
                tier = "Major Hit"
            else:
                damage = 4
                tier = "CRITICAL HIT!"
                
            defender.current_hp -= damage
            self.print_log(f"  💥 {tier}! (Diff: +{diff}) -> Deals {damage} Injury Damage to {defender.name}. (Remaining HP: {max(0, defender.current_hp)}/{defender.max_hp})")
            
            # Tag Reactions
            reactions = TagEngine.evaluate_interaction(weapon.tags, armor.tags + self.arena_tags)
            if reactions:
                self.print_log(f"  🔥 Reactive Tag Triggered! Effects: {', '.join(reactions)}")

    def run_simulation(self, max_rounds: int = 5):
        self.print_log("==================================================")
        self.print_log("⚔️ OSTRAKA RULES TEST ARENA: 1v1 COMBAT SIMULATION ⚔️")
        self.print_log("==================================================")
        self.print_log(f"Combatant 1: {self.c1.name} (Might-Focused Berserker)")
        self.print_log(f"  HP: {self.c1.max_hp} | Stamina Tax: {self.c1.stamina_tax} | Focus Tax: {self.c1.focus_tax}")
        self.print_log(f"Combatant 2: {self.c2.name} (Reflex-Focused Duelist)")
        self.print_log(f"  HP: {self.c2.max_hp} | Stamina Tax: {self.c2.stamina_tax} | Focus Tax: {self.c2.focus_tax}")
        self.print_log(f"Arena Props & Tags: {self.arena_tags}\n")
        
        for r in range(1, max_rounds + 1):
            self.print_log(f"\n==================== ROUND {r} ====================")
            
            # Turn 1: C1 attacks C2
            self.execute_attack_turn(self.c1, self.c2)
            if self.c2.current_hp <= 0:
                self.print_log(f"\n🏆 {self.c1.name} VICTORIOUS! {self.c2.name} has been defeated.")
                break
                
            # Turn 2: C2 attacks C1
            self.execute_attack_turn(self.c2, self.c1)
            if self.c1.current_hp <= 0:
                self.print_log(f"\n🏆 {self.c2.name} VICTORIOUS! {self.c1.name} has been defeated.")
                break


# ==========================================
# 4. ARENA SEED & EXECUTION
# ==========================================

def main():
    random.seed(42)  # Deterministic seed for reproducible testing
    
    # Character 1: Heavy Juggernaut
    attrs_juggernaut = Attributes(might=7, endurance=6, reflex=4, finesse=3, vitality=7, fortitude=6,
                                  knowledge=2, logic=3, awareness=4, intuition=3, charm=2, willpower=5)
    gear_juggernaut = [
        GearItem("Heavy Great-Bludgeon", "weapon", "might", 3, stamina_tax=3, focus_tax=1, tags=["heavy", "force"]),
        GearItem("Plate Armor", "armor", "endurance", 3, stamina_tax=4, focus_tax=1, tags=["metal", "heavy"])
    ]
    skills_juggernaut = [
        Skill("Shattering Cleave", "mundane", "might", stamina_loadout_tax=2, stamina_cost=3, tags=["force"])
    ]
    c1 = Character("Brog the Unbroken", attrs_juggernaut, gear_juggernaut, skills_juggernaut)

    # Character 2: Agile Duelist
    attrs_duelist = Attributes(might=3, endurance=4, reflex=7, finesse=6, vitality=4, fortitude=3,
                               knowledge=4, logic=5, awareness=6, intuition=5, charm=4, willpower=3)
    gear_duelist = [
        GearItem("Spark-Coiled Dueling Blade", "weapon", "finesse", 2, stamina_tax=1, focus_tax=1, tags=["shock", "finesse"]),
        GearItem("Reinforced Camo Attire", "armor", "reflex", 2, stamina_tax=1, focus_tax=0, tags=["flammable", "light"])
    ]
    skills_duelist = [
        Skill("Vibrational Riposte", "sparkborn", "reflex", stamina_loadout_tax=1, focus_loadout_tax=1, focus_cost=2, tags=["shock"])
    ]
    c2 = Character("Kaelen Velocity", attrs_duelist, gear_duelist, skills_duelist)

    arena = CombatArena(c1, c2, arena_tags=["conductive_water_puddle", "wooden_tables"])
    arena.run_simulation(max_rounds=5)

if __name__ == "__main__":
    main()
