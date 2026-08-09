package incident.management.system.dto;

import incident.management.system.enums.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "User read model: identity, role, activation and claim status, department.")
public record UserResponse(
        @Schema(description = "User primary key", example = "42")
        Long id,
        @Schema(description = "First name", example = "Yassine")
        String firstName,
        @Schema(description = "Last name", example = "El Amrani")
        String lastName,
        @Schema(description = "Employee matricule", example = "1024")
        int matricule,
        /**
         * Canonical (lowercased) login email — populated only for ADMIN
         * accounts, {@code null} for matricule-authenticated roles.
         */
        @Schema(description = "Login email — ADMIN accounts only (null for other roles)",
                example = "yassine.elamrani@icgl.ma")
        String email,
        @Schema(description = "Whether the account is active", example = "true")
        boolean isActive,
        @Schema(description = "Role — ADMIN, CHEF_ATELIER or SOUS_CHEF", example = "CHEF_ATELIER")
        UserRole role,
        @Schema(description = "Assigned department (nullable)")
        DepartmentResponse department,
        @Schema(description = "Account creation timestamp", example = "2026-07-01T10:00:00")
        LocalDateTime createdAt,
        /**
         * True when the account has a password set (i.e. the account was
         * claimed). False for promoted CHEF_ATELIER accounts awaiting the
         * claim flow — rendered as "En attente" in the admin surface.
         * Derived from the (never-exposed) {@code passwordHash} sentinel.
         */
        @Schema(description = "True when the account has a password set (claimed); false for promoted "
                + "CHEF_ATELIER accounts awaiting the claim flow", example = "false")
        boolean claimed
) {}
