package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateIncidentStatusRequest(
        @NotNull IncidentStatus status
) {}
