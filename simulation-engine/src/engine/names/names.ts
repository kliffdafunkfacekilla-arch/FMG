/**
 * The one place people get their names. Each species belongs to a naming culture with its own given names
 * and surnames; surnames are built from a prefix and a suffix ("Grey" + "Pelt" -> "Grey-Pelt", "Ash" + "ford"
 * -> "Ashford"), so a culture has hundreds of family names instead of a handful.
 * NameBook keeps a town's names unique: it remembers every name already used there and redraws on a clash.
 */

interface NameCulture {
  given: readonly string[];
  /** Whole surnames used as they are. */
  surnames: readonly string[];
  /** Surname parts: prefix + joiner + suffix. */
  prefixes: readonly string[];
  suffixes: readonly string[];
  joiner: "-" | "";
}

/** Plain market-town names: the fallback for a species with no naming culture of its own. */
const COMMON: NameCulture = {
  given: [
    "Elian", "Vaelen", "Mara", "Lucian", "Kenneth", "Cassian", "Theron", "Orla", "Danica", "Gareth", "Fiona", "Tobias",
    "Morwen", "Darek", "Brina", "Jarek", "Sylvia", "Aldric", "Bertil", "Celene", "Doran", "Edda", "Fenna", "Gisla",
    "Halvard", "Ingrith", "Joren", "Katrin", "Leoric", "Maelis", "Nessa", "Osric", "Petra", "Quill", "Rhosyn", "Soren",
    "Tamsin", "Ulric", "Verity", "Wendel", "Ysolde", "Anselm", "Briar", "Corin", "Dagny", "Emrys", "Hester", "Ivo",
  ],
  surnames: [
    "Thorne", "Vance", "Miller", "Fletcher", "Cooper", "Vane", "Frost", "Stone", "Cross", "Sterling", "Pike", "Weaver",
    "Harrow", "Rook", "Tanner", "Carter", "Mercer", "Thatcher", "Chandler", "Wright", "Fowler", "Sawyer", "Brewer", "Hale",
  ],
  prefixes: ["Ash", "Black", "Clear", "Iron", "Oak", "Brook", "Cold", "Dun", "Elm", "Fair", "Gray", "Hollow", "Kings", "Marsh", "Red", "Silver", "Thorn", "West", "Wil"],
  suffixes: ["wood", "fall", "water", "haven", "ford", "well", "more", "field", "brook", "dale", "wick", "ridge", "stead", "bury"],
  joiner: "",
};

const SKY: NameCulture = {
  given: [
    "Corvus", "Aeron", "Peregrine", "Skye", "Talon", "Cirrus", "Zephyr", "Kestrel", "Osprey", "Altair", "Sora", "Gale",
    "Aquila", "Brisa", "Cael", "Dove", "Elanus", "Falco", "Hirundo", "Ibis", "Jay", "Kite", "Lark", "Merlin", "Nimbus",
    "Orrin", "Pica", "Quetz", "Rallus", "Strix", "Tern", "Vireo", "Wren", "Ardea", "Buteo", "Ciel", "Egret", "Finch",
  ],
  surnames: [],
  prefixes: ["Wind", "Cloud", "Sky", "Feather", "Gale", "Storm", "High", "Sun", "Dawn", "Cliff", "Thunder", "Mist", "Silver", "Swift", "Far", "Moon"],
  suffixes: ["Rider", "Crest", "Watcher", "Bound", "Walker", "Beak", "Roost", "Wing", "Plume", "Call", "Diver", "Glide", "Eye"],
  joiner: "-",
};

const CANID: NameCulture = {
  given: [
    "Fenrir", "Lupen", "Varik", "Kira", "Ragnar", "Skoll", "Volf", "Freki", "Torva", "Astrid", "Bryn", "Canis", "Dagr",
    "Eira", "Garm", "Hati", "Ingrid", "Jorun", "Kaldr", "Lyka", "Mani", "Nyra", "Ulf", "Rurik", "Signy", "Tyra", "Vali",
    "Ylva", "Asger", "Brand", "Dusk", "Grima", "Haldor", "Rune", "Sigrun", "Toki",
  ],
  surnames: [],
  prefixes: ["Blood", "Moon", "Grey", "Swift", "Night", "Pine", "Frost", "Ash", "Iron", "Storm", "Bone", "Red", "Silver", "Ember", "Dusk", "Hollow", "Snow", "Thorn"],
  suffixes: ["Howl", "Stalker", "Pelt", "Fang", "Tracker", "Runner", "Mane", "Tooth", "Paw", "Tail", "Eye", "Song"],
  joiner: "-",
};

