package incident.management.system.dto;


public record LoginRequest(
        String matricule,
        String email,
        String password,
        String firstName,
        String lastName
) {}
