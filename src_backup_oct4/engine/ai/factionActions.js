"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACTION_ACTIONS = void 0;
exports.FACTION_ACTIONS = [
    {
        id: 'MINT_CURRENCY',
        name: 'Mint Fiat Currency',
        evaluate: (s) => { return s.treasury < 100 && s.economy > 5 ? 70 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = treasury + 1000 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20), wealth = GREATEST(0, wealth - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.leaderName} ordered the mass minting of fiat currency, temporarily saving the treasury but causing runaway inflation and unrest.`; }
    },
    {
        id: 'HEAVY_TAXATION',
        name: 'Heavy Taxation',
        evaluate: (s) => { return s.treasury < 500 && s.avgUnrest < 40 ? 50 + s.aggression : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = treasury + 600 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} enforced crushing taxes to refill their coffers, enraging the working class.`; }
    },
    {
        id: 'TAX_RELIEF',
        name: 'Tax Relief',
        evaluate: (s) => { return s.treasury > 3000 && s.avgUnrest > 30 ? 60 + s.economy : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.leaderName} issued widespread tax relief, buying the adoration of the populace at great expense.`; }
    },
    {
        id: 'SUBSIDIZE_AGRICULTURE',
        name: 'Subsidize Agriculture',
        evaluate: (s) => { return s.treasury > 500 && s.avgHealth < 60 ? 60 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET food = food + 100, health = LEAST(100, health + 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} heavily subsidized the farming sector, flooding the markets with cheap food.`; }
    },
    {
        id: 'LIQUIDATE_STOCKPILES',
        name: 'Liquidate National Stockpiles',
        evaluate: (s) => { return s.treasury < 0 ? 90 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = treasury + 800 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET food = GREATEST(0, food - 50) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Facing complete bankruptcy, ${s.name} liquidated national grain and material stockpiles to foreign buyers.`; }
    },
    {
        id: 'FUND_PUBLIC_WORKS',
        name: 'Fund Public Works',
        evaluate: (s) => { return s.treasury > 2000 && s.economy > 6 ? 40 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 50, health = LEAST(100, health + 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} initiated massive infrastructure and public works projects, causing an economic boom.`; }
    },
    {
        id: 'EMBEZZLE_FUNDS',
        name: 'Embezzle State Funds',
        evaluate: (s) => { return s.economy > 8 && s.avgUnrest < 20 && s.treasury > 1000 && Math.random() > 0.5 ? 45 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET crime_rate = LEAST(100, crime_rate + 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Rumors spread that ${s.leaderName} and corrupt counselors embezzled vast sums of state treasury into private vaults.`; }
    },
    {
        id: 'ESTABLISH_TRADE_ARTERY',
        name: 'Establish Trade Artery',
        evaluate: (s) => { return s.treasury > 1500 && s.validNeighbors.length > 0 && s.economy >= 7 ? 55 : 0; },
        execute: async (s, client) => { const neighbor = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 20 WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id IN ($1, $2))", [s.id, neighbor]); return `${s.name} opened a massive, lucrative new trade artery with neighboring lands.`; }
    },
    {
        id: 'GLADIATORIAL_GAMES',
        name: 'Host Gladiatorial Games',
        evaluate: (s) => { return s.treasury > 800 && s.avgUnrest > 30 && s.aggression > 5 ? 55 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 20), crime_rate = GREATEST(0, crime_rate - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} hosted brutal, month-long gladiatorial games, successfully distracting the rioting underclass.`; }
    },
    {
        id: 'PUBLIC_EXECUTIONS',
        name: 'Public Executions',
        evaluate: (s) => { return s.avgCrime > 50 && s.aggression > 7 ? 65 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, crime_rate - 30), unrest = LEAST(100, unrest + 10), health = GREATEST(0, health - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `To combat rampant lawlessness, ${s.leaderName} ordered hundreds of public executions in the town squares.`; }
    },
    {
        id: 'MARTIAL_LAW',
        name: 'Declare Martial Law',
        evaluate: (s) => { return s.avgUnrest > 70 && s.avgCrime > 60 ? 80 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 40), crime_rate = 0, wealth = GREATEST(0, wealth - 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} enacted absolute Martial Law. The streets are safe, but the economy has ground to a terrified halt.`; }
    },
    {
        id: 'PROPAGANDA_CAMPAIGN',
        name: 'State Propaganda Campaign',
        evaluate: (s) => { return s.treasury > 300 && s.avgUnrest > 20 ? 40 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 200) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Town criers and plastered posters spread a fierce propaganda campaign, boosting ${s.leaderName}'s approval.`; }
    },
    {
        id: 'BURN_HERETICS',
        name: 'Burn Heretics',
        evaluate: (s) => { return s.magic > 7 && s.avgUnrest > 40 && s.aggression > 6 ? 50 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25), health = GREATEST(0, health - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Inquisitors in ${s.name} burned suspected heretics and cultists at the stake to forcefully cleanse the realm.`; }
    },
    {
        id: 'FREE_ALE_DISTRIBUTION',
        name: 'Free Ale & Rations',
        evaluate: (s) => { return s.treasury > 600 && s.avgUnrest > 30 && s.economy > 5 ? 45 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 300) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25), health = GREATEST(0, health - 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.leaderName} opened the state vaults, distributing free ale and luxury rations to placate the mobs.`; }
    },
    {
        id: 'CONSCRIPT_MILITIA',
        name: 'Conscript Militia',
        evaluate: (s) => { return s.activeWars.length > 0 && s.perceivedDefense < 5 && s.avgUnrest < 50 ? 70 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20), pop_null = GREATEST(0, pop_null - 200) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Desperate for manpower, ${s.name} forcefully conscripted thousands of untrained peasants into the militia.`; }
    },
    {
        id: 'BUILD_FORTIFICATIONS',
        name: 'Build Fortifications',
        evaluate: (s) => { return s.treasury > 1200 && s.validNeighbors.length > 0 && s.aggression < 5 ? 50 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); return `${s.name} invested heavily in defensive siege walls and border fortifications.`; }
    },
    {
        id: 'BORDER_SKIRMISH',
        name: 'Border Skirmish',
        evaluate: (s) => { return s.aggression >= 6 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 40 + s.aggression : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = treasury + 100 WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 50) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = LEAST(100, sim_diplomacy.tension + 20)", [s.id, enemyId]); return `Forces from ${s.name} engaged in a violent but brief border skirmish with Faction ${enemyId}, looting supplies.`; }
    },
    {
        id: 'DECLARE_WAR',
        name: 'Declare War',
        evaluate: (s) => { return s.aggression >= 8 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 80 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [s.id, enemyId]); return `${s.leaderName} gave into bloodlust and formally declared ALL-OUT WAR on Faction ${enemyId}!`; }
    },
    {
        id: 'SUE_FOR_PEACE',
        name: 'Sue for Peace',
        evaluate: (s) => { return s.activeWars.length > 0 && (s.avgHealth < 40 || s.avgUnrest > 70) ? 90 : 0; },
        execute: async (s, client) => { const enemyId = s.activeWars[0]; await client.query("DELETE FROM sim_diplomacy WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)", [s.id, enemyId]); return `Battered and exhausted, ${s.name} successfully sued for peace, ending the bloodshed.`; }
    },
    {
        id: 'SCORCHED_EARTH',
        name: 'Scorched Earth Retreat',
        evaluate: (s) => { return s.activeWars.length > 0 && s.perceivedDefense < 2 ? 85 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET food = 0, health = GREATEST(0, health - 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Terrified of the enemy advance, ${s.name} enacted Scorched Earth, burning their own crops to starve invaders.`; }
    },
    {
        id: 'ARCANE_RITUALS',
        name: 'Arcane Blessings',
        evaluate: (s) => { return s.magic > 7 && s.treasury > 800 && s.avgHealth < 80 ? 50 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET health = LEAST(100, health + 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Covens within ${s.name} performed grand rituals, magically purifying the water and blessing the harvests.`; }
    },
    {
        id: 'BLOOD_SACRIFICE',
        name: 'Blood Sacrifice',
        evaluate: (s) => { return s.magic > 8 && s.aggression > 7 && s.avgHealth > 60 ? 45 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 20), unrest = LEAST(100, unrest + 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Dark mages in ${s.name} performed mass blood sacrifices of the citizenry to fuel terrifying war magic.`; }
    },
    {
        id: 'SCRY_ENEMIES',
        name: 'Arcane Scrying',
        evaluate: (s) => { return s.magic > 6 && s.treasury > 400 && s.validNeighbors.length > 0 ? 35 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 200) WHERE id = $1", [s.id]); return `Mages of ${s.name} cast massive scrying spells across the borders, mapping enemy troop movements perfectly.`; }
    },
    {
        id: 'MAGICAL_PLAGUE',
        name: 'Unleash Magical Plague',
        evaluate: (s) => { return s.magic >= 9 && s.activeWars.length > 0 ? 70 : 0; },
        execute: async (s, client) => { const enemyId = s.activeWars[0]; await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 40) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `${s.name} unleashed a horrific, flesh-eating magical plague upon their enemies!`; }
    },
    {
        id: 'FUND_CRIMINALS',
        name: 'Fund Underground Crime',
        evaluate: (s) => { return s.treasury > 1500 && s.economy > 6 && s.validNeighbors.length > 0 ? 40 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET crime_rate = LEAST(100, crime_rate + 30) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `${s.name} quietly funneled untraceable coin to crime syndicates across Faction ${enemyId}'s borders.`; }
    },
    {
        id: 'POISON_WELLS',
        name: 'Poison Enemy Wells',
        evaluate: (s) => { return s.activeWars.length > 0 && s.aggression > 6 ? 55 : 0; },
        execute: async (s, client) => { const enemyId = s.activeWars[0]; await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 25) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `Assassins from ${s.name} infiltrated enemy territory and poisoned the water wells, sparking mass sickness.`; }
    },
    {
        id: 'ASSASSINATE_COUNSELOR',
        name: 'Assassinate Rival Counselor',
        evaluate: (s) => { return s.treasury > 2000 && s.validNeighbors.length > 0 && s.aggression > 5 ? 35 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `A high-ranking counselor in Faction ${enemyId} was found dead. ${s.name} denies all involvement in the assassination.`; }
    },
    {
        id: 'SPONSOR_PIRATES',
        name: 'Sponsor Privateers',
        evaluate: (s) => { return s.treasury > 1000 && s.economy > 7 && s.validNeighbors.length > 0 ? 45 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); await client.query("UPDATE sim_factions SET treasury = treasury + 200 WHERE id = $1", [s.id]); return `${s.name} issued letters of marque to vicious privateers, raiding enemy merchant caravans for profit.`; }
    },
    {
        id: 'DECLARE_GOLDEN_AGE',
        name: 'Declare Golden Age',
        evaluate: (s) => { return s.treasury > 5000 && s.avgUnrest < 10 && s.avgHealth > 80 ? 95 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 3000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 100, food = food + 100 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `A flourishing renaissance of art and culture has begun! ${s.name} has entered a spectacular Golden Age!`; }
    },
    {
        id: 'COMMISSION_WORLD_WONDER',
        name: 'Commission World Wonder',
        evaluate: (s) => { return s.treasury > 8000 && s.economy >= 8 ? 85 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 7000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = 0 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.name} completed construction on a magnificent World Wonder, permanently cementing their historical legacy.`; }
    },
    {
        id: 'FOUND_RELIGION',
        name: 'Found State Religion',
        evaluate: (s) => { return s.magic >= 8 && s.avgUnrest > 30 && s.treasury > 2000 ? 65 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 30), crime_rate = GREATEST(0, crime_rate - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.leaderName} formally established a new State Religion, unifying the spiritual identity of the faction.`; }
    },
    {
        id: 'ARRANGE_ROYAL_MARRIAGE',
        name: 'Arrange Royal Marriage',
        evaluate: (s) => { return s.validNeighbors.length > 0 && s.treasury > 1000 && s.activeWars.length === 0 ? 55 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'PEACE', 0) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = 0", [s.id, enemyId]); return `A grand Royal Marriage was arranged between ${s.name} and Faction ${enemyId}, forging a powerful diplomatic bond.`; }
    },
    {
        id: 'HOST_GRAND_FEAST',
        name: 'Host Grand Feast',
        evaluate: (s) => { return s.treasury > 1500 && s.avgUnrest > 20 ? 50 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `${s.leaderName} hosted a lavish Grand Feast for the nobility, greatly increasing their political capital.`; }
    },
    {
        id: 'FABRICATE_CASUS_BELLI',
        name: 'Fabricate Casus Belli',
        evaluate: (s) => { return s.aggression > 6 && s.validNeighbors.length > 0 && s.treasury > 600 && s.activeWars.length === 0 ? 60 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 80) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = 80", [s.id, enemyId]); return `Diplomats from ${s.name} fabricated historical claims on the borders of Faction ${enemyId}, laying the groundwork for war.`; }
    },
    {
        id: 'CALL_HOLY_WAR',
        name: 'Call Holy War',
        evaluate: (s) => { return s.magic >= 8 && s.aggression >= 7 && s.validNeighbors.length > 0 && s.activeWars.length === 0 ? 85 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [s.id, enemyId]); return `Deus Vult! ${s.leaderName} has declared a righteous HOLY WAR against the heathens of Faction ${enemyId}!`; }
    },
    {
        id: 'TRADE_EMBARGO',
        name: 'Trade Embargo',
        evaluate: (s) => { return s.economy >= 6 && s.validNeighbors.length > 0 && s.treasury > 500 ? 45 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 30) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `${s.name} enacted a punishing Trade Embargo against Faction ${enemyId}, crippling their merchant class.`; }
    },
    {
        id: 'SUPPORT_FOREIGN_REBELS',
        name: 'Support Foreign Rebels',
        evaluate: (s) => { return s.treasury > 2000 && s.validNeighbors.length > 0 && s.aggression > 5 ? 55 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 40) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `${s.name} secretly supplied weapons to rebel factions across the border, throwing Faction ${enemyId} into chaos.`; }
    },
    {
        id: 'DEMAND_TRIBUTE',
        name: 'Demand Tribute',
        evaluate: (s) => { return s.aggression >= 8 && s.validNeighbors.length > 0 && s.treasury < 500 ? 65 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = treasury + 500 WHERE id = $1", [s.id]); await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [enemyId]); return `Through sheer military intimidation, ${s.name} forced Faction ${enemyId} to pay a humiliating tribute.`; }
    },
    {
        id: 'WAR_TAXES',
        name: 'Levy War Taxes',
        evaluate: (s) => { return s.activeWars.length > 0 && s.treasury < 500 ? 80 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = treasury + 1500 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `Desperate to fund the ongoing war, ${s.name} levied brutal War Taxes across the entire empire.`; }
    },
    {
        id: 'FORMAL_INSULT',
        name: 'Issue Formal Insult',
        evaluate: (s) => { return s.aggression >= 6 && s.validNeighbors.length > 0 && s.activeWars.length === 0 && Math.random() > 0.5 ? 30 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 40) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = LEAST(100, sim_diplomacy.tension + 20)", [s.id, enemyId]); return `${s.leaderName} issued a scathing, highly publicized formal insult to the ruler of Faction ${enemyId}, damaging relations.`; }
    },
    {
        id: 'EXPEL_UNDESIRABLES',
        name: 'Expel Undesirables',
        evaluate: (s) => { return s.aggression >= 9 && s.avgUnrest > 40 ? 60 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_burg_economy SET pop_null = GREATEST(0, pop_null - 500), unrest = GREATEST(0, unrest - 30) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]); return `In a chilling decree, ${s.name} forcibly expelled 'undesirable' populations from their borders to quell unrest.`; }
    },
    {
        id: 'SPONSOR_GREAT_HERO',
        name: 'Sponsor Great Hero',
        evaluate: (s) => { return s.treasury > 4000 ? 45 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 2500) WHERE id = $1", [s.id]); return `${s.name} sponsored the rise of a Great Hero, elevating a legendary new figure to their paragon ranks.`; }
    }
];
//# sourceMappingURL=factionActions.js.map