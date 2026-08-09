package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Section reference data (parent of production lines).")
public record SectionResponse(
        @Schema(description = "Section primary key", example = "2")
        Long id,
        @Schema(description = "Section name", example = "Ligne 2")
        String name
) {}
