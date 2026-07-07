package incident.management.system.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        Long incidentId,
        String incidentReference,
        String message,
        boolean isRead,
        String type,
        LocalDateTime createdAt
) {}
