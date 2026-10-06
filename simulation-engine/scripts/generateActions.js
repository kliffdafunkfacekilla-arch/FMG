const fs = require('fs');

const actions = [];

function addAction(id, name, evalLogic, execLogic) {
    actions.push(`
    {
        id: '${id}',
        name: '${name.replace(/'/g, "\\'")}',
        evaluate: (s) => { ${evalLogic} },
        execute: async (s, client) => { ${execLogic} }
    }`);
}

// -------------------------------------------------------------------------
// ECONOMIC MACRO ACTIONS
// -------------------------------------------------------------------------
addAction('MINT_CURRENCY', 'Mint Fiat Currency', `return s.treasury < 100 && s.economy > 5 ? 70 : 0;`, `await client.query("UPDATE sim_factions SET treasury = treasury + 1000 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20), wealth = GREATEST(0, wealth - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.leaderName} ordered the mass minting of fiat currency, temporarily saving the treasury but causing runaway inflation and unrest.\`;`);
addAction('HEAVY_TAXATION', 'Heavy Taxation', `return s.treasury < 500 && s.avgUnrest < 40 ? 50 + s.aggression : 0;`, `await client.query("UPDATE sim_factions SET treasury = treasury + 600 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} enforced crushing taxes to refill their coffers, enraging the working class.\`;`);
addAction('TAX_RELIEF', 'Tax Relief', `return s.treasury > 3000 && s.avgUnrest > 30 ? 60 + s.economy : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.leaderName} issued widespread tax relief, buying the adoration of the populace at great expense.\`;`);
addAction('SUBSIDIZE_AGRICULTURE', 'Subsidize Agriculture', `return s.treasury > 500 && s.avgHealth < 60 ? 60 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET food = food + 100, health = LEAST(100, health + 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} heavily subsidized the farming sector, flooding the markets with cheap food.\`;`);
addAction('LIQUIDATE_STOCKPILES', 'Liquidate National Stockpiles', `return s.treasury < 0 ? 90 : 0;`, `await client.query("UPDATE sim_factions SET treasury = treasury + 800 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET food = GREATEST(0, food - 50) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Facing complete bankruptcy, \${s.name} liquidated national grain and material stockpiles to foreign buyers.\`;`);
addAction('FUND_PUBLIC_WORKS', 'Fund Public Works', `return s.treasury > 2000 && s.economy > 6 ? 40 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 50, health = LEAST(100, health + 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} initiated massive infrastructure and public works projects, causing an economic boom.\`;`);
addAction('EMBEZZLE_FUNDS', 'Embezzle State Funds', `return s.economy > 8 && s.avgUnrest < 20 && s.treasury > 1000 && Math.random() > 0.5 ? 45 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET crime_rate = LEAST(100, crime_rate + 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Rumors spread that \${s.leaderName} and corrupt counselors embezzled vast sums of state treasury into private vaults.\`;`);
addAction('ESTABLISH_TRADE_ARTERY', 'Establish Trade Artery', `return s.treasury > 1500 && s.validNeighbors.length > 0 && s.economy >= 7 ? 55 : 0;`, `const neighbor = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 20 WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id IN ($1, $2))", [s.id, neighbor]); return \`\${s.name} opened a massive, lucrative new trade artery with neighboring lands.\`;`);

