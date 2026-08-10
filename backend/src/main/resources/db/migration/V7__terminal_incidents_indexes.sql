-- V7__terminal_incidents_indexes.sql
-- Flyway Incremental Migration: Terminal-Incidents (Logs) Query Indexes
--
-- The Actifs/Logs tab architecture queries GET /api/incidents with two status
-- groups plus a resolvedAt sort / date range:
--
--   Actifs:  status IN ('DECLARED','CLAIMED','IN_PROGRESS')
--   Logs:    status IN ('RESOLVED','NON_RESOLVED') ORDER BY resolved_at DESC
--
-- The compound indexes below cover both access patterns so the Logs tab never
-- degrades into a sequential scan of historical rows:
--
--   1. CHEF_ATELIER pattern — department-scoped terminal listing
--      (department_id equality + status group + resolved_at range sort).
--   2. ADMIN pattern — unscoped terminal listing
--      (status group + resolved_at range sort).
--
-- These are plain B-tree indexes; `resolved_at DESC` matches the default Logs
-- sort order and supports backward range scans for date-bounded queries.

CREATE INDEX IF NOT EXISTS idx_incidents_dept_status_resolved
    ON incidents (department_id, status, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_status_resolved
    ON incidents (status, resolved_at DESC);

-- TERMINAL-STATUS RETENTION THRESHOLD (shared constant, documented)
-- The self-hosted media pipeline (see V9) purges incident_attachments rows +
-- local files for terminal incidents through MediaRetentionJob. Its cutoff uses
-- the SAME terminal predicate as this index (status IN ('RESOLVED','NON_RESOLVED'))
-- with an uploaded_at cutoff of app.media.retention-days (default 90):
--
--   status IN ('RESOLVED', 'NON_RESOLVED')
--   AND uploaded_at < NOW() - INTERVAL '90 days'
--
-- Keep the retention window (N) consistent across the cleanup job, this query,
-- and the Logs tab date-range default.
