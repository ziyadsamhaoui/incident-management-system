package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Self-service account claim for promoted-but-unclaimed CHEF_ATELIER accounts. "
        + "The firstName/lastName must match the roster record (case-insensitive).")
public record ClaimAccountRequest(
        @NotBlank(message = "Le matricule est requis")
        @Schema(description = "Employee matricule", example = "1024",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String matricule,

        @NotBlank(message = "Le prénom est requis")
        @Schema(description = "First name as recorded in the roster", example = "Yassine",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String firstName,

        @NotBlank(message = "Le nom est requis")
        @Schema(description = "Last name as recorded in the roster", example = "El Amrani",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String lastName,

        @NotBlank(message = "Le mot de passe est requis")
        @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
        @Schema(description = "New password — minimum 8 characters", example = "S3cret!Pass",
                minLength = 8, requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {}
