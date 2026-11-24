-- 0005_map_overlays.sql: Durable per-object tactical map changes & overlays (Phase 5).

CREATE TABLE IF NOT EXISTS map_overlays (
  id         BIGSERIAL PRIMARY KEY,
  cell_id    INT NOT NULL,
  rx         INT NOT NULL,
  ry         INT NOT NULL,
  z          INT NOT NULL,
  x          INT,
  y          INT,
  object_ref TEXT,
  change     TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  tick       INT NOT NULL,
  minute     INT NOT NULL DEFAULT 0,
  source     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_overlays_tile ON map_overlays(cell_id, rx, ry, z);
