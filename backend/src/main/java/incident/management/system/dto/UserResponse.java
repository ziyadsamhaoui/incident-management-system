package incident.management.system.dto;

import incident.management.system.enums.UserRole;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String firstName,
        String lastName,
        int matricule,
        /**
         * Canonical (lowercased) login email — populated only for ADMIN
         * accounts, {@code null} for matricule-authenticated roles.
         */
        String email,
        boolean isActive,
        UserRole role,
        DepartmentResponse department,
        LocalDateTime createdAt,
        /**
         * True when the account has a password set (i.e. the account was
         * claimed). False for promoted CHEF_ATELIER accounts awaiting the
         * claim flow — rendered as "En attente" in the admin surface.
         * Derived from the (never-exposed) {@code passwordHash} sentinel.
         */
        boolean claimed
) {}
