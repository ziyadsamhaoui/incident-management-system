package incident.management.system.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @Min(value = 1, message = "Matricule must be a positive number")
        int matricule,

        @NotBlank(message = "Password must not be blank")
        String password
) {}
