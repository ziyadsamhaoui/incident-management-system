package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Lightweight response for {@code GET /api/users/active-admin-count} — feeds
 * the last-active-admin guard on the admin surface.
 */
@Schema(description = "Number of active ADMIN accounts — feeds the last-active-admin guard on the UI.")
public record ActiveAdminCountResponse(
        @Schema(description = "Count of active ADMIN accounts", example = "2")
        long activeAdminCount
) {}
