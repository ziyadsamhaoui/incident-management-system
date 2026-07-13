package incident.management.system.service;

import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.PasswordResetToken;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Encapsulates the dual-track password reset lifecycle:
 * <ul>
 *   <li><b>Manual Token Loop</b> — for CHEF_ATELIER &amp; floor staff; short
 *       alphanumeric code returned inline so a manager can display it.</li>
 *   <li><b>Corporate Email Loop</b> — for ADMIN; secure UUID token dispatched
 *       via a background async email stub.</li>
 *   <li><b>Unified Confirmation</b> — validates token expiry/integrity,
 *       BCrypt-hashes the new password, and invalidates the token atomically.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;

    private static final int MANUAL_TOKEN_LENGTH = 6;
    private static final int MANUAL_TOKEN_EXPIRY_MINUTES = 15;
    private static final int EMAIL_TOKEN_EXPIRY_MINUTES = 10;

    private static final String ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars (0/O, 1/I)

    // ──────────────────────────────────────────────
    //  Track A: No-Email Manual Token Loop
    //  (For CHEF_ATELIER & floor staff)
    // ──────────────────────────────────────────────

    /**
     * Generates a short (6-char) alphanumeric reset token with a 15-minute
     * expiry. Invalidates any prior unused token for the same user. Returns
     * the raw token string so it can be rendered on a manager dashboard.
     */
    public String requestPasswordResetManual(int matricule) {
        UserEntity user = userRepository.findByMatricule(matricule)
                .orElseThrow(() -> new ResourceNotFoundException("User", "matricule", matricule));

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

    // ──────────────────────────────────────────────
    //  Track B: Corporate Email Loop
    //  (For ADMIN)
    // ──────────────────────────────────────────────

    /**
     * Generates a secure UUID-based reset token with a 10-minute expiry for
     * the ADMIN identified by their corporate email. The token is delegated
     * to a background asynchronous email dispatcher stub.
     *
     * @return the generated secure token (for testing/debug purposes)
     */
    public String requestPasswordResetEmail(String email) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        invalidateExistingTokens(user.getId());

        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiryDate(LocalDateTime.now().plusMinutes(EMAIL_TOKEN_EXPIRY_MINUTES))
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);

        // Async email dispatcher stub — in production, replace with a real
        // email service call (e.g. Spring Mail + Thymeleaf template).
        dispatchPasswordResetEmailAsync(email, token);

        log.info("Email password reset token generated for user {} (email: {})", user.getId(), email);
        return token;
    }

    // ──────────────────────────────────────────────
    //  Track C: Unified Confirmation
    // ──────────────────────────────────────────────

    /**
     * Validates the supplied token (regardless of origin track), BCrypt-hashes
     * the new password, persists the hash on the target user record, and
     * atomically invalidates the token so it cannot be reused.
     */
    public void confirmPasswordReset(String token, String newPassword) {
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
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    private void invalidateExistingTokens(Long userId) {
        passwordResetTokenRepository.findByUserIdAndUsedFalse(userId)
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    passwordResetTokenRepository.save(existing);
                });
    }

    /**
     * Generates a short alphanumeric token using a cryptographically secure
     * random source. The character set excludes visually confusable characters
     * (0/O, 1/I) for dashboard readability.
     */
    private String generateManualToken() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(MANUAL_TOKEN_LENGTH);
        for (int i = 0; i < MANUAL_TOKEN_LENGTH; i++) {
            sb.append(ALPHANUMERIC.charAt(random.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }

    /**
     * Stub for asynchronous email dispatch. In a production environment this
     * would publish an {@link org.springframework.context.ApplicationEvent} or
     * invoke a {@link org.springframework.scheduling.annotation.Async} method
     * to send an email via SMTP.
     */
    private void dispatchPasswordResetEmailAsync(String email, String token) {
        log.info("[EMAIL STUB] --- Password reset link for {} ---", email);
        log.info("[EMAIL STUB] Token: {}", token);
        log.info("[EMAIL STUB] Expires in: {} minutes", EMAIL_TOKEN_EXPIRY_MINUTES);
        log.info("[EMAIL STUB] Reset URL: http://localhost:4200/auth/reset-password?token={}", token);
        log.info("[EMAIL STUB] --- End of email ---");
    }
}
