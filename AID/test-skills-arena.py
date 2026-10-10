import random

class Character:
    def __init__(self, name, might=4, endurance=4, finesse=4, reflex=4, vitality=4, fortitude=4,
                 knowledge=4, logic=4, awareness=4, intuition=4, charm=4, willpower=4):
        self.name = name
        
        # 12 Attributes
        self.might = might
        self.endurance = endurance
        self.finesse = finesse
        self.reflex = reflex
        self.vitality = vitality
        self.fortitude = fortitude
        self.knowledge = knowledge
        self.logic = logic
        self.awareness = awareness
        self.intuition = intuition
        self.charm = charm
        self.willpower = willpower
        
        # Derived Pools
        self.max_hp = vitality + reflex + intuition
        self.current_hp = self.max_hp
        
        self.max_cp = willpower + charm + might
        self.current_cp = self.max_cp
        
        self.base_stamina = endurance + finesse + logic + 10
        self.base_focus = knowledge + awareness + fortitude + 10
        
        # Equipped Loadout Taxes
        self.stamina_tax = 0
        self.focus_tax = 0
        
        # Active Pools
        self.current_stamina = self.get_effective_stamina()
        self.current_focus = self.get_effective_focus()
        
        # Status / Buffs
        self.active_shields = []
        self.null_field_active = False
        self.armor_mod = 0

    def equip_gear_and_skills(self, stamina_tax, focus_tax, armor_mod=0):
        self.stamina_tax = stamina_tax
        self.focus_tax = focus_tax
        self.armor_mod = armor_mod
        self.current_stamina = min(self.current_stamina, self.get_effective_stamina())
        self.current_focus = min(self.current_focus, self.get_effective_focus())

    def get_effective_stamina(self):
        eff = self.base_stamina - self.stamina_tax
        if self.stamina_tax / self.base_stamina >= 0.75:
            eff = min(eff, 5)
        return max(eff, 0)

    def get_effective_focus(self):
        eff = self.base_focus - self.focus_tax
        if self.focus_tax / self.base_focus >= 0.75:
            eff = min(eff, 5)
        return max(eff, 0)

    def get_regen_rates(self):
        st_burden = self.stamina_tax / self.base_stamina if self.base_stamina > 0 else 0
        fc_burden = self.focus_tax / self.base_focus if self.base_focus > 0 else 0
        
        st_regen = 2 if st_burden < 0.50 else (1 if st_burden < 0.75 else 0.5)
        fc_regen = 2 if fc_burden < 0.50 else (1 if fc_burden < 0.75 else 0.5)
        return st_regen, fc_regen

    def start_turn_regen(self):
        st_regen, fc_regen = self.get_regen_rates()
        self.current_stamina = min(self.get_effective_stamina(), self.current_stamina + int(st_regen))
        self.current_focus = min(self.get_effective_focus(), self.current_focus + int(fc_regen))

class Skill:
    def __init__(self, name, school, skill_type, stamina_cost, focus_cost, description):
        self.name = name
        self.school = school # e.g., 'Nexus (Fire)', 'Anuminus (Arcane)', 'Might (Mundane)', 'Null Discipline'
        self.skill_type = skill_type # 'Sparkborn Magic', 'Null Exemption', 'Mundane Offense', 'Mundane Defense'
        self.stamina_cost = stamina_cost
        self.focus_cost = focus_cost
        self.description = description

class SkillsArena:
    def __init__(self, c1, c2):
        self.c1 = c1
        self.c2 = c2

    def cast_skill(self, caster, target, skill):
        print(f"\n✨ {caster.name} attempts to use [{skill.name}] ({skill.skill_type} - {skill.school})")
        print(f"   Cost: {skill.stamina_cost} ST, {skill.focus_cost} FC | Current Pools: {caster.current_stamina} ST, {caster.current_focus} FC")
        
        if caster.current_stamina < skill.stamina_cost or caster.current_focus < skill.focus_cost:
            print(f"   ❌ INSUFFICIENT RESOURCES! Required ({skill.stamina_cost} ST / {skill.focus_cost} FC), Available ({caster.current_stamina} ST / {caster.current_focus} FC). Action failed!")
            return False

        # Pay cost
        caster.current_stamina -= skill.stamina_cost
        caster.current_focus -= skill.focus_cost

        # Execute Skill Logic
        if skill.skill_type == 'Sparkborn Magic':
            if target.null_field_active:
                print(f"   🛡️ NULL FIELD ABSORPTION! {target.name}'s Null Discipline unbinds the Aetheric energy of [{skill.name}]. 0 Damage dealt!")
                return True
            
            # Roll spell attack vs defense
            cast_roll = random.randint(1, 20) + caster.knowledge
            def_roll = random.randint(1, 20) + target.reflex + target.armor_mod
            diff = cast_roll - def_roll
            print(f"   🎲 Spell Roll: {cast_roll} vs Target Defense: {def_roll} (Diff: {diff})")

            if diff > 0:
                dmg = 2 if diff <= 4 else (3 if diff <= 9 else 5)
                target.current_hp -= dmg
                print(f"   🔥 SPARK BORN HIT! Deals {dmg} {skill.school} damage to {target.name}! (Target HP: {target.current_hp}/{target.max_hp})")
            else:
                print(f"   🛡️ Spell deflected or resisted by {target.name}!")

        elif skill.skill_type == 'Null Exemption':
            if 'Null Void' in skill.name or 'Aetheric Blackout' in skill.name:
                caster.null_field_active = True
                print(f"   🌌 NULL FIELD ACTIVATED! {caster.name} creates an anti-magic physics sanctuary. Immune to Sparkborn spells for 1 round!")
            elif 'Vascular Precision' in skill.name:
                print(f"   ⚡ VASCULAR PRECISION! {caster.name} exempts muscle groups from friction drag. Next attack gains +4 bonus!")

        elif skill.skill_type == 'Mundane Offense':
            atk_roll = random.randint(1, 20) + caster.might + 2
            def_roll = random.randint(1, 20) + target.fortitude + target.armor_mod
            diff = atk_roll - def_roll
            print(f"   🎲 Martial Attack Roll: {atk_roll} vs Target Armor Roll: {def_roll} (Diff: {diff})")
            if diff > 0:
                dmg = 1 if diff <= 2 else (2 if diff <= 5 else 4)
                target.current_hp -= dmg
                print(f"   💥 MARTIAL STRIKE HIT! Deals {dmg} Physical Damage to {target.name}! (Target HP: {target.current_hp}/{target.max_hp})")
            else:
                print(f"   🛡️ Strike blocked by {target.name}'s armor posture!")

        elif skill.skill_type == 'Mundane Defense':
            caster.armor_mod += 3
            print(f"   🛡️ DEFENSIVE POSTURE! {caster.name} sets [{skill.name}], increasing Armor Mod by +3!")

        return True

