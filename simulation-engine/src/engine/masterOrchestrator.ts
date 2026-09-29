import { FACTIONS, FACTION_DEMOGRAPHICS } from './constants';



import pool from '../db/pool';








const governanceTemplates: Record<number, any> = {
    [FACTIONS.AVIAN_EMPIRE]: { leader: { title: "EMPEROR", role: "DIPLOMACY" }, second: { title: "BANK_DIRECTOR", role: "ECONOMY" }, proxy: { title: "HIPPO_PROXY", role: "ENFORCER" } },
    [FACTIONS.HIVE_COMMONWEALTH]: { leader: { title: "EMPRESS", role: "DIPLOMACY" }, second: { title: "STATIONARY_QUEEN", role: "INFRASTRUCTURE" }, proxy: { title: "WASP_QUEEN", role: "MILITARY" } },
    [FACTIONS.URSINE_HEGEMONY]: { leader: { title: "HIGH_MATRIARCH", role: "DEFENSE" }, second: { title: "OWL_CHANCELLOR", role: "SCIENCE" }, proxy: { title: "FELINE_WARDEN", role: "SCOUT" } },
    [FACTIONS.RIVER_FOLK]: { leader: { title: "SYNDICATE_BOSS", role: "ECONOMY" }, second: { title: "PURIFIER_INQUISITOR", role: "DEFENSE" }, proxy: { title: "OTTER_KREWE_BOSS", role: "ESPIONAGE" } },
    [FACTIONS.HEARTLAND_ALLIANCE]: { leader: { title: "SENATE_CHAIR", role: "DIPLOMACY" }, second: { title: "WOLF_MARSHAL", role: "MILITARY" }, proxy: { title: "RAT_DIRECTOR", role: "ECONOMY" } },
    [FACTIONS.SUMP_KIN]: { leader: { title: "TOAD_BARON", role: "DIPLOMACY" }, second: { title: "CHEM_BARON", role: "ECONOMY" }, proxy: { title: "SHAMANIC_CIRCLE", role: "MAGIC" } },
    [FACTIONS.GUERRILLA_CLANS]: { leader: { title: "WARCHIEF", role: "MILITARY" }, second: { title: "ELDER_SHAMAN", role: "MAGIC" }, proxy: { title: "SCOUT_MASTER", role: "SCOUT" } },
    [FACTIONS.MERIDIAN_CHAIN]: { leader: { title: "PRIMARCH", role: "DIPLOMACY" }, second: { title: "GRAND_ADMIRAL", role: "MILITARY" }, proxy: { title: "ABYSSAL_KEEPER", role: "MAGIC" } },
    [FACTIONS.SYLVANIA]: { leader: { title: "ELDER_TREE", role: "DIPLOMACY" }, second: { title: "ARCH_DRUID", role: "MAGIC" }, proxy: { title: "ROOT_WARDEN", role: "DEFENSE" } },
    [FACTIONS.RELIENCE]: { leader: { title: "HIGH_COMMANDER", role: "MILITARY" }, second: { title: "QUARTERMASTER", role: "ECONOMY" }, proxy: { title: "CHIEF_ENGINEER", role: "INFRASTRUCTURE" } },
    [FACTIONS.EASTERN_HOUNDS]: { leader: { title: "ALPHA_HOUND", role: "MILITARY" }, second: { title: "PACK_SEER", role: "MAGIC" }, proxy: { title: "HUNT_MASTER", role: "SCOUT" } },
    [FACTIONS.IRON_CALADRA]: { leader: { title: "IRON_DICTATOR", role: "MILITARY" }, second: { title: "FORGE_MASTER", role: "ECONOMY" }, proxy: { title: "STEEL_OVERSEER", role: "INFRASTRUCTURE" } },
    [FACTIONS.THEOCRACY]: { leader: { title: "HIGH_PROPHET", role: "DIPLOMACY" }, second: { title: "INQUISITOR_GENERAL", role: "MILITARY" }, proxy: { title: "SACRED_SCRIBE", role: "MAGIC" } },
    [FACTIONS.CANOPY_CLANS]: { leader: { title: "HIGH_CHIEFTAIN", role: "DIPLOMACY" }, second: { title: "CANOPY_STALKER", role: "MILITARY" }, proxy: { title: "SKY_SHAMAN", role: "MAGIC" } },
    [FACTIONS.SCUTE]: { leader: { title: "SHELL_EMPEROR", role: "DIPLOMACY" }, second: { title: "CARAPACE_GENERAL", role: "DEFENSE" }, proxy: { title: "MUD_SAGE", role: "MAGIC" } },
    [FACTIONS.DUSK_HUSK_RIDERS]: { leader: { title: "DUSK_LORD", role: "MILITARY" }, second: { title: "INSECT_TAMER", role: "INFRASTRUCTURE" }, proxy: { title: "SHADOW_BLADE", role: "ESPIONAGE" } },
    [FACTIONS.PRISM_COLLECTIVE]: { leader: { title: "LIGHT_WEAVER", role: "MAGIC" }, second: { title: "CRYSTAL_SMITH", role: "ECONOMY" }, proxy: { title: "ILLUSIONIST_SPY", role: "ESPIONAGE" } },
    [FACTIONS.VANEER]: { leader: { title: "HIGH_NOBLE", role: "DIPLOMACY" }, second: { title: "MERCHANT_PRINCE", role: "ECONOMY" }, proxy: { title: "SILK_ASSASSIN", role: "ESPIONAGE" } },
    [FACTIONS.FLOWER_VALLEY]: { leader: { title: "ROOT_MOTHER", role: "DIPLOMACY" }, second: { title: "PETAL_DANCER", role: "MAGIC" }, proxy: { title: "THORN_GUARD", role: "DEFENSE" } },
};

