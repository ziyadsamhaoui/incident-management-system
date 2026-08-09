package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Terminal evaluation payload: outcome status (RESOLVED or NON_RESOLVED) plus an "
        + "optional resolution note.")
public record EvaluateIncidentRequest(
        @NotNull
        @Schema(description = "Outcome — RESOLVED or NON_RESOLVED", example = "RESOLVED",
                requiredMode = Schema.RequiredMode.REQUIRED)
        IncidentStatus status,

        @Schema(description = "Resolution note recorded on the incident (optional)",
                example = "Courroie remplacée, ligne relancée")
        String note
) {}
