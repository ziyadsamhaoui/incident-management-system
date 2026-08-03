package incident.management.system.dto;

import java.time.LocalDateTime;

/**
 * Response of {@code POST /api/admin/users/{id}/generate-reset-code}.
 * <p>
 * The {@code code} is the plaintext 6-character code intended for in-person
 * handoff to the employee. Only the SHA-256 hash of the code is persisted
 * (see {@code users.claim_code_hash}) — never the plaintext.
 */
public record GenerateResetCodeResponse(
        String code,
        LocalDateTime expiresAt
) {}
