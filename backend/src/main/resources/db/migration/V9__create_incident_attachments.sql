-- -----------------------------------------------------------------------------
-- V9: Incident attachments (self-hosted local media pipeline)
--
-- Metadata only. Raw bytes live on the application host's filesystem under
-- `{app.media.storage-path}/{incidentId}/{uuid}.{ext}`; `object_key` stores the
-- server-generated relative path (never user input). PostgreSQL never stores
-- media payloads — original user filenames are kept here for display only.
--
-- Note: the reference schema used a UUID primary key, but this codebase uses
-- BIGSERIAL identities everywhere (incidents.id is BIGINT), so we stay with
-- BIGSERIAL for consistency with every other table and the existing
-- reference-based APIs.
-- -----------------------------------------------------------------------------

CREATE TABLE incident_attachments (
    id              BIGSERIAL PRIMARY KEY,
    incident_id     BIGINT       NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    object_key      VARCHAR(512) NOT NULL UNIQUE,
    file_name       VARCHAR(160) NOT NULL,
    file_type       VARCHAR(20)  NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT       NOT NULL,
    uploaded_by_id  BIGINT       REFERENCES users(id),
    uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_attachment_file_type CHECK (file_type IN ('IMAGE', 'VIDEO', 'AUDIO'))
);

CREATE INDEX idx_attachment_incident ON incident_attachments(incident_id);
