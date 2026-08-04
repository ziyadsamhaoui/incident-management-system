-- V6__migrate_closed_incidents.sql
-- Flyway Incremental Migration: Drop the CLOSED state (non-destructive backfill).
--
-- The CLOSED status is removed from the application state machine (IncidentStatus
-- enum). RESOLVED and NON_RESOLVED are now the terminal states. This migration:
--
--   1. Restores every incident currently in CLOSED to its TRUE historical status
--      (RESOLVED or NON_RESOLVED) read from incident_history — never a blunt
--      bulk-overwrite to RESOLVED.
--   2. Normalizes incident_history so no row keeps a 'CLOSED' value in either
--      status column (JPA maps these columns via the Java enum). The original
--      auto-closure trail is preserved in the row's `comment`.
--
-- Note: incidents.status and incident_history.previous_status/current_status are
-- plain VARCHAR(20) columns — there is no DB-level check constraint or enum type
-- to alter, so this is purely a data backfill.
--
-- The migration is idempotent: every UPDATE is guarded by a `WHERE` on the value
-- it removes, so re-running it is a no-op.


-- ---------------------------------------------------------------------------
-- STEP 1 — Restore incidents.status from the incident_history entry that
-- produced the CLOSED state (latest RESOLVED/NON_RESOLVED predecessor).
-- ---------------------------------------------------------------------------
UPDATE incidents i
SET status = sub.previous_status
FROM (
    SELECT DISTINCT ON (h.incident_id)
           h.incident_id,
           h.previous_status
    FROM incident_history h
    WHERE h.current_status = 'CLOSED'
      AND h.previous_status IN ('RESOLVED', 'NON_RESOLVED')
    ORDER BY h.incident_id, h.changed_at DESC NULLS LAST
) sub
WHERE i.status = 'CLOSED'
  AND sub.incident_id = i.id;


-- ---------------------------------------------------------------------------
-- STEP 2 — Explicit fallback for CLOSED incidents with no usable history entry
-- (e.g. history was purged). Defaults to RESOLVED — documented last resort.
-- ---------------------------------------------------------------------------
UPDATE incidents
SET status = 'RESOLVED'
WHERE status = 'CLOSED';


-- ---------------------------------------------------------------------------
-- STEP 3 — Defensive normalization: 'CLOSED' could never be a source state
-- under the old state machine (it was terminal), but the old validation
-- silently allowed same-state transitions, so a stray 'CLOSED' previous_status
-- cannot be ruled out. Normalize previous_status FIRST so the next step's
-- `current_status = previous_status` can never re-introduce 'CLOSED'.
-- ---------------------------------------------------------------------------
UPDATE incident_history
SET previous_status = 'RESOLVED'
WHERE previous_status = 'CLOSED';


-- ---------------------------------------------------------------------------
-- STEP 4 — Normalize incident_history so no 'CLOSED' survives in
-- current_status. The row's previous_status is its true terminal predecessor
-- (already guaranteed non-CLOSED by step 3); the comment ("Auto-closed by
-- system...") keeps the audit trail intact.
-- ---------------------------------------------------------------------------
UPDATE incident_history
SET current_status = previous_status
WHERE current_status = 'CLOSED';
