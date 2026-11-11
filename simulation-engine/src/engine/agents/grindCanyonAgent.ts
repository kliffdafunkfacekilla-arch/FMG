import { PoolClient } from "pg";
import { CANON_DRAGON_PRISONS } from "../canon/dragonPrisons.js";

// Dragonstone by Power. Dragon names and Powers come from the canon table (engine/canon/dragonPrisons.ts).
const DRAGONSTONE_BY_POWER: Record<string, string> = {
  Mass: "Gravitic Basalt Dragonstone",
  Nexus: "Astral Weave Dragonstone",
  Ordo: "Geometric Glass Dragonstone",
  Lex: "Adamantine Law Dragonstone",
  Motus: "Kinetic Gale Dragonstone",
  Flux: "Molten Pyre Dragonstone",
  Vita: "Verdant Marrow Dragonstone",
  Ratio: "Harmonic Prismatic Dragonstone",
  Lux: "Solar Flare Dragonstone",
  Omen: "Void Shadow Dragonstone",
  Aura: "Resonant Aether Dragonstone",
  Anumis: "Spirit Spark Dragonstone",
};

export const DRAGON_DOMAINS = CANON_DRAGON_PRISONS.map(p => {
  const stone = DRAGONSTONE_BY_POWER[p.power];
  if (!stone) throw new Error(`No dragonstone for Power ${p.power}`);
  return { name: p.dragon, domain: p.power, stone };
});

