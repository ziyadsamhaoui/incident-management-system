package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Department reference data.")
public record DepartmentResponse(
        @Schema(description = "Department primary key", example = "3")
        Long id,
        @Schema(description = "Department name", example = "Montage")
        String name
) {}
