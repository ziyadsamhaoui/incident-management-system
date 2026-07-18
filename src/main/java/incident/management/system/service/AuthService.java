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

// Encapsulate the dual-track password reset logic (Track A, Track B, Track C)

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

    //  Track A: No-Email, Manual Token Loop (CHEF_ATELIER)
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

    //  Track B: Email Loop (ADMIN)
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

        // Async email dispatcher stub, in production replace with a real email service (Spring Mail)
        dispatchPasswordResetEmailAsync(email, token);

        log.info("Email password reset token generated for user {} (email: {})", user.getId(), email);
        return token;
    }

    //  Track C: Unified Confirmation
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

    //  Helpers
    private void invalidateExistingTokens(Long userId) {
        passwordResetTokenRepository.findByUserIdAndUsedFalse(userId)
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    passwordResetTokenRepository.save(existing);
                });
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


    private void dispatchPasswordResetEmailAsync(String email, String token) {
        log.info("[EMAIL STUB] --- Password reset link for {} ---", email);
        log.info("[EMAIL STUB] Token: {}", token);
        log.info("[EMAIL STUB] Expires in: {} minutes", EMAIL_TOKEN_EXPIRY_MINUTES);
        log.info("[EMAIL STUB] Reset URL: http://localhost:4200/auth/reset-password?token={}", token);
        log.info("[EMAIL STUB] --- End of email ---");
    }
}
