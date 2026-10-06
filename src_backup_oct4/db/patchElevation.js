"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const pool_1 = __importDefault(require("./pool"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.resolve(__dirname, '../../aetheria.sqlite');
const sqlite = new better_sqlite3_1.default(dbPath);
async function patchElevation() {
    console.log("Loading Okasha map...");
    const lines = fs_1.default.readFileSync('C:/Users/krazy/Desktop/ttrpgsimulationprojects/DualStateEngine/Okasha/Okasha 2026-06-26-06-43.map', 'utf8').split(/\r?\n/);
    const elevations = (lines[153] || '').split(',').map(Number);
    console.log(`Extracted ${elevations.length} elevation values.`);
    if (elevations.length !== 34431) {
        console.error("Length mismatch!");
        process.exit(1);
    }
    // 1. Patch SQLite
    console.log("Patching SQLite...");
    try {
        sqlite.exec("ALTER TABLE sim_cells ADD COLUMN elevation REAL DEFAULT 0");
    }
    catch (e) {
        // column might exist
    }
    const stmt = sqlite.prepare("UPDATE sim_cells SET elevation = ? WHERE id = ?");
    sqlite.exec("BEGIN");
    for (let i = 0; i < elevations.length; i++) {
        stmt.run(elevations[i], i);
    }
    sqlite.exec("COMMIT");
    // 2. Patch Postgres
    console.log("Patching Postgres...");
    const client = await pool_1.default.connect();
    try {
        await client.query("BEGIN");
        for (let i = 0; i < elevations.length; i += 1000) {
            const chunk = elevations.slice(i, i + 1000);
            let query = "UPDATE sim_cells SET elevation = CASE id ";
            for (let j = 0; j < chunk.length; j++) {
                query += `WHEN ${i + j} THEN ${chunk[j]} `;
            }
            query += "END WHERE id IN (" + chunk.map((_, j) => i + j).join(",") + ")";
            await client.query(query);
        }
        await client.query("COMMIT");
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
    }
    finally {
        client.release();
    }
    console.log("Done patching elevations!");
}
patchElevation().then(() => process.exit(0)).catch(console.error);
//# sourceMappingURL=patchElevation.js.map