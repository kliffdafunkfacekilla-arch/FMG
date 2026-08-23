# rules_engine/chassis_data.py

KINGDOMS = ["Mammals", "Reptiles & Amphibians", "Avians", "Aquatics", "Insects & Arthropods", "Plants & Myconids"]

SUB_TYPES = ["T0 (Origin)", "T1 (Balancer)", "T2 (Heavy)", "T3 (Predator)", "T4 (Specialist)"]

# Format: BASE_STATS[Kingdom][Sub-Type] = {stat: value}
BASE_STATS = {
    "Mammals": {
        "T0 (Origin)": {"might":3, "endurance":4, "finesse":5, "reflex":2, "vitality":3, "fortitude":1, "knowledge":5, "logic":1, "awareness":2, "intuition":3, "charm":4, "willpower":3},
        "T1 (Balancer)": {"might":3, "endurance":3, "finesse":4, "reflex":3, "vitality":3, "fortitude":2, "knowledge":4, "logic":2, "awareness":3, "intuition":3, "charm":3, "willpower":3},
        "T2 (Heavy)": {"might":4, "endurance":4, "finesse":4, "reflex":2, "vitality":2, "fortitude":2, "knowledge":4, "logic":2, "awareness":2, "intuition":2, "charm":4, "willpower":4},
        "T3 (Predator)": {"might":4, "endurance":5, "finesse":5, "reflex":1, "vitality":2, "fortitude":1, "knowledge":5, "logic":1, "awareness":1, "intuition":2, "charm":5, "willpower":4},
        "T4 (Specialist)": {"might":2, "endurance":4, "finesse":5, "reflex":4, "vitality":2, "fortitude":1, "knowledge":5, "logic":1, "awareness":4, "intuition":2, "charm":4, "willpower":2}
    },
    "Reptiles & Amphibians": {
        "T0 (Origin)": {"might":3, "endurance":2, "finesse":1, "reflex":4, "vitality":3, "fortitude":5, "knowledge":3, "logic":5, "awareness":1, "intuition":4, "charm":3, "willpower":2},
        "T1 (Balancer)": {"might":3, "endurance":3, "finesse":2, "reflex":3, "vitality":3, "fortitude":4, "knowledge":3, "logic":4, "awareness":2, "intuition":3, "charm":3, "willpower":3},
        "T2 (Heavy)": {"might":4, "endurance":2, "finesse":2, "reflex":4, "vitality":2, "fortitude":4, "knowledge":2, "logic":4, "awareness":2, "intuition":4, "charm":4, "willpower":2},
        "T3 (Predator)": {"might":4, "endurance":1, "finesse":1, "reflex":5, "vitality":2, "fortitude":5, "knowledge":2, "logic":5, "awareness":1, "intuition":5, "charm":4, "willpower":1},
        "T4 (Specialist)": {"might":2, "endurance":4, "finesse":1, "reflex":4, "vitality":2, "fortitude":5, "knowledge":2, "logic":5, "awareness":1, "intuition":4, "charm":2, "willpower":4}
    },
    "Avians": {
        "T0 (Origin)": {"might":1, "endurance":3, "finesse":3, "reflex":5, "vitality":4, "fortitude":2, "knowledge":4, "logic":2, "awareness":5, "intuition":1, "charm":3, "willpower":3},
        "T1 (Balancer)": {"might":2, "endurance":3, "finesse":3, "reflex":4, "vitality":3, "fortitude":3, "knowledge":3, "logic":3, "awareness":4, "intuition":2, "charm":3, "willpower":3},
        "T2 (Heavy)": {"might":2, "endurance":4, "finesse":2, "reflex":4, "vitality":4, "fortitude":2, "knowledge":4, "logic":2, "awareness":4, "intuition":2, "charm":4, "willpower":2},
        "T3 (Predator)": {"might":1, "endurance":2, "finesse":4, "reflex":5, "vitality":5, "fortitude":1, "knowledge":5, "logic":1, "awareness":5, "intuition":1, "charm":2, "willpower":4},
        "T4 (Specialist)": {"might":1, "endurance":2, "finesse":2, "reflex":5, "vitality":4, "fortitude":4, "knowledge":4, "logic":4, "awareness":5, "intuition":1, "charm":2, "willpower":2}
    },
    "Aquatics": {
        "T0 (Origin)": {"might":2, "endurance":5, "finesse":4, "reflex":3, "vitality":1, "fortitude":3, "knowledge":2, "logic":3, "awareness":4, "intuition":3, "charm":1, "willpower":5},
        "T1 (Balancer)": {"might":3, "endurance":4, "finesse":3, "reflex":3, "vitality":2, "fortitude":3, "knowledge":3, "logic":3, "awareness":3, "intuition":3, "charm":2, "willpower":4},
        "T2 (Heavy)": {"might":2, "endurance":4, "finesse":4, "reflex":2, "vitality":2, "fortitude":4, "knowledge":2, "logic":4, "awareness":4, "intuition":2, "charm":2, "willpower":4},
        "T3 (Predator)": {"might":1, "endurance":5, "finesse":5, "reflex":4, "vitality":1, "fortitude":2, "knowledge":1, "logic":2, "awareness":5, "intuition":4, "charm":1, "willpower":5},
        "T4 (Specialist)": {"might":4, "endurance":5, "finesse":4, "reflex":2, "vitality":1, "fortitude":2, "knowledge":4, "logic":2, "awareness":4, "intuition":2, "charm":1, "willpower":5}
    },
    "Insects & Arthropods": {
        "T0 (Origin)": {"might":5, "endurance":1, "finesse":3, "reflex":3, "vitality":2, "fortitude":4, "knowledge":3, "logic":4, "awareness":3, "intuition":5, "charm":2, "willpower":1},
        "T1 (Balancer)": {"might":4, "endurance":2, "finesse":3, "reflex":3, "vitality":3, "fortitude":3, "knowledge":3, "logic":3, "awareness":3, "intuition":4, "charm":3, "willpower":2},
        "T2 (Heavy)": {"might":4, "endurance":2, "finesse":4, "reflex":2, "vitality":2, "fortitude":4, "knowledge":2, "logic":4, "awareness":4, "intuition":4, "charm":2, "willpower":2},
        "T3 (Predator)": {"might":5, "endurance":1, "finesse":2, "reflex":4, "vitality":1, "fortitude":5, "knowledge":2, "logic":5, "awareness":4, "intuition":5, "charm":1, "willpower":1},
        "T4 (Specialist)": {"might":5, "endurance":1, "finesse":2, "reflex":2, "vitality":4, "fortitude":4, "knowledge":2, "logic":4, "awareness":2, "intuition":5, "charm":4, "willpower":1}
    },
    "Plants & Myconids": {
        "T0 (Origin)": {"might":4, "endurance":3, "finesse":2, "reflex":1, "vitality":5, "fortitude":3, "knowledge":1, "logic":3, "awareness":3, "intuition":2, "charm":5, "willpower":4},
        "T1 (Balancer)": {"might":3, "endurance":3, "finesse":3, "reflex":2, "vitality":4, "fortitude":3, "knowledge":2, "logic":3, "awareness":3, "intuition":3, "charm":4, "willpower":3},
        "T2 (Heavy)": {"might":4, "endurance":4, "finesse":2, "reflex":2, "vitality":4, "fortitude":2, "knowledge":2, "logic":2, "awareness":4, "intuition":2, "charm":4, "willpower":4},
        "T3 (Predator)": {"might":5, "endurance":2, "finesse":1, "reflex":1, "vitality":5, "fortitude":4, "knowledge":1, "logic":2, "awareness":4, "intuition":1, "charm":5, "willpower":5},
        "T4 (Specialist)": {"might":4, "endurance":2, "finesse":4, "reflex":1, "vitality":5, "fortitude":2, "knowledge":1, "logic":2, "awareness":2, "intuition":4, "charm":5, "willpower":4}
    }
}

