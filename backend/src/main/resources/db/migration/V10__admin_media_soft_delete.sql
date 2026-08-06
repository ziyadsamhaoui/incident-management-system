-- -----------------------------------------------------------------------------
-- V10: Admin media management — soft-delete stubs + admin list indexes
-- -----------------------------------------------------------------------------

ALTER TABLE incident_attachments
    ADD COLUMN is_deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at     TIMESTAMP,
    ADD COLUMN deletion_audit VARCHAR(255);

-- object_key becomes nullable: soft-deleted stubs lose their file pointer.
ALTER TABLE incident_attachments ALTER COLUMN object_key DROP NOT NULL;

-- Admin media list (filtered by type, ordered by size/date).
CREATE INDEX idx_attachment_admin_list ON incident_attachments(file_type, uploaded_at DESC, is_deleted);

-- Bulk stats: SUM(file_size_bytes) per type over non-deleted rows.
CREATE INDEX idx_attachment_stats ON incident_attachments(file_type, file_size_bytes) WHERE is_deleted = FALSE;
