import type { Db } from "../../deltas/types.js";
import type {
  CultureFrontierCandidate,
  CultureMeta,
  CultureReligionSnapshot,
  HeresyCandidate,
  ReligionMeta,
  TempleCleanseCandidate,
} from "./step.js";

/**
 * Loads culture/religion metadata, temple protection centers, chaos zones, and GiST-indexed
 * frontier conversion, temple cleansing, and heresy diffusion candidates.
 */
export async function loadCultureReligion(
  client: Db,
  tick: number,
  loreDate: string
): Promise<CultureReligionSnapshot> {
  const startCellCursor = ((Math.max(1, tick) * 1973) % 42000) + 1;

  const metaRes = await client.query(`
    SELECT 'C' AS k, id, name, NULL::text AS type FROM sim_cultures
    UNION ALL
    SELECT 'R' AS k, id, name, type FROM sim_religions
    ORDER BY k ASC, id ASC
  `);
  const cultures: CultureMeta[] = [];
  const religions: ReligionMeta[] = [];
  const cultRelIdSet = new Set<number>();
  const cultIds: number[] = [];

  for (const r of metaRes.rows) {
    if (r.k === "C") {
      cultures.push({ id: Number(r.id), name: String(r.name) });
    } else {
      const id = Number(r.id);
      const name = String(r.name);
      const type = String(r.type || "");
      religions.push({ id, name, type });
      if (type === "Cult") {
        cultRelIdSet.add(id);
        cultIds.push(id);
      }
    }
  }

  const templeRes = await client.query(`
    SELECT b.burg_id, b.name AS burg_name, b.cell_id,
           COALESCE(c.religion_id, 0)::int AS religion_id,
           r.name AS religion_name, r.type AS religion_type,
           c.center_x::float8 AS cx, c.center_y::float8 AS cy
    FROM sim_burg_economy b
    JOIN sim_cells c ON c.id = b.cell_id
    LEFT JOIN sim_religions r ON r.id = c.religion_id
    WHERE b.temple = true AND (b.pop_null > 0 OR COALESCE(b.pop_attuned, 0) > 0)
    ORDER BY b.burg_id ASC
  `);

  const chaosRes = await client.query(`
    SELECT cell_id, MAX(intensity)::real AS intensity
    FROM sim_chaos_zones
    WHERE intensity >= 35
    GROUP BY cell_id
    ORDER BY cell_id ASC
  `);

  const chaosByCell = chaosRes.rows.map((r: any) => ({
    cellId: Number(r.cell_id),
    intensity: Number(r.intensity) || 0,
  }));

  const cultFrontierQuery = async (minId: number, maxIdExclusive: number, limit: number) =>
    client.query(
      `WITH cand AS MATERIALIZED (
         SELECT c.id AS cell_id,
                COALESCE(c.culture_id, 0)::int AS old_culture_id,
                f.culture_id::int AS target_culture_id,
                f.name AS faction_name,
                c.center_x::float8 AS cx,
                c.center_y::float8 AS cy
         FROM sim_cells c
         JOIN sim_factions f ON f.id = c.faction_id
         WHERE c.id >= $1 AND c.id < $2
           AND c.elevation >= 20
           AND COALESCE(f.culture_id, 0) > 0
           AND COALESCE(c.culture_id, 0) <> f.culture_id
         ORDER BY c.id ASC
         LIMIT 64
       )
       SELECT cand.cell_id, cand.old_culture_id, cand.target_culture_id, cand.faction_name,
              b.burg_id, b.name AS burg_name
       FROM cand
       CROSS JOIN LATERAL (
         SELECT n.id
         FROM sim_cells n
         WHERE n.id <> cand.cell_id
           AND n.elevation >= 20
           AND n.culture_id = cand.target_culture_id
           AND point(n.center_x, n.center_y) <@ box(
             point(cand.cx - 25.0, cand.cy - 25.0),
             point(cand.cx + 25.0, cand.cy + 25.0)
           )
         LIMIT 1
       ) nb
       LEFT JOIN sim_burg_economy b ON b.cell_id = cand.cell_id
       ORDER BY cand.cell_id ASC
       LIMIT $3`,
      [minId, maxIdExclusive, limit]
    );

  let cultRawRows = (await cultFrontierQuery(startCellCursor, 99999999, 16)).rows;
  if (cultRawRows.length < 16) {
    const wrapRows = (await cultFrontierQuery(1, startCellCursor, 16 - cultRawRows.length)).rows;
    cultRawRows = [...cultRawRows, ...wrapRows];
  }
  const cultFrontierRows: CultureFrontierCandidate[] = cultRawRows.map((row: any) => ({
    cellId: Number(row.cell_id),
    oldCultureId: Number(row.old_culture_id) || 0,
    targetCultureId: Number(row.target_culture_id) || 0,
    factionName: String(row.faction_name),
    burgId: row.burg_id ? Number(row.burg_id) : null,
    burgName: row.burg_name ? String(row.burg_name) : null,
  }));

  const relNameById = new Map(religions.map((r) => [r.id, r.name]));
  const templeProtectedCenters: Array<{ cx: number; cy: number }> = [];
  const orthoTemples: Array<{ burgId: number; burgName: string; religionId: number; religionName: string; cx: number; cy: number }> = [];
  for (const t of templeRes.rows) {
    const rid = Number(t.religion_id) || 0;
    const cx = Number(t.cx) || 0;
    const cy = Number(t.cy) || 0;
    templeProtectedCenters.push({ cx, cy });
    if (rid > 0 && !cultRelIdSet.has(rid)) {
      orthoTemples.push({
        burgId: Number(t.burg_id),
        burgName: String(t.burg_name || `Burg #${t.burg_id}`),
        religionId: rid,
        religionName: String(t.religion_name || relNameById.get(rid) || `Faith #${rid}`),
        cx,
        cy,
      });
    }
  }

  let cleanseRows: TempleCleanseCandidate[] = [];
  if (orthoTemples.length > 0 && cultIds.length > 0) {
    const cleanseRes = await client.query(
      `SELECT t.burg_id, t.burg_name, t.religion_id AS ortho_religion_id, t.religion_name AS ortho_religion_name,
              h.id AS target_cell_id, h.religion_id AS old_religion_id
       FROM unnest($1::int[], $2::text[], $3::int[], $4::text[], $5::float8[], $6::float8[])
         AS t(burg_id, burg_name, religion_id, religion_name, cx, cy)
       CROSS JOIN LATERAL (
         SELECT c.id, c.religion_id
         FROM sim_cells c
         WHERE c.elevation >= 20
           AND c.religion_id = ANY($7::int[])
           AND point(c.center_x, c.center_y) <@ box(
             point(t.cx - 35.0, t.cy - 35.0),
             point(t.cx + 35.0, t.cy + 35.0)
           )
           AND ((c.center_x - t.cx)^2 + (c.center_y - t.cy)^2) <= 1225.0
         ORDER BY c.id ASC
         LIMIT 1
       ) h
       ORDER BY t.burg_id ASC
       LIMIT 6`,
      [
        orthoTemples.map((t) => t.burgId),
        orthoTemples.map((t) => t.burgName),
        orthoTemples.map((t) => t.religionId),
        orthoTemples.map((t) => t.religionName),
        orthoTemples.map((t) => t.cx),
        orthoTemples.map((t) => t.cy),
        cultIds,
      ]
    );
    cleanseRows = cleanseRes.rows.map((row: any) => ({
      burgId: Number(row.burg_id),
      burgName: String(row.burg_name),
      orthoReligionId: Number(row.ortho_religion_id),
      orthoReligionName: String(row.ortho_religion_name),
      targetCellId: Number(row.target_cell_id),
      oldReligionId: Number(row.old_religion_id) || 0,
    }));
  }

  let heresyRows: HeresyCandidate[] = [];
  if (cultIds.length > 0) {
    const chaosIds = chaosByCell.map((c: { cellId: number; intensity: number }) => c.cellId);
    const heresyScanQuery = async (minId: number, maxIdExclusive: number, limit: number) =>
      client.query(
        `SELECT src.id AS src_id, COALESCE(src.religion_id, 0)::int AS src_religion_id,
                nb.id AS target_cell_id, COALESCE(nb.religion_id, 0)::int AS old_religion_id,
                nb.center_x::float8 AS tx, nb.center_y::float8 AS ty,
                b.burg_id, b.name AS burg_name
         FROM sim_cells src
         CROSS JOIN LATERAL (
           SELECT c.id, c.religion_id, c.center_x, c.center_y
           FROM sim_cells c
           WHERE c.id <> src.id
             AND c.elevation >= 20
             AND NOT (COALESCE(c.religion_id, 0) = ANY($3::int[]))
             AND point(c.center_x, c.center_y) <@ box(
               point(src.center_x::float8 - 25.0, src.center_y::float8 - 25.0),
               point(src.center_x::float8 + 25.0, src.center_y::float8 + 25.0)
             )
           ORDER BY ((c.center_x - src.center_x)^2 + (c.center_y - src.center_y)^2), c.id ASC
           LIMIT 1
         ) nb
         LEFT JOIN sim_burg_economy b ON b.cell_id = nb.id
         WHERE src.id >= $1 AND src.id < $2
           AND src.elevation >= 20
           AND (COALESCE(src.religion_id, 0) = ANY($3::int[]) OR src.id = ANY($4::int[]))
         ORDER BY src.id ASC
         LIMIT $5`,
        [minId, maxIdExclusive, cultIds, chaosIds, limit]
      );

    let heresyRawRows = (await heresyScanQuery(startCellCursor, 99999999, 16)).rows;
    if (heresyRawRows.length < 16) {
      const wrapRows = (await heresyScanQuery(1, startCellCursor, 16 - heresyRawRows.length)).rows;
      heresyRawRows = [...heresyRawRows, ...wrapRows];
    }
    heresyRows = heresyRawRows.map((row: any) => ({
      srcId: Number(row.src_id),
      srcReligionId: Number(row.src_religion_id) || 0,
      targetCellId: Number(row.target_cell_id),
      oldReligionId: Number(row.old_religion_id) || 0,
      tx: Number(row.tx) || 0,
      ty: Number(row.ty) || 0,
      burgId: row.burg_id ? Number(row.burg_id) : null,
      burgName: row.burg_name ? String(row.burg_name) : null,
    }));
  }

  return {
    tick,
    loreDate,
    cultures,
    religions,
    templeProtectedCenters,
    chaosByCell,
    cultFrontierRows,
    cleanseRows,
    heresyRows,
  };
}
