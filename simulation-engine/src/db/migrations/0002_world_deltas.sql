-- 0002_world_deltas.sql: Unified delta audit log (Phase 2.1, F2).

CREATE TABLE IF NOT EXISTS world_deltas (
  id      BIGSERIAL PRIMARY KEY,
  tick    INT NOT NULL,
  minute  INT NOT NULL DEFAULT 0,
  source  TEXT NOT NULL,
  kind    TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_deltas_tick ON world_deltas(tick);
