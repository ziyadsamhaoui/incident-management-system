package incident.management.system.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Bulk media deletion payload ({@code POST /api/admin/media/bulk-delete}).
 * The API works with the numeric {@code incident_attachments.id} (BIGSERIAL) —
 * this codebase has no attachment UUID column.
 */
public record MediaBulkDeleteRequest(
        @NotEmpty(message = "La liste des fichiers est obligatoire.") List<Long> ids
) {
}
