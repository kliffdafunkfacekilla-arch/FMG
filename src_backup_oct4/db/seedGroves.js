"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const pool_1 = __importDefault(require("./pool"));
const dragons = [
    { name: "Tiraton", domain: "Mass" },
    { name: "Carulkem", domain: "Nexus" },
    { name: "Stagus", domain: "Ordo" },
    { name: "Tyrustis", domain: "Lex" },
    { name: "Vecelo", domain: "Motus" },
    { name: "Aurgenas", domain: "Flux" },
    { name: "Gavusrix", domain: "Vita" },
    { name: "Metrion", domain: "Ratio" },
    { name: "Opecten", domain: "Lux" },
    { name: "Termhill", domain: "Omen" },
    { name: "Virantor", domain: "Aura" },
    { name: "Lophex", domain: "Anumis" }
];
async function seedGroves() {
    try {
        console.log("Fetching random cell_ids...");
        const res = await pool_1.default.query("SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 12");
        const cellIds = res.rows.map((row) => row.id);
        if (cellIds.length < 12) {
            console.warn(`Only found ${cellIds.length} cells. We need 12 for all dragons.`);
        }
        console.log("Seeding Sacred Groves...");
        for (let i = 0; i < Math.min(dragons.length, cellIds.length); i++) {
            const dragon = dragons[i];
            const cellId = cellIds[i];
            await pool_1.default.query("INSERT INTO sim_sacred_groves (cell_id, dragon_name, power_domain, seal_strength) VALUES ($1, $2, $3, $4)", [cellId, dragon.name, dragon.domain, 100]);
            console.log(`Seeded ${dragon.name} (${dragon.domain}) at cell ${cellId}`);
        }
        console.log("Seeder script finished successfully.");
    }
    catch (error) {
        console.error("Failed to seed groves:", error);
    }
    finally {
        pool_1.default.end();
    }
}
seedGroves();
//# sourceMappingURL=seedGroves.js.map