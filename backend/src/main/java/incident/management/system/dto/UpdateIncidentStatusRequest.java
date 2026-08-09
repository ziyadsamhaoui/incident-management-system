package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Generic incident status update payload (state machine transitions).")
public record UpdateIncidentStatusRequest(
        @NotNull
        @Schema(description = "Target status — must respect the state machine (DECLARED → CLAIMED → "
                + "IN_PROGRESS → RESOLVED/NON_RESOLVED)", example = "CLAIMED",
                requiredMode = Schema.RequiredMode.REQUIRED)
        IncidentStatus status
) {}
