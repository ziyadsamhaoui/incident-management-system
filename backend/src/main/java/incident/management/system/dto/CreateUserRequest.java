package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "User-creation payload. ADMIN accounts require a unique, valid email (login "
        + "identifier); CHEF_ATELIER/SOUS_CHEF authenticate by matricule.")
public record CreateUserRequest(
        @NotBlank
        @Schema(description = "First name", example = "Yassine", requiredMode = Schema.RequiredMode.REQUIRED)
        String firstName,
        @NotBlank
        @Schema(description = "Last name", example = "El Amrani", requiredMode = Schema.RequiredMode.REQUIRED)
        String lastName,
        @NotBlank
        @Schema(description = "Initial password (min 8 chars enforced at claim/use)", example = "S3cret!Pass",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String password,
        @Min(0)
        @Schema(description = "Employee matricule — unique across the system", example = "1024",
                requiredMode = Schema.RequiredMode.REQUIRED)
        int matricule,
        @NotNull
        @Schema(description = "Role — ADMIN, CHEF_ATELIER or SOUS_CHEF", example = "SOUS_CHEF",
                requiredMode = Schema.RequiredMode.REQUIRED)
        UserRole role,
        @Schema(description = "Department assignment (optional at creation)", example = "3")
        Long departmentId,
        /**
         * Login identifier for ADMIN accounts (mandatory, enforced in
         * {@code UserServiceImpl.createUser}). Null/blank for the passwordless
         * or matricule-based roles. {@code @Email} tolerates null.
         */
        @Email(message = "Adresse email invalide")
        @Schema(description = "Login email — mandatory for ADMIN, null for other roles",
                example = "yassine.elamrani@icgl.ma")
        String email
) {}
