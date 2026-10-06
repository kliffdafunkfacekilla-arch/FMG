"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATURE_SUBTYPES = void 0;
/**
 * Registry of sub-types, size classifications, and ecological roles for each of the 6 creature types.
 */
exports.CREATURE_SUBTYPES = {
    MAMMAL: [
        { subTypeName: 'Rodent / Burrower', sizeClass: 'SMALL', ecologicalRole: 'PREY', statModifiers: { healthBonus: -2, staminaMultiplier: 0.8 } },
        { subTypeName: 'Ungulate / Pack Herder (Boar, Goat, Wolf)', sizeClass: 'MEDIUM', ecologicalRole: 'PREY', statModifiers: { healthBonus: 0, staminaMultiplier: 1.0 } },
        { subTypeName: 'Behemoth (Bear, Hippo, Rhino)', sizeClass: 'LARGE', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +5, staminaMultiplier: 1.3 } }
    ],
    AVIAN: [
        { subTypeName: 'Songbird / Passerine', sizeClass: 'SMALL', ecologicalRole: 'PREY', statModifiers: { healthBonus: -3, staminaMultiplier: 0.7 } },
        { subTypeName: 'Meso-Predator / Raptor (Hawk, Crow)', sizeClass: 'MEDIUM', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: 0, staminaMultiplier: 1.0 } },
        { subTypeName: 'Apex Aviary (Eagle, Roc, Condor)', sizeClass: 'LARGE', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +3, staminaMultiplier: 1.2 } }
    ],
    REPTILE: [
        { subTypeName: 'Serpent / Skink', sizeClass: 'SMALL', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: -2, staminaMultiplier: 0.9 } },
        { subTypeName: 'Stalker / Monitor (Varanus, Dilophosaur)', sizeClass: 'MEDIUM', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +2, staminaMultiplier: 1.1 } },
        { subTypeName: 'Titan / Leviathan (Crocodilian, Drake)', sizeClass: 'LARGE', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +6, staminaMultiplier: 1.4 } }
    ],
    INSECT: [
        { subTypeName: 'Micro-Swarm (Beetle, Ant)', sizeClass: 'SMALL', ecologicalRole: 'PREY', statModifiers: { healthBonus: -4, staminaMultiplier: 0.6 } },
        { subTypeName: 'Huntsman / Arachnid (Mantis, Scorpion)', sizeClass: 'MEDIUM', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +1, staminaMultiplier: 1.0 } },
        { subTypeName: 'Colossal Arthropod (Goliath Hive-Lord)', sizeClass: 'LARGE', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +4, staminaMultiplier: 1.3 } }
    ],
    AQUATIC: [
        { subTypeName: 'Minnow / Crustacean', sizeClass: 'SMALL', ecologicalRole: 'PREY', statModifiers: { healthBonus: -3, staminaMultiplier: 0.7 } },
        { subTypeName: 'Pelagic Hunter (Barracuda, Reef Shark)', sizeClass: 'MEDIUM', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +2, staminaMultiplier: 1.1 } },
        { subTypeName: 'Abyssal Leviathan (Whale, Kraken-Kin)', sizeClass: 'LARGE', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +8, staminaMultiplier: 1.5 } }
    ],
    PLANT: [
        { subTypeName: 'Spore-Cluster / Vine-Seedling', sizeClass: 'SMALL', ecologicalRole: 'PREY', statModifiers: { healthBonus: -1, staminaMultiplier: 0.8 } },
        { subTypeName: 'Thicket-Stalker / Bramble-Ambusher', sizeClass: 'MEDIUM', ecologicalRole: 'PREDATOR', statModifiers: { healthBonus: +3, staminaMultiplier: 1.0 } },
        { subTypeName: 'AnCIENT Greatwood / Sentinel-Root', sizeClass: 'LARGE', ecologicalRole: 'PREY', statModifiers: { healthBonus: +10, staminaMultiplier: 0.9 } }
    ]
};
//# sourceMappingURL=creatureTaxonomy.js.map