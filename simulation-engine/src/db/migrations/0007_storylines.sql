-- 0007_storylines.sql: Unified storyline model (scene, thread, arc, saga) + sim_threads / sim_story_arcs views (Phase 9.1).

CREATE TABLE IF NOT EXISTS storylines (
  id                   BIGSERIAL PRIMARY KEY,
  parent_id            BIGINT REFERENCES storylines(id) ON DELETE SET NULL,
  scale                TEXT NOT NULL CHECK (scale IN ('scene', 'thread', 'arc', 'saga')),
  scope_cells          INT[] NOT NULL DEFAULT '{}',
  cell_id              INT,
  rx                   INT NOT NULL DEFAULT 50,
  ry                   INT NOT NULL DEFAULT 50,
  z                    INT NOT NULL DEFAULT 0,
  question             TEXT NOT NULL,
  stakes               TEXT NOT NULL,
  actor_ids            TEXT[] NOT NULL DEFAULT '{}',
  clock                INT NOT NULL DEFAULT 0,
  clock_max            INT NOT NULL DEFAULT 6,
  state                TEXT NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'open', 'escalated', 'resolved', 'expired', 'failed', 'rejected')),
  origin               TEXT NOT NULL DEFAULT 'reaction',
  source               TEXT NOT NULL DEFAULT 'reaction',
  rule_id              TEXT,
  arc_key              TEXT,
  active_phase         INT NOT NULL DEFAULT 1,
  why                  TEXT,
  facts                JSONB NOT NULL DEFAULT '[]'::jsonb,
  hook                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  rank_score           NUMERIC NOT NULL DEFAULT 0,
  cooldown_until_tick  INT,
  created_tick         INT NOT NULL DEFAULT 0,
  resolved_tick        INT,
  resolution_text      TEXT,
  resolution           JSONB,
  on_expire            JSONB DEFAULT '{}'::jsonb,
  on_resolved_by_party JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_storylines_state_scale ON storylines(state, scale);
CREATE INDEX IF NOT EXISTS idx_storylines_loc ON storylines(cell_id, rx, ry);
CREATE INDEX IF NOT EXISTS idx_storylines_scope ON storylines USING GIN (scope_cells);
CREATE INDEX IF NOT EXISTS idx_storylines_parent ON storylines(parent_id);
CREATE INDEX IF NOT EXISTS idx_storylines_cooldown ON storylines(rule_id, cooldown_until_tick) WHERE state = 'rejected';

CREATE TABLE IF NOT EXISTS storyline_actors (
  storyline_id BIGINT NOT NULL REFERENCES storylines(id) ON DELETE CASCADE,
  entity_ref   TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'actor',
  PRIMARY KEY (storyline_id, entity_ref)
);

CREATE INDEX IF NOT EXISTS idx_storyline_actors_ref ON storyline_actors(entity_ref);

