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
    leaderTitle: string;
    leaderTraits: string[];
    leaderCorruption: number;
    macroTags: string[];
    tick: number;
    loreDate: string;
}

export interface FactionAction {
    id: string;
    name: string;
    evaluate: (state: FactionState) => { score: number; reasoning: string };
    execute: (state: FactionState, client: any, reasoning: string) => Promise<string | null>;
}

export const FACTION_ACTIONS: FactionAction[] = [

    // ── 1. MILITARY MOBILIZATION & GARRISON RECRUITMENT ─────────────────────
    {
        id: 'MUSTER_MILITARY_FORCES',
        name: 'Muster Military Forces',
        evaluate: (s) => {
            const isAtWar = s.activeWars.length > 0;
            const isDefVulnerable = s.perceivedDefense < 40;
            const isConqueror = s.leaderTraits.some(t => t.includes("BLOODTHIRSTY") || t.includes("CONQUEROR") || t.includes("MARTIAL") || t.includes("AGGRESSIVE"));
            const isPacifist = s.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("COMPASSIONATE"));

            if (s.treasury < 600) return { score: 0, reasoning: "" };

            let score = 30;
            if (isAtWar) score += 55;
            if (isDefVulnerable) score += 35;
            if (isConqueror) score += 25;
            if (isPacifist) score -= 30;
            if (s.macroTags.some(t => t.includes("War") || t.includes("Skirmish"))) score += 20;

            const reasoning = isAtWar 
                ? "urgent wartime conscription to repel active enemy incursions"
                : isConqueror 
                ? "militaristic ambition to build an overwhelming standing army"
                : "reinforcing vulnerable border garrisons";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 600) WHERE id = $1", [s.id]);
            const targetBurg = s.myBurgs[Math.floor(Math.random() * s.myBurgs.length)];
            if (targetBurg) {
                await client.query(`
                    UPDATE sim_burg_economy
                    SET military_forces = '{"footmen": 12, "archers": 6, "cavalry": 4}',
                        wealth = GREATEST(0, wealth - 20)
                    WHERE burg_id = $1
                `, [targetBurg.burg_id]);
                return `🛡️ IMPERIAL MOBILIZATION: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} mustered 22 combat detachments (armored footmen, archers, cavalry) to fortify the garrison at ${targetBurg.name || `Burg #${targetBurg.burg_id}`}!`;
            }
            return null;
        }
    },

    // ── 2. BORDER SKIRMISH & TENSION ESCALATION ─────────────────────────────
    {
        id: 'BORDER_SKIRMISH',
        name: 'Border Skirmish',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
            const isAggressive = s.leaderTraits.some(t => t.includes("AGGRESSIVE") || t.includes("BLOODTHIRSTY") || t.includes("VENGEFUL") || t.includes("BITTER"));
            const isPacifist = s.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("DIPLOMAT"));

            let score = 25 + s.aggression * 4;
            if (isAggressive) score += 35;
            if (isPacifist) score -= 45;
            if (s.macroTags.some(t => t.includes("Tension") || t.includes("Dispute"))) score += 20;

            const reasoning = isAggressive
                ? "belligerent posturing to intimidate neighboring sovereigns"
                : "contested border claims and territorial patrols";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
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

            return `⚔️ BORDER SKIRMISH: Prompted by ${reasoning}, frontier outriders of ${s.name} clashed with border patrols of ${enemyName} along contested boundary markers, escalating tensions!`;
        }
    },

    // ── 3. FORMAL ALL-OUT WAR DECLARATION ────────────────────────────────────
    {
        id: 'DECLARE_WAR',
        name: 'Declare War',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
            if (s.treasury < 1200 || s.perceivedDefense < 25) return { score: 0, reasoning: "" };

            const isConqueror = s.leaderTraits.some(t => t.includes("CONQUEROR") || t.includes("BLOODTHIRSTY") || t.includes("IMPERIALIST"));
            const isPacifist = s.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COWARDLY"));

            let score = 30 + s.aggression * 5;
            if (isConqueror) score += 45;
            if (isPacifist) score -= 60;
            if (s.treasury > 5000) score += 15;

            const reasoning = isConqueror 
                ? "unquenchable conquest ambition and martial superiority"
                : "decisive military action to break a hostile geopolitical stalemate";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyFactionRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyFactionRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, 'WAR', 100)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET status = 'WAR', tension = 100
            `, [s.id, enemyId]);

            return `🚩 ALL-OUT WAR DECLARED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} declared ALL-OUT WAR against ${enemyName}, mobilizing vanguard legions toward the front!`;
        }
    },

    // ── 4. MUTUAL DEFENSE ALLIANCE PACT ──────────────────────────────────────
    {
        id: 'FORM_ALLIANCE',
        name: 'Sign Alliance Treaty',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
            const isDiplomat = s.leaderTraits.some(t => t.includes("DIPLOMAT") || t.includes("PACIFIST") || t.includes("PRAGMATIC") || t.includes("CALCULATED"));
            const isBloodthirsty = s.leaderTraits.some(t => t.includes("BLOODTHIRSTY") || t.includes("ISOLATIONIST"));

            let score = 30 + s.economy * 3;
            if (isDiplomat) score += 40;
            if (isBloodthirsty) score -= 40;

            const reasoning = isDiplomat
                ? "diplomatic wisdom prioritizing regional stability and mutual protection"
                : "pragmatic balance of power against foreign expansion";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const allyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const allyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [allyId]);
            const allyName = allyRes.rows[0]?.name || `Faction ${allyId}`;

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, 'ALLIANCE', 0)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET status = 'ALLIANCE', tension = 0
            `, [s.id, allyId]);

            return `🤝 DIPLOMATIC ALLIANCE: Guided by ${reasoning}, ${s.name} and ${allyName} ratified a Mutual Defense Treaty, pledging joint military assistance!`;
        }
    },

    // ── 5. TRADE EMBARGO & ECONOMIC BLOCKADE ─────────────────────────────────
    {
        id: 'TRADE_EMBARGO',
        name: 'Trade Embargo',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0) return { score: 0, reasoning: "" };
            const isGreedy = s.leaderTraits.some(t => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("MERCANTILE"));
            const isVengeful = s.leaderTraits.some(t => t.includes("VENGEFUL") || t.includes("BITTER"));

            let score = 25 + s.economy * 4;
            if (isGreedy) score += 35;
            if (isVengeful) score += 30;

            const reasoning = isGreedy
                ? "mercantile avarice to crush foreign competition and monopolize regional trade"
                : "retaliatory economic sanctions against a rival border power";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                UPDATE sim_burg_economy
                SET wealth = GREATEST(0, wealth - 50)
                WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)
            `, [enemyId]);

            return `🚫 TRADE EMBARGO ENACTED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} imposed an iron trade embargo on ${enemyName}, shutting trade corridors and impounding foreign caravans!`;
        }
    },

    // ── 6. COVERT SABOTAGE & INFILTRATION ────────────────────────────────────
    {
        id: 'COVERT_SABOTAGE',
        name: 'Covert Sabotage',
        evaluate: (s) => {
            if (s.validNeighbors.length === 0 || s.treasury < 800) return { score: 0, reasoning: "" };
            const isSpymaster = s.leaderTraits.some(t => t.includes("SPYMASTER") || t.includes("PARANOID") || t.includes("CUNNING") || t.includes("ELUSIVE"));

            let score = 20 + s.aggression * 3;
            if (isSpymaster) score += 40;

            const reasoning = isSpymaster
                ? "covert doctrine to cripple rival logistical arteries in the shadows"
                : "clandestine sabotage against enemy supply lines";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const enemyId = s.validNeighbors[Math.floor(Math.random() * s.validNeighbors.length)];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 400) WHERE id = $1", [s.id]);

            return `🕵️ COVERT SABOTAGE: Guided by ${reasoning}, ${s.name} shadow operatives slipped across the border of ${enemyName}, setting fire to forward granaries and cutting signal tower cables!`;
        }
    },

    // ── 7. SUE FOR PEACE ─────────────────────────────────────────────────────
    {
        id: 'SUE_FOR_PEACE',
        name: 'Sue for Peace',
        evaluate: (s) => {
            if (s.activeWars.length === 0) return { score: 0, reasoning: "" };

            const isExhausted = s.treasury < 1000 || s.perceivedDefense < 25 || s.avgUnrest > 35;
            const isPacifist = s.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("PRAGMATIC") || t.includes("COMPASSIONATE"));
            const isProudConqueror = s.leaderTraits.some(t => t.includes("BLOODTHIRSTY") || t.includes("CONQUEROR") || t.includes("PROUD"));

            let score = 20;
            if (isExhausted) score += 60;
            if (isPacifist) score += 30;
            if (isProudConqueror) score -= 70; // Conquerors refuse to sue for peace easily!

            const reasoning = isExhausted 
                ? "exhausted treasury, widespread civilian unrest, and military losses"
                : "pragmatic armistice to preserve the sovereignty";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const enemyId = s.activeWars[0];
            const enemyRes = await client.query("SELECT name FROM sim_factions WHERE id = $1", [enemyId]);
            const enemyName = enemyRes.rows[0]?.name || `Faction ${enemyId}`;

            await client.query(`
                UPDATE sim_diplomacy SET status = 'PEACE', tension = 25
                WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)
            `, [s.id, enemyId]);

            return `🕊️ PEACE ARMISTICE RATIFIED: Overcome by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} signed a formal peace accord with ${enemyName}, ending active warfare!`;
        }
    },

    // ── 8. FORTIFY BORDER CITADEL ────────────────────────────────────────────
    {
        id: 'FORTIFY_BORDER_CITADEL',
        name: 'Fortify Border Citadel',
        evaluate: (s) => {
            if (s.treasury < 1000) return { score: 0, reasoning: "" };
            const isIsolationist = s.leaderTraits.some(t => t.includes("ISOLATIONIST") || t.includes("PARANOID") || t.includes("DEFENSIVE") || t.includes("STOIC"));

            let score = 25;
            if (isIsolationist) score += 45;
            if (s.perceivedDefense < 50) score += 20;

            const reasoning = isIsolationist
                ? "isolationist paranoia and fortified border doctrine"
                : "strengthening defensive citadels against frontier incursions";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 700) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, crime_rate - 8) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏰 CITADEL FORTIFICATION: Guided by ${reasoning}, ${s.leaderTitle} ${s.leaderName} financed heavy stone bastions and ballista redoubts along the frontier borders of ${s.name}.`;
        }
    },

    // ── 9. COMMISSION ALCHEMICAL STOCKPILE ────────────────────────────────────
    {
        id: 'COMMISSION_ALCHEMICAL_STOCKPILE',
        name: 'Commission Alchemical Stockpile',
        evaluate: (s) => {
            if (s.treasury < 800) return { score: 0, reasoning: "" };
            const isAlchemist = s.leaderTraits.some(t => t.includes("ALCHEMIST") || t.includes("SUPERSTITIOUS") || t.includes("SCHOLARLY") || t.includes("WILD_SPARK"));

            let score = 20 + s.magic * 4;
            if (isAlchemist) score += 35;
            if (s.avgHealth < 80) score += 25;

            const reasoning = isAlchemist
                ? "devotion to alchemical science and weaponized pitch reserves"
                : "stockpiling curative draughts and defensive pyrotechnics";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET health = LEAST(100, health + 6) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🧪 ALCHEMICAL STOCKPILE: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} directed court alchemists across ${s.name} to distill emergency reserves of dragon-fire pitch and curative draughts (+6 Health).`;
        }
    },

    // ── 10. HOLD GRAND TOURNEY & JOUST ───────────────────────────────────────
    {
        id: 'HOLD_CORONATION_JOUST',
        name: 'Hold Grand Tourney and Joust',
        evaluate: (s) => {
            if (s.treasury < 1500 || s.activeWars.length > 0) return { score: 0, reasoning: "" };
            const isHedonist = s.leaderTraits.some(t => t.includes("HEDONIST") || t.includes("DECADENT") || t.includes("CHIVALRIC") || t.includes("CONVIVIAL"));

            let score = 20;
            if (isHedonist) score += 45;
            if (s.avgUnrest > 25) score += 25;

            const reasoning = isHedonist
                ? "decadent love of chivalric spectacle and grand pageantry"
                : "inspiring knightly loyalty and cheering restless provincial crowds";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 600) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 10) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏆 CHIVALRIC TOURNEY: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} proclaimed an imperial chivalric tournament across ${s.name}, soothing public unrest through feasts and martial pageantry (-10 Unrest).`;
        }
    },

    // ── 11. IMPERIAL PROVINCIAL GRAIN RELIEF ─────────────────────────────────
    {
        id: 'IMPERIAL_GRAIN_RELIEF',
        name: 'Imperial Provincial Grain Relief',
        evaluate: (s) => {
            const hasStarvingBurg = s.myBurgs.some(b => (b.food || 0) < (b.pop_null || 100) * 2);
            if (!hasStarvingBurg || s.treasury < 600) return { score: 0, reasoning: "" };

            const isCompassionate = s.leaderTraits.some(t => t.includes("COMPASSIONATE") || t.includes("BENEVOLENT") || t.includes("PATERNAL") || t.includes("AGRARIAN"));
            const isGreedy = s.leaderTraits.some(t => t.includes("GREEDY") || t.includes("USURIOUS"));

            let score = 40;
            if (isCompassionate) score += 50;
            if (isGreedy) score -= 45;

            const reasoning = isCompassionate 
                ? "imperial benevolence ensuring provincial subjects do not perish of hunger"
                : "preventing widespread starvation riots across the provinces";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 500) WHERE id = $1", [s.id]);
            await client.query(`
                UPDATE sim_burg_economy 
                SET food = food + 300, unrest = GREATEST(0, unrest - 8)
                WHERE burg_id = ANY($1::int[])
            `, [s.myBurgs.map(b => b.burg_id)]);
            return `🌾 IMPERIAL GRAIN RELIEF: Guided by ${reasoning}, ${s.leaderTitle} ${s.leaderName} dispatched imperial food convoys to alleviate provincial shortages across ${s.name} (+300 Food).`;
        }
    },

    // ── 12. IMPERIAL SPECIAL TAX LEVY ────────────────────────────────────────
    {
        id: 'IMPERIAL_TAX_EXTRACTION',
        name: 'Imperial Special Tax Levy',
        evaluate: (s) => {
            const isGreedy = s.leaderTraits.some(t => t.includes("GREEDY") || t.includes("USURIOUS") || t.includes("AVARICE"));
            const isTreasuryLow = s.treasury < 1000;

            let score = isTreasuryLow ? 40 : 15;
            if (isGreedy) score += 45;

            const reasoning = isGreedy 
                ? "rapacious imperial avarice to amass sovereign bullion"
                : "urgently replenishing depleted sovereign coffers";

            return { score: Math.max(0, score), reasoning };
        },
        execute: async (s, client, reasoning) => {
            const totalExtracted = s.myBurgs.length * 40;
            await client.query("UPDATE sim_factions SET treasury = treasury + $1 WHERE id = $2", [totalExtracted, s.id]);
            await client.query(`
                UPDATE sim_burg_economy
                SET wealth = GREATEST(0, wealth - 40),
                    unrest = LEAST(100, unrest + 6)
                WHERE burg_id = ANY($1::int[])
            `, [s.myBurgs.map(b => b.burg_id)]);
            return `💰 IMPERIAL TAX EXTRACTION: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} enacted a special crown levy across ${s.name}, extracting +${totalExtracted} Gold while provoking public grumbling (+6 Unrest).`;
        }
    },

    // ── 13. COMMISSION WORLD WONDER ──────────────────────────────────────────
    {
        id: 'COMMISSION_WORLD_WONDER',
        name: 'Commission World Wonder',
        evaluate: (s) => {
            // World wonders are rare, legendary undertakings: must have immense treasury, 3+ cities, and tick >= 200
            if (s.treasury < 60000 || s.activeWars.length > 0 || s.myBurgs.length < 3 || s.tick < 200) return { score: 0, reasoning: "" };
            const isAmbitious = s.leaderTraits.some(t => t.includes("AMBITIOUS") || t.includes("VAINGLORIOUS") || t.includes("MAGNIFICENT"));
            if (!isAmbitious) return { score: 0, reasoning: "" };

            // Can only trigger on rare epoch cadence
            if (s.tick % 150 !== 0) return { score: 0, reasoning: "" };

            let score = 35;
            const reasoning = "vainglorious ambition to etch their sovereign dynasty into eternity with an epochal World Wonder";
            return { score, reasoning };
        },
        execute: async (s, client, reasoning) => {
            await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 40000) WHERE id = $1", [s.id]);
            await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 15) WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b => b.burg_id)]);
            return `🏛️ WORLD WONDER ERECTED: Driven by ${reasoning}, ${s.leaderTitle} ${s.leaderName} of ${s.name} completed an awe-inspiring World Wonder, permanently immortalizing their reign!`;
        }
    }
];
