package incident.management.system.dto;

public record StationResponse(
        Long id,
        String code,
        int rowIndex,
        int lineIndex,
        boolean isWorking,
        Long productionLineId
) {}
