package incident.management.system.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetRequest(
        @Min(value = 1, message = "Matricule must be a positive number")
        int matricule,

        @NotBlank(message = "FirstName must not be blank")
        String firstName,

        @NotBlank(message = "LastName must not be blank")
        String lastName
) {}