const FELINE: NameCulture = {
  given: [
    "Leona", "Raza", "Sabre", "Tigran", "Panthera", "Vesper", "Lynx", "Cleo", "Zara", "Asha", "Bast", "Caro", "Dahlia",
    "Esmer", "Felis", "Ghazal", "Indra", "Jasmin", "Kali", "Leon", "Mirza", "Nala", "Omar", "Persa", "Rani", "Simba",
    "Tamar", "Ursa", "Yara", "Zafir", "Amber", "Cinder", "Saffron", "Tawny",
  ],
  surnames: [],
  prefixes: ["Silent", "Shadow", "Sun", "Razor", "Night", "Dune", "Velvet", "Gold", "Ember", "Soft", "Quick", "Amber", "Sand", "Moon"],
  suffixes: ["Paws", "Pounce", "Basker", "Claw", "Stalker", "Leaper", "Whisker", "Eye", "Tail", "Step", "Purr", "Fang"],
  joiner: "-",
};

const URSINE: NameCulture = {
  given: [
    "Bjorn", "Kaelis", "Ursan", "Torben", "Grizel", "Brant", "Hulda", "Bram", "Orson", "Valko", "Thora", "Arno", "Berit",
    "Gunnar", "Halla", "Ivar", "Knut", "Liv", "Magnhild", "Odd", "Ragna", "Sten", "Tove", "Ulla", "Vigdis", "Yngve",
    "Borg", "Dagmar", "Frode", "Gerd", "Hakon", "Kolbein",
  ],
  surnames: [],
  prefixes: ["Iron", "Rock", "Honey", "Heavy", "Frost", "Brawn", "Stone", "Deep", "Moss", "Tide", "Salt", "Kelp", "Slate", "Oak"],
  suffixes: ["Paw", "Cleaver", "Crag", "Stride", "Fur", "Hammer", "Back", "Den", "Tusk", "Hide", "Belly", "Maw"],
  joiner: "-",
};

const SCALED: NameCulture = {
  given: [
    "Krag", "Ssys", "Xerxes", "Gorgon", "Viper", "Drakon", "Caiman", "Basil", "Azhar", "Bask", "Chessa", "Draxa", "Eshk",
    "Ghar", "Hissa", "Iksa", "Jhar", "Kesh", "Luzz", "Mosk", "Naga", "Ossk", "Rhaz", "Sesh", "Thask", "Uzz", "Vrask",
    "Zessa", "Aklo", "Brak", "Croa", "Glib", "Murk", "Pip",
  ],
  surnames: [],
  prefixes: ["Iron", "Deep", "Mud", "Venom", "Swamp", "Spire", "Bog", "Reed", "Sun", "Coil", "Green", "Black", "Silt", "Jade"],
  suffixes: ["Scale", "Basker", "Crag", "Spit", "Stalker", "Tail", "Fang", "Tongue", "Hide", "Eye", "Croak", "Coil"],
  joiner: "-",
};

const GREEN: NameCulture = {
  given: [
    "Rowan", "Bramble", "Thorn", "Moss", "Willow", "Oakley", "Sylvan", "Fern", "Petal", "Barkley", "Alder", "Birch",
    "Clover", "Daisy", "Elder", "Furze", "Hazel", "Ivy", "Juniper", "Laurel", "Myrtle", "Nettle", "Olive", "Poppy",
    "Reed", "Sorrel", "Tansy", "Yarrow", "Aspen", "Cedar", "Heather", "Linden",
  ],
  surnames: [],
  prefixes: ["Deep", "Green", "Sap", "Briar", "Autumn", "Iron", "Root", "Moss", "Thistle", "Dew", "Bloom", "Old", "Hedge"],
  suffixes: ["Root", "Bough", "Flow", "Twist", "Leaf", "Bark", "Bloom", "Seed", "Vine", "Thorn", "Bud", "Ring"],
  joiner: "-",
};

const SIMIAN: NameCulture = {
  given: ["Ako", "Bimba", "Chiku", "Dabu", "Enzi", "Faki", "Gogo", "Hasi", "Imani", "Juma", "Kito", "Lulu", "Mosi", "Nuru", "Oba", "Pili", "Rafiki", "Sefu", "Tumo", "Zuri", "Baraka", "Kibo", "Neema", "Sauti"],
  surnames: [],
  prefixes: ["Vine", "Canopy", "Bright", "Long", "Quick", "Fruit", "Branch", "Loud", "Sun", "Rain", "High", "Wide"],
  suffixes: ["Swinger", "Arm", "Eye", "Grip", "Call", "Climber", "Leaper", "Hand", "Chatter", "Tail", "Brow", "Foot"],
  joiner: "-",
};

