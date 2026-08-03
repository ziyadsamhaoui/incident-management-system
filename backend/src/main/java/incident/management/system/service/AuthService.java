package incident.management.system.service;

import incident.management.system.dto.GenerateResetCodeResponse;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.AuditLogEntity;
import incident.management.system.model.PasswordResetToken;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.AuditLogRepository;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.CurrentUserResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Encapsulates the dual-track password reset logic (Track A, Track B, Track C)
 * plus the supervisor-mediated reset-code flow introduced by the
 * authentication hardening:
 * <ul>
 *   <li><b>Track A (public manual):</b> {@code matricule + firstName + lastName}
 *       identity bar — exact, case-insensitive match against an active
 *       CHEF_ATELIER account. Any mismatch yields the generic
 *       {@code "Identifiants invalides"} to prevent identity enumeration.</li>
 *   <li><b>Supervisor-mediated (ADMIN):</b> an admin generates a 6-character
 *       code for in-person handoff. Only the SHA-256 hash of the code is
 *       persisted on the user with a strict 15-minute TTL, and the action is
 *       recorded in the system audit log ({@code GENERATE_RESET_CODE}).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * When {@code true} (dev default) the email dispatcher is a stub: the reset
     * deep-link is only logged server-side and the plaintext token is echoed
     * back in the response body for local testing. In production this MUST be
     * set to {@code false} and a real transactional mail provider (SES,
     * SendGrid, SMTP relay…) wired in — the token then travels by email only.
     */
    @Value("${app.mail.stub-mode:true}")
    private boolean mailStubMode = true; // Java-side default: unit tests bypass Spring property injection

    private static final int MANUAL_TOKEN_LENGTH = 6;
    private static final int MANUAL_TOKEN_EXPIRY_MINUTES = 15;
    private static final int RESET_CODE_EXPIRY_MINUTES = 15;
    private static final int EMAIL_TOKEN_EXPIRY_MINUTES = 10;

    private static final String ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars (0/O, 1/I)

    /** Generic failure message — never reveals whether the identity matched. */
    private static final String INVALID_IDENTIFIERS = "Identifiants invalides";

    private static final String GENERATE_RESET_CODE_ACTION = "GENERATE_RESET_CODE";

    /** Neutral Track B notice — identical regardless of whether the email exists. */
    public static final String EMAIL_NEUTRAL_MESSAGE =
            "Si cette adresse est enregistrée, un lien de réinitialisation a été envoyé.";

    /**
     * Outcome of a Track B (email) reset request. The response shape is always
     * identical from the caller's perspective; {@code token} is only populated
     * in stub (dev) mode for a known address so the local developer can grab
     * the deep-link value without a real mailbox.
     */
    public record EmailResetResult(boolean userFound, String token) {}

    /**
     * Outcome of a unified reset confirmation — carries the user's role and
     * preferred login identifier so the UI can route to the correct login lane
     * with the field pre-filled (matricule for CHEF_ATELIER, email for ADMIN).
     */
    public record ResetConfirmation(UserRole role, String loginIdentifier) {}

    //  Track A: No-Email, Manual Token Loop (CHEF_ATELIER)
    public String requestPasswordResetManual(int matricule, String firstName, String lastName) {
        UserEntity user = userRepository.findByMatricule(matricule)
                .orElseThrow(() -> new IllegalArgumentException(INVALID_IDENTIFIERS));

        // Identity bar — must mirror the login threshold: active, claimed
        // CHEF_ATELIER whose first/last name match exactly (case-insensitive).
        if (!user.isActive()
                || user.getRole() != UserRole.CHEF_ATELIER
                || isUnclaimed(user)
                || !matchesIdentity(user, firstName, lastName)) {
            throw new IllegalArgumentException(INVALID_IDENTIFIERS);
        }

        invalidateExistingTokens(user.getId());

        String token = generateManualToken();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiryDate(LocalDateTime.now().plusMinutes(MANUAL_TOKEN_EXPIRY_MINUTES))
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);
        log.info("Manual password reset token generated for user {} (matricule: {})", user.getId(), matricule);

        return token;
    }

    //  Track B: Email Loop (ADMIN)
    //
    //  Anti-enumeration contract: this method NEVER throws when the address is
    //  unknown. The caller receives the same neutral result either way, so the
    //  HTTP layer can always answer with the same non-committal notice.
    public EmailResetResult requestPasswordResetEmail(String email) {
        Optional<UserEntity> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            log.info("Password reset email requested for an unknown address — responding neutrally.");
            return new EmailResetResult(false, null);
        }

        UserEntity user = userOpt.get();
        invalidateExistingTokens(user.getId());

        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiryDate(LocalDateTime.now().plusMinutes(EMAIL_TOKEN_EXPIRY_MINUTES))
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);

        // Async email dispatcher. In stub mode only the server logs the link;
        // in production this MUST dispatch via a transactional mail provider.
        dispatchPasswordResetEmail(email, token);

        log.info("Email password reset token generated for user {} (email: {})", user.getId(), email);
        return new EmailResetResult(true, mailStubMode ? token : null);
    }

    /**
     * Supervisor-mediated reset-code generation (ADMIN only — enforced at the
     * controller). Generates a secure 6-character alphanumeric code, persists
     * only its SHA-256 hash on the target user with a strict 15-minute TTL,
     * records a {@code GENERATE_RESET_CODE} audit entry, and returns the
     * plaintext code for in-person handoff to the employee.
     */
    public GenerateResetCodeResponse generateAdminResetCode(Long targetUserId) {
        UserEntity user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", targetUserId));

        // Only floor roles are eligible — never ADMIN. Target must be active.
        if (user.getRole() == UserRole.ADMIN || !user.isActive()) {
            throw new IllegalArgumentException(
                    "Impossible de générer un code de réinitialisation pour ce compte.");
        }

        // Single active code per user: any previously issued code is invalidated.
        user.setClaimCodeHash(null);
        user.setClaimCodeExpiresAt(null);

        String code = generateManualToken();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(RESET_CODE_EXPIRY_MINUTES);

        user.setClaimCodeHash(sha256Hex(code));
        user.setClaimCodeExpiresAt(expiresAt);
        userRepository.save(user);

        // System audit log: who generated the code, for whom, and until when.
        UserEntity actor = CurrentUserResolver.resolve(userRepository);
        auditLogRepository.save(AuditLogEntity.builder()
                .action(GENERATE_RESET_CODE_ACTION)
                .actorUserId(actor != null ? actor.getId() : null)
                .targetUserId(user.getId())
                .details("Reset code for " + user.getAuditLabel()
                        + " (expires " + expiresAt + ")")
                .build());

        log.info("Admin-mediated reset code generated for user {} (matricule: {})",
                user.getId(), user.getMatricule());

        return new GenerateResetCodeResponse(code, expiresAt);
    }

    //  Track C: Unified Confirmation
    public ResetConfirmation confirmPasswordReset(String token, String newPassword) {
        // Primary path: supervisor-mediated 6-char claim code (hashed on user).
        // Codes are uppercase; normalize the input for a deterministic match.
        String claimHash = sha256Hex(token.trim().toUpperCase(Locale.ROOT));
        Optional<UserEntity> claimUser =
                userRepository.findByClaimCodeHashAndClaimCodeExpiresAtAfter(claimHash, LocalDateTime.now());

        if (claimUser.isPresent()) {
            UserEntity user = claimUser.get();
            user.setPasswordHash(passwordEncoder.encode(newPassword));
            user.resetFailedAttempts();
            // The code is single-use — consume it after a successful reset.
            user.setClaimCodeHash(null);
            user.setClaimCodeExpiresAt(null);
            userRepository.save(user);
            log.info("Password reset confirmed via supervisor-mediated code for user {}", user.getId());
            return new ResetConfirmation(user.getRole(), loginIdentifier(user));
        }

        // Legacy path: Track A (manual) / Track B (email) tokens.
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token"));

        if (!resetToken.isValid()) {
            throw new IllegalArgumentException("Reset token has expired or has already been used");
        }

        UserEntity user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", resetToken.getUserId()));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.resetFailedAttempts();
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        log.info("Password reset confirmed for user {}", user.getId());
        return new ResetConfirmation(user.getRole(), loginIdentifier(user));
    }

    //  Helpers
    private void invalidateExistingTokens(Long userId) {
        passwordResetTokenRepository.findByUserIdAndUsedFalse(userId)
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    passwordResetTokenRepository.save(existing);
                });
    }

    private boolean matchesIdentity(UserEntity user, String firstName, String lastName) {
        return user.getFirstName().trim().equalsIgnoreCase(firstName.trim())
                && user.getLastName().trim().equalsIgnoreCase(lastName.trim());
    }

    private boolean isUnclaimed(UserEntity user) {
        return user.getPasswordHash() == null || user.getPasswordHash().isBlank();
    }

    // Generates a random alphanumeric string of length 6
    private String generateManualToken() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(MANUAL_TOKEN_LENGTH);
        for (int i = 0; i < MANUAL_TOKEN_LENGTH; i++) {
            sb.append(ALPHANUMERIC.charAt(random.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }

    // Deterministic SHA-256 hex hash — queryable by the confirm flow.
    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }

    private void dispatchPasswordResetEmail(String email, String token) {
        if (mailStubMode) {
            log.warn("[EMAIL STUB] --- Reset link for {} ---", email);
            log.warn("[EMAIL STUB] Token: {}", token);
            log.warn("[EMAIL STUB] Expires in: {} minutes", EMAIL_TOKEN_EXPIRY_MINUTES);
            log.warn("[EMAIL STUB] Reset URL: http://localhost:3000/auth/reset-password/confirm?token={}", token);
            log.warn("[EMAIL STUB] --- End of email ---");
            log.warn("[EMAIL STUB] app.mail.stub-mode=true — no email was actually sent. "
                    + "PRODUCTION BLOCKER: wire a transactional mail provider (SES / SendGrid / SMTP relay) "
                    + "and set app.mail.stub-mode=false before deployment.");
        } else {
            // Production hook — replace with the real transactional mail provider.
            log.info("Dispatch password-reset email to {} with 10-minute link", email);
        }
    }

    /** Preferred login identifier per role, used to pre-fill the login lane. */
    private static String loginIdentifier(UserEntity user) {
        return user.getRole() == UserRole.ADMIN
                ? user.getEmail()
                : String.valueOf(user.getMatricule());
    }
}
