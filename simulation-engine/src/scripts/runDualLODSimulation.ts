import pool from "../db/pool.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { ensureCellLayers } from "./seedCellLayers.js";
import zlib from "zlib";

const TARGET_CELL_ID = 13408; // Burg #73: Flute (Premier Coastal River Metropolis)
const TOTAL_TICKS = 44; // 1 Full Dragon Month (Tiraton: Mass)

function renderAsciiGrid(grid: Uint8Array, width: number = 256, height: number = 256, outW: number = 40, outH: number = 18): string {
  const blockW = Math.floor(width / outW);
  const blockH = Math.floor(height / outH);
  const lines: string[] = [];

  for (let by = 0; by < outH; by++) {
    let line = "";
    for (let bx = 0; bx < outW; bx++) {
      let wallCount = 0;
      let roadCount = 0;
      let waterCount = 0;
      let buildCount = 0;
      let treeCount = 0;

      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const px = bx * blockW + dx;
          const py = by * blockH + dy;
          const tile = grid[py * width + px];
          if (tile === 5) wallCount++;
          else if (tile === 4) roadCount++;
          else if (tile === 1 || tile === 8) waterCount++;
          else if (tile === 6 || tile === 7) buildCount++;
          else if (tile === 2) treeCount++;
        }
      }

      if (wallCount > 4) line += "█"; // Stone Fortified Ramparts
      else if (waterCount > 10) line += "~"; // River / Harbor Basin
      else if (roadCount > 8) line += "═"; // Cobblestone Thoroughfare
      else if (buildCount > 8) line += "⌂"; // Residential / Guild Hall
      else if (treeCount > 6) line += "♣"; // Orchard / Timberline
      else line += "·"; // Open Ground / Pavement
    }
    lines.push(line);
  }
  return lines.join("\n");
}

