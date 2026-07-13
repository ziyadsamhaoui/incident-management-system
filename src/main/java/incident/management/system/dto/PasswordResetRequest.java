package incident.management.system.dto;

import jakarta.validation.constraints.Min;

public record PasswordResetRequest(
        @Min(value = 1, message = "Matricule must be a positive number")
        int matricule
) {}
