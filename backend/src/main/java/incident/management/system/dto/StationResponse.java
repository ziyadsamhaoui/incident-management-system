package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Station reference data — a position inside a production line.")
public record StationResponse(
        @Schema(description = "Station primary key", example = "17")
        Long id,
        @Schema(description = "Station code", example = "STN_12")
        String code,
        @Schema(description = "Row index in the grid layout", example = "0")
        int rowIndex,
        @Schema(description = "Line index in the grid layout", example = "1")
        int lineIndex,
        @Schema(description = "Whether the station is currently working", example = "true")
        boolean isWorking,
        @Schema(description = "Owning production line id", example = "11")
        Long productionLineId
) {}