async function main() {
  console.log(`================================================================================`);
  console.log(`  DUAL-LOD CO-SIMULATION: MACRO REALM + REGIONAL CELL #${TARGET_CELL_ID} (FLUTE)`);
  console.log(`================================================================================`);

  // Ensure regional 256x256 layers exist
  await ensureCellLayers(TARGET_CELL_ID);

  const client = await pool.connect();
  try {
    // Fetch initial layer 0 (Surface) terrain for schematic rendering
    const layer0Res = await client.query(
      "SELECT compressed_terrain, layer_name FROM sim_sector_layers WHERE cell_id = $1 AND z_layer = 0 LIMIT 1",
      [TARGET_CELL_ID]
    );
    const unzipped = zlib.gunzipSync(layer0Res.rows[0].compressed_terrain);
    const terrainGrid0 = new Uint8Array(unzipped.buffer, unzipped.byteOffset, unzipped.byteLength);

    console.log(`\n--- TACTICAL 256x256 SCHEMATIC: CELL #${TARGET_CELL_ID} (FLUTE - SURFACE LAYER 0) ---`);
    console.log(renderAsciiGrid(terrainGrid0, 256, 256, 42, 14));
    console.log(`Legend: █ Wall/Bastion | ~ River/Docks | ═ Thoroughfare | ⌂ Guild/Bldg | ♣ Timber | · Ground\n`);

    console.log(`Advancing ${TOTAL_TICKS} Ticks (1 Full Dragon Month)...`);

    for (let t = 1; t <= TOTAL_TICKS; t++) {
      const tickStartMs = Date.now();
      await executeMasterTick();
      const tickDurationMs = Date.now() - tickStartMs;

      // Report telemetry at key milestones (Days 1, 11, 22, 33, 44)
      if (t === 1 || t % 11 === 0 || t === TOTAL_TICKS) {
        // 1. MACRO CONTINENTAL STATE
        const calRes = await client.query("SELECT tick, month_name, day_of_month, season, moon_phase FROM sim_calendar LIMIT 1");
        const cal = calRes.rows[0];

        const macroEcon = await client.query(`
          SELECT SUM(pop_null) as total_pop, SUM(wealth) as total_wealth, SUM(food) as total_food,
                 ROUND(AVG(unrest)::numeric, 1) as avg_unrest, ROUND(AVG(crime_rate)::numeric, 1) as avg_crime
          FROM sim_burg_economy
        `);
        const m = macroEcon.rows[0];

        const sealRes = await client.query("SELECT MIN(seal_strength) as min_s, ROUND(AVG(seal_strength)::numeric, 1) as avg_s FROM sim_sacred_groves");
        const s = sealRes.rows[0];

        // 2. REGIONAL FOCUSED CELL STATE (CELL 13408 - FLUTE)
        const burgRes = await client.query(`
          SELECT burg_id, name, pop_null, wealth, food, unrest, crime_rate, military_forces
          FROM sim_burg_economy
          WHERE cell_id = $1
        `, [TARGET_CELL_ID]);
        const b = burgRes.rows[0];

        // Regional Sector Layers (z = -1, 0, 1)
        const layersRes = await client.query(`
          SELECT z_layer, layer_name, jsonb_array_length(npcs) as npc_count, jsonb_array_length(props) as prop_count, features
          FROM sim_sector_layers
          WHERE cell_id = $1
          ORDER BY z_layer DESC
        `, [TARGET_CELL_ID]);

        // Regional Events in Flute
        const recentBurgEvents = await client.query(`
          SELECT type, message
          FROM sim_events
          WHERE burg_id = $1 AND tick >= $2
          ORDER BY id DESC LIMIT 3
        `, [b.burg_id, Math.max(1, cal.tick - 10)]);

        console.log(`\n╔═══════════════════════════════════════════════════════════════════════════════╗`);
        console.log(`║ TICK ${String(cal.tick).padEnd(4)} | Day ${String(cal.day_of_month).padEnd(2)} of Month ${cal.month_name} (${cal.season}) | ${cal.moon_phase.padEnd(20)} [${tickDurationMs}ms] ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);
        console.log(`║ [MACRO REALM LOD]                                                             ║`);
        console.log(`║ Continental Pop: ${Number(m.total_pop).toLocaleString()} | Wealth: ${Number(m.total_wealth).toLocaleString()}g | Food: ${Number(m.total_food).toLocaleString()} | Unrest: ${m.avg_unrest}% | Seals: ${s.avg_s}%  ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);
        console.log(`║ [REGIONAL LOD - CELL #${TARGET_CELL_ID}: ${b.name.toUpperCase()} (BURG #${b.burg_id})]`.padEnd(80) + `║`);
        console.log(`║ Population: ${Number(b.pop_null).toLocaleString()} cohorts (${Number(b.pop_null) * 12} souls) | Wealth: ${Number(b.wealth).toLocaleString()}g | Food: ${Number(b.food).toLocaleString()}           ║`);
        console.log(`║ Unrest: ${b.unrest}% | Crime: ${b.crime_rate}% | Garrison: ${b.military_forces ? 'Standing Watch' : 'None'}`.padEnd(80) + `║`);
        console.log(`║                                                                               ║`);
        console.log(`║ Vertical Layer Architecture (Zelda-Style Regional Stack):                    ║`);
        for (const l of layersRes.rows) {
          const zLabel = l.z_layer === 1 ? "[Layer +1: Upper]" : l.z_layer === 0 ? "[Layer  0: Surface]" : "[Layer -1: Subterranean]";
          console.log(`║   ${zLabel} ${l.layer_name.padEnd(42)} (${l.npc_count} NPCs, ${l.prop_count} Props) ║`);
        }
        
        const tags = layersRes.rows.find((l: any) => l.z_layer === 0)?.features?.environmental_tags || [];
        console.log(`║ Active Sector Tags: ${tags.length > 0 ? tags.join(", ") : "Normal Civil Routine"}`.padEnd(80) + `║`);

        if (recentBurgEvents.rows.length > 0) {
          console.log(`║ Recent Regional Incidents:                                                    ║`);
          for (const ev of recentBurgEvents.rows) {
            const truncatedMsg = ev.message.length > 70 ? ev.message.substring(0, 67) + "..." : ev.message;
            console.log(`║   • [${ev.type}] ${truncatedMsg}`.padEnd(80) + `║`);
          }
        }
        console.log(`╚═══════════════════════════════════════════════════════════════════════════════╝`);
      }
    }

    console.log(`\n================================================================================`);
    console.log(`  DUAL-LOD CO-SIMULATION COMPLETED SUCCESSFULLY!`);
    console.log(`================================================================================\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

