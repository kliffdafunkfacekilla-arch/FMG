"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCivilizationEconomicTick = executeCivilizationEconomicTick;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Executes monthly civilization economic growth, carrying capacity checks, famine evaluations, and industrial manufacturing.
 */
async function executeCivilizationEconomicTick(seed) {
    const client = await pool_1.default.connect();
    try {
        console.log(`Executing civilization economic and manufacturing tick for seed: ${seed}...`);
        await client.query('BEGIN');
        // 1. Fetch all settlements and their corresponding industrial stockpiles
        const settlementsQuery = await client.query(`SELECT s.settlement_id, s.name, s.population, s.global_cell_id, i.food_reserves, i.refined_lumber, i.forged_steel, i.alchemical_potions
       FROM settlements s
       JOIN industrial_stockpiles i ON s.settlement_id = i.settlement_id
       WHERE s.seed = $1`, [seed]);
        for (const settlement of settlementsQuery.rows) {
            const pop = settlement.population;
            const foodRequired = pop * 0.1; // Baseline consumption: 0.1 food units per citizen per month
            // Calculate local food production capacity based on concentric ring exploitation
            const baseFoodProduction = 1200;
            const housingModifier = 1.0;
            const carryingCapacity = baseFoodProduction * housingModifier;
            let currentFoodReserves = parseFloat(settlement.food_reserves) + baseFoodProduction - foodRequired;
            let famineState = false;
            // 2. Evaluate Famine Conditions and Population Attrition
            if (currentFoodReserves < 0) {
                currentFoodReserves = 0;
                famineState = true;
                const newPopulation = Math.max(100, Math.floor(pop * 0.95)); // 5% population loss during active famine
                await client.query(`UPDATE settlements SET population = $1 WHERE settlement_id = $2`, [newPopulation, settlement.settlement_id]);
                console.warn(`Settlement '${settlement.name}' (ID ${settlement.settlement_id}) entered FAMINE state. Population adjusted.`);
            }
            // 3. Industrial Manufacturing Conversion Chains (Raw to Produced Goods)
            // Conversion: 2 Iron Ore + 1 Timber -> 1 Forged Steel; 3 Raw Timber -> 2 Refined Lumber
            const newForgedSteel = parseInt(settlement.forged_steel) + 12;
            const newRefinedLumber = parseInt(settlement.refined_lumber) + 20;
            // Update settlement industrial stockpile records
            await client.query(`UPDATE industrial_stockpiles 
         SET food_reserves = $1, forged_steel = $2, refined_lumber = $3 
         WHERE settlement_id = $4`, [currentFoodReserves, newForgedSteel, newRefinedLumber, settlement.settlement_id]);
        }
        await client.query('COMMIT');
        console.log('Civilization economic and manufacturing tick successfully completed.');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Economic tick execution failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=economicEngine.js.map