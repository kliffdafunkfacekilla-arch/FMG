import pool from '../db/pool.js';
import { generateBurgSectorLayers } from '../engine/maps/SectorMapGenerator.js';
import zlib from 'zlib';

export async function ensureCellLayers(cellId: number = 13408) {
  const client = await pool.connect();
  try {
    const burgRes = await client.query(`
      SELECT b.*, f.name AS faction_name 
      FROM sim_burg_economy b 
      LEFT JOIN sim_cells c ON c.id = b.cell_id 
      LEFT JOIN sim_factions f ON f.id = c.faction_id 
      WHERE b.cell_id = $1 LIMIT 1
    `, [cellId]);
    
    if (burgRes.rowCount === 0) {
      throw new Error(`Burg for Cell ${cellId} not found!`);
    }
    const burg = burgRes.rows[0];

    const citRes = await client.query(`
      SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation, 
             workplace_type, workplace_name, childhood_background, allegiance_status 
      FROM population_demographics 
      WHERE home_cell_id = $1 AND life_stage = 'ADULT' 
      ORDER BY citizen_id ASC LIMIT 60
    `, [cellId]);

    const lairRes = await client.query(`
      SELECT l.*, o.name AS cartel_name, o.type AS cartel_type, o.contraband_types 
      FROM sim_fringe_lairs l 
      JOIN sim_outlaw_factions o ON o.id = l.faction_id 
      WHERE l.burg_id = $1 OR l.cell_id = $2
    `, [burg.burg_id, cellId]);

    const paragonRes = await client.query(`
      SELECT * FROM sim_paragons WHERE burg_id = $1
    `, [burg.burg_id]);

    const layers = generateBurgSectorLayers(
      burg, 
      burg.faction_name || 'Provincial Sovereignty', 
      cellId, 
      citRes.rows, 
      lairRes.rows, 
      paragonRes.rows
    );

    const z0 = zlib.gzipSync(layers.layer0.grid);
    const zM1 = zlib.gzipSync(layers.layerMinus1.grid);
    const zP1 = zlib.gzipSync(layers.layerPlus1.grid);

    await client.query(`
      INSERT INTO sim_sector_layers (cell_id, rx, ry, z_layer, layer_name, compressed_terrain, props, npcs, features)
      VALUES
      ($1, 50, 50, -1, $2, $3, $4, $5, $6),
      ($1, 50, 50, 0, $7, $8, $9, $10, $11),
      ($1, 50, 50, 1, $12, $13, $14, $15, $16)
      ON CONFLICT (cell_id, rx, ry, z_layer) DO UPDATE SET
        compressed_terrain = EXCLUDED.compressed_terrain,
        props = EXCLUDED.props,
        npcs = EXCLUDED.npcs,
        features = EXCLUDED.features
    `, [
      cellId,
      layers.layerMinus1.name, zM1, JSON.stringify(layers.layerMinus1.props), JSON.stringify(layers.layerMinus1.npcs), JSON.stringify(layers.layerMinus1.features),
      layers.layer0.name, z0, JSON.stringify(layers.layer0.props), JSON.stringify(layers.layer0.npcs), JSON.stringify(layers.layer0.features),
      layers.layerPlus1.name, zP1, JSON.stringify(layers.layerPlus1.props), JSON.stringify(layers.layerPlus1.npcs), JSON.stringify(layers.layerPlus1.features)
    ]);

    console.log(`[Regional LOD] Successfully initialized Cell #${cellId} (${burg.name}):`);
    console.log(`  - Layer -1: "${layers.layerMinus1.name}" (${layers.layerMinus1.npcs.length} NPCs, ${layers.layerMinus1.props.length} props)`);
    console.log(`  - Layer  0: "${layers.layer0.name}" (${layers.layer0.npcs.length} NPCs, ${layers.layer0.props.length} props)`);
    console.log(`  - Layer +1: "${layers.layerPlus1.name}" (${layers.layerPlus1.npcs.length} NPCs, ${layers.layerPlus1.props.length} props)`);
    return layers;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('seedCellLayers.ts')) {
  ensureCellLayers().then(() => pool.end()).catch(console.error);
}

