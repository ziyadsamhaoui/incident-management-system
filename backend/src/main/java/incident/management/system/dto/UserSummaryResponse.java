package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Compact user reference embedded in incident/history/attachment payloads.")
public record UserSummaryResponse(
        @Schema(description = "User primary key", example = "42")
        Long id,
        @Schema(description = "First name", example = "Yassine")
        String firstName,
        @Schema(description = "Last name", example = "El Amrani")
        String lastName,
        @Schema(description = "Employee matricule", example = "1024")
        int matricule
) {}
