package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateUserRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank String password,
        @Min(0) int matricule,
        @NotNull UserRole role,
        Long departmentId,
        /**
         * Login identifier for ADMIN accounts (mandatory, enforced in
         * {@code UserServiceImpl.createUser}). Null/blank for the passwordless
         * or matricule-based roles. {@code @Email} tolerates null.
         */
        @Email(message = "Adresse email invalide")
        String email
) {}
