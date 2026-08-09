package incident.management.system.dto;

import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "Full incident read model: actors, references, priority/status and the complete "
        + "state-machine timestamps.")
public record IncidentResponse(
        @Schema(description = "Incident primary key", example = "1042")
        Long id,
        @Schema(description = "Human-readable incident reference", example = "INC-2026-0042")
        String reference,
        @Schema(description = "Declaring user")
        UserSummaryResponse user,
        @Schema(description = "User who claimed the incident (null until CLAIMED)")
        UserSummaryResponse assignedTo,
        @Schema(description = "User who resolved/evaluated the incident (null until terminal)")
        UserSummaryResponse resolvedBy,
        @Schema(description = "Department")
        DepartmentResponse department,
        @Schema(description = "Affected station")
        StationResponse station,
        @Schema(description = "Category")
        CategoryResponse category,
        @Schema(description = "Priority — LOW, MEDIUM, HIGH or CRITICAL", example = "HIGH")
        IncidentPriority priority,
        @Schema(description = "Current state-machine status", example = "IN_PROGRESS")
        IncidentStatus status,
        @Schema(description = "Free-text description (nullable)", example = "Courroie de convoyeur désalignée")
        String description,
        @Schema(description = "Resolution note (nullable, set on evaluation)")
        String resolutionNote,
        @Schema(description = "Declaration timestamp", example = "2026-08-09T08:15:00")
        LocalDateTime declaredAt,
        @Schema(description = "Claim timestamp (nullable)", example = "2026-08-09T09:02:00")
        LocalDateTime claimedAt,
        @Schema(description = "In-progress timestamp (nullable)", example = "2026-08-09T09:20:00")
        LocalDateTime inProgressAt,
        @Schema(description = "Resolution timestamp (nullable)", example = "2026-08-09T10:45:00")
        LocalDateTime resolvedAt,
        @Schema(description = "Close timestamp (legacy, always null since auto-close removal)")
        LocalDateTime closedAt
) {}
