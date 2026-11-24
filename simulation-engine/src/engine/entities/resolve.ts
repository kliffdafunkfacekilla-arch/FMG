import type { Db } from "../deltas/types.js";
import { mapNpcIdToEntityRef, parseEntityRef } from "./refs.js";
import { ensureEntity, getEntityByRef, upsertEntity, type EntityRow } from "./registry.js";

/**
 * Resolves any actor ID or name through the unified entity registry first, then ensures on-demand
 * entities from authoritative tables. Returns null for unknown/invented entities (Rule 7).
 */
export async function resolveActorRef(db: Db, rawId: string): Promise<EntityRow | null> {
  const cleanId = String(rawId || "").trim();
  if (!cleanId) return null;

  // 1. Typed reference (e.g. paragon:5, citizen:123, agent:7, faction:29, squad:..., creature:..., npcinst:...)
  if (/^(paragon|citizen|agent|player|faction|burg):(\d+)$/.test(cleanId)) {
    return ensureEntity(db, cleanId);
  }
  if (/^(squad|creature|npcinst|object|place):/.test(cleanId)) {
    const found = await getEntityByRef(db, cleanId);
    if (found) return found;
    if (cleanId.startsWith("npcinst:")) return ensureEntity(db, cleanId);
    return null;
  }

  // 2. Micro map npc_* IDs
  if (cleanId.startsWith("npc_")) {
    const mapped = mapNpcIdToEntityRef(cleanId);
    const parsed = parseEntityRef(mapped);
    if (parsed.prefix === "paragon" || parsed.prefix === "citizen" || parsed.prefix === "agent") {
      return ensureEntity(db, mapped);
    }
    const byRef = await getEntityByRef(db, mapped);
    if (byRef) return byRef;
  }

  // 3. Direct registry hit by exact ref, source_id, or exact name
  const regRes = await db.query(
    `SELECT * FROM entities WHERE ref = $1 OR source_id = $1 OR name = $1 LIMIT 1`,
    [cleanId]
  );
  if (regRes.rows[0]) {
    return regRes.rows[0] as EntityRow;
  }

  // 4. Fallback lookup across source tables (on-demand promotion into entities)
  const srcRes = await db.query(
    `SELECT 'sim_agents' AS src, id::text AS sid, name, location_cell_id AS cell_id FROM sim_agents WHERE id::text = $1 OR name = $1
     UNION ALL
     SELECT 'sim_paragons', p.id::text, p.name, b.cell_id FROM sim_paragons p LEFT JOIN sim_burg_economy b ON b.burg_id = p.burg_id WHERE p.id::text = $1 OR p.name = $1
     UNION ALL
     SELECT 'population_demographics', citizen_id::text, name, home_cell_id FROM population_demographics WHERE citizen_id::text = $1 OR name = $1
     UNION ALL
     SELECT 'sim_factions', id::text, name, NULL::int FROM sim_factions WHERE id::text = $1 OR name = $1
     LIMIT 1`,
    [cleanId]
  );
  if (srcRes.rows[0]) {
    const row = srcRes.rows[0];
    const prefixMap: Record<string, string> = {
      sim_agents: "agent",
      sim_paragons: "paragon",
      population_demographics: "citizen",
      sim_factions: "faction",
    };
    const prefix = prefixMap[String(row.src)]!;
    return ensureEntity(db, `${prefix}:${row.sid}`);
  }

  // 5. Fallback scan of cached map NPCs inside sim_sector_layers
  const layerRes = await db.query(
    `SELECT cell_id, rx, ry, z_layer, elem
     FROM sim_sector_layers, jsonb_array_elements(COALESCE(npcs, '[]'::jsonb)) elem
     WHERE elem->>'id' = $1 OR elem->>'name' = $1 OR elem->>'entity_ref' = $1
     LIMIT 1`,
    [cleanId]
  );
  if (layerRes.rows[0]) {
    const row = layerRes.rows[0];
    const elem = row.elem;
    const ref = elem.entity_ref || mapNpcIdToEntityRef(String(elem.id || cleanId), {
      cellId: Number(row.cell_id),
      rx: Number(row.rx),
      ry: Number(row.ry),
    });
    await upsertEntity(db, {
      ref,
      kind: "person",
      name: String(elem.name || cleanId),
      alive: elem.alive !== false,
      lod: "micro",
      cellId: Number(row.cell_id),
      rx: Number(row.rx),
      ry: Number(row.ry),
      z: Number(row.z_layer),
      sourceTable: "sim_sector_layers",
      sourceId: String(elem.id || ref),
    });
    return getEntityByRef(db, ref);
  }

  return null;
}
