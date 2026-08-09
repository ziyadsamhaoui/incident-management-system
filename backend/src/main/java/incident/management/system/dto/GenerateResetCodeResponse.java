package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Response of {@code POST /api/admin/users/{id}/generate-reset-code}.
 * <p>
 * The {@code code} is the plaintext 6-character code intended for in-person
 * handoff to the employee. Only the SHA-256 hash of the code is persisted
 * (see {@code users.claim_code_hash}) — never the plaintext.
 */
@Schema(description = "Admin-issued password-reset code — the plaintext 6-character code is returned exactly "
        + "once for in-person handoff; only its SHA-256 hash is persisted.")
public record GenerateResetCodeResponse(
        @Schema(description = "Plaintext single-use reset code (unambiguous alphabet)",
                example = "K4M7PQ")
        String code,
        @Schema(description = "Code expiry — 15 minutes after issuance", example = "2026-08-09T14:30:00")
        LocalDateTime expiresAt
) {}
