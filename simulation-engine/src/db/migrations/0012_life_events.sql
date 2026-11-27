-- 0012_life_events.sql: each named person's own history (born, married, befriended, survived a raid, mourned, died).
-- Kept apart from sim_events, which keeps only a rolling buffer, so a life story is never trimmed away.

CREATE TABLE IF NOT EXISTS sim_life_events (
  id                SERIAL PRIMARY KEY,
  citizen_id        INT NOT NULL,
  tick              INT NOT NULL,
  kind              TEXT NOT NULL,
  text              TEXT NOT NULL,
  other_citizen_id  INT,
  burg_id           INT
);

CREATE INDEX IF NOT EXISTS idx_life_events_citizen ON sim_life_events (citizen_id, tick);
CREATE INDEX IF NOT EXISTS idx_life_events_burg ON sim_life_events (burg_id, tick);
