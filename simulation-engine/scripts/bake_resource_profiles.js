/**
 * ONE-TIME BAKE: Calculates and stores the resource_profile for every burg.
 * Run once. The orchestrator reads it every tick instead of re-computing.
 */
const { Client } = require("pg");

// Azgaar biome IDs mapped to primary + secondary resources
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

// Resources that get a 2x bonus from MINE or CAMP
const MINE_RESOURCES = new Set(["iron", "stone", "copper", "gold", "silver", "crystals", "clay", "dragon_stone_shard"]);
const CAMP_RESOURCES = new Set(["wood", "pitch", "fibre"]);

async function bake() {
    const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await c.connect();

    // Fetch every burg with its cell's biome and coordinates
    const burgs = (await c.query(`
        SELECT b.burg_id, b.cell_id, c.biome, c.center_x, c.center_y
        FROM sim_burg_economy b
        JOIN sim_cells c ON b.cell_id = c.id
    `)).rows;

    // Fetch all cells so we can find neighboring biomes by proximity
    const cells = (await c.query("SELECT id, biome, center_x, center_y FROM sim_cells")).rows;
    const cellMap = new Map(cells.map(c => [c.id, c]));

    let updates = 0;

    for (const burg of burgs) {
        const myBiome = String(burg.biome || "5");
        const myX = burg.center_x || 0;
        const myY = burg.center_y || 0;

        // Find the 3 closest DISTINCT-biome cells to get the surrounding biome palette
        const distances = cells
            .filter(cell => String(cell.biome) !== myBiome && cell.center_x != null)
            .map(cell => ({
                biome: String(cell.biome),
                dist: Math.pow(cell.center_x - myX, 2) + Math.pow(cell.center_y - myY, 2)
            }))
            .sort((a, b) => a.dist - b.dist);

        // De-duplicate biomes — take first unique appearance
        const seen = new Set();
        const neighborBiomes = [];
        for (const d of distances) {
            if (!seen.has(d.biome)) {
                seen.add(d.biome);
                neighborBiomes.push(d.biome);
            }
            if (neighborBiomes.length >= 3) break;
        }

        // Roll individual worker allocations (locked in after this)
        // Each "slot" represents a resource type and a random worker count within a range
        const bRes = BIOME_RESOURCES[myBiome] || { floraM: "grain", floraS: "root_veg", faunaM: "draftbeasts", faunaS: "wool" };
        const slots = [];

        const roll = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // 2 slots of floraM (workers: 10-20 each)
        for (let i = 0; i < 2; i++) slots.push({ res: bRes.floraM, workers: roll(10, 20) });
        // 1 slot of floraS (workers: 5-15)
        slots.push({ res: bRes.floraS, workers: roll(5, 15) });
        // 2 slots of faunaM (workers: 10-20 each)
        for (let i = 0; i < 2; i++) slots.push({ res: bRes.faunaM, workers: roll(10, 20) });
        // 1 slot of faunaS (workers: 5-15)
        slots.push({ res: bRes.faunaS, workers: roll(5, 15) });

        // If they have neighbor biomes, pick 1 random neighbor and add 1 slot of its floraM (workers: 4-10) and 1 slot of its faunaM (workers: 4-10).
        if (neighborBiomes.length > 0) {
            const randomNeighbor = neighborBiomes[Math.floor(Math.random() * neighborBiomes.length)];
            const nRes = BIOME_RESOURCES[randomNeighbor] || { floraM: "grain", floraS: "root_veg", faunaM: "draftbeasts", faunaS: "wool" };
            slots.push({ res: nRes.floraM, workers: roll(4, 10) });
            slots.push({ res: nRes.faunaM, workers: roll(4, 10) });
        }

        const profile = {
            myBiome,
            neighborBiomes,
            slots,            // Locked-in worker allocations per resource type
        };

        await c.query(
            "UPDATE sim_burg_economy SET resource_profile = $1 WHERE burg_id = $2",
            [JSON.stringify(profile), burg.burg_id]
        );
        updates++;

        if (updates % 50 === 0) console.log(`Baked ${updates}/${burgs.length}...`);
    }

    console.log(`Done. Baked ${updates} burg profiles.`);
    process.exit(0);
}

bake().catch(e => { console.error(e.message); process.exit(1); });
