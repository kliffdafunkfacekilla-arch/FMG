"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function fixFactions() {
    const client = new pg_1.Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    const updates = [
        { old: 'Iron Caladra', new: 'Iron Caldera' },
        { old: 'Relience', new: 'Reliance' },
        { old: 'Guirilla', new: 'Guerrilla Clans' },
        { old: 'Theocracy', new: 'Coastal Theocracy' },
        { old: 'Canopy', new: 'Canopy Clans' },
        { old: 'Scute', new: 'Scute Confederacy' },
        { old: 'Ursine', new: 'Ursine Hegemony' },
        { old: 'Vaneer', new: 'Vaneer Concord' },
        { old: 'RiverFolk', new: 'Riverfolk' }
    ];
    for (const u of updates) {
        await client.query('UPDATE sim_factions SET name = $1 WHERE name = $2', [u.new, u.old]);
    }
    console.log("Postgres factions patched!");
    await client.end();
}
fixFactions();
//# sourceMappingURL=patchFactions.js.map