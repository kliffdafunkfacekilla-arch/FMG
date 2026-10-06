"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeMasterTick = executeMasterTick;
const constants_1 = require("./constants");
const pool_1 = __importDefault(require("../db/pool"));
const governanceTemplates = {
    [constants_1.FACTIONS.AVIAN_EMPIRE]: { leader: { title: "EMPEROR", role: "DIPLOMACY" }, second: { title: "BANK_DIRECTOR", role: "ECONOMY" }, proxy: { title: "HIPPO_PROXY", role: "ENFORCER" } },
    [constants_1.FACTIONS.HIVE_COMMONWEALTH]: { leader: { title: "EMPRESS", role: "DIPLOMACY" }, second: { title: "STATIONARY_QUEEN", role: "INFRASTRUCTURE" }, proxy: { title: "WASP_QUEEN", role: "MILITARY" } },
    [constants_1.FACTIONS.URSINE_HEGEMONY]: { leader: { title: "HIGH_MATRIARCH", role: "DEFENSE" }, second: { title: "OWL_CHANCELLOR", role: "SCIENCE" }, proxy: { title: "FELINE_WARDEN", role: "SCOUT" } },
    [constants_1.FACTIONS.RIVER_FOLK]: { leader: { title: "SYNDICATE_BOSS", role: "ECONOMY" }, second: { title: "PURIFIER_INQUISITOR", role: "DEFENSE" }, proxy: { title: "OTTER_KREWE_BOSS", role: "ESPIONAGE" } },
    [constants_1.FACTIONS.HEARTLAND_ALLIANCE]: { leader: { title: "SENATE_CHAIR", role: "DIPLOMACY" }, second: { title: "WOLF_MARSHAL", role: "MILITARY" }, proxy: { title: "RAT_DIRECTOR", role: "ECONOMY" } },
    [constants_1.FACTIONS.SUMP_KIN]: { leader: { title: "TOAD_BARON", role: "DIPLOMACY" }, second: { title: "CHEM_BARON", role: "ECONOMY" }, proxy: { title: "SHAMANIC_CIRCLE", role: "MAGIC" } },
    [constants_1.FACTIONS.GUERRILLA_CLANS]: { leader: { title: "WARCHIEF", role: "MILITARY" }, second: { title: "ELDER_SHAMAN", role: "MAGIC" }, proxy: { title: "SCOUT_MASTER", role: "SCOUT" } },
    [constants_1.FACTIONS.MERIDIAN_CHAIN]: { leader: { title: "PRIMARCH", role: "DIPLOMACY" }, second: { title: "GRAND_ADMIRAL", role: "MILITARY" }, proxy: { title: "ABYSSAL_KEEPER", role: "MAGIC" } },
    [constants_1.FACTIONS.SYLVANIA]: { leader: { title: "ELDER_TREE", role: "DIPLOMACY" }, second: { title: "ARCH_DRUID", role: "MAGIC" }, proxy: { title: "ROOT_WARDEN", role: "DEFENSE" } },
    [constants_1.FACTIONS.RELIENCE]: { leader: { title: "HIGH_COMMANDER", role: "MILITARY" }, second: { title: "QUARTERMASTER", role: "ECONOMY" }, proxy: { title: "CHIEF_ENGINEER", role: "INFRASTRUCTURE" } },
    [constants_1.FACTIONS.EASTERN_HOUNDS]: { leader: { title: "ALPHA_HOUND", role: "MILITARY" }, second: { title: "PACK_SEER", role: "MAGIC" }, proxy: { title: "HUNT_MASTER", role: "SCOUT" } },
    [constants_1.FACTIONS.IRON_CALADRA]: { leader: { title: "IRON_DICTATOR", role: "MILITARY" }, second: { title: "FORGE_MASTER", role: "ECONOMY" }, proxy: { title: "STEEL_OVERSEER", role: "INFRASTRUCTURE" } },
    [constants_1.FACTIONS.THEOCRACY]: { leader: { title: "HIGH_PROPHET", role: "DIPLOMACY" }, second: { title: "INQUISITOR_GENERAL", role: "MILITARY" }, proxy: { title: "SACRED_SCRIBE", role: "MAGIC" } },
    [constants_1.FACTIONS.CANOPY_CLANS]: { leader: { title: "HIGH_CHIEFTAIN", role: "DIPLOMACY" }, second: { title: "CANOPY_STALKER", role: "MILITARY" }, proxy: { title: "SKY_SHAMAN", role: "MAGIC" } },
    [constants_1.FACTIONS.SCUTE]: { leader: { title: "SHELL_EMPEROR", role: "DIPLOMACY" }, second: { title: "CARAPACE_GENERAL", role: "DEFENSE" }, proxy: { title: "MUD_SAGE", role: "MAGIC" } },
    [constants_1.FACTIONS.DUSK_HUSK_RIDERS]: { leader: { title: "DUSK_LORD", role: "MILITARY" }, second: { title: "INSECT_TAMER", role: "INFRASTRUCTURE" }, proxy: { title: "SHADOW_BLADE", role: "ESPIONAGE" } },
    [constants_1.FACTIONS.PRISM_COLLECTIVE]: { leader: { title: "LIGHT_WEAVER", role: "MAGIC" }, second: { title: "CRYSTAL_SMITH", role: "ECONOMY" }, proxy: { title: "ILLUSIONIST_SPY", role: "ESPIONAGE" } },
    [constants_1.FACTIONS.VANEER]: { leader: { title: "HIGH_NOBLE", role: "DIPLOMACY" }, second: { title: "MERCHANT_PRINCE", role: "ECONOMY" }, proxy: { title: "SILK_ASSASSIN", role: "ESPIONAGE" } },
    [constants_1.FACTIONS.FLOWER_VALLEY]: { leader: { title: "ROOT_MOTHER", role: "DIPLOMACY" }, second: { title: "PETAL_DANCER", role: "MAGIC" }, proxy: { title: "THORN_GUARD", role: "DEFENSE" } },
};
async function executeMasterTick() {
    const client = await pool_1.default.connect();
    function getLoreDate(t) {
        const s = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime', 'Shadow Week'];
        return `Year ${Math.floor(t / 8) + 1}, ${s[t % 8]}`;
    }
    try {
        await client.query('BEGIN');
        // 1. Phase 1: Cosmology & Weather (keep global)
        const calRes = await client.query('SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1');
        const DAYS_IN_YEAR = 589;
        const MONTH_LENGTH = 48;
        let tick = 1178000;
        if (calRes.rows.length > 0)
            tick = calRes.rows[0].tick + 1;
        const year = Math.floor(tick / DAYS_IN_YEAR);
        const dayOfYear = tick % DAYS_IN_YEAR;
        let month = Math.floor(dayOfYear / MONTH_LENGTH) + 1;
        let isShadowWeek = false;
        let season = 'The Thaw';
        if (month > 12) {
            month = 13;
            isShadowWeek = true;
            season = 'Shadow Week (Maelen)';
        }
        else {
            const seasons = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime'];
            season = seasons[Math.floor((month - 1) / 2)] || 'The Thaw';
        }
        const loreDate = `Year ${year} AW, ${season}`;
        const dayOfMonth = dayOfYear % MONTH_LENGTH;
        let cruorbusPhase = 'The Bruise';
        if (dayOfMonth > 15 && dayOfMonth <= 30)
            cruorbusPhase = 'The Mercy Alignment';
        else if (dayOfMonth > 30)
            cruorbusPhase = 'The Nightmare Alignment';
        if (calRes.rows.length > 0) {
            await client.query('UPDATE sim_calendar SET tick = $1, month = $2, year = $3, season = $4, moon_phase = $5 WHERE id = $6', [tick, month, year, season, cruorbusPhase, calRes.rows[0].id]);
        }
        else {
            await client.query('INSERT INTO sim_calendar (tick, year, month, moon_phase, season) VALUES ($1, $2, $3, $4, $5)', [tick, year, month, cruorbusPhase, season]);
        }
        if (dayOfMonth === 47 && !isShadowWeek) {
            await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_SURGE', 'Cruorbus enters The Hemorrhage. A global chaos surge wracks the world.', 'MAJOR', $2)`, [tick, loreDate]);
            await client.query(`UPDATE sim_burg_economy SET unrest = LEAST(100, COALESCE(unrest, 0) + 20), health = GREATEST(0, COALESCE(health, 100) - 10)`);
        }
        if (year % 169 === 41 && dayOfYear === 100) {
            await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'COSMIC_EVENT', 'Erranith the Ghost Moon reaches periapsis. Apocalyptic meteor showers rain dragon_stone_shard upon the earth!', 'MAJOR', $2)`, [tick, loreDate]);
        }
        const seasonalOffset = Math.sin((dayOfYear / DAYS_IN_YEAR) * Math.PI * 2) * 20;
        await client.query(`UPDATE sim_cells SET current_temp = base_temp + $1`, [seasonalOffset]);
        await client.query(`UPDATE sim_weather_fronts SET x = x + dx, y = y + dy, lifetime = lifetime - 1`);
        await client.query(`DELETE FROM sim_weather_fronts WHERE lifetime <= 0`);
        if (season === 'The Zenith' || season === 'The Wilt') {
            if (Math.random() < 0.03)
                await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('HURRICANE', $1, $2, $3, $4, 20, 20)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2]);
        }
        else if (season === 'The Rime' || season === 'The Chill') {
            if (Math.random() < 0.04)
                await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('BLIZZARD', $1, $2, $3, $4, 25, 20)`, [Math.random() * 100 - 50, (Math.random() > 0.5 ? 80 : -80), (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2]);
        }
        else if (season === 'The Bloom') {
            if (Math.random() < 0.02)
                await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('DROUGHT', $1, $2, $3, $4, 30, 15)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1]);
        }
        if (tick % 25 === 0) {
            const czRes = await client.query('SELECT cell_id FROM sim_chaos_zones WHERE intensity > 80 LIMIT 1');
            if (czRes.rows.length > 0) {
                await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('AETHER_FOG', $1, $2, $3, $4, 15, 10)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3]);
            }
        }
        // 2. Phase 1.5: Ecology & Cells (the UPDATE sim_cells part of old Phase 2)
        await client.query(`
      UPDATE sim_cells 
      SET eco_plants = CASE WHEN COALESCE(eco_plants, 0) + 5 > 100 THEN 100 ELSE COALESCE(eco_plants, 0) + 5 END,
          eco_prey = CASE WHEN COALESCE(eco_prey, 0) + 5 > 100 THEN 100 ELSE COALESCE(eco_prey, 0) + 5 END
    `);
        // 3. Fetch all DB State: Factions, Burgs, Paragons, Outlaws, Stockpiles, Infrastructure.
        const factionsRes = await client.query('SELECT * FROM sim_factions');
        const factions = factionsRes.rows;
        const burgEconRes = await client.query('SELECT b.*, c.faction_id, c.current_temp, c.center_x, c.center_y FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id');
        const allBurgs = burgEconRes.rows;
        const stockpilesRes = await client.query('SELECT * FROM sim_industrial_stockpiles');
        const stockpilesMap = new Map();
        for (const row of stockpilesRes.rows)
            stockpilesMap.set(row.burg_id, row);
        const infraRes = await client.query('SELECT burg_id, type FROM sim_infrastructure');
        const burgInfra = new Map();
        const forts = [];
        for (const row of infraRes.rows) {
            if (!burgInfra.has(row.burg_id))
                burgInfra.set(row.burg_id, new Set());
            burgInfra.get(row.burg_id).add(row.type);
            if (row.type === 'FORT')
                forts.push(row);
        }
        const tradeRoutesRes = await client.query('SELECT source_burg_id, dest_burg_id FROM sim_trade_routes');
        const connectedBurgs = new Set();
        for (const route of tradeRoutesRes.rows) {
            connectedBurgs.add(route.source_burg_id);
            connectedBurgs.add(route.dest_burg_id);
        }
        const paragonsRes = await client.query('SELECT * FROM sim_paragons');
        const paragonsByBurg = new Map();
        for (const p of paragonsRes.rows) {
            if (!paragonsByBurg.has(p.burg_id))
                paragonsByBurg.set(p.burg_id, []);
            paragonsByBurg.get(p.burg_id).push(p);
        }
        const cellsRes = await client.query('SELECT * FROM sim_cells');
        const cellUpdates = [];
        // Diplomacy Map
        const diplomacyRes = await client.query('SELECT * FROM sim_diplomacy');
        let diploMap = new Map();
        for (const d of diplomacyRes.rows) {
            const key = d.faction_a_id < d.faction_b_id ? `${d.faction_a_id}-${d.faction_b_id}` : `${d.faction_b_id}-${d.faction_a_id}`;
            diploMap.set(key, d);
        }
        const outlawFactionsRes = await client.query('SELECT * FROM sim_outlaw_factions');
        const enterprisesRes = await client.query('SELECT * FROM sim_outlaw_enterprises');
        // Agents / Grooves
        const agentsRes = await client.query(`SELECT * FROM sim_agents WHERE role IN ('Warden', 'Cultist')`);
        const wardens = agentsRes.rows.filter(a => a.role === 'Warden');
        const cultists = agentsRes.rows.filter(a => a.role === 'Cultist');
        const burgInventories = new Map();
        // 4. THE FACTION LOOP
        for (const faction of factions) {
            // A. Faction AI Stance (Aggressive, Economic, Mystic)
            // B. Modify stance based on Faction Leader Paragon (e.g., Bloodthirsty/Pacifist)
            // C. Faction Geopolitics (Declare war, sue for peace, etc. - former Phase 6 logic)
            let aName = (faction.name || '').toLowerCase();
            const myBurgs = allBurgs.filter((b) => b.faction_id === faction.id);
            // D. BURG LOOP
            for (const burg of myBurgs) {
                const bId = burg.burg_id;
                const types = burgInfra.get(bId) || new Set();
                // Burg Paragon overrides (Corrupt, etc.)
                let traitModifier = 0;
                let hasAgrarian = false;
                let hasParanoid = false;
                const localParagons = paragonsByBurg.get(bId) || [];
                const mayor = localParagons.find((p) => p.title === 'Mayor');
                if (!mayor) {
                    const corruptionScore = Math.floor(Math.random() * 100);
                    const possibleTraits = [{ "name": "agrarian", "modifier": 0.2 }, { "name": "paranoid", "modifier": 0.3 }, { "name": "greedy", "modifier": -0.2 }];
                    const traits = [possibleTraits[Math.floor(Math.random() * possibleTraits.length)]];
                    await client.query(`INSERT INTO sim_paragons (burg_id, name, title, corruption_score, traits) VALUES ($1, $2, $3, $4, $5)`, [bId, 'Mayor ' + bId, 'Mayor', corruptionScore, JSON.stringify(traits)]);
                }
                else if (mayor.traits) {
                    const parsedTraits = typeof mayor.traits === 'string' ? JSON.parse(mayor.traits) : mayor.traits;
                    if (parsedTraits.length > 0) {
                        traitModifier = parsedTraits[0].modifier || 0;
                        if (parsedTraits[0].name === 'agrarian')
                            hasAgrarian = true;
                        if (parsedTraits[0].name === 'paranoid')
                            hasParanoid = true;
                    }
                }
                // Economy / Production (former Phase 2 burg logic)
                let stockpile = stockpilesMap.get(bId) || { raw_wood: 0, raw_ore: 0, raw_herbs: 0, raw_fiber: 0, refined_lumber: 0, forged_steel: 0, alchemical_potions: 0, textiles: 0, complex_inventory: '{}' };
                let inv = JSON.parse(stockpile.complex_inventory || '{}');
                burgInventories.set(bId, inv);
                const addItem = (item, qty) => { inv[item] = (inv[item] || 0) + qty; };
                const hasItems = (reqs) => Object.entries(reqs).every(([k, v]) => (inv[k] || 0) >= v);
                const deductItems = (reqs) => Object.entries(reqs).forEach(([k, v]) => inv[k] -= v);
                stockpile.raw_wood += 20;
                stockpile.raw_ore += 20;
                stockpile.raw_herbs += 20;
                stockpile.raw_fiber += 20;
                if (types.has('MINE'))
                    stockpile.raw_ore += 50;
                if (types.has('CAMP')) {
                    stockpile.raw_wood += 50;
                    stockpile.raw_fiber += 50;
                }
                const basics = ['wood', 'stone', 'clay', 'pitch', 'fibre', 'iron', 'copper', 'gold', 'silver', 'medicine', 'narcotic', 'aromatics', 'organs', 'crystals', 'dragon_stone_shard', 'grain', 'root', 'spice', 'exotic'];
                for (const b of basics)
                    addItem(b, Math.floor(Math.random() * 16) + 5);
                if ((inv['fibre'] || 0) > 0) {
                    addItem('textile', Math.floor(inv['fibre'] * 0.5));
                    inv['fibre'] = 0;
                }
                stockpile.refined_lumber += Math.floor(stockpile.raw_wood * 0.5);
                stockpile.raw_wood = 0;
                stockpile.forged_steel += Math.floor(stockpile.raw_ore * 0.5);
                stockpile.raw_ore = 0;
                stockpile.alchemical_potions += Math.floor(stockpile.raw_herbs * 0.5);
                stockpile.raw_herbs = 0;
                stockpile.textiles += Math.floor(stockpile.raw_fiber * 0.5);
                stockpile.raw_fiber = 0;
                let generatedFood = 50;
                if (types.has('FARM')) {
                    let horse_pct = 0;
                    try {
                        const demographics = JSON.parse(burg.species_demographics || '{}');
                        horse_pct = demographics['Horse'] || 0;
                    }
                    catch (e) { }
                    generatedFood = 50 * (1.0 + (horse_pct * 0.5));
                }
                const effectiveFood = generatedFood * (1.0 + traitModifier);
                const consumedFood = (burg.pop_null || 0) * 0.1;
                let wealthInc = types.has('MARKET') ? 50 : 10;
                let currentWealth = (burg.wealth || 0) + wealthInc;
                let unrestChange = 0;
                let healthChange = (effectiveFood >= consumedFood) ? 2 : -5;
                const popSize = burg.pop_null || 0;
                if (popSize > 5000) {
                    if ((inv['textile'] || 0) >= 5)
                        inv['textile'] -= 5;
                    else if ((inv['medicine'] || 0) >= 5)
                        inv['medicine'] -= 5;
                    else {
                        healthChange -= 2;
                        unrestChange += 5;
                    }
                }
                if (popSize > 20000) {
                    if ((inv['spice'] || 0) >= 5) {
                        inv['spice'] -= 5;
                        unrestChange -= 5;
                    }
                    else if ((inv['exotic'] || 0) >= 5) {
                        inv['exotic'] -= 5;
                        unrestChange -= 5;
                    }
                    else if ((inv['aromatics'] || 0) >= 5) {
                        inv['aromatics'] -= 5;
                        unrestChange -= 5;
                    }
                    else
                        unrestChange += 10;
                }
                else if (popSize <= 20000) {
                    if ((inv['spice'] || 0) >= 5) {
                        inv['spice'] -= 5;
                        unrestChange -= 5;
                    }
                    else if ((inv['exotic'] || 0) >= 5) {
                        inv['exotic'] -= 5;
                        unrestChange -= 5;
                    }
                }
                if (types.has('TEMPLE') && currentWealth >= 10) {
                    currentWealth -= 10;
                    wealthInc -= 10;
                    unrestChange -= 5;
                }
                if (types.has('HOSPITAL') && currentWealth >= 15) {
                    currentWealth -= 15;
                    wealthInc -= 15;
                    healthChange += 5;
                }
                if (types.has('MARKET') && connectedBurgs.has(bId))
                    unrestChange -= 10;
                let currentHealth = (burg.health !== undefined && burg.health !== null ? burg.health : 100) + healthChange;
                if (currentHealth > 100)
                    currentHealth = 100;
                if (currentHealth < 0)
                    currentHealth = 0;
                let deaths = 0;
                let popGrowth = 0;
                if (currentHealth < 100)
                    deaths = Math.floor((burg.pop_null || 0) * ((100 - currentHealth) * 0.01));
                else if (effectiveFood > consumedFood * 1.2)
                    popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1;
                burg.food = Math.max(0, (burg.food || 0) + effectiveFood - consumedFood);
                burg.wealth = currentWealth;
                burg.unrest = Math.max(0, (burg.unrest || 0) + unrestChange);
                burg.health = currentHealth;
                burg.pop_null = Math.max(0, (burg.pop_null || 0) + popGrowth - deaths);
                // Construction / Trade (former Phase 4 logic)
                let built = false;
                if (hasAgrarian && !types.has('FARM') && currentWealth >= 20 && stockpile.refined_lumber >= 20) {
                    currentWealth -= 20;
                    stockpile.refined_lumber -= 20;
                    types.add('FARM');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'FARM')`, [bId]);
                }
                else if (hasParanoid && !types.has('WALL') && currentWealth >= 50 && stockpile.forged_steel >= 50 && stockpile.refined_lumber >= 50) {
                    currentWealth -= 50;
                    stockpile.forged_steel -= 50;
                    stockpile.refined_lumber -= 50;
                    types.add('WALL');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'WALL')`, [bId]);
                }
                const hospitalReqs = { stone: 50, wood: 20, medicine: 30, textile: 10, organs: 5 };
                const fortReqs = { stone: 100, iron: 50, wood: 20, pitch: 10 };
                const templeReqs = { stone: 50, gold: 10, silver: 10, crystals: 5, aromatics: 20 };
                if (!built && !types.has('HOSPITAL') && currentWealth >= 50 && hasItems(hospitalReqs)) {
                    currentWealth -= 50;
                    deductItems(hospitalReqs);
                    types.add('HOSPITAL');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'HOSPITAL')`, [bId]);
                }
                else if (!built && !types.has('FORT') && currentWealth >= 50 && hasItems(fortReqs)) {
                    currentWealth -= 50;
                    deductItems(fortReqs);
                    types.add('FORT');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'FORT')`, [bId]);
                }
                else if (!built && !types.has('TEMPLE') && currentWealth >= 100 && hasItems(templeReqs)) {
                    currentWealth -= 100;
                    deductItems(templeReqs);
                    types.add('TEMPLE');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'TEMPLE')`, [bId]);
                }
                else if (!built && currentWealth >= 20 && stockpile.refined_lumber >= 20 && !types.has('MINE')) {
                    currentWealth -= 20;
                    stockpile.refined_lumber -= 20;
                    types.add('MINE');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'MINE')`, [bId]);
                }
                else if (!built && currentWealth >= 20 && stockpile.refined_lumber >= 20 && !types.has('CAMP')) {
                    currentWealth -= 20;
                    stockpile.refined_lumber -= 20;
                    types.add('CAMP');
                    built = true;
                    await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'CAMP')`, [bId]);
                }
                burg.wealth = currentWealth;
                // Military Recruitment (former Phase 2.5 logic)
                let military_forces = {};
                try {
                    military_forces = JSON.parse(burg.military_forces || '{}');
                }
                catch (e) { }
                let totalTroops = Object.values(military_forces).reduce((a, b) => a + b, 0);
                if (totalTroops > 0) {
                    const upkeepCost = Math.floor(totalTroops / 100) * 5;
                    let hasFood = false;
                    if (burg.food >= upkeepCost) {
                        burg.food -= upkeepCost;
                        hasFood = true;
                    }
                    else if ((inv['grain'] || 0) >= upkeepCost) {
                        inv['grain'] = (inv['grain'] || 0) - upkeepCost;
                        hasFood = true;
                    }
                    else if ((inv['red_meat'] || 0) >= upkeepCost) {
                        inv['red_meat'] = (inv['red_meat'] || 0) - upkeepCost;
                        hasFood = true;
                    }
                    if (hasFood && burg.wealth >= upkeepCost) {
                        burg.wealth -= upkeepCost;
                    }
                    else {
                        burg.unrest += 10;
                        for (const key of Object.keys(military_forces))
                            military_forces[key] = Math.floor((military_forces[key] || 0) * 0.9);
                    }
                }
                if (burg.wealth > 100) {
                    if ((inv['iron'] || 0) >= 10 && (inv['leather'] || 0) >= 10) {
                        inv['iron'] = (inv['iron'] || 0) - 10;
                        inv['leather'] = (inv['leather'] || 0) - 10;
                        military_forces['footmen'] = (military_forces['footmen'] || 0) + 100;
                    }
                    if ((inv['crystals'] || 0) >= 10) {
                        inv['crystals'] = (inv['crystals'] || 0) - 10;
                        military_forces['shadowpaws'] = (military_forces['shadowpaws'] || 0) + 50;
                    }
                    if ((inv['blackstone'] || 0) >= 10) {
                        inv['blackstone'] = (inv['blackstone'] || 0) - 10;
                        military_forces['sparksquads'] = (military_forces['sparksquads'] || 0) + 50;
                    }
                }
                burg.military_forces = JSON.stringify(military_forces);
                // Save burg state
                await client.query(`
                UPDATE sim_burg_economy 
                SET food = $1, wealth = $2, unrest = $3, health = $4, pop_null = $5, military_forces = $6
                WHERE burg_id = $7
            `, [Math.floor(burg.food), Math.floor(burg.wealth), Math.floor(burg.unrest), Math.floor(burg.health), Math.floor(burg.pop_null), burg.military_forces, bId]);
                await client.query(`
                INSERT INTO sim_industrial_stockpiles (burg_id, raw_wood, raw_ore, raw_herbs, raw_fiber, refined_lumber, forged_steel, alchemical_potions, textiles, complex_inventory)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (burg_id) DO UPDATE SET
                raw_wood = EXCLUDED.raw_wood, raw_ore = EXCLUDED.raw_ore, raw_herbs = EXCLUDED.raw_herbs, raw_fiber = EXCLUDED.raw_fiber,
                refined_lumber = EXCLUDED.refined_lumber, forged_steel = EXCLUDED.forged_steel, alchemical_potions = EXCLUDED.alchemical_potions,
                textiles = EXCLUDED.textiles, complex_inventory = EXCLUDED.complex_inventory
            `, [bId, stockpile.raw_wood, stockpile.raw_ore, stockpile.raw_herbs, stockpile.raw_fiber, stockpile.refined_lumber, stockpile.forged_steel, stockpile.alchemical_potions, stockpile.textiles, JSON.stringify(inv)]);
                // Vice & Militia (former Phase 5 logic)
                const footmen = military_forces['footmen'] || 0;
                const thorn_men = military_forces['thorn_men'] || 0;
                let effectiveTroops = footmen + thorn_men;
                if ((burg.crime_rate || 0) > 10 && effectiveTroops > 0) {
                    const targetEntRes = await client.query(`
                    SELECT e.id, e.faction_id, f.heat 
                    FROM sim_outlaw_enterprises e
                    JOIN sim_outlaw_factions f ON e.faction_id = f.id
                    WHERE e.target_id = $1 AND e.enterprise_type IN ('VICE_DEN', 'NARCOTICS')
                    LIMIT 1
                `, [burg.burg_id]);
                    if (targetEntRes.rows.length > 0) {
                        const ent = targetEntRes.rows[0];
                        if (effectiveTroops > (ent.heat || 0)) {
                            await client.query(`DELETE FROM sim_outlaw_enterprises WHERE id = $1`, [ent.id]);
                            await client.query(`UPDATE sim_outlaw_factions SET manpower = CASE WHEN manpower - 50 < 0 THEN 0 ELSE manpower - 50 END WHERE id = $1`, [ent.faction_id]);
                            await client.query(`UPDATE sim_burg_economy SET crime_rate = CASE WHEN crime_rate - 10 < 0 THEN 0 ELSE crime_rate - 10 END WHERE burg_id = $1`, [burg.burg_id]);
                        }
                    }
                }
            }
        }
        // 5. THE FRINGE LOOP
        for (const fringe of outlawFactionsRes.rows) {
            let isNearFort = forts.some(f => Math.abs(f.cell_id - fringe.origin_cell_id) < 50);
            if (isNearFort) {
                let newManpower = fringe.manpower - 20;
                if (newManpower <= 0) {
                    await client.query(`DELETE FROM sim_outlaw_factions WHERE id = $1`, [fringe.id]);
                    continue;
                }
                else {
                    await client.query(`UPDATE sim_outlaw_factions SET manpower = $1, wealth = CASE WHEN wealth - 50 < 0 THEN 0 ELSE wealth - 50 END WHERE id = $2`, [newManpower, fringe.id]);
                    fringe.manpower = newManpower;
                }
            }
            const burgRes = await client.query(`SELECT burg_id, cell_id, unrest, pop_null FROM sim_burg_economy WHERE unrest > 30 AND pop_null > 0 ORDER BY RANDOM() LIMIT 1`);
            if (burgRes.rows.length > 0) {
                const burg = burgRes.rows[0];
                const bleed = Math.min(50, burg.pop_null || 0);
                const refugeeLoss = Math.floor(bleed * 0.80);
                const outlawGain = Math.floor(bleed * 0.15);
                await client.query(`UPDATE sim_burg_economy SET unrest = CASE WHEN unrest - 5 < 0 THEN 0 ELSE unrest - 5 END, pop_null = CASE WHEN COALESCE(pop_null, 0) - $1 < 0 THEN 0 ELSE COALESCE(pop_null, 0) - $1 END WHERE burg_id = $2`, [bleed, burg.burg_id]);
                await client.query(`UPDATE sim_outlaw_factions SET manpower = manpower + $1 WHERE id = $2`, [outlawGain, fringe.id]);
                fringe.manpower += outlawGain;
            }
            if (fringe.manpower > 200 && fringe.wealth > 500) {
                const targetBurgRes = await client.query('SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1');
                if (targetBurgRes.rows.length > 0) {
                    const tBurg = targetBurgRes.rows[0].burg_id;
                    const eType = Math.random() > 0.5 ? 'VICE_DEN' : 'NARCOTICS';
                    await client.query(`INSERT INTO sim_outlaw_enterprises (faction_id, target_id, enterprise_type) VALUES ($1, $2, $3)`, [fringe.id, tBurg, eType]);
                }
            }
        }
        // Process Enterprises
        for (const ent of enterprisesRes.rows) {
            if (ent.enterprise_type === 'RAIDING') {
                await client.query(`UPDATE sim_burg_economy SET wealth = CASE WHEN wealth - 20 < 0 THEN 0 ELSE wealth - 20 END WHERE burg_id = $1`, [ent.target_id]);
                await client.query(`UPDATE sim_outlaw_factions SET wealth = wealth + 20 WHERE id = $1`, [ent.faction_id]);
            }
            else if (ent.enterprise_type === 'VICE_DEN' || ent.enterprise_type === 'NARCOTICS') {
                const targetInv = burgInventories.get(ent.target_id);
                if (targetInv && (targetInv['narcotic'] || 0) >= 5) {
                    targetInv['narcotic'] = (targetInv['narcotic'] || 0) - 5;
                    await client.query(`UPDATE sim_burg_economy SET crime_rate = COALESCE(crime_rate, 0) + 5, unrest = CASE WHEN COALESCE(unrest, 0) - 20 < 0 THEN 0 ELSE COALESCE(unrest, 0) - 20 END, health = CASE WHEN COALESCE(health, 100) - 5 < 0 THEN 0 ELSE COALESCE(health, 100) - 5 END WHERE burg_id = $1`, [ent.target_id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = wealth + 50, heat = COALESCE(heat, 0) + 5 WHERE id = $1`, [ent.faction_id]);
                    await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(targetInv), ent.target_id]);
                }
            }
        }
        // Cosmic War
        for (const cultist of cultists) {
            const caught = wardens.some((w) => Math.abs(w.location_cell_id - cultist.location_cell_id) < 50);
            if (caught) {
                await client.query(`DELETE FROM sim_agents WHERE id = $1`, [cultist.id]);
            }
            else {
                const groveRes = await client.query(`SELECT id FROM sim_sacred_groves ORDER BY ABS(cell_id - $1) ASC LIMIT 1`, [cultist.location_cell_id]);
                if (groveRes.rows.length > 0) {
                    await client.query(`UPDATE sim_sacred_groves SET seal_strength = CASE WHEN seal_strength - 2 < 0 THEN 0 ELSE seal_strength - 2 END WHERE id = $1`, [groveRes.rows[0].id]);
                }
            }
        }
        // 6. COMMIT
        await client.query('COMMIT');
        return { status: 'success', currentTick: tick };
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=masterOrchestrator_FactionAI.js.map