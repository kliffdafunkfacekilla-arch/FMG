/**
 * cultureReligionAgent.ts (Phase B6.5)
 * Autonomous cell-to-cell cultural assimilation, Cult/chaos heresy spread,
 * and `temple = true` burg orthodoxy pushback over `sim_cells`, `sim_cultures`,
 * and `sim_religions`. Zero UI/observer imports (Rule 8).
 */

type Db = { query: (text: string, params?: any[]) => Promise<any> };

export interface CultureReligionResult {
  cultureConversions: number;
  heresyConversions: number;
  templeReconversions: number;
}

/** Deterministic per-(cell, tick) [0, 1) hash so diffusion never perturbs downstream Math.random() streams. */
function seededFraction(cellId: number, tick: number, salt: number): number {
  let h = (Math.imul(cellId ^ salt, 2654435761) ^ Math.imul(tick + 17, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Counts total queries cleanly within <= 12 queries per tick using GiST index `idx_sim_cells_pt`. */
export async function runCultureReligionAgent(
  client: Db,
  tick: number,
  loreDate: string
): Promise<CultureReligionResult> {
  let cultureConversions = 0;
  let heresyConversions = 0;
  let templeReconversions = 0;

  const startCellCursor = ((Math.max(1, tick) * 1973) % 42000) + 1;

  // Load canonical lookup metadata sequentially on the single transaction client (no pg concurrent-query warning)
  const cultMetaRes = await client.query(`SELECT id, name FROM sim_cultures ORDER BY id ASC`);
  const relMetaRes = await client.query(`SELECT id, name, type FROM sim_religions ORDER BY id ASC`);
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

  const cultureNameById = new Map<number, string>();
  for (const r of cultMetaRes.rows) cultureNameById.set(Number(r.id), String(r.name));

  const relNameById = new Map<number, string>();
  const cultReligions: Array<{ id: number; name: string }> = [];
  const cultRelIdSet = new Set<number>();
  for (const r of relMetaRes.rows) {
    const id = Number(r.id);
    const name = String(r.name);
    relNameById.set(id, name);
    if (String(r.type || "") === "Cult") {
      cultRelIdSet.add(id);
      cultReligions.push({ id, name });
    }
  }

  const cultureUpdates = new Map<number, { cellId: number; oldId: number; newId: number; burgId: number | null; burgName: string | null }>();
  const religionUpdates = new Map<number, { cellId: number; oldId: number; newId: number; kind: "HERESY" | "TEMPLE"; burgId: number | null; burgName: string | null }>();
  const burgUnrestDeltas = new Map<number, number>();
  const events: Array<{ tick: number; type: string; message: string; tier: string; burgId: number | null; cellId: number }> = [];

  // -------------------------------------------------------------------------
  // 1. Cultural Assimilation: sovereign land cells with an adjacent same-culture neighbor
  // -------------------------------------------------------------------------
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

  let cultFrontRows = (await cultFrontierQuery(startCellCursor, 99999999, 16)).rows;
  if (cultFrontRows.length < 16) {
    const wrapRows = (await cultFrontierQuery(1, startCellCursor, 16 - cultFrontRows.length)).rows;
    cultFrontRows = [...cultFrontRows, ...wrapRows];
  }

  for (const row of cultFrontRows) {
    if (cultureConversions >= 4) break;
    const cid = Number(row.cell_id);
    if (seededFraction(cid, tick, 0x51a1) < 0.55) {
      const oldC = Number(row.old_culture_id) || 0;
      const newC = Number(row.target_culture_id);
      if (newC <= 0 || oldC === newC) continue;
      cultureUpdates.set(cid, {
        cellId: cid,
        oldId: oldC,
        newId: newC,
        burgId: row.burg_id ? Number(row.burg_id) : null,
        burgName: row.burg_name ? String(row.burg_name) : null,
      });
      cultureConversions++;
      if (events.length < 2) {
        const cultName = cultureNameById.get(newC) || `Culture #${newC}`;
        const oldName = cultureNameById.get(oldC) || "Frontier Folk";
        const place = row.burg_name ? `${row.burg_name} (Cell #${cid})` : `Cell #${cid}`;
        events.push({
          tick,
          type: "CULTURAL_CONVERSION",
          message: `🏛️ CULTURAL ASSIMILATION: Borderlands around ${place} adopted ${cultName} customs under ${row.faction_name}, displacing ${oldName} traditions.`,
          tier: "MINOR",
          burgId: row.burg_id ? Number(row.burg_id) : null,
          cellId: cid,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Temple Orthodoxy Pushback (`temple = true` burgs cleanse nearby Cult cells)
  // -------------------------------------------------------------------------
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

  if (orthoTemples.length > 0 && cultReligions.length > 0) {
    const cultIds = cultReligions.map((r) => r.id);
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

    for (const row of cleanseRes.rows) {
      const cid = Number(row.target_cell_id);
      if (religionUpdates.has(cid)) continue;
      const oldR = Number(row.old_religion_id) || 0;
      const newR = Number(row.ortho_religion_id);
      if (newR <= 0 || oldR === newR) continue;
      religionUpdates.set(cid, {
        cellId: cid,
        oldId: oldR,
        newId: newR,
        kind: "TEMPLE",
        burgId: Number(row.burg_id),
        burgName: String(row.burg_name),
      });
      burgUnrestDeltas.set(Number(row.burg_id), (burgUnrestDeltas.get(Number(row.burg_id)) || 0) - 1);
      templeReconversions++;
      if (events.length < 4) {
        const oldName = relNameById.get(oldR) || "heretical sect";
        events.push({
          tick,
          type: "TEMPLE_RECONVERSION",
          message: `🕯️ SANCTUARY RECLAMATION: Clergy from ${row.burg_name}'s temple reconciled Cell #${cid} to ${row.ortho_religion_name}, uprooting cells of ${oldName}.`,
          tier: "MINOR",
          burgId: Number(row.burg_id),
          cellId: cid,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Heresy & Cult Diffusion (cell-to-cell from Cult cells and Chaos Zones)
  // -------------------------------------------------------------------------
  if (cultReligions.length > 0) {
    const cultIds = cultReligions.map((r) => r.id);
    const chaosMap = new Map<number, number>();
    for (const ch of chaosRes.rows) chaosMap.set(Number(ch.cell_id), Number(ch.intensity) || 0);
    const chaosIds = Array.from(chaosMap.keys()).sort((a, b) => a - b);

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

    let heresyRows = (await heresyScanQuery(startCellCursor, 99999999, 16)).rows;
    if (heresyRows.length < 16) {
      const wrapRows = (await heresyScanQuery(1, startCellCursor, 16 - heresyRows.length)).rows;
      heresyRows = [...heresyRows, ...wrapRows];
    }

    for (const row of heresyRows) {
      if (heresyConversions >= 4) break;
      const cid = Number(row.target_cell_id);
      if (religionUpdates.has(cid)) continue;

      const tx = Number(row.tx) || 0;
      const ty = Number(row.ty) || 0;
      const protectedByTemple = templeProtectedCenters.some(
        (t) => (tx - t.cx) ** 2 + (ty - t.cy) ** 2 <= 400
      );
      if (protectedByTemple) continue;

      const chaosIntensity = chaosMap.get(Number(row.src_id)) || 0;
      const spreadChance = chaosIntensity >= 35 ? 0.80 : 0.35;
      if (seededFraction(cid, tick, 0x73e2) < spreadChance) {
        const srcRel = Number(row.src_religion_id) || 0;
        const targetCult = cultRelIdSet.has(srcRel)
          ? srcRel
          : cultReligions[(Number(row.src_id) + tick) % cultReligions.length]!.id;
        const oldR = Number(row.old_religion_id) || 0;
        if (oldR === targetCult) continue;

        religionUpdates.set(cid, {
          cellId: cid,
          oldId: oldR,
          newId: targetCult,
          kind: "HERESY",
          burgId: row.burg_id ? Number(row.burg_id) : null,
          burgName: row.burg_name ? String(row.burg_name) : null,
        });
        if (row.burg_id) {
          burgUnrestDeltas.set(Number(row.burg_id), (burgUnrestDeltas.get(Number(row.burg_id)) || 0) + 2);
        }
        heresyConversions++;
        if (events.length < 6) {
          const sectName = relNameById.get(targetCult) || `Cult #${targetCult}`;
          const place = row.burg_name ? `${row.burg_name} (Cell #${cid})` : `Cell #${cid}`;
          events.push({
            tick,
            type: "HERESY_SPREAD",
            message: `🌑 HERESY DIFFUSION: whispered rites of ${sectName} took root across ${place}${chaosIntensity >= 35 ? " beside active chaos blight" : ""}.`,
            tier: "MINOR",
            burgId: row.burg_id ? Number(row.burg_id) : null,
            cellId: cid,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Persist batched updates to sim_cells, sim_cultures, sim_religions, burgs & events
  // -------------------------------------------------------------------------
  if (cultureUpdates.size > 0) {
    const entries = Array.from(cultureUpdates.values()).sort((a, b) => a.cellId - b.cellId);
    await client.query(
      `UPDATE sim_cells AS c SET culture_id = v.culture_id
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS culture_id) AS v
       WHERE c.id = v.id`,
      [entries.map((e) => e.cellId), entries.map((e) => e.newId)]
    );

    const cultCellDeltas = new Map<number, number>();
    for (const e of entries) {
      if (e.oldId > 0) cultCellDeltas.set(e.oldId, (cultCellDeltas.get(e.oldId) || 0) - 1);
      if (e.newId > 0) cultCellDeltas.set(e.newId, (cultCellDeltas.get(e.newId) || 0) + 1);
    }
    if (cultCellDeltas.size > 0) {
      const cIds = Array.from(cultCellDeltas.keys()).sort((a, b) => a - b);
      await client.query(
        `UPDATE sim_cultures AS cu SET cells = GREATEST(0, COALESCE(cu.cells, 0) + v.delta)
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
         WHERE cu.id = v.id`,
        [cIds, cIds.map((id) => cultCellDeltas.get(id)!)]
      );
    }
  }

  if (religionUpdates.size > 0) {
    const entries = Array.from(religionUpdates.values()).sort((a, b) => a.cellId - b.cellId);
    await client.query(
      `UPDATE sim_cells AS c SET religion_id = v.religion_id
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS religion_id) AS v
       WHERE c.id = v.id`,
      [entries.map((e) => e.cellId), entries.map((e) => e.newId)]
    );

    const relCellDeltas = new Map<number, number>();
    for (const e of entries) {
      relCellDeltas.set(e.oldId, (relCellDeltas.get(e.oldId) || 0) - 1);
      relCellDeltas.set(e.newId, (relCellDeltas.get(e.newId) || 0) + 1);
    }
    const rIds = Array.from(relCellDeltas.keys()).sort((a, b) => a - b);
    if (rIds.length > 0) {
      await client.query(
        `UPDATE sim_religions AS r SET cells = GREATEST(0, COALESCE(r.cells, 0) + v.delta)
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
         WHERE r.id = v.id`,
        [rIds, rIds.map((id) => relCellDeltas.get(id)!)]
      );
    }
  }

  if (burgUnrestDeltas.size > 0) {
    const bIds = Array.from(burgUnrestDeltas.keys()).sort((a, b) => a - b);
    await client.query(
      `UPDATE sim_burg_economy AS b SET unrest = LEAST(100, GREATEST(0, b.unrest + v.delta))
       FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS delta) AS v
       WHERE b.burg_id = v.burg_id`,
      [bIds, bIds.map((id) => burgUnrestDeltas.get(id)!)]
    );
  }

  if (events.length > 0) {
    await client.query(
      `INSERT INTO sim_events (tick, type, message, tier, burg_id, cell_id, lore_date)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[]),
              unnest($5::int[]), unnest($6::int[]), $7`,
      [
        tick,
        events.map((e) => e.type),
        events.map((e) => e.message),
        events.map((e) => e.tier),
        events.map((e) => e.burgId),
        events.map((e) => e.cellId),
        loreDate,
      ]
    );
  }

  return {
    cultureConversions,
    heresyConversions,
    templeReconversions,
  };
}
