package incident.management.system.dto;

import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import java.time.LocalDateTime;

public record IncidentResponse(
        Long id,
        String reference,
        UserSummaryResponse user,
        UserSummaryResponse assignedTo,
        UserSummaryResponse resolvedBy,
        DepartmentResponse department,
        StationResponse station,
        CategoryResponse category,
        IncidentPriority priority,
        IncidentStatus status,
        String description,
        String resolutionNote,
        LocalDateTime declaredAt,
        LocalDateTime claimedAt,
        LocalDateTime inProgressAt,
        LocalDateTime resolvedAt,
        LocalDateTime closedAt
) {}
