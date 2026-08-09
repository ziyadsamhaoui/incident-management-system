package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Production line reference data (child of a section).")
public record ProductionLineResponse(
        @Schema(description = "Production line primary key", example = "11")
        Long id,
        @Schema(description = "Production line name", example = "Montage M2")
        String name,
        @Schema(description = "Parent section")
        SectionResponse section
) {}
