-- V8: Normalize incident_history status values (ordinal numbers -> enum names)
--
-- WHY:
--   incident_history.previous_status / current_status are VARCHAR(20) columns.
--   The JPA entity did not declare @Enumerated(EnumType.STRING), so the default
--   ORDINAL strategy wrote the enum *ordinal* (0-4) into those string columns.
--   Derived queries such as DashboardController#getAdminActivity (which filters
--   on current_status IN (RESOLVED, NON_RESOLVED)) then bound *integers* against
--   the VARCHAR column and failed with:
--       operator does not exist: character varying = integer
--   (observed as HTTP 500 on GET /api/dashboard/admin-activity).
--
-- FIX:
--   1. The entity now maps both columns with @Enumerated(EnumType.STRING), so
--      new rows persist the enum NAME ('RESOLVED', ...) as the schema always
--      intended (V6 already assumes names like 'CLOSED'/'RESOLVED').
--   2. This migration backfills any legacy ordinal-as-string values ('0'-'4')
--      to their enum names so old rows match the new mapping.
--
-- Idempotency: the UPDATE only touches rows whose value is one of the ordinal
-- digits ('0'..'4'); names, NULLs and any other values are left untouched, so
-- re-running is a no-op.

-- previous_status (NOT NULL)
UPDATE incident_history
SET previous_status = CASE previous_status
        WHEN '0' THEN 'DECLARED'
        WHEN '1' THEN 'CLAIMED'
        WHEN '2' THEN 'IN_PROGRESS'
        WHEN '3' THEN 'RESOLVED'
        WHEN '4' THEN 'NON_RESOLVED'
        ELSE previous_status
    END
WHERE previous_status IN ('0', '1', '2', '3', '4');

-- current_status (nullable)
UPDATE incident_history
SET current_status = CASE current_status
        WHEN '0' THEN 'DECLARED'
        WHEN '1' THEN 'CLAIMED'
        WHEN '2' THEN 'IN_PROGRESS'
        WHEN '3' THEN 'RESOLVED'
        WHEN '4' THEN 'NON_RESOLVED'
        ELSE current_status
    END
WHERE current_status IN ('0', '1', '2', '3', '4');
