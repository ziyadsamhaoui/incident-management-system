package incident.management.system.dto;

import incident.management.system.enums.IncidentPriority;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateIncidentRequest(
        @NotNull Long userId,
        @NotNull Long departmentId,
        @NotNull Long stationId,
        @NotNull Long categoryId,
        @NotNull IncidentPriority priority,
        // Description is OPTIONAL — the incidents.description column is nullable and
        // operators may declare without a free-text note (photo-only declarations).
        @Size(max = 2000) String description
) {}
