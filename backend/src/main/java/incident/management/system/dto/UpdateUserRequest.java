package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Partial user update — only the fields present in the payload are changed.")
public record UpdateUserRequest(
        @Schema(description = "First name", example = "Yassine")
        String firstName,
        @Schema(description = "Last name", example = "El Amrani")
        String lastName,
        @Schema(description = "Role — ADMIN, CHEF_ATELIER or SOUS_CHEF", example = "CHEF_ATELIER")
        UserRole role,
        @Schema(description = "Department assignment", example = "3")
        Long departmentId
) {}
