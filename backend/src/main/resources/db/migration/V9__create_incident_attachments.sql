-- V9: Incident attachments (self-hosted local media pipeline)

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
