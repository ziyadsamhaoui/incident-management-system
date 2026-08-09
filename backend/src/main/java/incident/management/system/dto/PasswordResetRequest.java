package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Self-service password-reset request (identity bar): all three fields must exactly "
        + "match an active, claimed CHEF_ATELIER record.")
public record PasswordResetRequest(
        @Min(value = 1, message = "Matricule must be a positive number")
        @Schema(description = "Employee matricule", example = "1024",
                requiredMode = Schema.RequiredMode.REQUIRED)
        int matricule,

        @NotBlank(message = "FirstName must not be blank")
        @Schema(description = "First name", example = "Yassine",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String firstName,

        @NotBlank(message = "LastName must not be blank")
        @Schema(description = "Last name", example = "El Amrani",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String lastName
) {}