// -------------------------------------------------------------------------
// SOCIAL & DOMESTIC ACTIONS
// -------------------------------------------------------------------------
addAction('GLADIATORIAL_GAMES', 'Host Gladiatorial Games', `return s.treasury > 800 && s.avgUnrest > 30 && s.aggression > 5 ? 55 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 20), crime_rate = GREATEST(0, crime_rate - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} hosted brutal, month-long gladiatorial games, successfully distracting the rioting underclass.\`;`);
addAction('PUBLIC_EXECUTIONS', 'Public Executions', `return s.avgCrime > 50 && s.aggression > 7 ? 65 : 0;`, `await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, crime_rate - 30), unrest = LEAST(100, unrest + 10), health = GREATEST(0, health - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`To combat rampant lawlessness, \${s.leaderName} ordered hundreds of public executions in the town squares.\`;`);
addAction('MARTIAL_LAW', 'Declare Martial Law', `return s.avgUnrest > 70 && s.avgCrime > 60 ? 80 : 0;`, `await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 40), crime_rate = 0, wealth = GREATEST(0, wealth - 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} enacted absolute Martial Law. The streets are safe, but the economy has ground to a terrified halt.\`;`);
addAction('PROPAGANDA_CAMPAIGN', 'State Propaganda Campaign', `return s.treasury > 300 && s.avgUnrest > 20 ? 40 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 200) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Town criers and plastered posters spread a fierce propaganda campaign, boosting \${s.leaderName}'s approval.\`;`);
addAction('BURN_HERETICS', 'Burn Heretics', `return s.magic > 7 && s.avgUnrest > 40 && s.aggression > 6 ? 50 : 0;`, `await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25), health = GREATEST(0, health - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Inquisitors in \${s.name} burned suspected heretics and cultists at the stake to forcefully cleanse the realm.\`;`);
addAction('FREE_ALE_DISTRIBUTION', 'Free Ale & Rations', `return s.treasury > 600 && s.avgUnrest > 30 && s.economy > 5 ? 45 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 300) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25), health = GREATEST(0, health - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.leaderName} opened the state vaults, distributing free ale and luxury rations to placate the mobs.\`;`);

// -------------------------------------------------------------------------
// MILITARY & CONFLICT ACTIONS
// -------------------------------------------------------------------------
addAction('CONSCRIPT_MILITIA', 'Conscript Militia', `return s.activeWars.length > 0 && s.perceivedDefense < 5 && s.avgUnrest < 50 ? 70 : 0;`, `await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20), pop_null = GREATEST(0, pop_null - 200) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Desperate for manpower, \${s.name} forcefully conscripted thousands of untrained peasants into the militia.\`;`);
addAction('BUILD_FORTIFICATIONS', 'Build Fortifications', `return s.treasury > 1200 && s.validNeighbors.length > 0 && s.aggression < 5 ? 50 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); return \`\${s.name} invested heavily in defensive siege walls and border fortifications.\`;`);
addAction('BORDER_SKIRMISH', 'Border Skirmish', `return s.aggression >= 6 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 40 + s.aggression : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = treasury + 100 WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 50) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = LEAST(100, sim_diplomacy.tension + 20)", [s.id, enemyId]); return \`Forces from \${s.name} engaged in a violent but brief border skirmish with Faction \${enemyId}, looting supplies.\`;`);
addAction('DECLARE_WAR', 'Declare War', `return s.aggression >= 8 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 80 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [s.id, enemyId]); return \`\${s.leaderName} gave into bloodlust and formally declared ALL-OUT WAR on Faction \${enemyId}!\`;`);
addAction('SUE_FOR_PEACE', 'Sue for Peace', `return s.activeWars.length > 0 && (s.avgHealth < 40 || s.avgUnrest > 70) ? 90 : 0;`, `const enemyId = s.activeWars[0]; await client.query("DELETE FROM sim_diplomacy WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)", [s.id, enemyId]); return \`Battered and exhausted, \${s.name} successfully sued for peace, ending the bloodshed.\`;`);
addAction('SCORCHED_EARTH', 'Scorched Earth Retreat', `return s.activeWars.length > 0 && s.perceivedDefense < 2 ? 85 : 0;`, `await client.query("UPDATE sim_burg_economy SET food = 0, health = GREATEST(0, health - 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Terrified of the enemy advance, \${s.name} enacted Scorched Earth, burning their own crops to starve invaders.\`;`);

// -------------------------------------------------------------------------
// MAGIC & ARCANE ACTIONS
// -------------------------------------------------------------------------
addAction('ARCANE_RITUALS', 'Arcane Blessings', `return s.magic > 7 && s.treasury > 800 && s.avgHealth < 80 ? 50 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET health = LEAST(100, health + 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Covens within \${s.name} performed grand rituals, magically purifying the water and blessing the harvests.\`;`);
addAction('BLOOD_SACRIFICE', 'Blood Sacrifice', `return s.magic > 8 && s.aggression > 7 && s.avgHealth > 60 ? 45 : 0;`, `await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 20), unrest = LEAST(100, unrest + 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Dark mages in \${s.name} performed mass blood sacrifices of the citizenry to fuel terrifying war magic.\`;`);
addAction('SCRY_ENEMIES', 'Arcane Scrying', `return s.magic > 6 && s.treasury > 400 && s.validNeighbors.length > 0 ? 35 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 200) WHERE id = $1", [s.id]); return \`Mages of \${s.name} cast massive scrying spells across the borders, mapping enemy troop movements perfectly.\`;`);
addAction('MAGICAL_PLAGUE', 'Unleash Magical Plague', `return s.magic >= 9 && s.activeWars.length > 0 ? 70 : 0;`, `const enemyId = s.activeWars[0]; await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 40) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`\${s.name} unleashed a horrific, flesh-eating magical plague upon their enemies!\`;`);

