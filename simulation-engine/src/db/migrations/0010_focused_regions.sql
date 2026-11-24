-- 0010_focused_regions.sql: Persistent focused regions for real 100x100 meso layer & multi-focus (Phase 10 & 13.3).

CREATE TABLE IF NOT EXISTS focused_regions (
  focus_cell_id  INT PRIMARY KEY,
  cell_ids       INT[] NOT NULL,
  seed           TEXT NOT NULL DEFAULT 'ostraka',
  version        INT NOT NULL DEFAULT 1,
  focused_tick   INT NOT NULL DEFAULT 0,
  last_meso_tick INT NOT NULL DEFAULT 0,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focused_regions_cells ON focused_regions USING GIN (cell_ids);
