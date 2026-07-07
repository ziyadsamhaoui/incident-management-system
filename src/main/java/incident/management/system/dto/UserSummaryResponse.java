package incident.management.system.dto;

public record UserSummaryResponse(
        Long id,
        String firstName,
        String lastName,
        int matricule
) {}
