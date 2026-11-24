-- 0007_storylines.down.sql: Restore standalone sim_threads and sim_story_arcs physical tables from storylines.

DROP TRIGGER IF EXISTS trg_sim_story_arcs_delete ON sim_story_arcs;
DROP FUNCTION IF EXISTS sim_story_arcs_view_delete();
DROP VIEW IF EXISTS sim_story_arcs CASCADE;

DROP TRIGGER IF EXISTS trg_sim_threads_insert ON sim_threads;
DROP TRIGGER IF EXISTS trg_sim_threads_update ON sim_threads;
DROP TRIGGER IF EXISTS trg_sim_threads_delete ON sim_threads;
DROP FUNCTION IF EXISTS sim_threads_view_insert();
DROP FUNCTION IF EXISTS sim_threads_view_update();
DROP FUNCTION IF EXISTS sim_threads_view_delete();
DROP VIEW IF EXISTS sim_threads CASCADE;

CREATE TABLE IF NOT EXISTS sim_threads (
  id                   SERIAL PRIMARY KEY,
  question             TEXT NOT NULL,
  stakes               TEXT NOT NULL,
  actor_ids            TEXT[] NOT NULL DEFAULT '{}',
  cell_id              INT NOT NULL,
  rx                   INT NOT NULL,
  ry                   INT NOT NULL,
  clock                INT NOT NULL DEFAULT 0,
  clock_max            INT NOT NULL DEFAULT 6,
  state                VARCHAR(32) NOT NULL DEFAULT 'open',
  origin               VARCHAR(32) NOT NULL DEFAULT 'reaction',
  created_tick         INT NOT NULL DEFAULT 0,
  resolved_tick        INT DEFAULT NULL,
  resolution           TEXT DEFAULT NULL,
  rule_id              VARCHAR(64) DEFAULT NULL,
  on_expire            JSONB DEFAULT '{}'::jsonb,
  on_resolved_by_party JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sim_threads_state ON sim_threads(state);
CREATE INDEX IF NOT EXISTS idx_sim_threads_loc ON sim_threads(cell_id, rx, ry);

CREATE TABLE IF NOT EXISTS sim_story_arcs (
  id                SERIAL PRIMARY KEY,
  arc_key           VARCHAR(160) NOT NULL,
  cell_id           INT NOT NULL,
  rx                INT NOT NULL,
  ry                INT NOT NULL,
  z                 INT NOT NULL DEFAULT 0,
  inciting_incident TEXT NOT NULL,
  beats             JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_phase      INT NOT NULL DEFAULT 1,
  state             VARCHAR(16) NOT NULL DEFAULT 'active',
  thread_ids        INT[] NOT NULL DEFAULT '{}',
  actor_id          TEXT,
  source            VARCHAR(16) NOT NULL DEFAULT 'procedural',
  created_tick      INT NOT NULL DEFAULT 0,
  resolved_tick     INT
);
CREATE INDEX IF NOT EXISTS idx_story_arcs_loc ON sim_story_arcs(cell_id, rx, ry);

DO $$
BEGIN
  IF to_regclass('storylines') IS NOT NULL THEN
    INSERT INTO sim_threads (
      id, question, stakes, actor_ids, cell_id, rx, ry,
      clock, clock_max, state, origin, created_tick, resolved_tick,
      resolution, rule_id, on_expire, on_resolved_by_party
    )
    SELECT
      s.id::int,
      s.question,
      s.stakes,
      s.actor_ids,
      COALESCE(s.cell_id, s.scope_cells[1], 0),
      s.rx,
      s.ry,
      s.clock,
      s.clock_max,
      s.state::varchar(32),
      COALESCE(s.origin, s.source)::varchar(32),
      s.created_tick,
      s.resolved_tick,
      s.resolution_text,
      s.rule_id::varchar(64),
      COALESCE(s.on_expire, '{}'::jsonb),
      COALESCE(s.on_resolved_by_party, '{}'::jsonb)
    FROM storylines s
    WHERE s.scale = 'thread'
      AND s.state NOT IN ('proposed', 'rejected')
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(
      pg_get_serial_sequence('sim_threads', 'id'),
      GREATEST(1, COALESCE((SELECT MAX(id) FROM sim_threads), 1)),
      COALESCE((SELECT MAX(id) FROM sim_threads), 0) > 0
    );

    INSERT INTO sim_story_arcs (
      id, arc_key, cell_id, rx, ry, z, inciting_incident, beats,
      active_phase, state, thread_ids, actor_id, source, created_tick, resolved_tick
    )
    SELECT
      s.id::int,
      COALESCE(s.arc_key, 'arc_' || s.id)::varchar(160),
      COALESCE(s.cell_id, s.scope_cells[1], 0),
      s.rx,
      s.ry,
      s.z,
      s.stakes,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'phase', b.phase,
            'objective', b.objective,
            'discovery_method', b.discovery
          ))
          ORDER BY b.phase ASC, b.id ASC
        )
        FROM storyline_beats b
        WHERE b.storyline_id = s.id
      ), '[]'::jsonb),
      s.active_phase,
      (CASE WHEN s.state IN ('open', 'escalated') THEN 'active' ELSE s.state END)::varchar(16),
      COALESCE((SELECT array_agg(c.id::int ORDER BY c.id ASC) FROM storylines c WHERE c.parent_id = s.id), '{}'::int[]),
      s.actor_ids[1],
      s.source::varchar(16),
      s.created_tick,
      s.resolved_tick
    FROM storylines s
    WHERE s.scale = 'arc'
      AND s.state NOT IN ('proposed', 'rejected')
    ON CONFLICT (id) DO NOTHING;

    PERFORM setval(
      pg_get_serial_sequence('sim_story_arcs', 'id'),
      GREATEST(1, COALESCE((SELECT MAX(id) FROM sim_story_arcs), 1)),
      COALESCE((SELECT MAX(id) FROM sim_story_arcs), 0) > 0
    );
  END IF;
END $$;

DROP TABLE IF EXISTS storyline_beats, storyline_actors, storylines CASCADE;
