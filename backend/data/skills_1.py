skills_data = {
    # 1. MIGHT
    "might_assault": [
        {"tier": 1, "name": "Drive Back", "desc": "Free 1-space push on a successful hit."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Cleave", "desc": "Adjacent enemies take half damage from physical strikes."},
        {"tier": 4, "name": "Crushing Weight", "desc": "Striking ignores Shield or Braced armor modifiers."},
        {"tier": 5, "name": "The Wall", "desc": "Free strike when an enemy enters your melee zone."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Sunder", "desc": "Standard strikes automatically apply the [Broken Armor] tag."},
        {"tier": 8, "name": "Momentum", "desc": "Executing a kill restores 1 S-Die and grants a free strike."},
        {"tier": 9, "name": "Unstoppable Force", "desc": "Strikes cannot be dodged or parried."}
    ],
    "might_aegis": [
        {"tier": 1, "name": "Planted", "desc": "Gain +1 Defense if 0 Move Beats were spent this round."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "The Bulwark", "desc": "Allies standing directly behind you receive Full Cover."},
        {"tier": 4, "name": "Rooted", "desc": "Gain absolute immunity to Pushed, Pulled, and Prone tags."},
        {"tier": 5, "name": "Recoil", "desc": "Attackers failing to deal 3+ damage to you take 1 point of recoil damage."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Jarring Halt", "desc": "Melee attackers targeting you instantly gain the [Numb] tag."},
        {"tier": 8, "name": "Unbroken", "desc": "Surviving an attack of 5+ damage grants +1 S-Die and a free Action Beat."},
        {"tier": 9, "name": "Immovable Object", "desc": "Completely immune to non-magical forced movement."}
    ],
    "might_active": [
        {"tier": 1, "name": "Grapple/Throw", "desc": "(1 S-Die) Deal physical damage and push/pull target 1 Zone. Passive: Immune to disarm."},
        {"tier": 2, "name": "Leverage", "desc": "(1 S-Die) Manipulate center-of-mass out of combat to tip heavy structures or stop charging beasts."},
        {"tier": 3, "name": "The Toss", "desc": "(2 S-Die) Thrown enemies gain [Off-Balance] and take collision damage if hitting objects."},
        {"tier": 4, "name": "Momentum Transfer", "desc": "(2 S-Die) Throw allies safely or physically catch falling boulders."},
        {"tier": 5, "name": "Heavy Carry", "desc": "(3 S-Die) Passive: Ignore all physical penalties for dragging wounded or massive loads."},
        {"tier": 6, "name": "The Slam", "desc": "(Passive) T1/T2 cost 0. Thrown targets fall [Prone] and suffer -1 Armor Mod."},
        {"tier": 7, "name": "Mythic Heave", "desc": "(4 S-Die + 1 F-Die) Suplex a giant monster or shatter a watchtower bare-handed."},
        {"tier": 8, "name": "Flow State", "desc": "(Passive) Restore 1 S-Die and 1 F-Die when throwing an enemy into an active hazard."},
        {"tier": 9, "name": "Orbital Drop", "desc": "(5 S-Die + 2 F-Die) Launch target high and drive them into the earth. Permanently [Maims] target, knocks Zone prone."}
    ],

    # 2. ENDURANCE
    "endurance_assault": [
        {"tier": 1, "name": "Shield-Bash", "desc": "Gain +1 to your next Defense roll after executing a successful strike."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Iron Turtle", "desc": "Strike and Defend in the same Action Beat."},
        {"tier": 4, "name": "Relentless", "desc": "Ignore all physical action and movement penalties from injuries."},
        {"tier": 5, "name": "Intercept", "desc": "Reaction to redirect an adjacent ally's incoming attack to yourself."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Exhaust", "desc": "Standard strikes automatically apply the [Winded] tag."},
        {"tier": 8, "name": "Hold the Line", "desc": "Blocking an attack for an ally grants a free Action Beat."},
        {"tier": 9, "name": "Inevitable", "desc": "Your strikes never suffer Disadvantage."}
    ],
    "endurance_aegis": [
        {"tier": 1, "name": "Deflect", "desc": "Reduce all incoming physical damage by a flat 1."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Walking Bunker", "desc": "Ignore movement speed penalties for encumbrance or dragging."},
        {"tier": 4, "name": "Reinforced", "desc": "Gain absolute immunity to Critical Hit damage multipliers."},
        {"tier": 5, "name": "Shatter-Point", "desc": "Missed ranged physical attacks shatter on impact, preventing ricochet."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "The Anvil", "desc": "Enemies tying a contested Clash roll against you automatically lose."},
        {"tier": 8, "name": "Last Stand", "desc": "Dropping to 1 HP instantly restores 1 S-Die and 1 free Action Beat."},
        {"tier": 9, "name": "The Living Wall", "desc": "Gain absolute immunity to Bleeding and Pierced tags."}
    ],
    "endurance_active": [
        {"tier": 1, "name": "Brace", "desc": "(1 S-Die) Reduce incoming damage by a flat 1. Passive: Immune to [Staggered] status."},
        {"tier": 2, "name": "Kinetic Anchor", "desc": "(1 S-Die) Plant feet to become an immovable physical wall."},
        {"tier": 3, "name": "Repel", "desc": "(2 S-Die) Attackers dealing 0 net damage to you are shoved 1 Zone backward."},
        {"tier": 4, "name": "Structural Lock", "desc": "(2 S-Die) Freeze muscle fibers to hold up collapsing ceilings indefinitely."},
        {"tier": 5, "name": "Enviro-Shield", "desc": "(3 S-Die) Passive: Ignore the first 2 points of environmental hazard damage per round."},
        {"tier": 6, "name": "Exhaustion", "desc": "(Passive) T1/T2 cost 0. Attackers targeting your shield gain the [Fatigued] tag."},
        {"tier": 7, "name": "Mythic Stasis", "desc": "(4 S-Die + 1 F-Die) Lock your biology; your HP cannot drop below 1 for the round."},
        {"tier": 8, "name": "Flow State", "desc": "(Passive) Restore 1 S-Die and 1 F-Die when blocking a lethal hit meant for an ally."},
        {"tier": 9, "name": "The Monolith", "desc": "(5 S-Die + 2 F-Die) Absorb a Zone-wide catastrophic attack, taking zero damage and protecting all behind you."}
    ],

    # 3. FINESSE
    "finesse_assault": [
        {"tier": 1, "name": "Lunge", "desc": "Gain +1 space strike reach on melee attacks."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Surgical Flurry", "desc": "Free second strike against a distracted or flanked enemy."},
        {"tier": 4, "name": "Armor Piercing", "desc": "Melee strikes ignore Fortress or Reinforced armor mods."},
        {"tier": 5, "name": "Punish", "desc": "Free strike against a melee enemy that misses an attack against you."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Hamstring", "desc": "Standard strikes automatically apply the [Severed] tag to a targeted limb."},
        {"tier": 8, "name": "The Dissection", "desc": "Applying a Status Tag to an enemy grants you a free Move Beat."},
        {"tier": 9, "name": "Internal Strike", "desc": "Melee strikes bypass physical armor modifications completely."}
    ],
    "finesse_aegis": [
        {"tier": 1, "name": "Contortion", "desc": "Move through occupied enemy spaces without penalty."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Fluid Guard", "desc": "Execute a Move Beat and a Defend action within the same beat."},
        {"tier": 4, "name": "Slippery", "desc": "Gain absolute immunity to Grappled and Restrained tags."},
        {"tier": 5, "name": "Shadow-Step", "desc": "Free 1-space shift when an enemy enters your melee zone."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Overcommit", "desc": "Enemies missing an attack against you instantly gain the [Exposed] tag."},
        {"tier": 8, "name": "The Ghost", "desc": "Successfully dodging an incoming Critical Hit grants you a free Action Beat."},
        {"tier": 9, "name": "Weightless", "desc": "Never trigger physical floor traps, tripwires, or pressure plates."}
    ],
    "finesse_active": [
        {"tier": 1, "name": "Surgical Strike", "desc": "(1 S-Die) Strike an unaware target and shift 1 Zone. Passive: Leave no physical tracks."},
        {"tier": 2, "name": "The Blind Spot", "desc": "(1 S-Die) Hide in shadows and crevices mathematically too small."},
        {"tier": 3, "name": "The Artery", "desc": "(2 S-Die) Stealth strikes apply the [Bleeding] tag and ignore 1 Armor Mod."},
        {"tier": 4, "name": "Disarticulation", "desc": "(2 S-Die) Dislocate joints to slide through iron bars or pick locks by touch."},
        {"tier": 5, "name": "Weightless", "desc": "(3 S-Die) Passive: Cannot trigger pressure plates; take 0 fall damage."},
        {"tier": 6, "name": "Nerve Pinch", "desc": "(Passive) T1/T2 cost 0. Target is [Silenced] and Disarmed."},
        {"tier": 7, "name": "Mythic Slip", "desc": "(4 S-Die + 1 F-Die) Sprint over glass silently or run across sheer, frictionless walls."},
        {"tier": 8, "name": "Flow State", "desc": "(Passive) Restore 1 S-Die and 1 F-Die when eliminating an enemy from stealth."},
        {"tier": 9, "name": "Perfect Murder", "desc": "(5 S-Die + 2 F-Die) Strike microscopic gaps. Silent death; body caught flawlessly."}
    ],

    # 4. REFLEX
    "reflex_assault": [
        {"tier": 1, "name": "Quick-Step", "desc": "Free 1-space shift before or after executing a physical Strike."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Follow-Through", "desc": "Successful hit grants a free secondary strike on an adjacent target."},
        {"tier": 4, "name": "Find the Gap", "desc": "Striking ignores 2 points of physical Armor Mods."},
        {"tier": 5, "name": "Riposte", "desc": "Free strike against a melee attacker that misses you or loses a Clash."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax."},
        {"tier": 7, "name": "Artery Sever", "desc": "Landing two strikes in one round automatically applies [Bleeding] and [Slowed]."},
        {"tier": 8, "name": "Momentum State", "desc": "Securing a kill restores 1 S-Die and grants a free Move Beat."},
        {"tier": 9, "name": "Blinding Speed", "desc": "Strikes cannot be parried or blocked; gain Advantage vs. enemies who haven't acted."}
    ],
    "reflex_aegis": [
        {"tier": 1, "name": "The Slip", "desc": "Free 1-Zone shift after a successful defense or a Clash tie."},
        {"tier": 2, "name": "Loadout Efficiency", "desc": "Permanent -1 to Max Stamina physical gear tax."},
        {"tier": 3, "name": "Sure-Footed", "desc": "Ignore movement penalties from Difficult, Slick, and Unstable terrain tags."},
        {"tier": 4, "name": "Ghost-Step", "desc": "Gain absolute immunity to Attacks of Opportunity."},
        {"tier": 5, "name": "Fluid Escape", "desc": "Automatically succeed on Disengage Clash rolls without rolling dice."},
        {"tier": 6, "name": "Master Loadout", "desc": "Permanent -2 to Max Stamina physical gear tax. Sprint/Dash actions cost 0 Stamina."},
        {"tier": 7, "name": "Overextend", "desc": "Enemies rolling a Critical Failure or missing you by 5+ are knocked [Prone] and [Off-Balance]."},
        {"tier": 8, "name": "Kinetic Battery", "desc": "Moving through 2 or more Zones in a single turn restores 1 S-Die."},
        {"tier": 9, "name": "Untouchable", "desc": "The first physical attack targeted at you each round automatically misses."}
    ],
    "reflex_active": [
        {"tier": 1, "name": "Whirlwind", "desc": "(1 S-Die) Execute a physical Strike and receive a free 1-space shift. Passive: Immune to [Slowed]."},
        {"tier": 2, "name": "Momentum Carry", "desc": "(1 S-Die) Run across water or up vertical walls for a single Move Beat."},
        {"tier": 3, "name": "Cleave-Step", "desc": "(2 S-Die) Strike two adjacent targets seamlessly within a single action."},
        {"tier": 4, "name": "Frictionless Slide", "desc": "(2 S-Die) Slide under falling gates, heavy traps, or sweeping blades."},
        {"tier": 5, "name": "Slip-Step", "desc": "(3 S-Die) Passive: Permanent Advantage on Defense checks vs. Attacks of Opportunity."},
        {"tier": 6, "name": "The Tornado", "desc": "(Passive) T1/T2 cost 0. Hitting 3 targets applies [Off-Balance] to all."},
        {"tier": 7, "name": "Mythic Speed", "desc": "(4 S-Die + 1 F-Die) Instantly take two complete Action Beats in one turn."},
        {"tier": 8, "name": "Flow State", "desc": "(Passive) Restore 1 S-Die and 1 F-Die when dropping an enemy and striking a new one."},
        {"tier": 9, "name": "Thousand Cuts", "desc": "(5 S-Die + 2 F-Die) Strike every enemy in the active Zone simultaneously."}
    ]
}

def get_skills_subset():
    return skills_data
