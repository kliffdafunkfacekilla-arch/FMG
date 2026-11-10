/**
 * MASTER TAG MANIFEST & ONTOLOGY
 * Comprehensive, living taxonomy of Shatterlands tags for:
 * 1. Careers & Real Professions
 * 2. Workshop & Industry Facilities
 * 3. Forensic Evidence & Crime Scene Clues
 * 4. Wealth, Valuables & Contraband
 * 5. Character Personalities, Virtues & Vices
 * 6. Basic Material Compositions
 * 7. Physical Reactive Qualities & Sensitivities
 * 8. Tactical Affordances & Interactive Object Exploits (Flip tables, swing on chandeliers)
 */

export const MasterTagManifest = {

  // =========================================================================
  // 1. CAREERS & AUTHENTIC PROFESSIONS
  // =========================================================================
  careers: {
    // Primary Resource & Agrarian
    farmer: ['#Farmer', '#Husbandman', '#FieldHand', '#Plowman', '#Harvester'],
    herder: ['#Shepherd', '#Swineherd', '#Grovier', '#CattleHerder', '#Drovery'],
    forestry: ['#Forester', '#Woodcutter', '#CharcoalBurner', '#Sawyer', '#Lumberjack'],
    quarry_mining: ['#Quarryman', '#Stonecutter', '#Miner', '#Collier', '#Pitman', '#Prospector'],
    hunting_fishing: ['#Fisherman', '#Trapper', '#Fowler', '#Gamekeeper', '#Whaler', '#Eeler'],
    foraging: ['#Herbalist', '#Apiarist', '#PeatCutter', '#Gatherer', '#MushroomForager'],

    // Metallurgy & Construction Crafts
    metalworking: ['#Blacksmith', '#Armorer', '#Weaponsmith', '#Farrier', '#Foundryman', '#Smelter', '#Bladesmith'],
    fine_metals: ['#Goldsmith', '#Silversmith', '#Jeweler', '#Pewterer', '#Coppersmith', '#Tinsmith', '#CoinMintAssayer'],
    stone_masonry: ['#Mason', '#Freemason', '#Stonecarver', '#MonumentSculptor', '#Bricklayer', '#Plasterer'],
    carpentry_wood: ['#Carpenter', '#Joiner', '#Cooper', '#Wheelwright', '#Cartwright', '#Woodturner'],
    textiles_leather: ['#Tanner', '#Currier', '#Cobbler', '#Cordwainer', '#Weaver', '#Fuller', '#Dyer', '#Tailor', '#Ropemaker', '#Spinner'],
    specialty_crafts: ['#Potter', '#Glassblower', '#Chandler', '#Soapmaker', '#Locksmith', '#Clockmaker', '#Fletcher', '#Bowyer', '#Basketmaker'],

    // Food, Drink & Hospitality
    food_processing: ['#Miller', '#Baker', '#Brewer', '#Maltster', '#Vintner', '#Distiller', '#Butcher', '#Fishmonger'],
    hospitality: ['#Innkeeper', '#Taverner', '#Cook', '#Roaster', '#Scullion', '#Ostler', '#Stablehand'],

    // Commerce, Transport & Maritime
    mercantile: ['#Merchant', '#CaravanMaster', '#Peddler', '#Hawker', '#ChandlerMerchant', '#Purveyor'],
    maritime: ['#Shipwright', '#Boatbuilder', '#Stevedore', '#Dockworker', '#Lighterman', '#Waterman', '#Sailor', '#Helmsman', '#Harbormaster'],
    logistics: ['#Teamster', '#Carter', '#PackDriver', '#Warehouseman', '#Weighmaster', '#TollKeeper'],

    // Civic, Bureaucratic & Legal
    governance: ['#Mayor', '#Reeve', '#Bailiff', '#Magistrate', '#Judge', '#Alderman', '#Burgomaster'],
    administration: ['#TownClerk', '#Scribe', '#Notary', '#TaxCollector', '#Beadle', '#TownCrier', '#Herald'],
    penal_judicial: ['#Jailer', '#Turnkey', '#Gaoler', '#Executioner', '#Coroner', '#WatchBailiff'],

    // Security, Guard & Military
    city_watch: ['#Watchman', '#WatchSergeant', '#WatchCaptain', '#Sentry', '#GateGuard', '#RampartGuard', '#NightWatch'],
    military: ['#Soldier', '#ManAtArms', '#Halberdier', '#Pikeman', '#Crossbowman', '#Archer', '#ShieldBearer', '#Scout'],
    mercenary_bounty: ['#Sellsword', '#Mercenary', '#Freebooter', '#Bodyguard', '#BountyHunter', '#Duelist'],

    // Scholarship, Medicine & Faith
    medicine: ['#Physician', '#Chirurgeon', '#Apothecary', '#Leech', '#Midwife', '#HerbalHealer', '#BoneSetter'],
    scholarship: ['#Scholar', '#Philosopher', '#Alchemist', '#Cartographer', '#Librarian', '#Astronomer', '#Naturalist'],
    clergy: ['#Priest', '#Priestess', '#Chaplain', '#Monk', '#Nun', '#Acolyte', '#Friar', '#Preacher', '#Sexton', '#Gravedigger'],

    // Underworld & Shadow Trade
    illicit: ['#Thief', '#Cutpurse', '#Pickpocket', '#Burglar', '#Smuggler', '#Fence', '#Footpad', '#Highwayman', '#Bandit', '#Racketeer', '#Enforcer', '#Infiltrator', '#Spy', '#Informant'],
    marginalized: ['#Beggar', '#Vagrant', '#Scavenger', '#Mudlark', '#Ragpicker', '#Tinkerer']
  },

  // =========================================================================
  // 2. WORKSHOPS, INDUSTRY & PRODUCTION FACILITIES
  // =========================================================================
  facilities: {
    metal_facilities: ['#Smithy', '#Foundry', '#SmeltingFurnace', '#Bloomery', '#CoinMint', '#ArmoryForge'],
    milling_facilities: ['#GristMill', '#Windmill', '#Watermill', '#TideMill', '#Horsemill'],
    food_facilities: ['#BakeryOven', '#BreweryKettle', '#Distillery', '#Malthouse', '#SaltingHouse', '#Smokehouse', '#Slaughterhouse', '#CheeseCave'],
    textile_facilities: ['#TanneryPit', '#DyeWorks', '#WeavingLoom', '#FullingMill', '#Ropewalk', '#Tailory'],
    wood_stone_facilities: ['#CarpentryShop', '#Sawmill', '#TimberYard', '#Cooperage', '#MasonryYard', '#StonecarvingAtelier', '#PotteryKiln', '#Glassworks'],
    maritime_facilities: ['#Shipyard', '#Drydock', '#BoatSlip', '#SailLoft', '#FishMarketWharf'],
    scientific_sacred_facilities: ['#ApothecaryLab', '#AlchemicalFurnace', '#HerbalDryingShed', '#Stillhouse', '#Scriptorium', '#PrintingPress', '#SanctuaryAltar']
  },

  // =========================================================================
  // 3. EVIDENCE, FORENSIC & CRIME SCENE MARKS
  // =========================================================================
  evidence: {
    physical_traces: ['#BloodyFootprint', '#BloodyHandprint', '#DragMarks', '#StruggledGround', '#DisturbedDust', '#FreshGravedigging'],
    breaches_tampering: ['#BrokenLock', '#ScratchedKeyhole', '#PriedHasp', '#CutBars', '#BrokenWindow', '#SeveredRope', '#ForcedLatch'],
    combat_residue: ['#StainedDagger', '#BrokenBladeHilt', '#SpentCrossbowBolt', '#ShatteredShieldWood', '#StrangulationCord', '#BloodSplatters'],
    alchemical_toxins: ['#PoisonResidue', '#AlchemicalStain', '#BurnedChemicalPowder', '#SmellingSalts', '#ViperVenomVial', '#AcidEtching'],
    documents_records: ['#EmbezzledLedger', '#ForgedDecree', '#CounterfeitSeal', '#BurnedLetterFragment', '#BlackmailMissive', '#EncryptedCipher', '#SmugglerManifest', '#BribeReceipt', '#StolenInsignia'],
    anomalous_traces: ['#DragonScaleResidue', '#AethericSinge', '#LeyResonanceEcho', '#ColdSpotNecrotic', '#CrackedRunePebble']
  },

  // =========================================================================
  // 4. WEALTH, VALUABLES & CONTRABAND
  // =========================================================================
  wealth_and_contraband: {
    legal_wealth: ['#BullionChest', '#UngildedSilver', '#RoyalMintCoin', '#TradeBars', '#JeweledChalice', '#UncutGems', '#ImperialPearls', '#VelvetCasket', '#PreciousHeirloom', '#GoldTithe'],
    illicit_contraband: ['#SmuggledSilks', '#UntaxedSpices', '#ProhibitedAlchemicalPowder', '#BlackMarketGrain', '#SmuggledWeaponsCrate', '#UnmarkedFirearms', '#ViperDustNarcotic', '#AetherOpium'],
    heretical_relics: ['#ForbiddenTome', '#DesecratedRelic', '#BloodMoonIcon', '#SeveredFingerTalisman', '#StolenMunicipalCharter', '#ContrabandRuneSlab']
  },

  // =========================================================================
  // 5. CHARACTER PERSONALITIES, VIRTUES & VICES
  // =========================================================================
  personalities: {
    virtues: [
      '#Honorable', '#Compassionate', '#Courageous', '#Diligent', '#Generous',
      '#Loyal', '#Incorruptible', '#Protective', '#Pious', '#Stoic',
      '#Pragmatic', '#Meticulous', '#Merciful', '#FairMinded', '#Patient', '#Humble'
    ],
    vices_and_flaws: [
      '#Greedy', '#Cruel', '#Cowardly', '#Vengeful', '#Paranoid',
      '#Treacherous', '#Sadistic', '#Arrogant', '#Wrathful', '#Gullible',
      '#Stubborn', '#Deceitful', '#Fanatical', '#Addicted', '#Gluttonous',
      '#Hedonistic', '#Corruptible', '#Vain', '#Jealous', '#Indolent'
    ],
    demeanor_temperament: [
      '#SoftSpoken', '#Boisterous', '#Blunt', '#Charming', '#Cynical',
      '#Secretive', '#Melancholic', '#Skeptical', '#Superstitious', '#Pompous',
      '#Obsequious', '#HotHeaded', '#Calculating', '#Jovial', '#Brooding', '#Mercurial'
    ]
  },

  // =========================================================================
  // 6. BASIC MATERIAL COMPOSITIONS
  // =========================================================================
  materials: {
    wood: ['#Wood_Oak', '#Wood_Pine', '#Wood_Ironwood', '#Wood_Rotten', '#Wood_Polished'],
    metals: ['#Metal_Iron', '#Metal_Steel', '#Metal_Bronze', '#Metal_Copper', '#Metal_Lead', '#Metal_Gold', '#Metal_Silver', '#Metal_Rusted'],
    minerals_stone: ['#Stone_Granite', '#Stone_Marble', '#Stone_Limestone', '#Stone_Cobblestone', '#Stone_Sandstone', '#Brick', '#Clay', '#Ceramic'],
    fabrics_leather: ['#Cloth_Linen', '#Cloth_Wool', '#Cloth_Silk', '#Cloth_Ragged', '#Leather_Hard', '#Leather_Supple', '#RawHide'],
    miscellaneous_matter: ['#Glass', '#Parchment', '#Paper', '#Rope_Hemp', '#Bone', '#Wax', '#Straw', '#Tar_Pitch', '#Ice', '#Water']
  },

  // =========================================================================
  // 7. REACTIVE QUALITIES & SENSITIVITIES (Physical & Environmental Physics)
  // =========================================================================
  reactive_qualities: {
    thermal_combustion: ['#Flammable', '#HighlyCombustible', '#Explosive', '#MeltsUnderHeat', '#FireResistant', '#Charred'],
    structural_integrity: ['#Fragile', '#Brittle', '#Shatterable', '#Heavy', '#Dense', '#Lightweight', '#Hollow', '#Buckling'],
    electrical_arcane: ['#Conductive', '#Insulating', '#ResonantToAether', '#DampensMagic', '#LeyAttracting', '#StaticCharged'],
    fluid_decay: ['#Waterproof', '#WaterDamaged', '#WaterSoluble', '#Rusting', '#Corroded', '#Decaying', '#Rotting', '#Putrid'],
    tactile_surface: ['#Slippery', '#Sticky', '#SharpEdge', '#Barbed', '#Greasy', '#Splintered'],
    hazards_toxins: ['#ToxicFumesOnBurn', '#PoisonCoated', '#Acidic', '#Corrosive', '#Biohazardous']
  },

  // =========================================================================
  // 8. SPECIAL TACTICAL AFFORDANCES (Player Interaction & Exploits)
  // =========================================================================
  tactical_affordances: {
    // Physical cover & barricading
    flippable: ['#Flippable', '#FlippedCover', '#CoverProviding'], // Tables, heavy benches, carts, stalls
    barricadeable: ['#Barricadeable', '#Barricaded', '#DoorBraced'], // Doors, windows, archways, narrow alleys

    // Mobility, elevation & acrobatics
    swingable: ['#Swingable', '#SwungTackle'], // Chandeliers, hanging ropes, hoist pulleys, awnings, chains
    climbable: ['#Climbable', '#HighVantage', '#Scaffolding'], // Ladders, bookshelves, trellises, stacks of crates, rigging

    // Dynamic environmental offense
    pushable: ['#Pushable', '#RollableHazard'], // Heavy boulders, wine casks, bookcases, armoires, coal carts
    throwable: ['#Throwable', '#ImprovisedMissile'], // Bottles, beer steins, stools, bricks, torches, iron tongs
    smashable: ['#Smashable', '#BreachablePartition'], // Glass display cases, thin partitions, railings, casks
    collapsible: ['#Collapsible', '#StructuralWeakness'], // Rickety scaffolding, frayed bridge ropes, rotten floorboards

    // Stealth, visibility & light manipulation
    snuffable: ['#Snuffable', '#LightSourceActive', '#Extinguished'], // Torches, braziers, lanterns, hearths
    ignitable: ['#Ignitable', '#IgnitedHazard'], // Barrels of pitch, straw beds, curtains, oil slicks
    hiding_spot: ['#HidingSpot', '#ConcealedUnderneath'] // Wine barrels, haystacks, wardrobes, under beds, dark alcoves
  }
};

/**
 * Flattens all tags across all categories into a single Set for validation.
 */
export function getAllManifestTags(): Set<string> {
  const set = new Set<string>();

  function collect(obj: any) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'string' && item.startsWith('#')) {
          set.add(item);
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const val of Object.values(obj)) {
        collect(val);
      }
    }
  }

  collect(MasterTagManifest);
  return set;
}

/**
 * Checks if an entity possesses an interactive tactical affordance.
 */
export function hasTacticalAffordance(
  entityTags: string[],
  affordance: keyof typeof MasterTagManifest.tactical_affordances
): boolean {
  const allowed = new Set(MasterTagManifest.tactical_affordances[affordance]);
  return entityTags.some(t => allowed.has(t));
}

