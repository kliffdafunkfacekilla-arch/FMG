import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

errors = []

# --- 1. Infrastructure Fetch: Need to track levels instead of a Set ---
target_infra = """    const infraRes = await client.query(`
        SELECT i.burg_id, i.type, c.center_x, c.center_y
        FROM sim_infrastructure i
        JOIN sim_burg_economy b ON i.burg_id = b.burg_id
        JOIN sim_cells c ON b.cell_id = c.id
    `);
    const burgInfra = new Map<number, Set<string>>();
    const forts: any[] = [];
    for (const row of infraRes.rows) {
      if (!burgInfra.has(row.burg_id)) burgInfra.set(row.burg_id, new Set());
      burgInfra.get(row.burg_id)!.add(row.type);
      if (row.type === "FORT") forts.push(row); // row now has center_x, center_y
    }"""

replacement_infra = """    // QE: Fetch infrastructure with levels
    const infraRes = await client.query(`
        SELECT i.burg_id, i.type, i.level, c.center_x, c.center_y
        FROM sim_infrastructure i
        JOIN sim_burg_economy b ON i.burg_id = b.burg_id
        JOIN sim_cells c ON b.cell_id = c.id
    `);
    const burgInfra = new Map<number, Map<string, number>>();
    const forts: any[] = [];
    for (const row of infraRes.rows) {
      if (!burgInfra.has(row.burg_id)) burgInfra.set(row.burg_id, new Map());
      const l = parseInt(row.level) || 1;
      burgInfra.get(row.burg_id)!.set(row.type, l);
      if (row.type === "FORT") forts.push(row);
    }"""

if target_infra in c:
    c = c.replace(target_infra, replacement_infra)
else:
    errors.append("Infra fetch not found")


# --- 2. Biome Resources map replacement ---
target_biome_res = """const BIOME_RESOURCES: Record<string, { main: string, sec: string }> = {"""

replacement_biome_res = """// QE: Infra mapping constants
const INFRA_MAP: Record<string, string> = {
    'grain':'FARM', 'fruit':'FARM', 'root_veg':'FARM', 'veg':'FARM', 'fibre':'FARM', 'herbs':'FARM', 'medicine':'FARM',
    'wood':'CAMP', 'pitch':'CAMP', 'meat':'CAMP', 'ivory':'CAMP', 'leather':'CAMP', 'wool':'CAMP', 'fur':'CAMP', 'lard':'CAMP', 'adhesive':'CAMP', 'reagents':'CAMP', 'pets':'CAMP', 'mounts':'CAMP', 'draftbeasts':'CAMP', 'companion_beasts':'CAMP', 'codependent_beasts':'CAMP', 'errand_beasts':'CAMP', 'poison':'CAMP',
    'stone':'QUARRY', 'clay':'QUARRY',
    'ore':'MINE', 'gems':'MINE', 'crystals':'MINE', 'dragon_stone_shard':'MINE'
};

const BIOME_RESOURCES: Record<string, { main: string, sec: string }> = {"""

if target_biome_res in c:
    c = c.replace(target_biome_res, replacement_biome_res)
else:
    errors.append("Biome resources not found")

# --- 3. Set up cellEcoDeltas array ---
target_cell_updates = """    const cellsRes = await client.query('SELECT * FROM sim_cells');
    const cellUpdates: any[] = [];"""

replacement_cell_updates = """    const cellsRes = await client.query('SELECT * FROM sim_cells');
    const cellUpdates: any[] = [];
    const cellEcoDeltas = new Map<number, number>(); // QE: Track ecology damage per cell"""

if target_cell_updates in c:
    c = c.replace(target_cell_updates, replacement_cell_updates)
else:
    errors.append("Cell updates array not found")


# --- 4. Types declaration updates ---
target_types_declare = """            const bId = burg.burg_id;
            const types = burgInfra.get(bId) || new Set();"""

replacement_types_declare = """            const bId = burg.burg_id;
            const bInfraLevelsTop = burgInfra.get(bId) || new Map<string, number>();
            const types = new Set(Array.from(bInfraLevelsTop.keys()));"""

if target_types_declare in c:
    c = c.replace(target_types_declare, replacement_types_declare)
else:
    errors.append("Types declaration not found")

target_types_declare2 = """        for (const burg of myBurgs) {
            const types = burgInfra.get(burg.burg_id) || new Set();"""

replacement_types_declare2 = """        for (const burg of myBurgs) {
            const bInfraLevelsTop2 = burgInfra.get(burg.burg_id) || new Map<string, number>();
            const types = new Set(Array.from(bInfraLevelsTop2.keys()));"""

if target_types_declare2 in c:
    c = c.replace(target_types_declare2, replacement_types_declare2)
else:
    errors.append("Types declaration 2 not found")


