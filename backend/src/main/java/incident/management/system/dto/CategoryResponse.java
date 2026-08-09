package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Incident category reference data.")
public record CategoryResponse(
        @Schema(description = "Category primary key", example = "5")
        Long id,
        @Schema(description = "Category name", example = "Mécanique")
        String name
) {}
