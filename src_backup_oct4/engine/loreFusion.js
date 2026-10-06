"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFusion = runFusion;
// @ts-nocheck
const fs_1 = __importDefault(require("fs"));
const pool_1 = __importDefault(require("../db/pool"));
const CSV_PATH = 'C:/Users/krazy/Desktop/ttrpgsimulationprojects/DualStateEngine/Okasha/Okasha States 2026-06-26-06-57.csv';
const GEOJSON_PATH = 'C:/Users/krazy/Desktop/ttrpgsimulationprojects/DualStateEngine/Okasha/Okasha Cells 2026-06-26-06-52.geojson';
const MD1_PATH = 'C:/Users/krazy/Downloads/files (3)/03_Great_Powers.md';
const MD2_PATH = 'C:/Users/krazy/Downloads/files (3)/06_Underworld_and_Secret_Orders.md';
const aggressionKeywords = ['war', 'conflict', 'military', 'combat', 'siege', 'violence', 'weapon', 'sword', 'guard', 'conquer', 'invasion', 'threat', 'defend'];
const magicKeywords = ['magic', 'aether', 'spell', 'spark', 'dragon', 'mystic', 'illusion', 'chaos', 'psychic', 'rite', 'ritual', 'god', 'divine', 'worship'];
const economyKeywords = ['trade', 'economy', 'merchant', 'gold', 'profit', 'market', 'import', 'wealth', 'debt', 'bank', 'cartel', 'syndicate', 'commerce'];
function scoreTrait(text, keywords) {
    let score = 5;
    if (!text)
        return score;
    const lowerText = text.toLowerCase();
    for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) {
            score += matches.length;
        }
    }
    return Math.min(10, Math.max(1, score));
}
async function runFusion() {
    console.log("Starting Lore Fusion...");
    const csvData = fs_1.default.readFileSync(CSV_PATH, 'utf-8').split('\n');
    const md1 = fs_1.default.readFileSync(MD1_PATH, 'utf-8');
    const md2 = fs_1.default.readFileSync(MD2_PATH, 'utf-8');
    const fullLore = md1 + "\n\n" + md2;
    const factions = [];
    for (let i = 1; i < csvData.length; i++) {
        const line = csvData[i].trim();
        if (!line)
            continue;
        // Handle CSV split correctly (naive split works here as there are no commas in unquoted strings based on the preview)
        const cols = line.split(',');
        const id = parseInt(cols[0], 10);
        let name = cols[1];
        if (!name)
            name = cols[2] || "Unknown"; // Fallback to full name if short state name is missing
        const color = cols[4] || "#ffffff";
        let lore_text = "";
        const sections = fullLore.split('## ');
        for (const sec of sections) {
            if (sec.toLowerCase().includes(name.toLowerCase())) {
                lore_text += sec.trim() + "\n\n";
            }
        }
        if (lore_text.length > 3000) {
            lore_text = lore_text.substring(0, 3000) + '...';
        }
        const trait_aggression = scoreTrait(lore_text, aggressionKeywords);
        const trait_magic = scoreTrait(lore_text, magicKeywords);
        const trait_economy = scoreTrait(lore_text, economyKeywords);
        factions.push({ id, name, color, lore_text, trait_aggression, trait_magic, trait_economy });
    }
    console.log(`Inserting ${factions.length} factions...`);
    for (const f of factions) {
        await pool_1.default.query(`INSERT INTO sim_factions (id, name, color, lore_text, trait_aggression, trait_magic, trait_economy)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`, [f.id, f.name, f.color, f.lore_text, f.trait_aggression, f.trait_magic, f.trait_economy]);
    }
    console.log("Factions inserted.");
    console.log("Parsing GeoJSON and inserting cells...");
    const geojsonData = JSON.parse(fs_1.default.readFileSync(GEOJSON_PATH, 'utf-8'));
    const features = geojsonData.features;
    let count = 0;
    for (const feat of features) {
        const id = feat.properties.id;
        const faction_id = feat.properties.state;
        const biome = feat.properties.biome.toString();
        const population = feat.properties.population || 0;
        const geometry = JSON.stringify(feat.geometry);
        await pool_1.default.query(`INSERT INTO sim_cells (id, faction_id, biome, population, geometry)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`, [id, faction_id, biome, population, geometry]);
        count++;
        if (count % 1000 === 0)
            console.log(`Inserted ${count} cells...`);
    }
    console.log(`Total ${count} Cells inserted.`);
    console.log("Lore Fusion Complete.");
}
// Do not call runFusion() here directly. The engineer instructed not to run the script yet.
//# sourceMappingURL=loreFusion.js.map