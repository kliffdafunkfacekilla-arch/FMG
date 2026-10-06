"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectWorldLore = injectWorldLore;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Injects foundational world lore into the persistence layer.
 */
async function injectWorldLore(entry) {
    const client = await pool_1.default.connect();
    try {
        await client.query(`INSERT INTO world_lore (seed, title, category, content, associated_cell_id)
       VALUES ($1, $2, $3, $4, $5)`, [entry.seed, entry.title, entry.category, entry.content, entry.associatedCellId]);
        console.log(`Lore injected successfully: '${entry.title}'`);
    }
    catch (error) {
        console.error('Failed to inject world lore:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=loreEngine.js.map