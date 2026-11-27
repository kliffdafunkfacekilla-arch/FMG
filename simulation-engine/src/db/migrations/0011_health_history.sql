-- 0011_health_history.sql: one row of world-health numbers per committed tick, for the dashboard's trends and alarms.

CREATE TABLE IF NOT EXISTS sim_health_history (
  tick          INT PRIMARY KEY,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_ms      INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'success',
  failed_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps         JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb
);
