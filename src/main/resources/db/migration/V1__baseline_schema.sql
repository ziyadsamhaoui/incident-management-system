-- V1__baseline_schema.sql
-- Flyway Baseline Migration: Core Schema Snapshot (Pre-Refactor)


-- 1. REFERENCE TABLES (no foreign-key dependencies)

CREATE TABLE IF NOT EXISTS categories (
    id      BIGSERIAL    PRIMARY KEY,
    name    VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
    id      BIGSERIAL    PRIMARY KEY,
    name    VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id      BIGSERIAL    PRIMARY KEY,
    name    VARCHAR(255) NOT NULL
);

-- 2. HIERARCHICAL FACILITY STRUCTURE

CREATE TABLE IF NOT EXISTS production_lines (
    id           BIGSERIAL    PRIMARY KEY,
    section_id   BIGINT       REFERENCES sections(id),
    name         VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS stations (
    id                BIGSERIAL    PRIMARY KEY,
    production_line_id BIGINT      REFERENCES production_lines(id),
    code              VARCHAR(255) NOT NULL,
    row_index         INTEGER      NOT NULL,
    line_index        INTEGER      NOT NULL,
    is_working        BOOLEAN      NOT NULL DEFAULT TRUE
);

-- 3. CORE DOMAIN: USERS

CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL    PRIMARY KEY,
    first_name            VARCHAR(255) NOT NULL,
    last_name             VARCHAR(255) NOT NULL,
    email                 VARCHAR(255) UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    matricule             INTEGER      NOT NULL UNIQUE,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    role                  VARCHAR(20)  NOT NULL,
    department_id         BIGINT       REFERENCES departments(id),
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMP,
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    lockout_end           TIMESTAMP
);

CREATE INDEX idx_users_matricule ON users(matricule);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);

-- 4. CORE DOMAIN: INCIDENTS

CREATE TABLE IF NOT EXISTS incidents (
    id              BIGSERIAL       PRIMARY KEY,
    reference       VARCHAR(20)     NOT NULL UNIQUE,
    user_id         BIGINT          REFERENCES users(id),
    assigned_to_id  BIGINT          REFERENCES users(id),
    department_id   BIGINT          REFERENCES departments(id),
    station_id      BIGINT          REFERENCES stations(id),
    category_id     BIGINT          REFERENCES categories(id),
    priority        VARCHAR(20)     NOT NULL,
    status          VARCHAR(20)     NOT NULL,
    description     VARCHAR(2000),
    declared_at     TIMESTAMP       NOT NULL DEFAULT NOW(),
    assigned_at     TIMESTAMP,
    in_progress_at  TIMESTAMP,
    resolved_at     TIMESTAMP,
    closed_at       TIMESTAMP
);

CREATE INDEX idx_incidents_reference     ON incidents(reference);
CREATE INDEX idx_incidents_status        ON incidents(status);
CREATE INDEX idx_incidents_declared_at   ON incidents(declared_at);
CREATE INDEX idx_incidents_department_id ON incidents(department_id);
CREATE INDEX idx_incidents_user_id       ON incidents(user_id);
CREATE INDEX idx_incidents_assigned_to   ON incidents(assigned_to_id);

-- 5. CORE DOMAIN: INCIDENT HISTORY

CREATE TABLE IF NOT EXISTS incident_history (
    id               BIGSERIAL    PRIMARY KEY,
    incident_id      BIGINT       NOT NULL REFERENCES incidents(id),
    previous_status  VARCHAR(20)  NOT NULL,
    current_status   VARCHAR(20),
    changed_at       TIMESTAMP,
    comment          VARCHAR(255)
);

CREATE INDEX idx_incident_history_incident_id ON incident_history(incident_id);

-- 6. CORE DOMAIN: NOTIFICATIONS

CREATE TABLE IF NOT EXISTS notifications (
    id           BIGSERIAL    PRIMARY KEY,
    incident_id  BIGINT       REFERENCES incidents(id),
    user_id      BIGINT       REFERENCES users(id),
    message      VARCHAR(255) NOT NULL,
    is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
    type         VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);
CREATE INDEX idx_notifications_is_read     ON notifications(is_read);

-- 7. INFRASTRUCTURE: REFERENCE COUNTERS (Incident ID Generation)

CREATE TABLE IF NOT EXISTS reference_counters (
    date_key    VARCHAR(8) PRIMARY KEY,
    last_value  BIGINT     NOT NULL
);

-- 8. INFRASTRUCTURE: REFRESH TOKENS

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(36)  NOT NULL UNIQUE,
    expiry_date TIMESTAMP    NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token   ON refresh_tokens(token);

-- 9. INFRASTRUCTURE: PASSWORD RESET TOKENS

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(64)  NOT NULL UNIQUE,
    expiry_date TIMESTAMP    NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token   ON password_reset_tokens(token);
