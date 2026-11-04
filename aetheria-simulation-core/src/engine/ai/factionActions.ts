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

    // ── 1. MILITARY MOBILIZATION & GARRISON RECRUITMENT ─────────────────────
    {
        id: 'MUSTER_MILITARY_FORCES',
        name: 'Muster Military Forces',
        evaluate: (s) => {
            // High priority if at war or military is low
            if (s.activeWars.length > 0) return 85;
            if (s.perceivedDefense < 40 && s.treasury > 1000) return 70 + s.aggression;
            return s.treasury > 2000 && (s.tick + s.id) % 4 === 0 ? 55 + s.aggression : 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 600) WHERE id = $1", [s.id]);
            const targetBurg = s.myBurgs[Math.floor(Math.random() * s.myBurgs.length)];
            if (targetBurg) {
                await client.query(`
                    UPDATE sim_burg_economy
                    SET military_forces = '{"footmen": 12, "archers": 6, "cavalry": 4}'
                    WHERE burg_id = $1
                `, [targetBurg.burg_id]);
                return `🛡️ MOBILIZATION: ${s.name} recruited 22 combat detachments (armored footmen, archers, cavalry) to garrison the fortress at Burg ${targetBurg.name || targetBurg.burg_id}!`;
            }
            return null;
        }
    },

    // ── 2. BORDER SKIRMISH & TENSION ESCALATION ─────────────────────────────
    {
        id: 'BORDER_SKIRMISH',
        name: 'Border Skirmish',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return 0;
            return s.aggression >= 5 && (s.tick + s.id) % 3 === 0 ? 65 + s.aggression : 0;
        },
        execute: async (s, client) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyFactionRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyFactionRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, 'COLD_WAR', 75)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET tension = LEAST(100, sim_diplomacy.tension + 20),
                    status = CASE WHEN sim_diplomacy.tension + 20 >= 100 THEN 'WAR' ELSE sim_diplomacy.status END
            `, [s.id, enemyId]);

            return `⚔️ BORDER SKIRMISH: Outriders of ${s.name} clashed with frontier patrols of ${enemyName} along contested border markers, sending tensions soaring!`;
        }
    },

    // ── 3. FORMAL ALL-OUT WAR DECLARATION ────────────────────────────────────
    {
        id: 'DECLARE_WAR',
        name: 'Declare War',
        evaluate: (s) => {
            // Aggressive factions declare war when they have border neighbors and sufficient forces
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return 0;
            return s.aggression >= 6 && s.perceivedDefense >= 20 && s.treasury > 1500 ? 75 + s.aggression : 0;
        },
        execute: async (s, client) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyFactionRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyFactionRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, 'WAR', 100)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET status = 'WAR', tension = 100
            `, [s.id, enemyId]);

            return `🚩 ALL-OUT WAR DECLARED: ${s.leaderName} of ${s.name} declared ALL-OUT WAR against ${enemyName}, ordering vanguard legions to march on the border!`;
        }
    },

    // ── 4. MUTUAL DEFENSE ALLIANCE PACT ──────────────────────────────────────
    {
        id: 'FORM_ALLIANCE',
        name: 'Sign Alliance Treaty',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return 0;
            return s.economy >= 6 && (s.tick + s.id) % 4 === 0 ? 58 + s.economy : 0;
        },
        execute: async (s, client) => {
            const allyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const allyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [allyId]);
            const allyName = allyRes.rows[0]?.name || `Faction ${allyId}`;

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, 'ALLIANCE', 0)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET status = 'ALLIANCE', tension = 0
            `, [s.id, allyId]);

            return `🤝 DIPLOMATIC ALLIANCE: ${s.name} and ${allyName} ratified a Mutual Defense Treaty, guaranteeing joint military aid against foreign aggression!`;
        }
    },

    // ── 5. TRADE EMBARGO & ECONOMIC BLOCKADE ─────────────────────────────────
    {
        id: 'TRADE_EMBARGO',
        name: 'Trade Embargo',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0) return 0;
            return s.economy >= 5 && s.aggression >= 4 && (s.tick + s.id) % 5 === 0 ? 52 : 0;
        },
        execute: async (s, client) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                UPDATE sim_burg_economy
                SET wealth = GREATEST(0, wealth - 40)
                WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)
            `, [enemyId]);

            return `🚫 TRADE EMBARGO: ${s.name} enacted an iron commercial embargo against ${enemyName}, shutting trade corridors and seizing foreign merchant freight!`;
        }
    },

    // ── 6. COVERT SABOTAGE & INFILTRATION ────────────────────────────────────
    {
        id: 'COVERT_SABOTAGE',
        name: 'Covert Sabotage',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0) return 0;
            return s.treasury > 1000 && (s.tick + s.id) % 4 === 0 ? 50 + Math.floor(Math.random() * 15) : 0;
        },
        execute: async (s, client) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]);

            return `🕵️ COVERT SABOTAGE: ${s.name} shadow operatives infiltrated ${enemyName}, sabotaging border watchtowers and burning forward grain stores!`;
        }
    },

    // ── 7. SUE FOR PEACE ─────────────────────────────────────────────────────
    {
        id: 'SUE_FOR_PEACE',
        name: 'Sue for Peace',
        evaluate: (s) => {
            if (s.activeWars.length === 0) return 0;
            return s.treasury < 1000 || s.perceivedDefense < 25 || s.avgUnrest > 35 ? 90 : 0;
        },
        execute: async (s, client) => {
            const enemyId = s.activeWars[0];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                UPDATE sim_diplomacy SET status = 'PEACE', tension = 25
                WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)
            `, [s.id, enemyId]);

            return `🕊️ PEACE ACCORD: Exhausted and battered by military losses, ${s.name} signed a formal peace armistice with ${enemyName}, ending the war!`;
        }
    },

    // ── 8. FORTIFY BORDER CITADEL ────────────────────────────────────────────
    {
        id: 'FORTIFY_BORDER_CITADEL',
        name: 'Fortify Border Citadel',
        evaluate: (s) => {
            return s.treasury > 1500 ? 48 + s.aggression : 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 700) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, crime_rate - 8) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏰 CITADEL FORTIFICATION: Sovereign ${s.leaderName} financed heavy stone citadels and ballista bastions along the frontier borders of ${s.name}.`;
        }
    },

    // ── 9. COMMISSION ALCHEMICAL STOCKPILE ────────────────────────────────────
    {
        id: 'COMMISSION_ALCHEMICAL_STOCKPILE',
        name: 'Commission Alchemical Stockpile',
        evaluate: (s) => {
            return s.magic >= 4 && s.treasury > 1000 && (s.tick + s.id) % 3 === 0 ? 46 : 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET health = LEAST(100, health + 6) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🧪 ALCHEMICAL STOCKPILE: ${s.name} commissioned court alchemists to distill emergency reserves of dragon-fire pitch and curative draughts.`;
        }
    },

    // ── 10. HOLD CORONATION JOUST ────────────────────────────────────────────
    {
        id: 'HOLD_CORONATION_JOUST',
        name: 'Hold Grand Tourney and Joust',
        evaluate: (s) => {
            return s.treasury > 2000 && s.activeWars.length === 0 && (s.tick + s.id) % 6 === 0 ? 42 : 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 600) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏆 CHIVALRIC TOURNEY: ${s.leaderName} proclaimed a grand chivalric tournament and joust, inspiring knightly valor and courtly prestige across ${s.name}.`;
        }
    },

    // ── 11. ROYAL HIGHWAY PATROL ─────────────────────────────────────────────
    {
        id: 'ROYAL_HIGHWAY_PATROL',
        name: 'Royal Highway Patrol',
        evaluate: (s) => {
            return s.activeWars.length === 0 && (s.tick + s.id) % 3 === 0 ? 40 : 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, crime_rate - 6) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🐎 HIGHWAY PATROL: ${s.leaderName} deployed mounted royal marshals to secure trade routes and deter bandits along the king's highways in ${s.name}.`;
        }
    },

    // ── 12. COMMISSION WORLD WONDER (Monumental, rare, capped) ───────────────
    {
        id: 'COMMISSION_WORLD_WONDER',
        name: 'Commission World Wonder',
        evaluate: (s) => {
            // Only fires rarely (every 60 ticks) when treasury is colossal and at peace
            if (s.treasury >= 50000 && s.activeWars.length === 0 && (s.tick + s.id) % 60 === 0) {
                return 44;
            }
            return 0;
        },
        execute: async (s, client) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 10000) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET unrest = 0 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏛️ WORLD WONDER: ${s.name} completed construction on a magnificent World Wonder, cementing their historical legacy for centuries!`;
        }
    }
];
