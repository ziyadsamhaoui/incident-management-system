package incident.management.system.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "User role. ADMIN authenticates by email; CHEF_ATELIER and SOUS_CHEF by matricule "
        + "(SOUS_CHEF is passwordless).")
public enum UserRole {
    ADMIN,
    CHEF_ATELIER,
    SOUS_CHEF
}
