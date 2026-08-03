-- V5__password_reset_hardening.sql
-- Flyway Incremental Migration: Password-Reset Security Hardening
--
-- Adds the supervisor-mediated reset-code state machine (admin generates a
-- 6-character code whose SHA-256 hash is persisted with a strict 15-minute
-- TTL — never the plaintext code) and a general system audit log used to
-- record administrative security actions (e.g. GENERATE_RESET_CODE).

-- STEP 1: Users — supervisor-mediated claim code (hashed, 15-minute TTL)
ALTER TABLE users
    ADD COLUMN claim_code_hash VARCHAR(64);

ALTER TABLE users
    ADD COLUMN claim_code_expires_at TIMESTAMP;

-- Partial index so lookups only scan rows that currently hold an active code.
CREATE INDEX idx_users_claim_code_hash
    ON users(claim_code_hash)
    WHERE claim_code_hash IS NOT NULL;

-- STEP 2: System audit log
CREATE TABLE audit_logs (
    id             BIGSERIAL   PRIMARY KEY,
    action         VARCHAR(64) NOT NULL,
    actor_user_id  BIGINT      REFERENCES users(id),
    target_user_id BIGINT      REFERENCES users(id),
    details        VARCHAR(500),
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor  ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
