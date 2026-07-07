package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String firstName,
        String lastName,
        int matricule,
        boolean isActive,
        UserRole role,
        DepartmentResponse department,
        LocalDateTime createdAt
) {}
