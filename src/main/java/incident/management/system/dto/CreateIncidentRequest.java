package incident.management.system.dto;

import incident.management.system.enums.IncidentPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateIncidentRequest(
        @NotNull Long userId,
        @NotNull Long departmentId,
        @NotNull Long stationId,
        @NotNull Long categoryId,
        @NotNull IncidentPriority priority,
        @NotBlank String description
) {}