# --- 5. Building Loop Replace ---
# We need to replace from `// Construction / Trade (former Phase 4 logic)` down to `await client.query(\`INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, 'CAMP')\`, [bId]); }`
pattern_build = re.compile(r"// Construction / Trade \(former Phase 4 logic\).*?await client\.query\(`INSERT INTO sim_infrastructure \(burg_id, type\) VALUES \(\$1, 'CAMP'\)`, \[bId\]\);\s*\}", re.DOTALL)

replacement_build = """            // Construction / Trade
            // QE: Automated infrastructure upgrading to stop ecology bleeding
            let infraBuildQueue: Array<{type: string, cost: number}> = [];
            for (const [infra, deficit] of requiredInfraBuilds.entries()) {
                const neededLevels = Math.ceil(deficit / 10);
                for (let i = 0; i < Math.min(3, neededLevels); i++) infraBuildQueue.push({type: infra, cost: 20}); // Max 3 per tick to throttle
            }
            
            for (const build of infraBuildQueue) {
                if (currentWealth >= build.cost && stockpile.refined_lumber >= build.cost) {
                    currentWealth -= build.cost;
                    stockpile.refined_lumber -= build.cost;
                    
                    const curLevel = bInfraLevels.get(build.type) || 0;
                    if (curLevel === 0) {
                        await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, $2, 1)`, [bId, build.type]);
                        bInfraLevels.set(build.type, 1);
                        types.add(build.type);
                    } else {
                        await client.query(`UPDATE sim_infrastructure SET level = level + 1 WHERE burg_id = $1 AND type = $2`, [bId, build.type]);
                        bInfraLevels.set(build.type, curLevel + 1);
                    }
                    
                    // Reduce max eco by 1 per level built
                    await client.query(`UPDATE sim_cells SET eco_max = GREATEST(10, eco_max - 1) WHERE id = $1`, [burg.cell_id]);
                }
            }
            
            // Legacy advanced buildings
            const hospitalReqs = { stone: 50, wood: 20, medicine: 30, textile: 10, organs: 5 };
            const fortReqs = { stone: 100, iron: 50, wood: 20, pitch: 10 };
            const templeReqs = { stone: 50, gold: 10, silver: 10, crystals: 5, aromatics: 20 };

            if (!types.has('HOSPITAL') && currentWealth >= 50 && hasItems(hospitalReqs)) {
                currentWealth -= 50; deductItems(hospitalReqs); types.add('HOSPITAL');
                await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, 'HOSPITAL', 1)`, [bId]);
            }
            if (!types.has('FORT') && currentWealth >= 50 && hasItems(fortReqs)) {
                currentWealth -= 50; deductItems(fortReqs); types.add('FORT');
                await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, 'FORT', 1)`, [bId]);
            }
            if (!types.has('TEMPLE') && currentWealth >= 100 && hasItems(templeReqs)) {
                currentWealth -= 100; deductItems(templeReqs); types.add('TEMPLE');
                await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, 'TEMPLE', 1)`, [bId]);
            }"""

if pattern_build.search(c):
    c = pattern_build.sub(replacement_build, c, 1)
else:
    errors.append("Building loop pattern not found")


# --- 6. Cell Ecology Update Loop ---
target_cell_update = """    // L-1: Supply/Demand Price Index Update (every 5 ticks for performance)"""

replacement_cell_update = """    // QE: Cell Ecology Updates
    if (cellEcoDeltas.size > 0) {
        for (const [cellId, damage] of cellEcoDeltas.entries()) {
            const dmg = Math.floor(damage / 10); // scale it so 10 uncovered workers = 1 eco damage point
            await client.query(`
                UPDATE sim_cells 
                SET eco_health = LEAST(eco_max, GREATEST(0, COALESCE(eco_health, 100) + 1 - $1))
                WHERE id = $2
            `, [dmg, cellId]);
            
            // Check for threshold collapse
            const cellState = await client.query(`SELECT eco_health FROM sim_cells WHERE id = $1`, [cellId]);
            if (cellState.rows.length > 0 && cellState.rows[0].eco_health < 30) {
                // Ecological Collapse! Find burgs in this cell and ruin them
                await client.query(`
                    UPDATE sim_burg_economy 
                    SET food = GREATEST(0, food - 50), unrest = LEAST(100, unrest + 20)
                    WHERE cell_id = $1
                `, [cellId]);
            }
        }
    }

    // L-1: Supply/Demand Price Index Update (every 5 ticks for performance)"""

if target_cell_update in c:
    c = c.replace(target_cell_update, replacement_cell_update)
else:
    errors.append("Cell update injection not found")


with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)

if errors:
    print("ERRORS:")
    for e in errors:
        print(f"  - {e}")
else:
    print("Patch applied successfully.")
