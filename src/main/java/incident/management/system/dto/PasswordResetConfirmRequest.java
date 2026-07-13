package incident.management.system.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank(message = "Reset token must not be blank")
        String token,

        @NotBlank(message = "New password must not be blank")
        @Size(min = 6, message = "New password must be at least 6 characters")
        String newPassword
) {}