ORIGINS = {
    "Mammals": {
        "T2 (Heavy)": ["Horses", "Zebras", "Donkeys", "Cattle/Sheep", "Hippos", "Bears"],
        "T3 (Predator)": ["Deer/Elk", "Wolves", "Coyotes", "Foxes", "Big Cats", "Otters"],
        "T4 (Specialist)": ["Rats", "Mice", "Beavers", "Porcupines", "Flying Squirrels", "Bats"],
        "T1 (Balancer)": ["Monkeys", "Sloths", "Red Pandas", "Raccoons", "Opossums", "Pangolins"],
        "T0 (Origin)": ["Mammal-Standard"]
    },
    "Reptiles & Amphibians": {
        "T2 (Heavy)": ["Stone-Scales", "Crocodiles", "Alligators", "Komodos", "Toad Barons", "Resonance-Basilisks"],
        "T3 (Predator)": ["Serpentes", "Pit-Vipers", "Monitors", "Aquatic Frogs", "Salamander-Lizards", "Crystal-Serpents"],
        "T4 (Specialist)": ["Geckoes", "Gliding Skinks", "Ranidae", "Tree Frogs", "Shovel-Snouts", "Glass-Skinks"],
        "T1 (Balancer)": ["Frilled-Lizards", "Newt-Kin", "Mud Frogs", "Echo-Toads", "Desert Iguanas", "Chameleons"],
        "T0 (Origin)": ["Reptile-Standard"]
    },
    "Avians": {
        "T2 (Heavy)": ["Penguins", "Chickens", "Ostriches/Emus", "Cassowaries", "Turkeys", "Geese"],
        "T3 (Predator)": ["Owls", "Eagles", "Hawks", "Falcons", "Vultures/Condors", "Ospreys"],
        "T4 (Specialist)": ["Finches/Sparrows", "Hummingbirds", "Nightingales", "Mockingbirds", "Lyrebirds", "Magpies"],
        "T1 (Balancer)": ["Ducks", "Ravens/Crows", "Swans", "Parrots/Macaws", "Pigeons/Doves", "Gulls/Albatross"],
        "T0 (Origin)": ["Avian-Standard"]
    },
    "Aquatics": {
        "T2 (Heavy)": ["Walruses", "Orcas", "Giant Crabs", "Lobsters", "Elephant Seals", "Manatees"],
        "T3 (Predator)": ["Great White Sharks", "Hammerhead Sharks", "Barracudas", "Moray Eels", "Tiger Sharks", "Marlin/Swordfish"],
        "T4 (Specialist)": ["Seahorses", "Anglerfish", "Lionfish", "Mantis Shrimp", "Pufferfish", "Flounder/Flatfish"],
        "T1 (Balancer)": ["Koi/Carp", "Salmon/Trout", "Seals/Sea Lions", "Dolphins", "Manta Rays", "Catfish"],
        "T0 (Origin)": ["Aquatic-Standard"]
    },
    "Insects & Arthropods": {
        "T2 (Heavy)": ["Goliath/Rhino Beetles", "Pill Bugs", "Cockroaches", "Stag Beetles", "Soldier Ants", "Ironclad Beetles"],
        "T3 (Predator)": ["Praying Mantises", "Wasps", "Hornets", "Tarantulas", "Assassin Bugs", "Centipedes"],
        "T4 (Specialist)": ["Honey Bees", "Orb-Weaver Spiders", "Caterpillars", "Trapdoor Spiders", "Mosquitoes", "Fleas"],
        "T1 (Balancer)": ["Butterflies", "Moths", "Grasshoppers", "Leafcutter Ants", "Fireflies", "Stick Insects"],
        "T0 (Origin)": ["Insect-Standard"]
    },
    "Plants & Myconids": {
        "T2 (Heavy)": ["Oaks", "Redwoods", "Willows", "Mangroves", "Pines", "Baobabs"],
        "T3 (Predator)": ["Strangler Figs", "Kudzu", "Blood-Briars", "Ivy/Creepers", "Pitcher-Vines", "Morning Glories"],
        "T4 (Specialist)": ["Truffles", "Death Caps", "Ink Caps", "Bioluminescent Mycena", "Puffballs", "Cordyceps"],
        "T1 (Balancer)": ["Roses", "Lotus", "Nightshades", "Orchids", "Sunflowers", "Tumbleweeds"],
        "T0 (Origin)": ["Plant-Standard"]
    }
}

SKILL_TRACKS = {
    "The Wrangler": "might",
    "The Sponge": "endurance",
    "The Dervish": "reflex",
    "The Ghost": "finesse",
    "The Medic": "vitality",
    "The Sunderer": "fortitude",
    "The Warden": "logic",
    "The Sniper": "awareness",
    "The Harrier": "intuition",
    "The Commander": "charm",
    "The Vanguard": "willpower",
    "The Saboteur": "knowledge",
    "Mass": "might",
    "Ordo": "endurance",
    "Flux": "finesse",
    "Motus": "reflex",
    "Vita": "vitality",
    "Nexus": "fortitude",
    "Ratio": "logic",
    "Anumis": "knowledge",
    "Lux": "awareness",
    "Omen": "intuition",
    "Aura": "charm",
    "Lex": "willpower"
}
