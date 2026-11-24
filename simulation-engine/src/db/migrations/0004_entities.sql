-- 0004_entities.sql: Unified Entity Registry across Macro, Meso, and Micro LODs (Phase 4, F1).

CREATE TABLE IF NOT EXISTS entities (
  id           BIGSERIAL PRIMARY KEY,
  ref          TEXT NOT NULL UNIQUE,
  kind         TEXT NOT NULL,
  name         TEXT NOT NULL,
  alive        BOOLEAN NOT NULL DEFAULT true,
  lod          TEXT NOT NULL DEFAULT 'macro',
  cell_id      INT,
  rx           INT,
  ry           INT,
  z            INT,
  x            INT,
  y            INT,
  source_table TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  created_tick INT NOT NULL DEFAULT 0,
  died_tick    INT
);

CREATE INDEX IF NOT EXISTS idx_entities_loc ON entities(cell_id, rx, ry) WHERE alive;
CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source_table, source_id);
