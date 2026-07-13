package incident.management.system.controller;

import incident.management.system.config.JwtService;
import incident.management.system.dto.*;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.PasswordResetToken;
import incident.management.system.model.RefreshTokenEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.RefreshTokenRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.TokenBlacklistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final PasswordEncoder passwordEncoder;

    // ──────────────────────────────────────────────
    //  Login (dual-token issuance + lockout tracking)
    // ──────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request) {

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            String.valueOf(request.matricule()),
                            request.password()));

            // Successful login — reset any lockout state
            UserEntity user = userRepository.findByMatricule(request.matricule())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "matricule", request.matricule()));
            user.resetFailedAttempts();
            userRepository.save(user);

            // Issue access token (JWT) + persist opaque refresh token (UUID)
            String accessToken = jwtService.generateAccessToken(authentication);

            // Persist refresh token
            RefreshTokenEntity refreshTokenEntity = RefreshTokenEntity.builder()
                    .userId(user.getId())
                    .token(UUID.randomUUID().toString())
                    .expiryDate(LocalDateTime.now().plusDays(7))  // 7-day DB persistence
                    .revoked(false)
                    .build();
            refreshTokenRepository.save(refreshTokenEntity);

            int matricule = Integer.parseInt(authentication.getName());
            List<String> roles = authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toList());

            JwtAuthenticationResponse response = new JwtAuthenticationResponse(
                    accessToken, refreshTokenEntity.getToken(), matricule, roles);

            return ResponseEntity.ok(response);

        } catch (LockedException e) {
            log.warn("Locked account login attempt for matricule: {}", request.matricule());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account is locked. Try again later."));

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt for matricule: {}", request.matricule());

            // Track failed attempt
            userRepository.findByMatricule(request.matricule()).ifPresent(user -> {
                user.incrementFailedAttempts();
                userRepository.save(user);
                if (user.isLocked()) {
                    log.warn("Account locked for matricule: {} due to 5 failed attempts", request.matricule());
                }
            });

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }
    }

    // ──────────────────────────────────────────────
    //  Refresh token
    // ──────────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(@RequestBody Map<String, String> body) {
        String refreshTokenValue = body.get("refreshToken");
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "refreshToken is required"));
        }

        RefreshTokenEntity storedToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElse(null);

        if (storedToken == null || !storedToken.isValid()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired refresh token"));
        }

        UserEntity user = userRepository.findById(storedToken.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", storedToken.getUserId()));

        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "User account is deactivated"));
        }

        // Build a lightweight Authentication for token generation
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                String.valueOf(user.getMatricule()),
                null,
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                        "ROLE_" + user.getRole().name())));

        String newAccessToken = jwtService.generateAccessToken(authentication);

        return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken,
                "type", "Bearer"));
    }

    // ──────────────────────────────────────────────
    //  Logout (blacklist access token)
    // ──────────────────────────────────────────────

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader("Authorization") String authHeader) {

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            tokenBlacklistService.blacklist(accessToken);
        }

        return ResponseEntity.ok(Map.of("message", "Successfully logged out"));
    }

    // ──────────────────────────────────────────────
    //  Password Reset
    // ──────────────────────────────────────────────

    @PostMapping("/password-reset/request")
    public ResponseEntity<Map<String, Object>> requestPasswordReset(
            @Valid @RequestBody PasswordResetRequest request) {

        UserEntity user = userRepository.findByMatricule(request.matricule())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User", "matricule", request.matricule()));

        passwordResetTokenRepository.findByUserIdAndUsedFalse(user.getId())
                .ifPresent(existing -> {
                    existing.setUsed(true);
                    passwordResetTokenRepository.save(existing);
                });

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(user.getId())
                .token(UUID.randomUUID().toString())
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);

        return ResponseEntity.ok(Map.of(
                "message", "Password reset token generated. Use this token to reset your password.",
                "token", resetToken.getToken(),
                "expiresInMinutes", 15));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Map<String, String>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request) {

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByToken(request.token())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token"));

        if (!resetToken.isValid()) {
            throw new IllegalArgumentException("Reset token has expired or has already been used");
        }

        UserEntity user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", resetToken.getUserId()));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        return ResponseEntity.ok(Map.of("message", "Password has been successfully reset"));
    }
}
