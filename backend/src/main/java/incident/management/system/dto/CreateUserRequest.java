package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateUserRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank String password,
        @Min(0) int matricule,
        @NotNull UserRole role,
        Long departmentId
) {}
