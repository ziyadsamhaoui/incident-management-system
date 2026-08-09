package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Audit-log entry exposed on the admin user detail page ("piste d'audit").
 * <p>
 * {@code actorName} is resolved server-side from {@code actor_user_id} so the
 * UI can render copy such as {@code "Code de réinitialisation généré par
 * [actorName] le [createdAt]"} without joining users itself.
 */
@Schema(description = "Audit-log entry (e.g. 'Code de réinitialisation généré par [actor] le [date]').")
public record AuditLogResponse(
        @Schema(description = "Audit entry primary key", example = "9001")
        Long id,
        @Schema(description = "Audit action code", example = "GENERATE_RESET_CODE")
        String action,
        @Schema(description = "Acting user full name (resolved server-side)", example = "Admin Système")
        String actorName,
        @Schema(description = "Additional audit details", example = "Code de réinitialisation généré")
        String details,
        @Schema(description = "Entry timestamp", example = "2026-08-09T14:30:00")
        LocalDateTime createdAt
) {}
