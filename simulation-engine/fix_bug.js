const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

const oldStr = `              FROM (
                SELECT unnest($1::int[]) as id,
                       unnest($2::int[]) as food,
                       unnest($3::int[]) as wealth,
                       unnest($4::int[]) as health,
                       unnest($5::int[]) as unrest,
                       unnest($6::int[]) as crime,
                       unnest($7::int[]) as urban_tier
              ) AS v
              WHERE b.burg_id = v.id
          \`, [
              burgUpdates.map(u => u.id),
              burgUpdates.map(u => u.food),
              burgUpdates.map(u => u.wealth),
              burgUpdates.map(u => u.health),
              burgUpdates.map(u => u.unrest),
              burgUpdates.map(u => u.crime),
              burgUpdates.map(u => u.urban_tier)
          ]);`;

const newStr = `              FROM (
                SELECT unnest($1::int[]) as id,
                       unnest($2::int[]) as food,
                       unnest($3::int[]) as wealth,
                       unnest($4::int[]) as health,
                       unnest($5::int[]) as unrest,
                       unnest($6::int[]) as crime,
                       unnest($7::int[]) as urban_tier,
                       unnest($8::int[]) as pop_null,
                       unnest($9::text[]) as military_forces
              ) AS v
              WHERE b.burg_id = v.id
          \`, [
              burgUpdates.map(u => u.id),
              burgUpdates.map(u => u.food),
              burgUpdates.map(u => u.wealth),
              burgUpdates.map(u => u.health),
              burgUpdates.map(u => u.unrest),
              burgUpdates.map(u => u.crime),
              burgUpdates.map(u => u.urban_tier),
              burgUpdates.map(u => u.pop_null || 0),
              burgUpdates.map(u => JSON.stringify(u.military_forces || {}))
          ]);`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', content);
