-- 0008_actions.sql: Structured party action ledger for computed storyline consequences & witnesses (Phase 11.1).

CREATE TABLE IF NOT EXISTS actions (
  id           BIGSERIAL PRIMARY KEY,
  tick         INT NOT NULL,
  minute       INT NOT NULL DEFAULT 0,
  actor_ref    TEXT NOT NULL,
  verb         TEXT NOT NULL,
  target_ref   TEXT,
  location     JSONB NOT NULL DEFAULT '{}'::jsonb,
  method       TEXT,
  result       TEXT NOT NULL,
  storyline_id BIGINT REFERENCES storylines(id) ON DELETE SET NULL,
  witnesses    TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_actions_actor_tick ON actions(actor_ref, tick DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_actions_storyline ON actions(storyline_id) WHERE storyline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_target ON actions(target_ref) WHERE target_ref IS NOT NULL;