CREATE TABLE IF NOT EXISTS storyline_beats (
  id           BIGSERIAL PRIMARY KEY,
  storyline_id BIGINT NOT NULL REFERENCES storylines(id) ON DELETE CASCADE,
  phase        INT NOT NULL,
  objective    TEXT NOT NULL,
  discovery    TEXT,
  hook         JSONB,
  state        TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_storyline_beats_storyline ON storyline_beats(storyline_id, phase);

-- Backfill existing sim_threads and sim_story_arcs before replacing them with compatibility views
DO $$
DECLARE
  v_threads_kind "char";
  v_arcs_kind "char";
  v_arc_rec RECORD;
  v_new_arc_id BIGINT;
  v_beat JSONB;
  v_beat_idx INT;
BEGIN
  SELECT c.relkind INTO v_threads_kind
  FROM pg_class c
  WHERE c.relname = 'sim_threads' AND pg_table_is_visible(c.oid)
  LIMIT 1;

  IF v_threads_kind IN ('r', 'p') THEN
    INSERT INTO storylines (
      id, scale, scope_cells, cell_id, rx, ry, z,
      question, stakes, actor_ids, clock, clock_max, state,
      origin, source, rule_id, created_tick, resolved_tick,
      resolution_text, on_expire, on_resolved_by_party
    )
    SELECT
      t.id::bigint,
      'thread',
      ARRAY[t.cell_id],
      t.cell_id,
      COALESCE(t.rx, 50),
      COALESCE(t.ry, 50),
      0,
      t.question,
      t.stakes,
      COALESCE(t.actor_ids, '{}'::text[]),
      COALESCE(t.clock, 0),
      COALESCE(t.clock_max, 6),
      CASE WHEN t.state IN ('proposed', 'open', 'escalated', 'resolved', 'expired', 'failed', 'rejected') THEN t.state ELSE 'open' END,
      COALESCE(t.origin, 'reaction'),
      CASE COALESCE(t.origin, 'reaction')
        WHEN 'arc' THEN 'arc'
        WHEN 'world' THEN 'world'
        WHEN 'beat' THEN 'beat'
        ELSE 'reaction'
      END,
      t.rule_id,
      COALESCE(t.created_tick, 0),
      t.resolved_tick,
      t.resolution,
      COALESCE(t.on_expire, '{}'::jsonb),
      COALESCE(t.on_resolved_by_party, '{}'::jsonb)
    FROM sim_threads t
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storyline_actors (storyline_id, entity_ref, role)
    SELECT DISTINCT t.id::bigint, trim(aid), 'actor'
    FROM sim_threads t, unnest(COALESCE(t.actor_ids, '{}'::text[])) AS aid
    WHERE btrim(aid) <> ''
    ON CONFLICT (storyline_id, entity_ref) DO NOTHING;
  END IF;

  PERFORM setval(
    pg_get_serial_sequence('storylines', 'id'),
    GREATEST(1, COALESCE((SELECT MAX(id) FROM storylines), 1)),
    COALESCE((SELECT MAX(id) FROM storylines), 0) > 0
  );

  SELECT c.relkind INTO v_arcs_kind
  FROM pg_class c
  WHERE c.relname = 'sim_story_arcs' AND pg_table_is_visible(c.oid)
  LIMIT 1;

  IF v_arcs_kind IN ('r', 'p') THEN
    FOR v_arc_rec IN SELECT * FROM sim_story_arcs ORDER BY id ASC LOOP
      INSERT INTO storylines (
        scale, scope_cells, cell_id, rx, ry, z,
        question, stakes, actor_ids, clock, clock_max, state,
        origin, source, arc_key, active_phase, created_tick, resolved_tick
      )
      VALUES (
        'arc',
        ARRAY[v_arc_rec.cell_id],
        v_arc_rec.cell_id,
        COALESCE(v_arc_rec.rx, 50),
        COALESCE(v_arc_rec.ry, 50),
        COALESCE(v_arc_rec.z, 0),
        v_arc_rec.inciting_incident,
        v_arc_rec.inciting_incident,
        CASE WHEN v_arc_rec.actor_id IS NOT NULL AND btrim(v_arc_rec.actor_id) <> '' THEN ARRAY[v_arc_rec.actor_id] ELSE '{}'::text[] END,
        COALESCE(v_arc_rec.active_phase, 1),
        GREATEST(1, COALESCE(jsonb_array_length(COALESCE(v_arc_rec.beats, '[]'::jsonb)), 1)),
        CASE WHEN COALESCE(v_arc_rec.state, 'active') = 'active' THEN 'open' ELSE v_arc_rec.state END,
        'arc',
        COALESCE(v_arc_rec.source, 'procedural'),
        v_arc_rec.arc_key,
        COALESCE(v_arc_rec.active_phase, 1),
        COALESCE(v_arc_rec.created_tick, 0),
        v_arc_rec.resolved_tick
      )
      RETURNING id INTO v_new_arc_id;

      IF v_arc_rec.actor_id IS NOT NULL AND btrim(v_arc_rec.actor_id) <> '' THEN
        INSERT INTO storyline_actors (storyline_id, entity_ref, role)
        VALUES (v_new_arc_id, trim(v_arc_rec.actor_id), 'actor')
        ON CONFLICT (storyline_id, entity_ref) DO NOTHING;
      END IF;

      v_beat_idx := 0;
      FOR v_beat IN SELECT elem FROM jsonb_array_elements(COALESCE(v_arc_rec.beats, '[]'::jsonb)) AS elem LOOP
        v_beat_idx := v_beat_idx + 1;
        INSERT INTO storyline_beats (storyline_id, phase, objective, discovery, state)
        VALUES (
          v_new_arc_id,
          COALESCE((v_beat->>'phase')::int, v_beat_idx),
          COALESCE(v_beat->>'objective', v_arc_rec.inciting_incident),
          v_beat->>'discovery_method',
          CASE
            WHEN COALESCE(v_arc_rec.state, 'active') = 'resolved' THEN 'resolved'
            WHEN COALESCE(v_arc_rec.state, 'active') = 'failed' THEN 'failed'
            WHEN COALESCE((v_beat->>'phase')::int, v_beat_idx) < COALESCE(v_arc_rec.active_phase, 1) THEN 'resolved'
            WHEN COALESCE((v_beat->>'phase')::int, v_beat_idx) = COALESCE(v_arc_rec.active_phase, 1) THEN 'open'
            ELSE 'pending'
          END
        );
      END LOOP;

      IF array_length(v_arc_rec.thread_ids, 1) IS NOT NULL THEN
        UPDATE storylines
        SET parent_id = v_new_arc_id
        WHERE id = ANY(v_arc_rec.thread_ids::bigint[]);
      END IF;
    END LOOP;
  END IF;

  IF v_threads_kind IN ('r', 'p') THEN
    DROP TABLE sim_threads CASCADE;
  ELSIF v_threads_kind = 'v' THEN
    DROP VIEW sim_threads CASCADE;
  END IF;

  IF v_arcs_kind IN ('r', 'p') THEN
    DROP TABLE sim_story_arcs CASCADE;
  ELSIF v_arcs_kind = 'v' THEN
    DROP VIEW sim_story_arcs CASCADE;
  END IF;
END $$;

-- Compatibility view for sim_threads (W8: existing readers & legacy test writers continue working via INSTEAD OF triggers)
CREATE OR REPLACE VIEW sim_threads AS
SELECT
  s.id::int AS id,
  s.question,
  s.stakes,
  s.actor_ids,
  COALESCE(s.cell_id, s.scope_cells[1], 0)::int AS cell_id,
  s.rx,
  s.ry,
  s.clock,
  s.clock_max,
  s.state::varchar(32) AS state,
  COALESCE(s.origin, s.source)::varchar(32) AS origin,
  s.created_tick,
  s.resolved_tick,
  s.resolution_text AS resolution,
  s.rule_id::varchar(64) AS rule_id,
  s.on_expire,
  s.on_resolved_by_party
FROM storylines s
WHERE s.scale = 'thread'
  AND s.state NOT IN ('proposed', 'rejected');

CREATE OR REPLACE FUNCTION sim_threads_view_insert() RETURNS TRIGGER AS $$
DECLARE
  v_id BIGINT;
  v_cell_id INT;
  v_origin TEXT;
  v_source TEXT;
  v_actors TEXT[];
BEGIN
  v_cell_id := COALESCE(NEW.cell_id, 0);
  v_origin := COALESCE(NEW.origin, 'reaction');
  v_source := CASE v_origin
    WHEN 'arc' THEN 'arc'
    WHEN 'world' THEN 'world'
    WHEN 'beat' THEN 'beat'
    ELSE 'reaction'
  END;
  v_actors := COALESCE(NEW.actor_ids, '{}'::text[]);
  v_id := COALESCE(NULLIF(NEW.id, 0)::bigint, nextval(pg_get_serial_sequence('storylines', 'id')));

  INSERT INTO storylines (
    id, scale, scope_cells, cell_id, rx, ry, z,
    question, stakes, actor_ids, clock, clock_max, state,
    origin, source, rule_id, created_tick, resolved_tick,
    resolution_text, on_expire, on_resolved_by_party
  ) VALUES (
    v_id,
    'thread',
    ARRAY[v_cell_id],
    v_cell_id,
    COALESCE(NEW.rx, 50),
    COALESCE(NEW.ry, 50),
    0,
    NEW.question,
    NEW.stakes,
    v_actors,
    COALESCE(NEW.clock, 0),
    COALESCE(NEW.clock_max, 6),
    COALESCE(NEW.state, 'open'),
    v_origin,
    v_source,
    NEW.rule_id,
    COALESCE(NEW.created_tick, 0),
    NEW.resolved_tick,
    NEW.resolution,
    COALESCE(NEW.on_expire, '{}'::jsonb),
    COALESCE(NEW.on_resolved_by_party, '{}'::jsonb)
  );

  IF NEW.id IS NOT NULL AND NEW.id > 0 THEN
    PERFORM setval(
      pg_get_serial_sequence('storylines', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM storylines), 1), v_id),
      true
    );
  END IF;

  INSERT INTO storyline_actors (storyline_id, entity_ref, role)
  SELECT DISTINCT v_id, trim(aid), 'actor'
  FROM unnest(v_actors) AS aid
  WHERE btrim(aid) <> ''
  ON CONFLICT (storyline_id, entity_ref) DO NOTHING;

  NEW.id := v_id::int;
  NEW.actor_ids := v_actors;
  NEW.cell_id := v_cell_id;
  NEW.rx := COALESCE(NEW.rx, 50);
  NEW.ry := COALESCE(NEW.ry, 50);
  NEW.clock := COALESCE(NEW.clock, 0);
  NEW.clock_max := COALESCE(NEW.clock_max, 6);
  NEW.state := COALESCE(NEW.state, 'open');
  NEW.origin := v_origin;
  NEW.created_tick := COALESCE(NEW.created_tick, 0);
  NEW.on_expire := COALESCE(NEW.on_expire, '{}'::jsonb);
  NEW.on_resolved_by_party := COALESCE(NEW.on_resolved_by_party, '{}'::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sim_threads_view_update() RETURNS TRIGGER AS $$
DECLARE
  v_actors TEXT[];
BEGIN
  v_actors := COALESCE(NEW.actor_ids, '{}'::text[]);
  UPDATE storylines
  SET question = NEW.question,
      stakes = NEW.stakes,
      actor_ids = v_actors,
      cell_id = NEW.cell_id,
      scope_cells = CASE WHEN array_length(scope_cells, 1) > 1 THEN scope_cells ELSE ARRAY[NEW.cell_id] END,
      rx = COALESCE(NEW.rx, 50),
      ry = COALESCE(NEW.ry, 50),
      clock = COALESCE(NEW.clock, 0),
      clock_max = COALESCE(NEW.clock_max, 6),
      state = NEW.state,
      origin = COALESCE(NEW.origin, origin),
      resolved_tick = NEW.resolved_tick,
      resolution_text = NEW.resolution,
      rule_id = NEW.rule_id,
      on_expire = COALESCE(NEW.on_expire, '{}'::jsonb),
      on_resolved_by_party = COALESCE(NEW.on_resolved_by_party, '{}'::jsonb)
  WHERE id = OLD.id::bigint;

  IF v_actors IS DISTINCT FROM COALESCE(OLD.actor_ids, '{}'::text[]) THEN
    DELETE FROM storyline_actors WHERE storyline_id = OLD.id::bigint;
    INSERT INTO storyline_actors (storyline_id, entity_ref, role)
    SELECT DISTINCT OLD.id::bigint, trim(aid), 'actor'
    FROM unnest(v_actors) AS aid
    WHERE btrim(aid) <> ''
    ON CONFLICT (storyline_id, entity_ref) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sim_threads_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storylines WHERE id = OLD.id::bigint;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sim_threads_insert ON sim_threads;
DROP TRIGGER IF EXISTS trg_sim_threads_update ON sim_threads;
DROP TRIGGER IF EXISTS trg_sim_threads_delete ON sim_threads;
CREATE TRIGGER trg_sim_threads_insert INSTEAD OF INSERT ON sim_threads FOR EACH ROW EXECUTE FUNCTION sim_threads_view_insert();
CREATE TRIGGER trg_sim_threads_update INSTEAD OF UPDATE ON sim_threads FOR EACH ROW EXECUTE FUNCTION sim_threads_view_update();
CREATE TRIGGER trg_sim_threads_delete INSTEAD OF DELETE ON sim_threads FOR EACH ROW EXECUTE FUNCTION sim_threads_view_delete();

-- Compatibility view for sim_story_arcs
CREATE OR REPLACE VIEW sim_story_arcs AS
SELECT
  s.id::int AS id,
  COALESCE(s.arc_key, 'arc_' || s.id)::varchar(160) AS arc_key,
  COALESCE(s.cell_id, s.scope_cells[1], 0)::int AS cell_id,
  s.rx,
  s.ry,
  s.z,
  s.stakes AS inciting_incident,
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
  ), '[]'::jsonb) AS beats,
  s.active_phase,
  (CASE WHEN s.state IN ('open', 'escalated') THEN 'active' ELSE s.state END)::varchar(16) AS state,
  COALESCE((
    SELECT array_agg(c.id::int ORDER BY c.id ASC)
    FROM storylines c
    WHERE c.parent_id = s.id
  ), '{}'::int[]) AS thread_ids,
  s.actor_ids[1] AS actor_id,
  s.source::varchar(16) AS source,
  s.created_tick,
  s.resolved_tick
FROM storylines s
WHERE s.scale = 'arc'
  AND s.state NOT IN ('proposed', 'rejected');

CREATE OR REPLACE FUNCTION sim_story_arcs_view_delete() RETURNS TRIGGER AS $$
BEGIN
  UPDATE storylines SET parent_id = NULL WHERE parent_id = OLD.id::bigint;
  DELETE FROM storylines WHERE id = OLD.id::bigint;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sim_story_arcs_delete ON sim_story_arcs;
CREATE TRIGGER trg_sim_story_arcs_delete INSTEAD OF DELETE ON sim_story_arcs FOR EACH ROW EXECUTE FUNCTION sim_story_arcs_view_delete();
