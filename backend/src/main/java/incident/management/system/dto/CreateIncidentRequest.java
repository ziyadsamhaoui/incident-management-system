package incident.management.system.dto;

import incident.management.system.enums.IncidentPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Incident declaration payload. The description is optional — photo-only declarations "
        + "are allowed. Send the X-Idempotency-Key header to make the creation idempotent.")
public record CreateIncidentRequest(
        @NotNull
        @Schema(description = "Declaring user id", example = "42", requiredMode = Schema.RequiredMode.REQUIRED)
        Long userId,

        @NotNull
        @Schema(description = "Department where the incident occurred", example = "3",
                requiredMode = Schema.RequiredMode.REQUIRED)
        Long departmentId,

        @NotNull
        @Schema(description = "Affected station id", example = "17", requiredMode = Schema.RequiredMode.REQUIRED)
        Long stationId,

        @NotNull
        @Schema(description = "Incident category id", example = "5", requiredMode = Schema.RequiredMode.REQUIRED)
        Long categoryId,

        @NotNull
        @Schema(description = "Priority — LOW, MEDIUM, HIGH or CRITICAL", example = "HIGH",
                requiredMode = Schema.RequiredMode.REQUIRED)
        IncidentPriority priority,

        @Size(max = 2000)
        @Schema(description = "Optional free-text description (max 2000 chars)", maxLength = 2000,
                example = "Courroie de convoyeur désalignée sur la ligne 2")
        String description
) {}
