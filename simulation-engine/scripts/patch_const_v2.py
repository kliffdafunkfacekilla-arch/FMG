import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Fetching Projects
fetch_pattern = re.compile(r"""(const infraRes = await client\.query.*?for \(const row of infraRes\.rows\) \{.*?\}\n)""", re.DOTALL)
fetch_replacement = r"""\1
    // Fetch active construction projects
    const projectsRes = await client.query('SELECT * FROM sim_active_projects');
    const burgProjects = new Map<number, any[]>();
    for (const row of projectsRes.rows) {
        if (!burgProjects.has(row.burg_id)) burgProjects.set(row.burg_id, []);
        burgProjects.get(row.burg_id)!.push(row);
    }
"""
if fetch_pattern.search(c):
    c = fetch_pattern.sub(fetch_replacement, c, 1)

# 2. Replacing Urbanization Upgrades
c = c.replace(
    "burg.urban_tier = 2; burg.architecture_type = b1.toUpperCase();",
    "burg.architecture_type = b1.toUpperCase(); await client.query(`INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining) VALUES ($1, 'URBAN_TIER', 2, 20)`, [bId]);"
)
c = c.replace(
    "burg.urban_tier = 3; burg.architecture_type = b2 === 'refined_lumber' ? 'WOOD' : b2 === 'cut_stone' ? 'STONE' : 'CLAY';",
    "burg.architecture_type = b2 === 'refined_lumber' ? 'WOOD' : b2 === 'cut_stone' ? 'STONE' : 'CLAY'; await client.query(`INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining) VALUES ($1, 'URBAN_TIER', 3, 20)`, [bId]);"
)
c = c.replace(
    "burg.urban_tier = 4;",
    "await client.query(`INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining) VALUES ($1, 'URBAN_TIER', 4, 20)`, [bId]);"
)

# 3. Replacing infraBuildQueue logic
target_build = """                    const curLevel = bInfraLevels.get(build.type) || 0;
                    if (curLevel === 0) {
                        await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, $2, 1)`, [bId, build.type]);
                        bInfraLevels.set(build.type, 1);
                        types.add(build.type);
                    } else {
                        await client.query(`UPDATE sim_infrastructure SET level = level + 1 WHERE burg_id = $1 AND type = $2`, [bId, build.type]);
                        bInfraLevels.set(build.type, curLevel + 1);
                    }
                    
                    // Reduce max eco by 1 per level built
                    await client.query(`UPDATE sim_cells SET eco_max = GREATEST(10, eco_max - 1) WHERE id = $1`, [burg.cell_id]);"""

replacement_build = """                    const ticksReq = ['FARM', 'CAMP', 'MINE', 'QUARRY'].includes(build.type) ? 2 : 8;
                    await client.query(`INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining) VALUES ($1, $2, 0, $3)`, [bId, build.type, ticksReq]);"""

c = c.replace(target_build, replacement_build)

# 4. Process Active Projects
maint_pattern = re.compile(r"""(const maintWorkers = Math\.min\(urbanWorkers, requiredMaint\);\s*urbanWorkers -= maintWorkers;)""")

maint_replacement = r"""\1

            // --- PROCESS CONSTRUCTION QUEUE ---
            const activeProjects = burgProjects.get(bId) || [];
            const isAtWar = Array.from(diploMap.values()).some(d => (d.faction_a_id === burg.faction_id || d.faction_b_id === burg.faction_id) && d.status === 'WAR');
            const canBuild = burg.unrest <= 30 && !isAtWar && maintWorkers >= requiredMaint;

            for (const proj of activeProjects) {
                if (canBuild) {
                    proj.ticks_remaining--;
                    if (proj.ticks_remaining <= 0) {
                        if (proj.project_type === 'URBAN_TIER') {
                            burg.urban_tier = proj.target_tier;
                            await client.query(`UPDATE sim_burg_economy SET urban_tier = $1 WHERE burg_id = $2`, [proj.target_tier, bId]);
                        } else {
                            const curLvl = bInfraLevels.get(proj.project_type) || 0;
                            if (curLvl === 0) {
                                await client.query(`INSERT INTO sim_infrastructure (burg_id, type, level) VALUES ($1, $2, 1)`, [bId, proj.project_type]);
                                types.add(proj.project_type);
                            } else {
                                await client.query(`UPDATE sim_infrastructure SET level = level + 1 WHERE burg_id = $1 AND type = $2`, [bId, proj.project_type]);
                            }
                            bInfraLevels.set(proj.project_type, curLvl + 1);
                            await client.query(`UPDATE sim_cells SET eco_max = GREATEST(10, eco_max - 1) WHERE id = $1`, [burg.cell_id]);
                        }
                        await client.query(`DELETE FROM sim_active_projects WHERE id = $1`, [proj.id]);
                    } else {
                        await client.query(`UPDATE sim_active_projects SET ticks_remaining = $1 WHERE id = $2`, [proj.ticks_remaining, proj.id]);
                    }
                }
            }
"""

if maint_pattern.search(c):
    c = maint_pattern.sub(maint_replacement, c, 1)

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Patch applied.")