// -------------------------------------------------------------------------
// COVERT & UNDERWORLD ACTIONS
// -------------------------------------------------------------------------
addAction('FUND_CRIMINALS', 'Fund Underground Crime', `return s.treasury > 1500 && s.economy > 6 && s.validNeighbors.length > 0 ? 40 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET crime_rate = LEAST(100, crime_rate + 30) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`\${s.name} quietly funneled untraceable coin to crime syndicates across Faction \${enemyId}'s borders.\`;`);
addAction('POISON_WELLS', 'Poison Enemy Wells', `return s.activeWars.length > 0 && s.aggression > 6 ? 55 : 0;`, `const enemyId = s.activeWars[0]; await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 25) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`Assassins from \${s.name} infiltrated enemy territory and poisoned the water wells, sparking mass sickness.\`;`);
addAction('ASSASSINATE_COUNSELOR', 'Assassinate Rival Counselor', `return s.treasury > 2000 && s.validNeighbors.length > 0 && s.aggression > 5 ? 35 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`A high-ranking counselor in Faction \${enemyId} was found dead. \${s.name} denies all involvement in the assassination.\`;`);
addAction('SPONSOR_PIRATES', 'Sponsor Privateers', `return s.treasury > 1000 && s.economy > 7 && s.validNeighbors.length > 0 ? 45 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); await client.query("UPDATE sim_factions SET treasury = treasury + 200 WHERE id = $1", [s.id]); return \`\${s.name} issued letters of marque to vicious privateers, raiding enemy merchant caravans for profit.\`;`);

// -------------------------------------------------------------------------
// NEW GRAND STRATEGY ACTIONS (Inspired by Civ, CK3, Stellaris, EU4)
// -------------------------------------------------------------------------

// CIVILIZATION INSPIRED
addAction('DECLARE_GOLDEN_AGE', 'Declare Golden Age', `return s.treasury > 5000 && s.avgUnrest < 10 && s.avgHealth > 80 ? 95 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 3000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 100, food = food + 100 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`A flourishing renaissance of art and culture has begun! \${s.name} has entered a spectacular Golden Age!\`;`);
addAction('COMMISSION_WORLD_WONDER', 'Commission World Wonder', `return s.treasury > 8000 && s.economy >= 8 ? 85 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 7000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = 0 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.name} completed construction on a magnificent World Wonder, permanently cementing their historical legacy.\`;`);
addAction('FOUND_RELIGION', 'Found State Religion', `return s.magic >= 8 && s.avgUnrest > 30 && s.treasury > 2000 ? 65 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 30), crime_rate = GREATEST(0, crime_rate - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.leaderName} formally established a new State Religion, unifying the spiritual identity of the faction.\`;`);

// CRUSADER KINGS INSPIRED
addAction('ARRANGE_ROYAL_MARRIAGE', 'Arrange Royal Marriage', `return s.validNeighbors.length > 0 && s.treasury > 1000 && s.activeWars.length === 0 ? 55 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'PEACE', 0) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = 0", [s.id, enemyId]); return \`A grand Royal Marriage was arranged between \${s.name} and Faction \${enemyId}, forging a powerful diplomatic bond.\`;`);
addAction('HOST_GRAND_FEAST', 'Host Grand Feast', `return s.treasury > 1500 && s.avgUnrest > 20 ? 50 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`\${s.leaderName} hosted a lavish Grand Feast for the nobility, greatly increasing their political capital.\`;`);
addAction('FABRICATE_CASUS_BELLI', 'Fabricate Casus Belli', `return s.aggression > 6 && s.validNeighbors.length > 0 && s.treasury > 600 && s.activeWars.length === 0 ? 60 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 80) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = 80", [s.id, enemyId]); return \`Diplomats from \${s.name} fabricated historical claims on the borders of Faction \${enemyId}, laying the groundwork for war.\`;`);
addAction('CALL_HOLY_WAR', 'Call Holy War', `return s.magic >= 8 && s.aggression >= 7 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 85 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [s.id, enemyId]); return \`Deus Vult! \${s.leaderName} has declared a righteous HOLY WAR against the heathens of Faction \${enemyId}!\`;`);

// EUROPA UNIVERSALIS INSPIRED
addAction('TRADE_EMBARGO', 'Trade Embargo', `return s.economy >= 6 && s.validNeighbors.length > 0 && s.treasury > 500 ? 45 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 30) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`\${s.name} enacted a punishing Trade Embargo against Faction \${enemyId}, crippling their merchant class.\`;`);
addAction('SUPPORT_FOREIGN_REBELS', 'Support Foreign Rebels', `return s.treasury > 2000 && s.validNeighbors.length > 0 && s.aggression > 5 ? 55 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 40) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return \`\${s.name} secretly supplied weapons to rebel factions across the border, throwing Faction \${enemyId} into chaos.\`;`);
addAction('DEMAND_TRIBUTE', 'Demand Tribute', `return s.aggression >= 8 && s.validNeighbors.length > 0 && s.treasury < 500 ? 65 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = treasury + 500 WHERE id = $1", [s.id]); await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [enemyId]); return \`Through sheer military intimidation, \${s.name} forced Faction \${enemyId} to pay a humiliating tribute.\`;`);
addAction('WAR_TAXES', 'Levy War Taxes', `return s.activeWars.length > 0 && s.treasury < 500 ? 80 : 0;`, `await client.query("UPDATE sim_factions SET treasury = treasury + 1500 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`Desperate to fund the ongoing war, \${s.name} levied brutal War Taxes across the entire empire.\`;`);

// STELLARIS INSPIRED
addAction('FORMAL_INSULT', 'Issue Formal Insult', `return s.aggression >= 6 && s.validNeighbors.length > 0 && s.activeWars.length === 0 && Math.random() > 0.5 ? 30 : 0;`, `const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 40) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = LEAST(100, sim_diplomacy.tension + 20)", [s.id, enemyId]); return \`\${s.leaderName} issued a scathing, highly publicized formal insult to the ruler of Faction \${enemyId}, damaging relations.\`;`);
addAction('EXPEL_UNDESIRABLES', 'Expel Undesirables', `return s.aggression >= 9 && s.avgUnrest > 40 ? 60 : 0;`, `await client.query("UPDATE sim_burg_economy SET pop_null = GREATEST(0, pop_null - 500), unrest = GREATEST(0, unrest - 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`In a chilling decree, \${s.name} forcibly expelled 'undesirable' populations from their borders to quell unrest.\`;`);
addAction('SPONSOR_GREAT_HERO', 'Sponsor Great Hero', `return s.treasury > 4000 ? 45 : 0;`, `await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 2500) WHERE id = $1", [s.id]); return \`\${s.name} sponsored the rise of a Great Hero, elevating a legendary new figure to their paragon ranks.\`;`);


const fileOutput = `
export interface FactionState {
    id: number;
    name: string;
    treasury: number;
    avgUnrest: number;
    avgHealth: number;
    avgCrime: number;
    aggression: number;
    economy: number;
    magic: number;
    perceivedEconomy: number;
    perceivedDefense: number;
    myBurgs: any[];
    myUnits: any[];
    validNeighbors: number[];
    activeWars: number[];
    leaderName: string;
    tick: number;
    loreDate: string;
}

export interface FactionAction {
    id: string;
    name: string;
    evaluate: (state: FactionState) => number; // Returns 0-100 score
    execute: (state: FactionState, client: any) => Promise<string | null>; // Returns the event message
}

export const FACTION_ACTIONS: FactionAction[] = [
${actions.join(',\n')}
];
`;

fs.writeFileSync('src/engine/ai/factionActions.ts', fileOutput);
console.log('factionActions.ts dynamically generated with ' + actions.length + ' options.');
