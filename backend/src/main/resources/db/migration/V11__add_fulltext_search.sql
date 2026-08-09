-- V11__add_fulltext_search.sql
-- Flyway Incremental Migration: PostgreSQL Native Full-Text Search.
--
-- Replaces the unindexed `LIKE '%term%'` scans over incidents (sequential
-- scans, no relevance ranking) with a self-maintaining `tsvector` column +
-- GIN index. The column is `GENERATED ALWAYS AS ... STORED`, so PostgreSQL
-- keeps it in sync on every INSERT/UPDATE — no application-side sync code,
-- no triggers.
--
-- Dictionary configuration: 'simple' (tokenize + lowercase only, no
-- language-specific stemming). Correct for the mixed French/Arabic
-- operational vocabulary. Switch to 'french' only if domain metrics prove
-- entries are strictly French (stemming: convoyeurs -> convoyeur).
--
-- Field weighting (feeds ts_rank relevance ordering):
--   weight 'A' (high priority): reference + description
--   weight 'B' (lower priority): resolution_note
--   (reference is included so full/partial reference lookups — the primary
--    search target, e.g. "INC-2026-0042" — keep working under FTS.)
--
-- Post-migration verification:
--   SELECT id, reference, search_vector FROM incidents LIMIT 5;

ALTER TABLE incidents
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', COALESCE(reference, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(description, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(resolution_note, '')), 'B')
    ) STORED;

CREATE INDEX idx_incidents_search
    ON incidents USING GIN (search_vector);
