package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Multi-channel login payload — the controller selects the lane from the filled fields: "
        + "ADMIN → email+password; CHEF_ATELIER → matricule+firstName+lastName+password; "
        + "SOUS_CHEF → matricule+firstName+lastName (passwordless).")
public record LoginRequest(
        @Schema(description = "Employee matricule (CHEF_ATELIER / SOUS_CHEF lanes)", example = "1024")
        String matricule,
        @Schema(description = "Login email (ADMIN lane only)", example = "admin@icgl.ma")
        String email,
        @Schema(description = "Password — absent for the passwordless SOUS_CHEF lane", example = "S3cret!Pass")
        String password,
        @Schema(description = "First name, part of the identity bar for CHEF_ATELIER / SOUS_CHEF lanes", example = "Yassine")
        String firstName,
        @Schema(description = "Last name, part of the identity bar for CHEF_ATELIER / SOUS_CHEF lanes", example = "El Amrani")
        String lastName
) {}
