-- 0006_population_cohorts.sql: Population cohorts and deterministic LOD promotion tracking (Phase 8).

CREATE TABLE IF NOT EXISTS population_cohorts (
  burg_id    INT NOT NULL,
  species    TEXT NOT NULL,
  profession TEXT NOT NULL,
  age_band   TEXT NOT NULL,
  spark_tier TEXT NOT NULL,
  is_null    BOOLEAN NOT NULL,
  allegiance TEXT NOT NULL DEFAULT 'CIVILIAN',
  count      INT NOT NULL CHECK (count >= 0),
  PRIMARY KEY (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_burg ON population_cohorts(burg_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_burg_workforce
  ON population_cohorts(burg_id, profession)
  WHERE age_band = 'ADULT' AND allegiance = 'CIVILIAN';

CREATE TABLE IF NOT EXISTS promoted_slots (
  burg_id      INT NOT NULL,
  cohort_key   TEXT NOT NULL,
  slot_key     TEXT NOT NULL,
  citizen_id   INT NOT NULL,
  entity_ref   TEXT NOT NULL,
  species      TEXT NOT NULL,
  profession   TEXT NOT NULL,
  age_band     TEXT NOT NULL,
  spark_tier   TEXT NOT NULL,
  is_null      BOOLEAN NOT NULL,
  allegiance   TEXT NOT NULL DEFAULT 'CIVILIAN',
  created_tick INT NOT NULL DEFAULT 0,
  PRIMARY KEY (burg_id, cohort_key, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_promoted_slots_citizen ON promoted_slots(citizen_id);
CREATE INDEX IF NOT EXISTS idx_promoted_slots_burg ON promoted_slots(burg_id);
