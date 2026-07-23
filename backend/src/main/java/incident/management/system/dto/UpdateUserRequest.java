package incident.management.system.dto;

import incident.management.system.enums.UserRole;

public record UpdateUserRequest(
        String firstName,
        String lastName,
        UserRole role,
        Long departmentId
) {}
