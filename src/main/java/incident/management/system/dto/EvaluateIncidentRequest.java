package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;
import jakarta.validation.constraints.NotNull;

public record EvaluateIncidentRequest(
        @NotNull IncidentStatus status,
        String note
) {}