export async function executeMasterTick() {
  const client = await pool.connect();
  
  function getLoreDate(t: number) {
    const s = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime', 'Shadow Week'];
    return `Year ${Math.floor(t/8) + 1}, ${s[t%8]}`;
  }
  
  try {
    await client.query('BEGIN');
    
    // Phase 1: Cosmology & Shadow Week
    const calRes = await client.query('SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1');
    
    // 589-day year: 12 months of 48 days, plus 13-day Shadow Week (Maelen)
    const DAYS_IN_YEAR = 589;
    const MONTH_LENGTH = 48;
    
    let tick = 1178000;
    if (calRes.rows.length > 0) {
      tick = calRes.rows[0].tick + 1;
    }
    
    // Calculate year and day of year
    const year = Math.floor(tick / DAYS_IN_YEAR);
    const dayOfYear = tick % DAYS_IN_YEAR;
    
    let month = Math.floor(dayOfYear / MONTH_LENGTH) + 1;
    let isShadowWeek = false;
    let season = 'The Thaw'; // Fallback
    
    if (month > 12) {
      month = 13;
      isShadowWeek = true;
      season = 'Shadow Week (Maelen)';
    } else {
      const seasons = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime'];
      season = seasons[Math.floor((month - 1) / 2)] || 'The Thaw';
    }

    const loreDate = `Year ${year} AW, ${season}`;

    // Cruorbus Moon Phases (48-day cycle aligns with month)
    const dayOfMonth = dayOfYear % MONTH_LENGTH;
    let cruorbusPhase = 'The Bruise';
    if (dayOfMonth > 15 && dayOfMonth <= 30) cruorbusPhase = 'The Mercy Alignment';
    else if (dayOfMonth > 30) cruorbusPhase = 'The Nightmare Alignment';

    if (calRes.rows.length > 0) {
      await client.query('UPDATE sim_calendar SET tick = $1, month = $2, year = $3, season = $4, moon_phase = $5 WHERE id = $6', 
        [tick, month, year, season, cruorbusPhase, calRes.rows[0].id]);
    } else {
      await client.query('INSERT INTO sim_calendar (tick, year, month, moon_phase, season) VALUES ($1, $2, $3, $4, $5)', 
        [tick, year, month, cruorbusPhase, season]);
    }

    // Cruorbus Hemorrhage (Chaos Surge) - Day 48 of the month
    if (dayOfMonth === 47 && !isShadowWeek) {
      await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_SURGE', 'Cruorbus enters The Hemorrhage. A global chaos surge wracks the world.', 'MAJOR', $2)`, [tick, loreDate]);
      // Apply Hemorrhage global penalty
      await client.query(`UPDATE sim_burg_economy SET unrest = LEAST(100, COALESCE(unrest, 0) + 20), health = GREATEST(0, COALESCE(health, 100) - 10)`);
    }

    // Erranith's Return (Year 2069, 169-year cycle)
    if (year % 169 === 41 && dayOfYear === 100) { // arbitrary day for periapsis
      await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'COSMIC_EVENT', 'Erranith the Ghost Moon reaches periapsis. Apocalyptic meteor showers rain dragon_stone_shard upon the earth!', 'MAJOR', $2)`, [tick, loreDate]);
      // Spawn shards globally
      const allBurgs = await client.query('SELECT burg_id FROM sim_burg_economy');
      const bIds = allBurgs.rows.map(r => r.burg_id);
      if (bIds.length > 0) {
        // Just inject into stockpileUpdates in Phase 2, or do a direct injection here? 
        // We can't do JSON updates easily in SQL without complex JSONB, so let's skip the inventory inject for now and just log it, or update outlaws.
      }
    }

    // Environment & Climate Baking
    const seasonalOffset = Math.sin((dayOfYear / DAYS_IN_YEAR) * Math.PI * 2) * 20;
    await client.query(`UPDATE sim_cells SET current_temp = base_temp + $1`, [seasonalOffset]);

    // Front Movement & Aging
    await client.query(`UPDATE sim_weather_fronts SET x = x + dx, y = y + dy, lifetime = lifetime - 1`);
    await client.query(`DELETE FROM sim_weather_fronts WHERE lifetime <= 0`);

    // Spawning Extreme Weather
    if (season === 'The Zenith' || season === 'The Wilt') {
       if (Math.random() < 0.03) {
          await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('HURRICANE', $1, $2, $3, $4, 20, 20)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random()-0.5)*2, (Math.random()-0.5)*2]);
       }
    } else if (season === 'The Rime' || season === 'The Chill') {
       if (Math.random() < 0.04) {
          await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('BLIZZARD', $1, $2, $3, $4, 25, 20)`, [Math.random() * 100 - 50, (Math.random() > 0.5 ? 80 : -80), (Math.random()-0.5)*2, (Math.random()-0.5)*2]);
       }
    } else if (season === 'The Bloom') {
       if (Math.random() < 0.02) {
          await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('DROUGHT', $1, $2, $3, $4, 30, 15)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random()-0.5)*1, (Math.random()-0.5)*1]);
       }
    }

    // Aether Fog driven by Chaos Zones
    if (tick % 25 === 0) {
      const czRes = await client.query('SELECT cell_id FROM sim_chaos_zones WHERE intensity > 80 LIMIT 1');
      if (czRes.rows.length > 0) {
         await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('AETHER_FOG', $1, $2, $3, $4, 15, 10)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random()-0.5)*3, (Math.random()-0.5)*3]);
      }
    }
    
    // Phase 1.5: Paragon Generation
    const burgsForParagons = await client.query('SELECT burg_id FROM sim_burg_economy');
    const existingMayors = await client.query(`SELECT burg_id FROM sim_paragons WHERE title = 'Mayor'`);
    const mayorBurgIds = new Set(existingMayors.rows.map(m => m.burg_id));

    const possibleTraits = [
      [{"name": "agrarian", "modifier": 0.2}],
      [{"name": "paranoid", "modifier": 0.3}],
      [{"name": "greedy", "modifier": -0.2}]
    ];

    for (const burgRow of burgsForParagons.rows) {
      if (!mayorBurgIds.has(burgRow.burg_id)) {
        const corruptionScore = Math.floor(Math.random() * 100);
        const traits = possibleTraits[Math.floor(Math.random() * possibleTraits.length)];
        await client.query(`
          INSERT INTO sim_paragons (burg_id, name, title, corruption_score, traits)
          VALUES ($1, $2, $3, $4, $5)
        `, [burgRow.burg_id, 'Mayor ' + burgRow.burg_id, 'Mayor', corruptionScore, JSON.stringify(traits)]);
      }
    }

    // Phase 2: 4-Part Trophic Ecology & Infrastructure Math
    await client.query(`
      UPDATE sim_cells 
      SET eco_plants = CASE WHEN COALESCE(eco_plants, 0) + 5 > 100 THEN 100 ELSE COALESCE(eco_plants, 0) + 5 END,
          eco_prey = CASE WHEN COALESCE(eco_prey, 0) + 5 > 100 THEN 100 ELSE COALESCE(eco_prey, 0) + 5 END
    `);

    const burgEconRes = await client.query('SELECT b.*, c.faction_id, c.current_temp, c.center_x, c.center_y FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id');
    const stockpilesRes = await client.query('SELECT * FROM sim_industrial_stockpiles');
    const frontsRes = await client.query('SELECT * FROM sim_weather_fronts');
    const activeFronts = frontsRes.rows;
    const stockpilesMap = new Map();
    const burgInventories = new Map<number, Record<string, number>>();
    for (const row of stockpilesRes.rows) {
      stockpilesMap.set(row.burg_id, row);
    }
    const infraRes = await client.query('SELECT burg_id, type FROM sim_infrastructure');
    const burgInfra = new Map<number, Set<string>>();
    for (const row of infraRes.rows) {
      if (!burgInfra.has(row.burg_id)) burgInfra.set(row.burg_id, new Set());
      burgInfra.get(row.burg_id)!.add(row.type);
    }
    
    const tradeRoutesRes = await client.query('SELECT source_burg_id, dest_burg_id FROM sim_trade_routes');
    const connectedBurgs = new Set<number>();
    for (const route of tradeRoutesRes.rows) {
      connectedBurgs.add(route.source_burg_id);
      connectedBurgs.add(route.dest_burg_id);
    }

    const defenseScores = new Map<number, number>();
    const ecoDrains = new Map<number, number>();

    const mayorsRes = await client.query(`SELECT burg_id, corruption_score, traits FROM sim_paragons WHERE title = 'Mayor'`);
    const mayorsMap = new Map();
    for (const m of mayorsRes.rows) {
      mayorsMap.set(m.burg_id, m);
    }

    for (const burg of burgEconRes.rows) {
      let isHurricane = false;
      let isBlizzard = false;
      let isDrought = false;
      let isAetherFog = false;
      const bId = burg.burg_id;
      const types = burgInfra.get(bId) || new Set();
      
      let stockpile = stockpilesMap.get(bId) || { raw_wood: 0, raw_ore: 0, raw_herbs: 0, raw_fiber: 0, refined_lumber: 0, forged_steel: 0, alchemical_potions: 0, textiles: 0, complex_inventory: '{}' };
      
      let inv = JSON.parse(stockpile.complex_inventory || '{}');
      burgInventories.set(bId, inv);
      
      const addItem = (item: string, qty: number) => { inv[item] = (inv[item] || 0) + qty; };
      const hasItems = (reqs: Record<string, number>) => Object.entries(reqs).every(([k, v]) => (inv[k] || 0) >= v);
      const deductItems = (reqs: Record<string, number>) => Object.entries(reqs).forEach(([k, v]) => inv[k] -= v);

      // Phase 2 (Raw Extraction)
      stockpile.raw_wood += 20;
      stockpile.raw_ore += 20;
      stockpile.raw_herbs += 20;
      stockpile.raw_fiber += 20;

      if (types.has('MINE')) stockpile.raw_ore += 50;
      if (types.has('CAMP')) {
        stockpile.raw_wood += 50;
        stockpile.raw_fiber += 50;
      }

      const basics = ['wood', 'stone', 'clay', 'pitch', 'fibre', 'iron', 'copper', 'gold', 'silver', 'medicine', 'narcotic', 'aromatics', 'organs', 'crystals', 'dragon_stone_shard', 'grain', 'root', 'spice', 'exotic'];
      for (const b of basics) {
        addItem(b, Math.floor(Math.random() * 16) + 5);
      }
      
      if ((inv['fibre'] || 0) > 0) {
        addItem('textile', Math.floor(inv['fibre'] * 0.5));
        inv['fibre'] = 0;
      }

      // Phase 2 (Refining Loop)
      stockpile.refined_lumber += Math.floor(stockpile.raw_wood * 0.5);
      stockpile.raw_wood = 0;
      stockpile.forged_steel += Math.floor(stockpile.raw_ore * 0.5);
      stockpile.raw_ore = 0;
      stockpile.alchemical_potions += Math.floor(stockpile.raw_herbs * 0.5);
      stockpile.raw_herbs = 0;
      stockpile.textiles += Math.floor(stockpile.raw_fiber * 0.5);
      stockpile.raw_fiber = 0;
      
      let defenseScore = 0;
      if (types.has('FORT')) defenseScore = 100;
      else if (types.has('WALL')) defenseScore = 50;
      defenseScores.set(bId, defenseScore);

      let generatedFood = 0;
      if (types.has('FARM')) {
        let horse_pct = 0;
        try {
          const demographics = JSON.parse(burg.species_demographics || '{}');
          horse_pct = demographics['Horse'] || 0;
        } catch (e) {}
        generatedFood = 50 * (1.0 + (horse_pct * 0.5));
      } else {
        generatedFood = 50; 
        ecoDrains.set(bId, 50);
      }

      const mayor = mayorsMap.get(bId);
      let traitModifier = 0;
      let hasAgrarian = false;
      let hasParanoid = false;
      
      if (mayor && mayor.traits) {
        const parsedTraits = typeof mayor.traits === 'string' ? JSON.parse(mayor.traits) : mayor.traits;
        if (parsedTraits.length > 0) {
          traitModifier = parsedTraits[0].modifier || 0;
          if (parsedTraits[0].name === 'agrarian') hasAgrarian = true;
          if (parsedTraits[0].name === 'paranoid') hasParanoid = true;
        }
      }

      const effectiveFood = generatedFood * (1.0 + traitModifier);
      const consumedFood = (burg.pop_null || 0) * 0.1;
      let wealthInc = types.has('MARKET') ? 50 : 10;
      let currentWealth = (burg.wealth || 0) + wealthInc;
      let unrestChange = 0;
      let healthChange = (effectiveFood >= consumedFood) ? 2 : -5;
      
      if (burg.current_temp < -10 || burg.current_temp > 40) {
          if (!types.has('HOSPITAL')) healthChange -= 2;
      }
      if (isAetherFog) {
          healthChange -= 5;
          unrestChange += 10;
      }
      
      if (burg.current_temp < -10 || burg.current_temp > 40) {
          if (!types.has('HOSPITAL')) healthChange -= 2;
      }
      if (isAetherFog) {
          healthChange -= 5;
          unrestChange += 10;
      }
      const popSize = burg.pop_null || 0;

      // Tier 1: Comfort Need (Requires Textile or Medicine)
      if (popSize > 5000) {
        if ((inv['textile'] || 0) >= 5) {
          inv['textile'] -= 5;
        } else if ((inv['medicine'] || 0) >= 5) {
          inv['medicine'] -= 5;
        } else {
          healthChange -= 2;
          unrestChange += 5;
        }
      }

      // Tier 2: Luxury Need (Requires Spice, Exotic, or Aromatics)
      if (popSize > 20000) {
        if ((inv['spice'] || 0) >= 5) {
          inv['spice'] -= 5;
          unrestChange -= 5;
        } else if ((inv['exotic'] || 0) >= 5) {
          inv['exotic'] -= 5;
          unrestChange -= 5;
        } else if ((inv['aromatics'] || 0) >= 5) {
          inv['aromatics'] -= 5;
          unrestChange -= 5;
        } else {
          unrestChange += 10;
        }
      } else if (popSize <= 20000) {
        // Smaller burgs just get a bonus if they have it
        if ((inv['spice'] || 0) >= 5) {
          inv['spice'] -= 5;
          unrestChange -= 5;
        } else if ((inv['exotic'] || 0) >= 5) {
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
      
      if (types.has('MARKET') && connectedBurgs.has(bId)) {
        unrestChange -= 10;
      }

      let currentHealth = (burg.health !== undefined && burg.health !== null ? burg.health : 100) + healthChange;
      if (currentHealth > 100) currentHealth = 100;
      if (currentHealth < 0) currentHealth = 0;

      let deaths = 0;
      let popGrowth = 0;
      if (currentHealth < 100) {
        deaths = Math.floor((burg.pop_null || 0) * ((100 - currentHealth) * 0.01));
      } else if (effectiveFood > consumedFood * 1.2) {
        // If they have excess food and are perfectly healthy, population naturally grows
        popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1; // 0.5% growth
      }

      await client.query(`
        UPDATE sim_burg_economy 
        SET food = CASE WHEN COALESCE(food, 0) + $1 - $2 < 0 THEN 0 ELSE COALESCE(food, 0) + $1 - $2 END,
            wealth = COALESCE(wealth, 0) + $3,
            unrest = CASE WHEN COALESCE(unrest, 0) + $4 < 0 THEN 0 ELSE COALESCE(unrest, 0) + $4 END,
            health = CASE WHEN COALESCE(health, 100) + $5 > 100 THEN 100 ELSE CASE WHEN COALESCE(health, 100) + $5 < 0 THEN 0 ELSE COALESCE(health, 100) + $5 END END,
            pop_null = CASE WHEN COALESCE(pop_null, 0) + $8 - $6 < 0 THEN 0 ELSE COALESCE(pop_null, 0) + $8 - $6 END
        WHERE burg_id = $7
      `, [Math.floor(effectiveFood), Math.floor(consumedFood), Math.floor(wealthInc), Math.floor(unrestChange), Math.floor(healthChange), Math.floor(deaths), bId, Math.floor(popGrowth)]);

      if (Math.random() < 0.05) {
        await client.query(`
          UPDATE sim_burg_economy 
          SET pop_null = CASE WHEN COALESCE(pop_null, 0) - 10 < 0 THEN 0 ELSE COALESCE(pop_null, 0) - 10 END
          WHERE burg_id = $1
        `, [bId]);
        await client.query(`
          INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)
        `, [burg.cell_id]);
      }

      // Autonomous Building (Phase 2 - Material-Based Construction AI)
      let built = false;
      if (hasAgrarian && !types.has('FARM') && currentWealth >= 20 && stockpile.refined_lumber >= 20) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 20 WHERE burg_id = $1`, [bId]);
        stockpile.refined_lumber -= 20;
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'FARM')`, [bId]);
        types.add('FARM');
        built = true;
      } else if (hasParanoid && !types.has('WALL') && currentWealth >= 50 && stockpile.forged_steel >= 50 && stockpile.refined_lumber >= 50) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 50 WHERE burg_id = $1`, [bId]);
        stockpile.forged_steel -= 50;
        stockpile.refined_lumber -= 50;
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'WALL')`, [bId]);
        types.add('WALL');
        built = true;
      }
      
      // General building for other types
      const hospitalReqs = { stone: 50, wood: 20, medicine: 30, textile: 10, organs: 5 };
      const fortReqs = { stone: 100, iron: 50, wood: 20, pitch: 10 };
      const templeReqs = { stone: 50, gold: 10, silver: 10, crystals: 5, aromatics: 20 };

      if (!built && !types.has('HOSPITAL') && currentWealth >= 50 && hasItems(hospitalReqs)) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 50 WHERE burg_id = $1`, [bId]);
        deductItems(hospitalReqs);
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'HOSPITAL')`, [bId]);
        types.add('HOSPITAL');
        built = true;
      } else if (!built && !types.has('FORT') && currentWealth >= 50 && hasItems(fortReqs)) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 50 WHERE burg_id = $1`, [bId]);
        deductItems(fortReqs);
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'FORT')`, [bId]);
        types.add('FORT');
        built = true;
      } else if (!built && !types.has('TEMPLE') && currentWealth >= 100 && hasItems(templeReqs)) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 100 WHERE burg_id = $1`, [bId]);
        deductItems(templeReqs);
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'TEMPLE')`, [bId]);
        types.add('TEMPLE');
        built = true;
      } else if (!built && currentWealth >= 20 && stockpile.refined_lumber >= 20 && !types.has('MINE')) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 20 WHERE burg_id = $1`, [bId]);
        stockpile.refined_lumber -= 20;
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'MINE')`, [bId]);
        types.add('MINE');
      } else if (!built && currentWealth >= 20 && stockpile.refined_lumber >= 20 && !types.has('CAMP')) {
        await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 20 WHERE burg_id = $1`, [bId]);
        stockpile.refined_lumber -= 20;
        await client.query(`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'CAMP')`, [bId]);
        types.add('CAMP');
      }

      // Phase 2 (Save State)
      await client.query(`
        INSERT INTO sim_industrial_stockpiles (burg_id, raw_wood, raw_ore, raw_herbs, raw_fiber, refined_lumber, forged_steel, alchemical_potions, textiles, complex_inventory)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (burg_id) DO UPDATE SET
          raw_wood = EXCLUDED.raw_wood,
          raw_ore = EXCLUDED.raw_ore,
          raw_herbs = EXCLUDED.raw_herbs,
          raw_fiber = EXCLUDED.raw_fiber,
          refined_lumber = EXCLUDED.refined_lumber,
          forged_steel = EXCLUDED.forged_steel,
          alchemical_potions = EXCLUDED.alchemical_potions,
          textiles = EXCLUDED.textiles,
          complex_inventory = EXCLUDED.complex_inventory
      `, [bId, stockpile.raw_wood, stockpile.raw_ore, stockpile.raw_herbs, stockpile.raw_fiber, stockpile.refined_lumber, stockpile.forged_steel, stockpile.alchemical_potions, stockpile.textiles, JSON.stringify(inv)]);
    }

    const cellsRes = await client.query('SELECT * FROM sim_cells');
    const cellUpdates: any[] = [];
    for (const cell of cellsRes.rows) {
      let plants = cell.eco_plants || 0;
      const prey = cell.eco_prey || 0;
      const preds = cell.eco_predators || 0;

      if (ecoDrains.has(cell.id)) {
        plants = Math.max(0, plants - ecoDrains.get(cell.id)!);
      }
      
      let new_plants = plants + (0.1 * plants) - (0.05 * plants * prey);
      let new_prey = prey + (0.01 * plants * prey) - (0.1 * prey * preds);
      let new_preds = preds + (0.05 * prey * preds) - (0.1 * preds);
      
      const clamp = (v: number) => Math.max(0, Math.min(200, v));
      
      const pl_clamp = clamp(new_plants);
      const pr_clamp = clamp(new_prey);
      const pd_clamp = clamp(new_preds);

      if (pd_clamp > 180 && tick % 10 === 0) {
        await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, z_layer) VALUES ($1, 'ECOLOGY_SHIFT', 'A massive predator population boom disrupts the food chain in cell ' || $3, 'MINOR', $2, $4)`, [tick, loreDate, cell.id, cell.z_layer || 0]);
      }

      cellUpdates.push({ id: cell.id, pl: pl_clamp, pr: pr_clamp, pd: pd_clamp });
    }
    
    if (cellUpdates.length > 0) {
      await client.query(`
        UPDATE sim_cells as c
        SET eco_plants = u.pl, eco_prey = u.pr, eco_predators = u.pd
        FROM unnest($1::int[], $2::float[], $3::float[], $4::float[]) as u(id, pl, pr, pd)
        WHERE c.id = u.id
      `, [
        cellUpdates.map(u => u.id),
        cellUpdates.map(u => u.pl),
        cellUpdates.map(u => u.pr),
        cellUpdates.map(u => u.pd)
      ]);
    }


    // Phase 2.5: Military Recruitment & Upkeep
    const allBurgsEconRes = await client.query('SELECT * FROM sim_burg_economy');
    for (const burg of allBurgsEconRes.rows) {
      let military_forces: Record<string, number> = {};
      try {
        military_forces = JSON.parse(burg.military_forces || '{}');
      } catch (e) {}

      let totalTroops = 0;
      for (const count of Object.values(military_forces)) {
        totalTroops += (count as number);
      }

      let newWealth = burg.wealth || 0;
      let newUnrest = burg.unrest || 0;
      let newFood = burg.food || 0;
      
      const targetInv = burgInventories.get(burg.burg_id) || {};

      if (totalTroops > 0) {
        const upkeepCost = Math.floor(totalTroops / 100) * 5;
        let hasFood = false;
        if (newFood >= upkeepCost) {
          newFood -= upkeepCost;
          hasFood = true;
        } else if ((targetInv['grain'] || 0) >= upkeepCost) {
          targetInv['grain'] = (targetInv['grain'] || 0) - upkeepCost;
          hasFood = true;
        } else if ((targetInv['red_meat'] || 0) >= upkeepCost) {
          targetInv['red_meat'] = (targetInv['red_meat'] || 0) - upkeepCost;
          hasFood = true;
        }

        if (hasFood && newWealth >= upkeepCost) {
          newWealth -= upkeepCost;
        } else {
          newUnrest += 10;
          for (const key of Object.keys(military_forces)) {
            military_forces[key] = Math.floor((military_forces[key] || 0) * 0.9);
          }
          let desertedCount = Math.floor(totalTroops * 0.1);
          
          if (desertedCount > 0) {
            const outlawsRes = await client.query('SELECT id FROM sim_outlaw_factions ORDER BY ABS(origin_cell_id - $1) ASC LIMIT 1', [burg.cell_id]);
            if (outlawsRes.rows.length > 0) {
              await client.query(`UPDATE sim_outlaw_factions SET manpower = manpower + $1 WHERE id = $2`, [desertedCount, outlawsRes.rows[0].id]);
            }
          }
        }

        const cmdRes = await client.query(`SELECT id FROM sim_paragons WHERE burg_id = $1 AND title = 'Commander' LIMIT 1`, [burg.burg_id]);
        if (cmdRes.rows.length === 0) {
          const tList = ['Tactician', 'Corrupt', 'Strict'];
          const pickedT = tList[Math.floor(Math.random() * tList.length)];
          const traitsJson = JSON.stringify([{name: pickedT, modifier: 0}]);
          await client.query(`
            INSERT INTO sim_paragons (burg_id, name, title, corruption_score, traits)
            VALUES ($1, $2, $3, $4, $5)
          `, [burg.burg_id, 'Cmdr ' + burg.burg_id, 'Commander', pickedT === 'Corrupt' ? 80 : 10, traitsJson]);
        }
      }

      if (newWealth > 100) {
        if ((targetInv['iron'] || 0) >= 10 && (targetInv['leather'] || 0) >= 10) {
          targetInv['iron'] = (targetInv['iron'] || 0) - 10;
          targetInv['leather'] = (targetInv['leather'] || 0) - 10;
          military_forces['footmen'] = (military_forces['footmen'] || 0) + 100;
        }
        if ((targetInv['crystals'] || 0) >= 10) {
          targetInv['crystals'] = (targetInv['crystals'] || 0) - 10;
          military_forces['shadowpaws'] = (military_forces['shadowpaws'] || 0) + 50;
        }
        if ((targetInv['blackstone'] || 0) >= 10) {
          targetInv['blackstone'] = (targetInv['blackstone'] || 0) - 10;
          military_forces['sparksquads'] = (military_forces['sparksquads'] || 0) + 50;
        }
      }


      let demoObj: Record<string, number> = {};
      const totalPop = burg.pop_null || 0;
      const template = FACTION_DEMOGRAPHICS[burg.faction_id];
      if (template) {
        let allocated = 0;
        const entries = Object.entries(template);
        for (let i = 0; i < entries.length; i++) {
            const [species, ratio] = entries[i] as [string, number];
            if (i === entries.length - 1) {
                demoObj[species] = Math.floor(totalPop - allocated);
            } else {
                const count = Math.floor(totalPop * (ratio as number));
                demoObj[species] = count;
                allocated += count;
            }
        }
      } else {
        demoObj["Unknown Local"] = Math.floor(totalPop);
      }
      const demoStr = JSON.stringify(demoObj);

      await client.query(`
        UPDATE sim_burg_economy 
        SET wealth = $1, unrest = $2, food = $3, military_forces = $4, demographics = $5
        WHERE burg_id = $6
      `, [Math.floor(newWealth), Math.floor(newUnrest), Math.floor(newFood), JSON.stringify(military_forces), demoStr, burg.burg_id]);

      
      await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(targetInv), burg.burg_id]);
    }

    // Phase 3: The Cosmic War - Wardens vs Cultists
    const agentsRes = await client.query(`SELECT * FROM sim_agents WHERE role IN ('Warden', 'Cultist')`);
    const wardens = agentsRes.rows.filter(a => a.role === 'Warden');
    const cultists = agentsRes.rows.filter(a => a.role === 'Cultist');

    for (const cultist of cultists) {
      const caught = wardens.some(w => Math.abs(w.location_cell_id - cultist.location_cell_id) < 50);
      if (caught) {
        await client.query(`DELETE FROM sim_agents WHERE id = $1`, [cultist.id]);
        await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, 'WARDEN_STRIKE', 'A Cultist was executed by a Warden.', 'MINOR', $2, null, null)`, [tick, loreDate]);
      } else {
        const groveRes = await client.query(`
          SELECT id FROM sim_sacred_groves 
          ORDER BY ABS(cell_id - $1) ASC LIMIT 1
        `, [cultist.location_cell_id]);
        if (groveRes.rows.length > 0) {
          await client.query(`UPDATE sim_sacred_groves SET seal_strength = CASE WHEN seal_strength - 2 < 0 THEN 0 ELSE seal_strength - 2 END WHERE id = $1`, [groveRes.rows[0].id]);
        }
      }
    }

    // Phase 4: Logistics & Trade Networks
    const routesRes = await client.query('SELECT * FROM sim_trade_routes');
    const weakGrovesRes = await client.query('SELECT cell_id FROM sim_sacred_groves WHERE seal_strength < 50');
    const weakGroveCells = new Set(weakGrovesRes.rows.map(g => g.cell_id));
    
    let totalTradeVolume = 0;

    for (const route of routesRes.rows) {
      const srcInv = burgInventories.get(route.source_burg_id);
      const dstInv = burgInventories.get(route.dest_burg_id);

      if (srcInv && dstInv) {
        const tradeableGoods = ['spice', 'exotic', 'aromatics', 'textile', 'medicine', 'grain', 'iron'];
        let goodsMoved = 0;

        for (const good of tradeableGoods) {
           if ((srcInv[good] || 0) > 10 && (dstInv[good] || 0) < 5) {
              srcInv[good] = (srcInv[good] as number || 0) - 5;
              dstInv[good] = (dstInv[good] as number || 0) + 5;
              goodsMoved += 5;
           }
        }
        
        if (goodsMoved > 0) {
           const profit = Math.floor(goodsMoved * 2);
           await client.query(`UPDATE sim_burg_economy SET wealth = wealth + $1 WHERE burg_id IN ($2, $3)`, [profit, route.source_burg_id, route.dest_burg_id]);
           totalTradeVolume += goodsMoved;
        }
      }

      if (weakGroveCells.has(route.source_burg_id) || weakGroveCells.has(route.dest_burg_id)) {
        if (Math.random() < 0.05) {
          await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, 'BLOWOUT', 'Aether-Skiff blowout on route. Reality unmade.', 'MINOR', $2, $3, null)`, [tick, loreDate, route.source_burg_id]);
          await client.query(`UPDATE sim_burg_economy SET wealth = CAST(wealth * 0.5 AS INT) WHERE burg_id IN ($1, $2)`, [route.source_burg_id, route.dest_burg_id]);
        }
      }
    }

    if (totalTradeVolume > 500 && tick % 15 === 0) {
      await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TRADE_BOOM', 'A surge in global commerce leads to a golden era of trade routes.', 'MINOR', $2)`, [tick, loreDate]);
    } else if (totalTradeVolume < 50 && tick % 15 === 0 && routesRes.rows.length > 5) {
      await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'ECONOMIC_CRASH', 'A sudden deflationary spiral hits global markets as trade halts.', 'MAJOR', $2)`, [tick, loreDate]);
    }

    // Phase 5: The Underworld - Forts & Militia
    const fortsRes = await client.query(`SELECT * FROM sim_infrastructure WHERE type = 'FORT'`);
    const forts = fortsRes.rows;

    let cultRecruitsPool = 0;

    const outlawFactionsRes = await client.query('SELECT * FROM sim_outlaw_factions');
    for (const faction of outlawFactionsRes.rows) {
      // Fort Patrol Radius
      let isNearFort = forts.some(f => Math.abs(f.cell_id - faction.origin_cell_id) < 50);

      if (isNearFort) {
        let newManpower = faction.manpower - 20;
        if (newManpower <= 0) {
          await client.query(`DELETE FROM sim_outlaw_factions WHERE id = $1`, [faction.id]);
          continue;
        } else {
          await client.query(`
            UPDATE sim_outlaw_factions 
            SET manpower = $1, wealth = CASE WHEN wealth - 50 < 0 THEN 0 ELSE wealth - 50 END 
            WHERE id = $2
          `, [newManpower, faction.id]);
          faction.manpower = newManpower;
        }
      }

      // Unrest Recruitment
      const burgRes = await client.query(`
        SELECT burg_id, cell_id, unrest, pop_null
        FROM sim_burg_economy 
        WHERE unrest > 30 AND pop_null > 0
        ORDER BY RANDOM() LIMIT 1
      `);
      if (burgRes.rows.length > 0) {
        const burg = burgRes.rows[0];
        const bleed = Math.min(50, burg.pop_null || 0);
          
        // 80% Refugees (lost), 15% Outlaws, 5% Cults
        const refugeeLoss = Math.floor(bleed * 0.80);
        const outlawGain = Math.floor(bleed * 0.15);
        const cultGain = bleed - refugeeLoss - outlawGain;

        cultRecruitsPool += cultGain;

        if (refugeeLoss > 0) {
          const destBurgRes = await client.query('SELECT burg_id FROM sim_burg_economy WHERE burg_id != $1 ORDER BY RANDOM() LIMIT 1', [burg.burg_id]);
          if (destBurgRes.rows.length > 0) {
            const destBurgId = destBurgRes.rows[0].burg_id;
            await client.query('UPDATE sim_burg_economy SET pop_null = COALESCE(pop_null, 0) + $1 WHERE burg_id = $2', [refugeeLoss, destBurgId]);
            await client.query('INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, \'MINOR\', $4, $5, null)', [tick, 'REFUGEE_CRISIS', `Refugee Crisis: ${refugeeLoss} citizens fled to Burg ${destBurgId}`, loreDate, burg.burg_id]);
          }
        }

        await client.query(`
          UPDATE sim_burg_economy 
          SET unrest = CASE WHEN unrest - 5 < 0 THEN 0 ELSE unrest - 5 END,
              pop_null = CASE WHEN COALESCE(pop_null, 0) - $1 < 0 THEN 0 ELSE COALESCE(pop_null, 0) - $1 END
          WHERE burg_id = $2
        `, [bleed, burg.burg_id]);
        
        await client.query(`
          UPDATE sim_outlaw_factions 
          SET manpower = manpower + $1 
          WHERE id = $2
        `, [outlawGain, faction.id]);
        
        faction.manpower += outlawGain; // update local object for next step

        while (cultRecruitsPool >= 50) {
          cultRecruitsPool -= 50;
          await client.query(`INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)`, [burg.cell_id]);
        }
      }

      // Enterprise Expansion
      if (faction.manpower > 200 && faction.wealth > 500) {
        const targetBurgRes = await client.query('SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1');
        if (targetBurgRes.rows.length > 0) {
          const tBurg = targetBurgRes.rows[0].burg_id;
          const eType = Math.random() > 0.5 ? 'VICE_DEN' : 'NARCOTICS';
          await client.query(`
            INSERT INTO sim_outlaw_enterprises (faction_id, target_id, enterprise_type) 
            VALUES ($1, $2, $3)
          `, [faction.id, tBurg, eType]);
        }
      }
    }

    // Execute Enterprises
    const enterprisesRes = await client.query('SELECT * FROM sim_outlaw_enterprises');
    for (const ent of enterprisesRes.rows) {
      if (ent.enterprise_type === 'RAIDING') {
        const targetBurgRes = await client.query(`SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1`, [ent.target_id]);
        const targetCellId = targetBurgRes.rows.length > 0 ? targetBurgRes.rows[0].cell_id : null;
        
        const types = burgInfra.get(ent.target_id) || new Set();
        const hasWall = types.has('WALL');
        const nearFort = targetCellId !== null && forts.some(f => Math.abs(f.cell_id - targetCellId) < 50);

        if (hasWall || nearFort) {
          await client.query(`
            UPDATE sim_outlaw_factions 
            SET manpower = CASE WHEN manpower - 10 < 0 THEN 0 ELSE manpower - 10 END,
                heat = COALESCE(heat, 0) + 20
            WHERE id = $1
          `, [ent.faction_id]);
        } else {
          await client.query(`
            UPDATE sim_burg_economy 
            SET wealth = CASE WHEN wealth - 20 < 0 THEN 0 ELSE wealth - 20 END 
            WHERE burg_id = $1
          `, [ent.target_id]);
          
          await client.query(`
            UPDATE sim_outlaw_factions 
            SET wealth = wealth + 20 
            WHERE id = $1
          `, [ent.faction_id]);
        }
      } else if (ent.enterprise_type === 'VICE_DEN' || ent.enterprise_type === 'NARCOTICS') {
        const targetBurgRow = await client.query(`SELECT species_demographics FROM sim_burg_economy WHERE burg_id = $1`, [ent.target_id]);
        let rat_pct = 0;
        if (targetBurgRow.rows.length > 0) {
          try {
            const demographics = JSON.parse(targetBurgRow.rows[0].species_demographics || '{}');
            rat_pct = demographics['Rat'] || 0;
          } catch (e) {}
        }
        const viceWealth = 50 * (1.0 + (rat_pct * 1.0));

        const targetInv = burgInventories.get(ent.target_id);
        if (targetInv && (targetInv['narcotic'] || 0) >= 5) {
          targetInv['narcotic'] = (targetInv['narcotic'] || 0) - 5;
          
          await client.query(`
            UPDATE sim_burg_economy 
            SET crime_rate = COALESCE(crime_rate, 0) + 5, 
                unrest = CASE WHEN COALESCE(unrest, 0) - 20 < 0 THEN 0 ELSE COALESCE(unrest, 0) - 20 END,
                health = CASE WHEN COALESCE(health, 100) - 5 < 0 THEN 0 ELSE COALESCE(health, 100) - 5 END
            WHERE burg_id = $1
          `, [ent.target_id]);
          
          await client.query(`
            UPDATE sim_outlaw_factions 
            SET wealth = wealth + $1,
                heat = COALESCE(heat, 0) + 5
            WHERE id = $2
          `, [viceWealth, ent.faction_id]);

          await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(targetInv), ent.target_id]);
        }
    }

      }
    // City Militia Counter-Strikes
    const allBurgsMilitiaRes = await client.query('SELECT * FROM sim_burg_economy');
    for (const burg of allBurgsMilitiaRes.rows) {
      let military_forces: Record<string, number> = {};
      try {
        military_forces = JSON.parse(burg.military_forces || '{}');
      } catch (e) {}

      const footmen = military_forces['footmen'] || 0;
      const thorn_men = military_forces['thorn_men'] || 0;
      let effectiveTroops = footmen + thorn_men;

      if ((burg.crime_rate || 0) > 10 && effectiveTroops > 0) {
        // Commander Check
        const cmdRes = await client.query(`SELECT traits FROM sim_paragons WHERE burg_id = $1 AND title = 'Commander' LIMIT 1`, [burg.burg_id]);
        let isCorrupt = false;
        let isTactician = false;
        if (cmdRes.rows.length > 0) {
          const traitsStr = cmdRes.rows[0].traits;
          if (traitsStr) {
            try {
              const traits = typeof traitsStr === 'string' ? JSON.parse(traitsStr) : traitsStr;
              if (traits.some((t: any) => t.name === 'Corrupt')) isCorrupt = true;
              if (traits.some((t: any) => t.name === 'Tactician')) isTactician = true;
            } catch(e) {}
          }
        }

        if (isCorrupt) {
          // The Commander is corrupt, raid cancelled
          continue;
        }

        if (isTactician) {
          effectiveTroops += footmen; // double the footmen
        }
        
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
            await client.query(`
              UPDATE sim_outlaw_factions 
              SET manpower = CASE WHEN manpower - 50 < 0 THEN 0 ELSE manpower - 50 END
              WHERE id = $1
            `, [ent.faction_id]);
            await client.query(`
              UPDATE sim_burg_economy 
              SET crime_rate = CASE WHEN crime_rate - 10 < 0 THEN 0 ELSE crime_rate - 10 END
              WHERE burg_id = $1
            `, [burg.burg_id]);
          }
        }
      }
    }

            // Phase 6: Diplomacy & Black Ops
    

    const simFactionsRes = await client.query('SELECT * FROM sim_factions');
    const simFactions = simFactionsRes.rows;
    
    // Calculate Faction Military Power
    const burgEconFactionRes = await client.query(`
      SELECT b.burg_id, b.military_forces, b.wealth, b.food, c.faction_id
      FROM sim_burg_economy b
      JOIN sim_cells c ON b.cell_id = c.id
    `);
    
    const factionForces = new Map<number, Record<string, number>>();
    const factionBurgs = new Map<number, number[]>();
    for (const row of burgEconFactionRes.rows) {
      if (!row.faction_id) continue;
      
      if (!factionBurgs.has(row.faction_id)) {
        factionBurgs.set(row.faction_id, []);
        factionForces.set(row.faction_id, {
          footmen: 0, marksmen: 0, cavalry: 0, thorn_men: 0,
          lockbreakers: 0, skymen: 0, sparksquads: 0, shadowpaws: 0, seamen: 0
        });
      }
      factionBurgs.get(row.faction_id)!.push(row.burg_id);
      
      let forces: Record<string, number> = {};
      try {
        forces = JSON.parse(row.military_forces || '{}');
      } catch (e) {}
      
      const fMap = factionForces.get(row.faction_id)!;
      for (const k of Object.keys(forces)) {
        const key = k.toLowerCase();
        if (fMap[key] !== undefined) {
          fMap[key] += forces[k] || 0;
        } else {
          fMap[key] = forces[k] || 0;
        }
      }
    }
    
    const getBasePower = (fId: number) => {
      const f = factionForces.get(fId);
      if (!f) return 0;
      return (f.footmen || 0) + 
             ((f.marksmen || 0) * 1.5) + 
             ((f.cavalry || 0) * 2) + 
             ((f.thorn_men || 0) * 1.5) + 
             ((f.lockbreakers || 0) * 3) + 
             ((f.skymen || 0) * 10) + 
             ((f.sparksquads || 0) * 5) + 
             ((f.shadowpaws || 0) * 2) + 
             ((f.seamen || 0) * 4);
    };

    const getFactionName = (fId: number) => {
      const f = simFactions.find((x: any) => x.id === fId);
      return f ? (f.name || '').toLowerCase() : '';
    };

    const diplomacyRes = await client.query('SELECT * FROM sim_diplomacy');
    let diploMap = new Map();
    for (const d of diplomacyRes.rows) {
      const key = d.faction_a_id < d.faction_b_id ? `${d.faction_a_id}-${d.faction_b_id}` : `${d.faction_b_id}-${d.faction_a_id}`;
      diploMap.set(key, d);
    }

    for (let i = 0; i < simFactions.length; i++) {
      for (let j = i + 1; j < simFactions.length; j++) {
        const fA = simFactions[i];
        const fB = simFactions[j];
        
        const key = fA.id < fB.id ? `${fA.id}-${fB.id}` : `${fB.id}-${fA.id}`;
        let diplo = diploMap.get(key);
        
        if (!diplo) {
          diplo = { faction_a_id: fA.id, faction_b_id: fB.id, tension: 50, status: 'NEUTRAL' };
          await client.query(`
            INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) 
            VALUES ($1, $2, $3, $4)
          `, [fA.id, fB.id, diplo.status, diplo.tension]);
        }
        
        let tensionChange = -1; // Natural decay of hostilities
        
        // Aggressive Expansion (Threat from large empires)
        const aSize = factionBurgs.get(fA.id)?.length || 0;
        const bSize = factionBurgs.get(fB.id)?.length || 0;
        if (aSize > 25) tensionChange += Math.floor((aSize - 25) / 5);
        if (bSize > 25) tensionChange += Math.floor((bSize - 25) / 5);

        // Trade Route Pacification
        let sharedRoutes = 0;
        for (const route of routesRes.rows) {
          const srcFaction = burgEconFactionRes.rows.find(r => r.burg_id === route.source_burg_id)?.faction_id;
          const dstFaction = burgEconFactionRes.rows.find(r => r.burg_id === route.dest_burg_id)?.faction_id;
          if ((srcFaction === fA.id && dstFaction === fB.id) || (srcFaction === fB.id && dstFaction === fA.id)) {
             sharedRoutes++;
          }
        }
        tensionChange -= (sharedRoutes * 2);

        let newTension = (diplo.tension || 50) + tensionChange;
        if (newTension < 0) newTension = 0;
        if (newTension > 100) newTension = 100;
        
        let newStatus = diplo.status;
        if (newTension > 80) newStatus = 'WAR';
        else if (newTension < 20) newStatus = 'ALLIANCE';
        else newStatus = 'NEUTRAL';
        
        await client.query(`
          UPDATE sim_diplomacy 
          SET tension = $1, status = $2 
          WHERE (faction_a_id = $3 AND faction_b_id = $4) OR (faction_a_id = $4 AND faction_b_id = $3)
        `, [newTension, newStatus, fA.id, fB.id]);
        
        // Deterministic War Clash: An offensive happens if a faction is wealthy enough to supply an army
        if (newStatus === 'WAR' && ((fA.wealth || 0) > 1000 || (fB.wealth || 0) > 1000) && tick % 5 === 0) {
          // Asymmetric Faction War Doctrines
          let aName = getFactionName(fA.id);
          let bName = getFactionName(fB.id);
          let aForces = factionForces.get(fA.id) || {} as Record<string, number>;
          let bForces = factionForces.get(fB.id) || {} as Record<string, number>;
          
          let aBasePower = getBasePower(fA.id);
          let bBasePower = getBasePower(fB.id);

          // Apply pre-clash special effects & modifiers
          // Avian
          if (aName.includes('avian')) aBasePower += (aForces.skymen || 0) * 10;
          if (bName.includes('avian')) bBasePower += (bForces.skymen || 0) * 10;
          
          // Ursine
          if (aName.includes('ursine')) aBasePower += (aForces.cavalry || 0) * 4;
          if (bName.includes('ursine')) bBasePower += (bForces.cavalry || 0) * 4;

          // Iron Caldera
          if (aName.includes('iron caldera')) aBasePower += (aForces.thorn_men || 0) * 3;
          if (bName.includes('iron caldera')) bBasePower += (bForces.thorn_men || 0) * 3;

          // Guerrilla
          if (aName.includes('guerrilla')) bBasePower -= (bForces.skymen || 0) * 10;
          if (bName.includes('guerrilla')) aBasePower -= (aForces.skymen || 0) * 10;

          // Eastern Hounds
          if (aName.includes('eastern')) bBasePower *= 0.8;
          if (bName.includes('eastern')) aBasePower *= 0.8;

          // Heartland
          if (aName.includes('heartland')) aBasePower += (aForces.footmen || 0);
          if (bName.includes('heartland')) bBasePower += (bForces.footmen || 0);

          // Canopy/Flower
          if (aName.includes('canopy') || aName.includes('flower')) aBasePower *= 1.2;
          if (bName.includes('canopy') || bName.includes('flower')) bBasePower *= 1.2;

          // Sylvan
          if (aName.includes('sylvan')) aBasePower += (aForces.lockbreakers || 0) * 3;
          if (bName.includes('sylvan')) bBasePower += (bForces.lockbreakers || 0) * 3;

          // Meridian / Dusthusk skip clash
          let skipClash = false;
          let thiefFactionId: number | null = null;
          let victimFactionId: number | null = null;
          
          if ((aName.includes('meridian') || aName.includes('dusthusk')) && Math.random() < 0.3) {
            skipClash = true; thiefFactionId = fA.id; victimFactionId = fB.id;
          } else if ((bName.includes('meridian') || bName.includes('dusthusk')) && Math.random() < 0.3) {
            skipClash = true; thiefFactionId = fB.id; victimFactionId = fA.id;
          }

          if (skipClash && thiefFactionId !== null && victimFactionId !== null) {
            const victimBurgs = burgEconFactionRes.rows.filter((r: any) => r.faction_id === victimFactionId).sort((x: any, y: any) => (y.wealth || 0) - (x.wealth || 0));
            if (victimBurgs.length > 0) {
              const richest = victimBurgs[0];
              await client.query(`UPDATE sim_burg_economy SET wealth = CASE WHEN wealth - 100 < 0 THEN 0 ELSE wealth - 100 END, food = CASE WHEN food - 100 < 0 THEN 0 ELSE food - 100 END WHERE burg_id = $1`, [richest.burg_id]);
              const thiefBurgs = burgEconFactionRes.rows.filter((r: any) => r.faction_id === thiefFactionId);
              if (thiefBurgs.length > 0) {
                const receiver = thiefBurgs[Math.floor(Math.random() * thiefBurgs.length)];
                await client.query(`UPDATE sim_burg_economy SET wealth = COALESCE(wealth, 0) + 100, food = COALESCE(food, 0) + 100 WHERE burg_id = $1`, [receiver.burg_id]);
              }
            }
            continue; // skip the clash
          }

          // Clash!
          let aWon = aBasePower >= bBasePower;
          let winnerId = aWon ? fA.id : fB.id;
          let loserId = aWon ? fB.id : fA.id;
          let winnerName = aWon ? aName : bName;
          let loserName = aWon ? bName : aName;

          // Casualties
          let aCasPct = aWon ? 0.05 : 0.15;
          let bCasPct = aWon ? 0.15 : 0.05;

          // Hive casualty shielding
          if (aName.includes('hive')) aCasPct *= 0.5;
          if (bName.includes('hive')) bCasPct *= 0.5;

          // Heartland casualty halved
          if (aName.includes('heartland')) aCasPct *= 0.5;
          if (bName.includes('heartland')) bCasPct *= 0.5;

          // Prism daylight shielding
          if (tick % 8 < 4) {
            if (aName.includes('prism')) aCasPct = 0;
            if (bName.includes('prism')) bCasPct = 0;
          }

          // Reliance scorched earth
          if (!aWon && aName.includes('reliance')) {
            aCasPct = 0;
            const myBurgs = factionBurgs.get(fA.id) || [];
            if (myBurgs.length > 0) {
              const bToBurn = myBurgs[Math.floor(Math.random() * myBurgs.length)];
              await client.query(`UPDATE sim_burg_economy SET food = CASE WHEN food - 50 < 0 THEN 0 ELSE food - 50 END WHERE burg_id = $1`, [bToBurn]);
            }
          }
          if (aWon && bName.includes('reliance')) {
            bCasPct = 0;
            const myBurgs = factionBurgs.get(fB.id) || [];
            if (myBurgs.length > 0) {
              const bToBurn = myBurgs[Math.floor(Math.random() * myBurgs.length)];
              await client.query(`UPDATE sim_burg_economy SET food = CASE WHEN food - 50 < 0 THEN 0 ELSE food - 50 END WHERE burg_id = $1`, [bToBurn]);
            }
          }

          // Apply casualties evenly across burgs' JSON
          const applyCas = async (fId: number, pct: number) => {
            if (pct <= 0) return;
            const bList = factionBurgs.get(fId) || [];
            for (const bId of bList) {
              const bData = burgEconFactionRes.rows.find((r: any) => r.burg_id === bId);
              if (bData && bData.military_forces) {
                try {
                  const m = JSON.parse(bData.military_forces);
                  let changed = false;
                  for (const k of Object.keys(m)) {
                    if (m[k] > 0) {
                      m[k] = Math.floor(m[k] * (1 - pct));
                      changed = true;
                    }
                  }
                  if (changed) {
                    await client.query(`UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2`, [JSON.stringify(m), bId]);
                    bData.military_forces = JSON.stringify(m);
                  }
                } catch(e) {}
              }
            }
          };

          await applyCas(fA.id, aCasPct);
          await applyCas(fB.id, bCasPct);

          // Sump-Kin
          if (winnerName.includes('sump') || winnerName.includes('sump-kin')) {
            const loserBurgs = factionBurgs.get(loserId) || [];
            if (loserBurgs.length > 0) {
              const targetB = loserBurgs[Math.floor(Math.random() * loserBurgs.length)];
              await client.query(`UPDATE sim_burg_economy SET unrest = COALESCE(unrest, 0) + 20 WHERE burg_id = $1`, [targetB]);
            }
          }

          await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, 'MAJOR', $4, null, $5)`, [tick, 'WAR_CLASH', `Faction ${winnerId} clashed with Faction ${loserId}. ${winnerId} won.`, loreDate, winnerId]);
        }
      }
    }

    for (const f of simFactions) {
      if ((f.wealth || 0) < 10) {
        await client.query(`UPDATE sim_factions SET wealth = 500 WHERE id = $1`, [f.id]);
        f.wealth = 500;
        
        const factionBurgsRes = await client.query(`
          SELECT b.burg_id 
          FROM sim_burg_economy b 
          JOIN sim_cells c ON b.cell_id = c.id 
          WHERE c.faction_id = $1
        `, [f.id]);
        
        for (const bRow of factionBurgsRes.rows) {
          const inv = burgInventories.get(bRow.burg_id);
          if (inv) {
            delete inv['gold'];
            delete inv['crystals'];
            await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(inv), bRow.burg_id]);
          }
        }
        await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, 'MINOR', $4, null, $5)`, [tick, 'DEBT_SEIZURE', `The Bank seized assets from Faction ${f.id} to cover debts.`, loreDate, f.id]);
      }
    }

    const viceDensRes = await client.query(`SELECT faction_id, target_id FROM sim_outlaw_enterprises WHERE enterprise_type = 'VICE_DEN'`);
    for (const vd of viceDensRes.rows) {
      const targetInv = burgInventories.get(vd.target_id);
      if (targetInv && (targetInv['narcotic'] || 0) < 1) {
        const cartelRes = await client.query(`SELECT wealth FROM sim_outlaw_factions WHERE id = $1`, [vd.faction_id]);
        if (cartelRes.rows.length > 0 && (cartelRes.rows[0].wealth || 0) >= 100) {
          await client.query(`UPDATE sim_outlaw_factions SET wealth = wealth - 100 WHERE id = $1`, [vd.faction_id]);
          targetInv['narcotic'] = (targetInv['narcotic'] || 0) + 10;
          await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(targetInv), vd.target_id]);
          await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, 'MINOR', $4, $5, $6)`, [tick, 'SMUGGLING', `Smugglers injected narcotics into Burg ${vd.target_id}`, loreDate, vd.target_id, vd.faction_id]);
        }
      }
    }

    for (const route of routesRes.rows) {
      for (const bId of [route.source_burg_id, route.dest_burg_id]) {
        const wRes = await client.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [bId]);
        if (wRes.rows.length > 0) {
          const w = wRes.rows[0].wealth || 0;
          if (w >= 5) {
            await client.query(`UPDATE sim_burg_economy SET wealth = wealth - 5 WHERE burg_id = $1`, [bId]);
          } else {
            await client.query(`UPDATE sim_burg_economy SET unrest = COALESCE(unrest, 0) + 10 WHERE burg_id = $1`, [bId]);
            await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, 'MINOR', $4, $5, null)`, [tick, 'IVORY_GATE_BLOCKADE', `IVORY_GATE_BLOCKADE: Ivory-Gate refused to anchor Burg ${bId}.`, loreDate, bId]);
          }
        }
      }
    }

    // Ghostwind Raiders: Trigger if any burg accumulates too much arcane material
    if (tick % 10 === 0) {
      const allBurgs = Array.from(burgInventories.entries());
      const targetBurg = allBurgs.find(([bId, inv]) => (inv['blackstone'] || 0) + (inv['dragon_stone_shard'] || 0) >= 15);
      
      if (targetBurg) {
        const [target, inv] = targetBurg;
        const stolenBs = inv['blackstone'] || 0;
        const stolenDs = inv['dragon_stone_shard'] || 0;
        
        delete inv['blackstone'];
        delete inv['dragon_stone_shard'];
        await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(inv), target]);
        
        const proxyRes = await client.query(`SELECT burg_id FROM sim_burg_economy ORDER BY wealth DESC LIMIT 1`);
        if (proxyRes.rows.length > 0) {
          const proxyId = proxyRes.rows[0].burg_id;
          const proxyInv = burgInventories.get(proxyId) || {};
          if (stolenBs > 0) proxyInv['blackstone'] = (proxyInv['blackstone'] || 0) + stolenBs;
          if (stolenDs > 0) proxyInv['dragon_stone_shard'] = (proxyInv['dragon_stone_shard'] || 0) + stolenDs;
          await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(proxyInv), proxyId]);
          burgInventories.set(proxyId, proxyInv);
        }

        await client.query(`INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, faction_id) VALUES ($1, $2, $3, 'MINOR', $4, $5, null)`, [tick, 'GHOSTWIND_RAID', `GHOSTWIND_RAID: Ghostwind Raiders extracted hoarded arcane assets from Burg ${target} and delivered them to proxy sponsors.`, loreDate, target]);
      }
    }



    await client.query('COMMIT');
    return { status: 'success', currentTick: tick };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}


