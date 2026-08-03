package incident.management.system.dto;

import java.time.LocalDateTime;

/**
 * Audit-log entry exposed on the admin user detail page ("piste d'audit").
 * <p>
 * {@code actorName} is resolved server-side from {@code actor_user_id} so the
 * UI can render copy such as {@code "Code de réinitialisation généré par
 * [actorName] le [createdAt]"} without joining users itself.
 */
public record AuditLogResponse(
        Long id,
        String action,
        String actorName,
        String details,
        LocalDateTime createdAt
) {}
