package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Legacy public self-registration payload — superseded by the account-claim
 * flow ({@link ClaimAccountRequest}); retained for compatibility.
 */
@Schema(description = "Legacy public registration payload — superseded by POST /api/auth/claim.",
        deprecated = true)
public record RegisterRequest(
        @NotBlank(message = "Le matricule est requis")
        @Schema(description = "Employee matricule", example = "1024",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String matricule,

        @NotBlank(message = "Le nom complet est requis")
        @Schema(description = "Full name", example = "Yassine El Amrani",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String fullName,

        @Email(message = "Adresse email invalide")
        @NotBlank(message = "L'email est requis")
        @Schema(description = "Email address", example = "yassine.elamrani@icgl.ma",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String email,

        @NotBlank(message = "Le mot de passe est requis")
        @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
        @Schema(description = "Password — minimum 8 characters", example = "S3cret!Pass",
                minLength = 8, requiredMode = Schema.RequiredMode.REQUIRED)
        String password,

        @NotNull(message = "Le rôle est requis")
        @Schema(description = "Requested role", example = "SOUS_CHEF",
                requiredMode = Schema.RequiredMode.REQUIRED)
        UserRole role
) {}
