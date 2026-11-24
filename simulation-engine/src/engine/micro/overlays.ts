import type { Db, OverlayChange } from "../deltas/types.js";

export interface MapOverlayRow {
  id: number;
  cell_id: number;
  rx: number;
  ry: number;
  z: number;
  x: number | null;
  y: number | null;
  object_ref: string | null;
  change: OverlayChange;
  payload: Record<string, any>;
  tick: number;
  minute: number;
  source: string;
}

export async function loadTileOverlays(
  db: Db,
  cellId: number,
  rx: number,
  ry: number,
  z: number
): Promise<MapOverlayRow[]> {
  const res = await db.query(
    `SELECT id, cell_id, rx, ry, z, x, y, object_ref, change, payload, tick, minute, source
     FROM map_overlays
     WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z = $4
     ORDER BY id ASC`,
    [cellId, rx, ry, z]
  );
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    cell_id: Number(r.cell_id),
    rx: Number(r.rx),
    ry: Number(r.ry),
    z: Number(r.z),
    x: r.x !== null && r.x !== undefined ? Number(r.x) : null,
    y: r.y !== null && r.y !== undefined ? Number(r.y) : null,
    object_ref: r.object_ref ? String(r.object_ref) : null,
    change: r.change as OverlayChange,
    payload: r.payload && typeof r.payload === "object" ? r.payload : {},
    tick: Number(r.tick || 0),
    minute: Number(r.minute || 0),
    source: String(r.source || ""),
  }));
}

export async function hasObjectOverlay(
  db: Db,
  cellId: number,
  rx: number,
  ry: number,
  z: number,
  objectRef: string,
  change?: OverlayChange
): Promise<boolean> {
  if (!objectRef) return false;
  if (change) {
    const res = await db.query(
      `SELECT 1 FROM map_overlays
       WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z = $4 AND object_ref = $5 AND change = $6
       LIMIT 1`,
      [cellId, rx, ry, z, objectRef, change]
    );
    return res.rows.length > 0;
  }
  const res = await db.query(
    `SELECT 1 FROM map_overlays
     WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z = $4 AND object_ref = $5
     LIMIT 1`,
    [cellId, rx, ry, z, objectRef]
  );
  return res.rows.length > 0;
}

function addTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags : [...tags, tag];
}

function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
}

/**
 * Deterministically replays ordered tile overlays onto a freshly generated or loaded props array.
 */
export function applyMapOverlays(props: any[], overlays: MapOverlayRow[]): any[] {
  const out = (Array.isArray(props) ? props : []).map((p) => ({
    ...p,
    tags: Array.isArray(p?.tags) ? [...p.tags] : [],
    inventory: Array.isArray(p?.inventory) ? [...p.inventory] : p?.inventory,
    pos: Array.isArray(p?.pos) ? [...p.pos] : p?.pos,
  }));

  const findProp = (ref: string | null) =>
    ref ? out.find((p) => String(p.id) === ref || String(p.entity_ref || "") === ref) : undefined;

  for (const ov of overlays) {
    if (ov.change === "placed") {
      const placed = ov.payload?.prop;
      if (placed && placed.id && !out.some((p) => String(p.id) === String(placed.id))) {
        out.push({
          ...placed,
          tags: Array.isArray(placed.tags) ? [...placed.tags] : [],
          inventory: Array.isArray(placed.inventory) ? [...placed.inventory] : [],
          pos: Array.isArray(placed.pos) ? [...placed.pos] : [ov.x ?? 128, ov.y ?? 128],
        });
      }
      continue;
    }

    const prop = findProp(ov.object_ref);
    if (!prop) continue;

    if (ov.change === "burnt") {
      prop.isDestroyed = true;
      prop.hp = 0;
      prop.tags = addTag(prop.tags, "burnt");
      if (prop.name && !String(prop.name).includes("(Burnt)")) {
        prop.name = `${prop.name} (Burnt)`;
      }
    } else if (ov.change === "destroyed") {
      prop.isDestroyed = true;
      prop.hp = 0;
      prop.tags = addTag(prop.tags, "destroyed");
    } else if (ov.change === "looted") {
      prop.tags = addTag(addTag(removeTag(removeTag(prop.tags, "lootable"), "container"), "looted"), "opened");
      prop.inventory = [];
    } else if (ov.change === "opened") {
      prop.tags = addTag(removeTag(prop.tags, "locked"), "opened");
    } else if (ov.change === "moved" && ov.x !== null && ov.y !== null) {
      prop.pos = [ov.x, ov.y];
    }
  }

  return out;
}