def main():
    print("=" * 60)
    print("🔮 OSTRAKA SKILLS & SPELLS TEST ARENA 🔮")
    print("=" * 60)

    # Character 1: Ignis the Sparkborn Sorcerer (Focus-heavy)
    ignis = Character("Ignis the Sparkborn", knowledge=7, awareness=6, fortitude=5, reflex=4, vitality=5, might=3)
    # Gear: Silk Robes (1 ST tax, 2 FC tax)
    ignis.equip_gear_and_skills(stamina_tax=1, focus_tax=2, armor_mod=1)

    # Character 2: Vael the Null Warden (Stamina & Null-heavy)
    vael = Character("Vael the Null Warden", fortitude=7, endurance=6, reflex=5, logic=5, knowledge=2, vitality=6)
    # Gear: Reinforced Null-Plate (6 ST tax, 3 FC tax)
    vael.equip_gear_and_skills(stamina_tax=6, focus_tax=3, armor_mod=3)

    print(f"\nCombatant 1: {ignis.name}")
    print(f"  HP: {ignis.max_hp} | Max ST: {ignis.get_effective_stamina()} | Max FC: {ignis.get_effective_focus()}")
    print(f"  Loadout Taxes: {ignis.stamina_tax} ST / {ignis.focus_tax} FC")

    print(f"\nCombatant 2: {vael.name}")
    print(f"  HP: {vael.max_hp} | Max ST: {vael.get_effective_stamina()} | Max FC: {vael.get_effective_focus()}")
    print(f"  Loadout Taxes: {vael.stamina_tax} ST / {vael.focus_tax} FC")

    # Define Skills & Spells
    thermal_arc = Skill("Thermal Arc", "Nexus (Fire)", "Sparkborn Magic", stamina_cost=0, focus_cost=4, description="Fires a beam of elemental plasma.")
    vector_dart = Skill("Vector Dart", "Anuminus (Arcane)", "Sparkborn Magic", stamina_cost=0, focus_cost=3, description="Hard-light arcane needle projectiles.")
    null_void = Skill("Aetheric Blackout", "Null Discipline", "Null Exemption", stamina_cost=2, focus_cost=3, description="Creates a localized magic-inversion field.")
    vascular_precision = Skill("Vascular Precision", "Null Discipline", "Null Exemption", stamina_cost=3, focus_cost=1, description="Bypasses muscle drag equations.")
    shattering_strike = Skill("Shattering Strike", "Might (Mundane)", "Mundane Offense", stamina_cost=4, focus_cost=0, description="Heavy armor-crushing hammer blow.")
    anvil_posture = Skill("Anvil Posture", "Fortitude (Mundane)", "Mundane Defense", stamina_cost=2, focus_cost=0, description="Hardens skeletal frame.")

    arena = SkillsArena(ignis, vael)

    # SIMULATION ROUNDS
    print("\n" + "="*20 + " TEST TURN 1: Sparkborn Spell Attack " + "="*20)
    ignis.start_turn_regen()
    arena.cast_skill(ignis, vael, thermal_arc)

    print("\n" + "="*20 + " TEST TURN 2: Null Exemption Activation " + "="*20)
    vael.start_turn_regen()
    arena.cast_skill(vael, ignis, null_void)

    print("\n" + "="*20 + " TEST TURN 3: Spell vs Active Null Field " + "="*20)
    ignis.start_turn_regen()
    arena.cast_skill(ignis, vael, vector_dart)

    print("\n" + "="*20 + " TEST TURN 4: Mundane Offense vs Heavy Armor " + "="*20)
    vael.null_field_active = False # Field expires after 1 round
    vael.start_turn_regen()
    arena.cast_skill(vael, ignis, shattering_strike)

    print("\n" + "="*20 + " TEST TURN 5: High Resource Drain & Pool Check " + "="*20)
    ignis.start_turn_regen()
    arena.cast_skill(ignis, vael, thermal_arc)
    arena.cast_skill(ignis, vael, thermal_arc)

if __name__ == '__main__':
    main()
