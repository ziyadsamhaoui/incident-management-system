-- V4__user_activity_analytics_indexes.sql
-- Flyway Incremental Migration: Composite Indexes for Per-User Activity Analytics
--
-- Backs the on-demand analytics endpoint GET /api/users/{id}/activity, which
-- computes metrics via SQL COUNT(*) + GROUP BY DATE(...) — no denormalized
-- counters on the users table.
--
--   * (resolved_by_id, resolved_at)  → per-user resolution counts + daily buckets
--   * (user_id, declared_at)         → per-user declaration counts + daily buckets

CREATE INDEX idx_incidents_resolved_by_resolved_at
    ON incidents(resolved_by_id, resolved_at);

CREATE INDEX idx_incidents_user_declared_at
    ON incidents(user_id, declared_at);
