const { Client } = require("pg");

const BIOME_RESOURCES = {
    "0":  { floraM: "veg", floraS: "stone", faunaM: "meat", faunaS: "reagents" },
    "1":  { floraM: "clay", floraS: "poison", faunaM: "mounts", faunaS: "ivory" },
    "2":  { floraM: "clay", floraS: "gems", faunaM: "fur", faunaS: "lard" },
    "3":  { floraM: "fibre", floraS: "grain", faunaM: "ivory", faunaS: "meat" },
    "4":  { floraM: "grain", floraS: "root_veg", faunaM: "draftbeasts", faunaS: "wool" },
    "5":  { floraM: "fruit", floraS: "wood", faunaM: "pets", faunaS: "errand_beasts" },
    "6":  { floraM: "wood", floraS: "herbs", faunaM: "leather", faunaS: "companion_beasts" },
    "7":  { floraM: "wood", floraS: "poison", faunaM: "reagents", faunaS: "pets" },
    "8":  { floraM: "wood", floraS: "medicine", faunaM: "fur", faunaS: "leather" },
    "9":  { floraM: "wood", floraS: "root_veg", faunaM: "fur", faunaS: "meat" },
    "10": { floraM: "root_veg", floraS: "stone", faunaM: "fur", faunaS: "ivory" },
    "11": { floraM: "stone", floraS: "gems", faunaM: "lard", faunaS: "fur" },
    "12": { floraM: "clay", floraS: "medicine", faunaM: "adhesive", faunaS: "codependent_beasts" }
};

async function run() {
    const client = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await client.connect();
    
    const burgsRes = await client.query("SELECT b.burg_id, c.biome, c.id as cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id");
    const cellsRes = await client.query("SELECT id, biome, center_x, center_y FROM sim_cells");
    
    const roll = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    for (let i = 0; i < burgsRes.rows.length; i++) {
        const burg = burgsRes.rows[i];
        const bId = String(burg.biome || "5");
        const bRes = BIOME_RESOURCES[bId] || BIOME_RESOURCES["5"];
        
        const slots = [];
        // 2 slots floraM, 1 slot floraS
        slots.push({ res: bRes.floraM, workers: roll(10, 20) });
        slots.push({ res: bRes.floraM, workers: roll(10, 20) });
        slots.push({ res: bRes.floraS, workers: roll(5, 15) });
        
        // 2 slots faunaM, 1 slot faunaS
        slots.push({ res: bRes.faunaM, workers: roll(10, 20) });
        slots.push({ res: bRes.faunaM, workers: roll(10, 20) });
        slots.push({ res: bRes.faunaS, workers: roll(5, 15) });
        
        const profile = { slots, neighborBiomes: [] };
        
        await client.query("UPDATE sim_burg_economy SET resource_profile = $1 WHERE burg_id = $2", [JSON.stringify(profile), burg.burg_id]);
        
        if (i > 0 && i % 100 === 0) console.log(`Baked ${i}/${burgsRes.rows.length}...`);
    }
    
    console.log("Done.");
    process.exit(0);
}
run();
