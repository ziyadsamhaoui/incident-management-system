package incident.management.system.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClaimAccountRequest(
        @NotBlank(message = "Le matricule est requis")
        String matricule,

        @NotBlank(message = "Le prénom est requis")
        String firstName,

        @NotBlank(message = "Le nom est requis")
        String lastName,

        @NotBlank(message = "Le mot de passe est requis")
        @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
        String newPassword
) {}
