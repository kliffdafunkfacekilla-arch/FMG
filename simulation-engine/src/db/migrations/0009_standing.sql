-- 0009_standing.sql: Per-entity and per-faction party reputation ledger (Phase 11.3).

CREATE TABLE IF NOT EXISTS standing (
  subject_ref TEXT NOT NULL,
  party_ref   TEXT NOT NULL,
  value       INT NOT NULL DEFAULT 0 CHECK (value BETWEEN -100 AND 100),
  reasons     JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (subject_ref, party_ref)
);

CREATE INDEX IF NOT EXISTS idx_standing_party ON standing(party_ref);
