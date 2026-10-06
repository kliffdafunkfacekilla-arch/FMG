"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyParagonSkew = applyParagonSkew;
exports.executeFactionAndDiplomacyTick = executeFactionAndDiplomacyTick;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Applies Paragon trait skews to base simulation values.
 */
function applyParagonSkew(baseValue, traits, targetKey) {
    let modifierSum = 0.0;
    traits.forEach((trait) => {
        if (trait.target === targetKey) {
            modifierSum += trait.modifier;
        }
    });
    // Ensures output scales mathematically according to leader personality and flaws
    return baseValue * (1.0 + modifierSum);
}
/**
 * Executes monthly faction upkeep, diplomatic shifts, and leadership trait checks.
 */
async function executeFactionAndDiplomacyTick(seed) {
    const client = await pool_1.default.connect();
    try {
        console.log(`Executing faction diplomacy and paragon tick for seed: ${seed}...`);
        await client.query('BEGIN');
        // 1. Fetch all factions and their assigned resources
        const factionsQuery = await client.query(`SELECT faction_id, name, treasury, military_strength, expansionism FROM factions WHERE seed = $1`, [seed]);
        for (const faction of factionsQuery.rows) {
            // Military Upkeep Equation: Maintaining active troops drains state treasury
            const baseUnitCost = 2.0; // Currency units per active soldier per month
            const totalUpkeep = faction.military_strength * baseUnitCost;
            // Fetch leadership traits if governing a capital settlement linked to this faction
            const paragonQuery = await client.query(`SELECT p.traits FROM paragons p
         JOIN settlements s ON p.settlement_id = s.settlement_id
         WHERE s.faction_id = $1`, [faction.faction_id]);
            let effectiveUpkeep = totalUpkeep;
            if (paragonQuery.rows.length > 0) {
                const traits = paragonQuery.rows[0].traits;
                // Apply Paragon skew if leader traits affect military logistics or maintenance
                effectiveUpkeep = applyParagonSkew(totalUpkeep, traits, 'military_upkeep');
            }
            let newTreasury = parseFloat(faction.treasury) - effectiveUpkeep;
            let militaryStrength = faction.military_strength;
            // Desertion Penalty if Treasury falls below zero
            if (newTreasury < 0) {
                newTreasury = 0;
                militaryStrength = Math.max(50, Math.floor(militaryStrength * 0.90)); // 10% desertion drop
                console.warn(`Faction '${faction.name}' treasury exhausted. Military desertion penalty triggered.`);
            }
            // Update faction status in database
            await client.query(`UPDATE factions SET treasury = $1, military_strength = $2 WHERE faction_id = $3`, [parseFloat(newTreasury.toFixed(2)), militaryStrength, faction.faction_id]);
        }
        await client.query('COMMIT');
        console.log('Faction diplomacy and paragon upkeep tick successfully completed.');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Faction tick execution failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=factionEngine.js.map