export async function runGrindCanyonAgent(client: PoolClient, tick: number, loreDate: string) {
  // 1. Process active open / collapsing Grind Canyons
  const activeRes = await client.query(`
    SELECT * FROM sim_grind_canyons
    WHERE status IN ('OPEN', 'COLLAPSING')
    ORDER BY id ASC
  `);

  for (const canyon of activeRes.rows) {
    let stability = Number(canyon.stability_ticks_remaining) - 1;
    let extractedStone = 0;
    let extractedGold = 0;

    if (canyon.status === "OPEN") {
      // Miners dive into the abyss and extract dragonstone
      extractedStone = Math.min(Number(canyon.dragonstone_richness), 12 + Math.floor(Math.random() * 8));
      extractedGold = extractedStone * 25; // Dragonstone is extremely valuable

      // Abyssal chasm diving incurs high operational costs: ropes, harnesses, breath-filters, and provisions
      const expeditionOverhead = Math.floor(extractedGold * 0.50);
      const netMiningProfit = extractedGold - expeditionOverhead;

      await client.query(`
        UPDATE sim_grind_canyons
        SET dragonstone_richness = GREATEST(0, dragonstone_richness - $1),
            stability_ticks_remaining = $2
        WHERE id = $3
      `, [extractedStone, stability, canyon.id]);

      // Re-inject expedition expenses into nearby local burgs for provisions and smith repairs
      await client.query(`
        UPDATE sim_burg_economy
        SET wealth = wealth + $1, raw_materials = raw_materials + 15
        WHERE cell_id = $2
      `, [expeditionOverhead, canyon.cell_id]);

      // Fund the Grind Canyon Corps (Outlaw Faction ID 9) with net profit
      await client.query(`
        UPDATE sim_outlaw_factions
        SET wealth = wealth + $1
        WHERE id = 9
      `, [netMiningProfit]);

      // Check if entering collapsing state
      if (stability === 1) {
        await client.query(`UPDATE sim_grind_canyons SET status = 'COLLAPSING' WHERE id = $1`, [canyon.id]);
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'GRIND_CANYON_COLLAPSING', $2, 'MAJOR', $3)
        `, [
          tick,
          `⚠️ GRIND CANYON COLLAPSE IMMINENT: Catastrophic tremors rock Cell ${canyon.cell_id}! The abyssal walls of ${canyon.name} are grinding shut! ${canyon.miner_crew_name} dive teams are frantically hauling up remaining dragonstone before the bedrock slams closed!`,
          loreDate
        ]);
      }
    } else if (canyon.status === "COLLAPSING") {
      // Final collapse: chasm grinds completely shut
      await client.query(`
        UPDATE sim_grind_canyons
        SET status = 'SEALED',
            stability_ticks_remaining = 0,
            closed_tick = $1
        WHERE id = $2
      `, [tick, canyon.id]);

      // Remove the temporary dive camp for this canyon from sim_fringe_lairs
      await client.query(`
        DELETE FROM sim_fringe_lairs
        WHERE faction_id = 9 AND cell_id = $1
      `, [canyon.cell_id]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, lore_date)
        VALUES ($1, 'GRIND_CANYON_SEALED', $2, 'MAJOR', $3)
      `, [
        tick,
        `💥 GRIND CANYON SEALED: ${canyon.name} at Cell ${canyon.cell_id} has ground shut with a deafening tectonic roar! The chasm, pre-Cruor ruins, and unmined dragonstone veins are crushed and sealed beneath solid bedrock.`,
        loreDate
      ]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, lore_date)
        VALUES ($1, 'GRIND_CORE_CARAVAN_DEPARTURE', $2, 'MAJOR', $3)
      `, [
        tick,
        `🐎 GRIND CORE CARAVAN DEPARTURE: With ${canyon.name} ground shut beneath solid stone at Cell ${canyon.cell_id}, the Grind Canyon Corps packed up their heavy winches, forge-wagons, and caravans to roam the wilderness until the next chasm tears open!`,
        loreDate
      ]);
    }
  }

  // 2. Spawn new Grind Canyons in wild / canyon / mountain terrain (Strictly max 3 active in world)
  const openCountRes = await client.query(`
    SELECT COUNT(*) FROM sim_grind_canyons WHERE status IN ('OPEN', 'COLLAPSING')
  `);
  const activeCount = Number(openCountRes.rows[0].count);

  if (activeCount < 3 && Math.random() < 0.25) {
    // Pick a wild cell without a major burg settlement
    const targetCellRes = await client.query(`
      SELECT c.id, c.biome, c.elevation
      FROM sim_cells c
      LEFT JOIN sim_burg_economy b ON b.cell_id = c.id
      WHERE b.burg_id IS NULL AND c.biome NOT IN ('Marine') AND c.elevation >= 40
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (targetCellRes.rows.length > 0) {
      const cell = targetCellRes.rows[0];
      const dragonPick = DRAGON_DOMAINS[Math.floor(Math.random() * DRAGON_DOMAINS.length)]!;
      const canyonName = `The Jagged Chasm of ${dragonPick.name} (${dragonPick.domain})`;
      const depth = 200 + Math.floor(Math.random() * 350);
      const richness = 100 + Math.floor(Math.random() * 150);
      const artifacts = 2 + Math.floor(Math.random() * 4);
      const duration = 6 + Math.floor(Math.random() * 6); // 6 to 11 days
      const crewNum = Math.floor(Math.random() * 20) + 1;
      const crewName = `Grind Canyon Corps - Sledge Dive Crew #${crewNum}`;

      const inserted = await client.query(`
        INSERT INTO sim_grind_canyons (
          name, cell_id, sector_x, sector_y, dragon_name, dragon_domain,
          depth_meters, dragonstone_richness, artifacts_remaining,
          stability_ticks_remaining, total_duration_ticks, status,
          miner_crew_name, active_miners, opened_tick
        ) VALUES (
          $1, $2, 112, 112, $3, $4,
          $5, $6, $7,
          $8, $9, 'OPEN',
          $10, 14, $11
        ) RETURNING id
      `, [
        canyonName, cell.id, dragonPick.name, dragonPick.domain,
        depth, richness, artifacts,
        duration, duration,
        crewName, tick
      ]);

      // Find nearest burg to this canyon dive site
      const nearestBurgRes = await client.query(`
        SELECT burg_id, name, cell_id FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1
      `, [cell.id]);
      const nearestBurg = nearestBurgRes.rows[0];

      // Anchor temporary dive camp in sim_fringe_lairs for the duration of the dig
      await client.query(`
        INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
        VALUES (9, $1, $2, 'CHASM_DIVE_CAMP', 35, 20)
      `, [cell.id, nearestBurg ? nearestBurg.burg_id : null]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, lore_date)
        VALUES ($1, 'GRIND_CANYON_OPENED', $2, 'CRITICAL', $3)
      `, [
        tick,
        `⚡ GRIND CANYON OPENED: A colossal tectonic fissure has torn open at Cell ${cell.id}! ${canyonName} plunges ${depth}m into the earth, exposing pre-Cruor ruins and veins of ${dragonPick.stone}. ${crewName} has anchored heavy descent winches to strip treasure before the chasm grinds shut!`,
        loreDate
      ]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, lore_date)
        VALUES ($1, 'GRIND_CORE_CARAVAN_ARRIVED', $2, 'CRITICAL', $3)
      `, [
        tick,
        `⛺ CHASM CARAVAN ARRIVAL: The nomadic wagon-trains of the Grind Canyon Corps have arrived at Cell ${cell.id}! Setting up heavy descent winches and mobile forge-tents above ${canyonName}, the self-populating caravan community has established camp to strip dragonstone before the bedrock slams shut! Nearby ${nearestBurg?.name || 'settlements'} brace for the influx of wild crews.`,
        loreDate
      ]);
    }
  }
}
