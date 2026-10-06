"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const pool_1 = __importDefault(require("./pool"));
async function main() {
    console.log('Loading factions and cells...');
    // 1. Query cells and factions
    const queryResult = await pool_1.default.query(`
    SELECT c.id as cell_id, f.name as faction_name 
    FROM sim_cells c 
    JOIN sim_factions f ON c.faction_id = f.id
  `);
    const stateCellsMap = new Map();
    const allCells = [];
    for (const row of queryResult.rows) {
        const factionName = row.faction_name;
        const cellId = row.cell_id;
        allCells.push(cellId);
        if (!stateCellsMap.has(factionName)) {
            stateCellsMap.set(factionName, []);
        }
        stateCellsMap.get(factionName).push(cellId);
    }
    // Also get all sim_cells in case some cells don't have a faction
    const fallbackResult = await pool_1.default.query(`SELECT id FROM sim_cells`);
    const totalCells = fallbackResult.rows.map((r) => r.id);
    console.log(`Loaded ${stateCellsMap.size} factions.`);
    const csvPath = "C:\\Users\\krazy\\Desktop\\ttrpgsimulationprojects\\DualStateEngine\\Okasha\\Okasha Burgs 2026-06-26-06-56.csv";
    const burgs = [];
    console.log('Reading CSV...');
    fs_1.default.createReadStream(csvPath)
        .pipe((0, csv_parser_1.default)())
        .on('data', (data) => {
        burgs.push(data);
    })
        .on('end', async () => {
        console.log(`Read ${burgs.length} burgs from CSV.`);
        let count = 0;
        for (const b of burgs) {
            const id = parseInt(b.Id, 10);
            const state = b.State; // Faction name
            const population = parseFloat(b.Population) || 0;
            let possibleCells = stateCellsMap.get(state) || [];
            if (possibleCells.length === 0) {
                possibleCells = totalCells;
            }
            const selectedCell = possibleCells[Math.floor(Math.random() * possibleCells.length)];
            const food = Math.floor(population * 10);
            const wealth = Math.floor(population * 5);
            const unrest = 0;
            const pop_null = Math.floor(population);
            await pool_1.default.query(`
          INSERT INTO sim_burg_economy (burg_id, cell_id, food, wealth, unrest, pop_null)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT(burg_id) DO UPDATE SET
            cell_id = excluded.cell_id,
            food = excluded.food,
            wealth = excluded.wealth,
            unrest = excluded.unrest,
            pop_null = excluded.pop_null
        `, [id, selectedCell, food, wealth, unrest, pop_null]);
            count++;
        }
        console.log(`Finished importing ${count} burgs.`);
        process.exit(0);
    });
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=burgFusion.js.map