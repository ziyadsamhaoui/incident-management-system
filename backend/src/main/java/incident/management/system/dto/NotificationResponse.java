package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "In-app notification read model.")
public record NotificationResponse(
        @Schema(description = "Notification primary key", example = "301")
        Long id,
        @Schema(description = "Related incident id (nullable)", example = "1042")
        Long incidentId,
        @Schema(description = "Related incident reference (nullable)", example = "INC-2026-0042")
        String incidentReference,
        @Schema(description = "Notification message", example = "Nouvel incident déclaré dans votre département")
        String message,
        @Schema(description = "Whether the notification has been read", example = "false")
        boolean isRead,
        @Schema(description = "Notification type", example = "INCIDENT_DECLARED")
        String type,
        @Schema(description = "Creation timestamp", example = "2026-08-09T08:16:00")
        LocalDateTime createdAt
) {}
