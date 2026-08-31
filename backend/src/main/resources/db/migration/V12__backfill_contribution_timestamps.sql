-- Claim and evaluation timestamps were previously marked non-updatable in the
-- JPA entity. Restore missing values from the immutable incident audit trail.
UPDATE incidents i
SET claimed_at = (
    SELECT MIN(h.changed_at)
    FROM incident_history h
    WHERE h.incident_id = i.id
      AND h.current_status = 'CLAIMED'
)
WHERE i.claimed_at IS NULL
  AND EXISTS (
      SELECT 1
      FROM incident_history h
      WHERE h.incident_id = i.id
        AND h.current_status = 'CLAIMED'
  );

UPDATE incidents i
SET resolved_at = (
    SELECT MIN(h.changed_at)
    FROM incident_history h
    WHERE h.incident_id = i.id
      AND h.current_status IN ('RESOLVED', 'NON_RESOLVED')
)
WHERE i.resolved_at IS NULL
  AND EXISTS (
      SELECT 1
      FROM incident_history h
      WHERE h.incident_id = i.id
        AND h.current_status IN ('RESOLVED', 'NON_RESOLVED')
  );
