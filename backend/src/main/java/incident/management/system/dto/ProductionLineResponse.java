package incident.management.system.dto;

public record ProductionLineResponse(
        Long id,
        String name,
        SectionResponse section
) {}
