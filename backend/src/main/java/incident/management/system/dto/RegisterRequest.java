package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Le matricule est requis")
        String matricule,

        @NotBlank(message = "Le nom complet est requis")
        String fullName,

        @Email(message = "Adresse email invalide")
        @NotBlank(message = "L'email est requis")
        String email,

        @NotBlank(message = "Le mot de passe est requis")
        @Size(min = 4, message = "Le mot de passe doit contenir au moins 4 caractères")
        String password,

        @NotNull(message = "Le rôle est requis")
        UserRole role
) {}
