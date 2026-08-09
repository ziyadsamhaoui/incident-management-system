package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Bulk media deletion payload ({@code POST /api/admin/media/bulk-delete}).
 * The API works with the numeric {@code incident_attachments.id} (BIGSERIAL) —
 * this codebase has no attachment UUID column.
 */
@Schema(description = "Bulk media deletion payload — a list of attachment ids (BIGSERIAL).")
public record MediaBulkDeleteRequest(
        @NotEmpty(message = "La liste des fichiers est obligatoire.")
        @Schema(description = "Attachment ids to delete (AUDIO ids are silently skipped)",
                example = "[812, 815, 820]", requiredMode = Schema.RequiredMode.REQUIRED)
        List<Long> ids
) {
}
