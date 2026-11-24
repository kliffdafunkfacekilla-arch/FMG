-- 0003_world_clock.sql: Persistent world clock, command queue, and scheduled event queue (Phase 3, F3).

CREATE TABLE IF NOT EXISTS world_clock (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tick             INT NOT NULL,
  minute_of_day    INT NOT NULL DEFAULT 0,
  running          BOOLEAN NOT NULL DEFAULT false,
  speed_ms         INT NOT NULL DEFAULT 1500,
  mode             TEXT NOT NULL DEFAULT 'live',
  tick_in_progress BOOLEAN NOT NULL DEFAULT false,
  last_tick_health JSONB,
  last_tick_error  JSONB,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO world_clock (id, tick, minute_of_day, running, speed_ms, mode)
VALUES (1, COALESCE((SELECT MAX(tick) FROM sim_calendar), 0), 0, false, 1500, 'live')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sim_commands (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at    TIMESTAMPTZ,
  result     JSONB
);

CREATE INDEX IF NOT EXISTS idx_sim_commands_pending ON sim_commands(id) WHERE done_at IS NULL;

CREATE TABLE IF NOT EXISTS scheduled_events (
  id           BIGSERIAL PRIMARY KEY,
  due_tick     INT NOT NULL,
  due_minute   INT NOT NULL DEFAULT 0,
  kind         TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_tick INT NOT NULL,
  fired_tick   INT
);

CREATE INDEX IF NOT EXISTS idx_sched_due ON scheduled_events(due_tick, due_minute) WHERE fired_tick IS NULL;