const CHITIN: NameCulture = {
  given: ["Chitin", "Vespis", "Khepri", "Myrmex", "Mantor", "Skitter", "Vespa", "Coleus", "Aphid", "Buzzra", "Cicada", "Drone", "Elytra", "Formi", "Hivra", "Ixil", "Kesk", "Lumen", "Nyx", "Ptera", "Silk", "Thrix", "Weba", "Zizz"],
  surnames: [],
  prefixes: ["Hive", "Silk", "Amber", "Hollow", "Dust", "Comb", "Thread", "Glass", "Night", "Honey", "Spindle", "Stone"],
  suffixes: ["Weaver", "Wing", "Sting", "Carapace", "Mandible", "Drone", "Keeper", "Spinner", "Leg", "Hum", "Antenna", "Shell"],
  joiner: "-",
};

const PLATED: NameCulture = {
  given: ["Armand", "Bolo", "Cuirass", "Dillo", "Esco", "Fosso", "Gravel", "Husk", "Ilsa", "Jinks", "Knob", "Loric", "Mardo", "Nub", "Oro", "Pango", "Quill", "Rumble", "Scuta", "Tamba", "Burr", "Spindle", "Thistle", "Burrow"],
  surnames: [],
  prefixes: ["Shell", "Plate", "Burrow", "Dust", "Clay", "Root", "Quill", "Iron", "Pebble", "Deep", "Ridge", "Ant"],
  suffixes: ["Back", "Roller", "Digger", "Guard", "Spine", "Hide", "Claw", "Snout", "Curl", "Scale", "Burrow", "Tail"],
  joiner: "-",
};

const SMALLPAW: NameCulture = {
  given: ["Pip", "Nib", "Tansy", "Bramwell", "Cobb", "Dottie", "Fidget", "Hazel", "Juniper", "Kip", "Lettice", "Midge", "Nutmeg", "Pickle", "Quince", "Rosehip", "Scamper", "Tibbs", "Whisk", "Acorn", "Barley", "Crumb", "Dapple", "Ember"],
  surnames: [],
  prefixes: ["Nut", "Seed", "Grain", "Cellar", "Hedge", "Quick", "Burrow", "Bramble", "Cheese", "Corn", "Barn", "Mill"],
  suffixes: ["Whisker", "Tail", "Gnaw", "Scurry", "Nose", "Squeak", "Hoard", "Paw", "Ear", "Tuft", "Nibble", "Dash"],
  joiner: "-",
};

const STEPPE: NameCulture = {
  given: ["Arvak", "Bayard", "Cyrra", "Dandar", "Epona", "Fal", "Galen", "Hrim", "Ilkhan", "Jochi", "Kasar", "Mares", "Nogai", "Orda", "Qara", "Rhun", "Sable", "Toghrul", "Ulan", "Yesui", "Borte", "Mongke", "Altan", "Sorkhan"],
  surnames: [],
  prefixes: ["Wind", "Long", "Dust", "Iron", "Swift", "Thunder", "Grass", "Red", "Wild", "Far", "Storm", "Silver"],
  suffixes: ["Mane", "Hoof", "Runner", "Stride", "Gallop", "Strider", "Tail", "Rider", "Born", "Breaker", "Flank", "Neigh"],
  joiner: "-",
};

const WASTES: NameCulture = {
  given: ["Ashka", "Brand", "Cinder", "Dread", "Ember", "Flint", "Grit", "Hex", "Ire", "Jagg", "Kael", "Lash", "Malice", "Nox", "Raze", "Scar", "Slag", "Talon", "Vex", "Wrath", "Bane", "Char", "Rust", "Sorrow"],
  surnames: [],
  prefixes: ["Ash", "Scar", "Dust", "Blood", "Bone", "Iron", "Salt", "Burn", "Grave", "Rust", "Hollow", "Black"],
  suffixes: ["Walker", "Born", "Marked", "Brand", "Skin", "Eye", "Tongue", "Hand", "Heart", "Mourn", "Scourge", "Wake"],
  joiner: "-",
};

