-- V2__refactor_and_audit_schema.sql
-- Flyway Incremental Migration: Incident Lifecycle Refactor


-- STEP 1: Rename assigned_to_id → claimed_by_id on incidents
ALTER TABLE incidents
    RENAME COLUMN assigned_to_id TO claimed_by_id;

-- STEP 2: Rename assigned_at → claimed_at on incidents
ALTER TABLE incidents
    RENAME COLUMN assigned_at TO claimed_at;

-- STEP 3: Add resolution_note (evaluation feedback, varchar 1000)
ALTER TABLE incidents
    ADD COLUMN resolution_note VARCHAR(1000);

-- STEP 4: Add resolved_by_id (FK → users) — tracks who performed evaluation
ALTER TABLE incidents
    ADD COLUMN resolved_by_id BIGINT REFERENCES users(id);

CREATE INDEX idx_incidents_resolved_by ON incidents(resolved_by_id);

-- STEP 5: Create admin_department_subscriptions junction table
-- Maps ADMIN users to departments they wish to monitor for notifications.
-- Unique constraint prevents duplicate subscriptions.
CREATE TABLE admin_department_subscriptions (
    id              BIGSERIAL   PRIMARY KEY,
    admin_id        BIGINT      NOT NULL REFERENCES users(id),
    department_id   BIGINT      NOT NULL REFERENCES departments(id)
);

CREATE UNIQUE INDEX idx_admin_dept_subscription_unique
    ON admin_department_subscriptions(admin_id, department_id);

CREATE INDEX idx_admin_dept_subscription_admin
    ON admin_department_subscriptions(admin_id);

CREATE INDEX idx_admin_dept_subscription_department
    ON admin_department_subscriptions(department_id);
