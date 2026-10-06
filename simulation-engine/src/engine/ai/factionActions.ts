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

    {
        id: 'MINT_CURRENCY',
        name: 'Mint Fiat Currency',
        evaluate: (s) => { return s.treasury < 100 && s.economy > 5 ? 70 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = treasury + 1000 WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 10), wealth = GREATEST(0, wealth - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.leaderName} ordered the mass minting of fiat currency to save the treasury.`; }
    },

    {
        id: 'TAX_RELIEF',
        name: 'Tax Relief',
        evaluate: (s) => { return s.treasury > 3000 && s.avgUnrest > 25 ? 60 + s.economy : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.leaderName} issued widespread tax relief, buying the adoration of the populace.`; }
    },

    {
        id: 'SUBSIDIZE_AGRICULTURE',
        name: 'Subsidize Agriculture',
        evaluate: (s) => { return s.treasury > 500 && s.avgHealth < 70 ? 55 + (s.economy * 2) : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET food = food + 1000, health = LEAST(100, health + 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.name} heavily subsidized the farming sector, flooding the markets with cheap food.`; }
    },

    {
        id: 'FUND_PUBLIC_WORKS',
        name: 'Fund Public Works',
        evaluate: (s) => { return s.treasury > 2000 && s.economy > 6 && s.avgUnrest < 20 ? 50 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 50, health = LEAST(100, health + 5) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.name} initiated massive infrastructure and public works projects.`; }
    },

    {
        id: 'MUSTER_MILITIA',
        name: 'Muster Militia',
        evaluate: (s) => { return s.activeWars.length > 0 && s.perceivedDefense < 5 && s.treasury > 1000 ? 80 : 0; },
        execute: async (s, client) => { 
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); 
            await client.query(`
                UPDATE sim_burg_economy 
                SET military_forces = jsonb_set(COALESCE(military_forces, '{}'::jsonb), '{footmen}', (COALESCE((military_forces->>'footmen')::int, 0) + 100)::text::jsonb) 
                WHERE burg_id = ANY($1::int[])`, [s.myBurgs.map(b=>b.burg_id)]); 
            return `Desperate for defense, ${s.name} spent their treasury to muster thousands of peasant militia to the front lines.`; 
        }
    },

    {
        id: 'ESTABLISH_TRADE_ARTERY',
        name: 'Establish Trade Artery',
        evaluate: (s) => { return s.economy >= 7 && s.treasury > 3000 && s.activeWars.length === 0 ? 60 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_factions SET treasury = treasury + 2500 WHERE id = $1", [s.id]); return `${s.name} opened a massive, lucrative new trade artery with neighboring lands.`; }
    },

    {
        id: 'COMMISSION_WORLD_WONDER',
        name: 'Commission World Wonder',
        evaluate: (s) => { return s.treasury >= 15000 && s.activeWars.length === 0 ? 85 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 10000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = 0 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.name} completed construction on a magnificent World Wonder, cementing their historical legacy.`; }
    },

    {
        id: 'FOUND_RELIGION',
        name: 'Found State Religion',
        evaluate: (s) => { return s.magic >= 8 && s.avgUnrest > 30 && s.treasury > 2000 ? 65 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1500) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 20), crime_rate = GREATEST(0, crime_rate - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.leaderName} formally established a new State Religion, unifying the spiritual identity of the faction.`; }
    },

    {
        id: 'ARRANGE_ROYAL_MARRIAGE',
        name: 'Arrange Royal Marriage',
        evaluate: (s) => { return s.validNeighbors.length > 0 && s.treasury > 1000 && s.activeWars.length === 0 && Math.random() > 0.5 ? 55 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 800) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'PEACE', 0) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = 0, status='PEACE'", [s.id, enemyId]); return `A grand Royal Marriage was arranged between ${s.name} and Faction ${enemyId}, forging a powerful diplomatic bond.`; }
    },

    {
        id: 'HOST_GRAND_FEAST',
        name: 'Host Grand Feast',
        evaluate: (s) => { return s.treasury > 1500 && s.avgUnrest > 15 ? 45 : 0; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 1000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 20) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `${s.leaderName} hosted a lavish Grand Feast for the nobility, greatly increasing their political capital.`; }
    },

    {
        id: 'FABRICATE_CASUS_BELLI',
        name: 'Fabricate Casus Belli',
        evaluate: (s) => { return s.aggression > 5 && s.validNeighbors.length > 0 && s.activeWars.length === 0 && s.treasury > 800 ? 55 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]); await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', 80) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET tension = LEAST(100, sim_diplomacy.tension + 30)", [s.id, enemyId]); return `Diplomats from ${s.name} fabricated historical claims on the borders of Faction ${enemyId}, laying the groundwork for war.`; }
    },

    {
        id: 'DECLARE_WAR',
        name: 'Declare War',
        evaluate: (s) => { 
            // Only declare war if highly aggressive, have money to fund it, AND have a strong military!
            return s.aggression >= 7 && s.validNeighbors.length > 0 && s.activeWars.length === 0 && s.perceivedDefense > 50 && s.treasury > 2000 ? 70 : 0; 
        },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [s.id, enemyId]); return `${s.leaderName} felt confident in their military superiority and formally declared ALL-OUT WAR on Faction ${enemyId}!`; }
    },

    {
        id: 'SUE_FOR_PEACE',
        name: 'Sue for Peace',
        evaluate: (s) => { return s.activeWars.length > 0 && (s.treasury < 500 || s.perceivedDefense < 20 || s.avgUnrest > 40) ? 90 : 0; },
        execute: async (s, client) => { 
            const enemyId = s.activeWars[0];
            await client.query("UPDATE sim_diplomacy SET status = 'PEACE', tension = 30 WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)", [s.id, enemyId]);
            return `Exhausted and battered by the ongoing conflict, ${s.name} officially sued for peace with Faction ${enemyId}, ending the war.`; 
        }
    },

    {
        id: 'TRADE_EMBARGO',
        name: 'Trade Embargo',
        evaluate: (s) => { return s.economy >= 6 && s.validNeighbors.length > 0 && s.treasury > 1000 && s.aggression > 4 ? 40 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 30) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [enemyId]); return `${s.name} enacted a punishing Trade Embargo against Faction ${enemyId}, crippling their merchant class.`; }
    },

    {
        id: 'DEMAND_TRIBUTE',
        name: 'Demand Tribute',
        evaluate: (s) => { return s.aggression >= 8 && s.validNeighbors.length > 0 && s.perceivedDefense > 60 && s.treasury < 1000 ? 65 : 0; },
        execute: async (s, client) => { const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)]; await client.query("UPDATE sim_factions SET treasury = treasury + 500 WHERE id = $1", [s.id]); await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [enemyId]); return `Through sheer military intimidation, ${s.name} forced Faction ${enemyId} to pay a humiliating tribute.`; }
    },

    {
        id: 'DECLARE_GOLDEN_AGE',
        name: 'Declare Golden Age',
        evaluate: (s) => { if (s.treasury < 20000 || s.avgUnrest > 5 || s.avgHealth < 90) return 0; return 50; },
        execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 15000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 100, food = food + 1000 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return `A flourishing renaissance of art and culture has begun! ${s.name} has entered a spectacular Golden Age!`; }
    }
];
