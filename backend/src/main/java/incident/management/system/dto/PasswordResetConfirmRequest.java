package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Password-reset confirmation: a manual token, legacy email token or admin-issued "
        + "6-character claim code plus the new password.")
public record PasswordResetConfirmRequest(
        @NotBlank(message = "Reset token must not be blank")
        @Schema(description = "Token from the self-service flow, email deep link, or admin-issued claim code",
                example = "AB2CD3", requiredMode = Schema.RequiredMode.REQUIRED)
        String token,

        @NotBlank(message = "New password must not be blank")
        @Size(min = 8, message = "New password must be at least 8 characters")
        @Schema(description = "New password — minimum 8 characters", example = "S3cret!Pass",
                minLength = 8, requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {}
