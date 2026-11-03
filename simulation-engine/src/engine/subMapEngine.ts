import pool from "../db/pool";
import zlib from "zlib";
import { generateInteriorSubMap, generatePOISubMap, detectInteriorType, InteriorMapResult, InteriorType, PointOfEntryConfig } from "./maps/InteriorMapGenerator";

export interface SubMapParameters {
  localId?: number;
  cellId?: number;
  rx?: number;
  ry?: number;
  propId?: string;
  propName?: string;
  propTags?: string[];
  mapType?: string;
  width?: number;
  height?: number;
  parameters?: PointOfEntryConfig["parameters"];
}

/**
 * Loads an existing interior sub-map or generates and persists a new 256x256 interior battlegrid.
 */
export async function getOrGenerateInteriorSubMap(
  parentCellId: number,
  parentRx: number,
  parentRy: number,
  parentPropId: string,
  parentPropName: string = "Sub-Surface Chamber",
  parentPropTags: string[] = [],
  forcedType?: InteriorType,
  parameters?: PointOfEntryConfig["parameters"]
): Promise<InteriorMapResult> {
  try {
    // 1. Check if sub-map already exists for this parent cell & prop
    const existingRes = await pool.query(
      `SELECT sub_map_id, parent_cell_id, parent_rx, parent_ry, parent_prop_id,
              interior_type, name, grid_data, props, npcs
       FROM interior_sub_maps
       WHERE parent_cell_id = $1 AND parent_prop_id = $2
       LIMIT 1`,
      [parentCellId, parentPropId]
    );

    if (existingRes.rows.length > 0) {
      const row = existingRes.rows[0];
      let gridBuffer: Buffer;

      if (row.grid_data) {
        // Inflate compressed terrain
        gridBuffer = zlib.inflateSync(row.grid_data);
      } else {
        // Fallback: regenerate if grid_data was empty
        const fresh = generatePOISubMap({
          parentCellId,
          parentRx,
          parentRy,
          entryPropId: parentPropId,
          entryPropName: parentPropName,
          entryPropTags: parentPropTags,
          subMapType: forcedType,
          parameters
        });
        await pool.query(
          `UPDATE interior_sub_maps
           SET grid_data = $1, props = $2, npcs = $3, interior_type = $4, name = $5
           WHERE sub_map_id = $6`,
          [fresh.compressed, JSON.stringify(fresh.props), JSON.stringify(fresh.npcs), fresh.interiorType, fresh.name, row.sub_map_id]
        );
        fresh.subMapId = row.sub_map_id;
        return fresh;
      }

      const grid = new Uint8Array(gridBuffer.buffer, gridBuffer.byteOffset, gridBuffer.byteLength);

      return {
        subMapId: row.sub_map_id,
        parentCellId: row.parent_cell_id,
        parentRx: row.parent_rx ?? 112,
        parentRy: row.parent_ry ?? 112,
        parentPropId: row.parent_prop_id,
        name: row.name || "Subterranean Interior",
        interiorType: (row.interior_type as InteriorType) || "CELLAR",
        grid,
        compressed: row.grid_data,
        props: Array.isArray(row.props) ? row.props : [],
        npcs: Array.isArray(row.npcs) ? row.npcs : [],
        playerSpawn: [128, 226],
        exitProp: {
          id: "prop_interior_exit",
          name: "Ascending Stairs to Surface",
          pos: [128, 228],
          tags: ["door", "exit", "stairs_up", "surface"]
        }
      };
    }

    // 2. Generate authentic procedural interior sub-map or POI
    const interior = generatePOISubMap({
      parentCellId,
      parentRx,
      parentRy,
      entryPropId: parentPropId,
      entryPropName: parentPropName,
      entryPropTags: parentPropTags,
      subMapType: forcedType,
      parameters
    });

    // 3. Persist to Postgres database
    const insertRes = await pool.query(
      `INSERT INTO interior_sub_maps (
         parent_cell_id, parent_rx, parent_ry, parent_prop_id,
         interior_type, name, grid_width, grid_height,
         grid_data, props, npcs, layout_data, map_type
       ) VALUES ($1, $2, $3, $4, $5, $6, 256, 256, $7, $8, $9, '{}'::jsonb, $10)
       RETURNING sub_map_id;`,
      [
        parentCellId,
        parentRx,
        parentRy,
        parentPropId,
        interior.interiorType,
        interior.name,
        interior.compressed,
        JSON.stringify(interior.props),
        JSON.stringify(interior.npcs),
        interior.interiorType
      ]
    );

    interior.subMapId = insertRes.rows[0].sub_map_id;
    return interior;
  } catch (error) {
    console.error("Error in getOrGenerateInteriorSubMap:", error);
    throw error;
  }
}

/**
 * Legacy compatibility wrapper for sub-map generation
 */
export async function generateSubMapInterior(params: SubMapParameters): Promise<number> {
  const cellId = params.cellId || params.localId || 13408;
  const propId = params.propId || `prop_legacy_${Date.now()}`;
  const interior = await getOrGenerateInteriorSubMap(
    cellId,
    params.rx ?? 112,
    params.ry ?? 112,
    propId,
    params.propName || "Sub-Map Chamber",
    params.propTags || ["door", "interior"],
    params.mapType as InteriorType
  );
  return interior.subMapId!;
}