const CULTURE_BY_SPECIES: Record<string, NameCulture> = {
  Avian: SKY, Penguin: SKY, Peacock: SKY,
  "Wolf-Kin": CANID, Vulpine: CANID, "Dune Dog": CANID,
  Felid: FELINE,
  "Bear-Folk": URSINE, Walrus: URSINE, Seal: URSINE, Otter: URSINE,
  Saurian: SCALED, Salamander: SCALED, Frog: SCALED, "Mutant Amphibian": SCALED, "Fur-Wyrm": SCALED,
  "Plant-Folk": GREEN,
  Simian: SIMIAN, Tarsier: SIMIAN,
  Insect: CHITIN, Bee: CHITIN, Ant: CHITIN, Arachnid: CHITIN,
  Armadillo: PLATED, Pangolin: PLATED, Porcupine: PLATED,
  Rat: SMALLPAW, Mouse: SMALLPAW, Sciurini: SMALLPAW,
  Horse: STEPPE,
  "Demon-Kin": WASTES, Outcast: WASTES, "Scarred-Guard": WASTES, "Dust-Skipper": WASTES,
};

export function cultureFor(species: string): NameCulture {
  return CULTURE_BY_SPECIES[species] || COMMON;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

export function givenName(species: string, rng: () => number): string {
  return pick(cultureFor(species).given, rng);
}

export function surname(species: string, rng: () => number): string {
  const c = cultureFor(species);
  const compounds = c.prefixes.length * c.suffixes.length;
  const total = c.surnames.length + compounds;
  const i = Math.floor(rng() * total) % total;
  if (i < c.surnames.length) return c.surnames[i]!;
  const k = i - c.surnames.length;
  const p = c.prefixes[Math.floor(k / c.suffixes.length)]!;
  const s = c.suffixes[k % c.suffixes.length]!;
  return c.joiner === "-" ? `${p}-${s}` : `${p}${s}`;
}

/** How many distinct full names a species can have (for tests and sanity). */
export function nameSpace(species: string): number {
  const c = cultureFor(species);
  return c.given.length * (c.surnames.length + c.prefixes.length * c.suffixes.length);
}

const BYNAMES = ["the Younger", "the Elder", "of the Lower Ward", "of the Upper Ward", "the Second", "the Third"];

/**
 * Hands out names that are unique within one town (case-insensitive). Seed it with the names already used there.
 * `make` keeps a family surname when one is given (a newborn takes a parent's), varying the given name instead.
 */
export class NameBook {
  private taken = new Set<string>();

  constructor(existing: Iterable<string> = []) {
    for (const n of existing) this.add(n);
  }

  add(name: string): void {
    this.taken.add(stripRole(name).toLowerCase());
  }

  has(name: string): boolean {
    return this.taken.has(stripRole(name).toLowerCase());
  }

  make(species: string, rng: () => number, family?: string): string {
    for (let i = 0; i < 24; i++) {
      const name = `${givenName(species, rng)} ${family || surname(species, rng)}`;
      if (!this.has(name)) { this.add(name); return name; }
    }
    // A crowded town: keep the name and tell the two apart the way people do.
    const base = `${givenName(species, rng)} ${family || surname(species, rng)}`;
    for (const by of BYNAMES) {
      const name = `${base} ${by}`;
      if (!this.has(name)) { this.add(name); return name; }
    }
    const name = `${base} ${this.taken.size}`;
    this.add(name);
    return name;
  }
}

/** One NameBook per town, seeded with every name already used there (the living and the dead). One query. */
export async function loadTownNameBooks(
  db: { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> },
  burgIds: number[]
): Promise<Map<number, NameBook>> {
  const books = new Map<number, NameBook>();
  const ids = Array.from(new Set(burgIds.filter((b) => Number.isFinite(b)))).sort((a, b) => a - b);
  for (const id of ids) books.set(id, new NameBook());
  if (ids.length === 0) return books;
  const res = await db.query(
    `SELECT settlement_id, name FROM population_demographics WHERE settlement_id = ANY($1::int[])`,
    [ids]
  );
  for (const r of res.rows) books.get(Number(r.settlement_id))?.add(String(r.name || ""));
  return books;
}

/** "Skye Feather-Bound (Baker)" -> "Skye Feather-Bound": map NPC names carry their profession. */
export function stripRole(name: string): string {
  return String(name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** The family name of a full name ("Mara Ashwood" -> "Ashwood"); bynames are dropped. */
export function familyName(name: string): string {
  const parts = stripRole(name).split(/\s+/);
  return parts[1] || parts[0] || "";
}
