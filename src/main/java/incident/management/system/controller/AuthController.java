package incident.management.system.controller;

import incident.management.system.config.JwtService;
import incident.management.system.dto.*;
import incident.management.system.enums.UserRole;
import incident.management.system.model.RefreshTokenEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.RefreshTokenRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.MultiChannelAuthenticationToken;
import incident.management.system.security.TokenBlacklistService;
import incident.management.system.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
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
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuthService authService;

    // ──────────────────────────────────────────────
    //  Multi-Channel Login
    // ──────────────────────────────────────────────

    /**
     * Unified login endpoint that auto-detects the operational channel from
     * the presence of specific fields in the {@link LoginRequest} payload.
     * <p>
     * <b>Lane detection rules:</b>
     * <ul>
     *   <li>{@code email} present → ADMIN lane (classic email+password)</li>
     *   <li>{@code password} present → CHEF_ATELIER lane (matricule+name+password)</li>
     *   <li>no {@code password} → SOUS_CHEF lane (matricule+name, no password)</li>
     * </ul>
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {

        try {
            // 1. Detect the operational lane
            UserRole lane = detectLane(request);

            // 2. Build the principal and credentials based on the lane
            MultiChannelAuthenticationToken authToken = buildAuthToken(request, lane);

            // 3. Delegate to the MultiChannelAuthenticationProvider
            Authentication authentication = authenticationManager.authenticate(authToken);

            // 4. Successful login — extract the authenticated user
            MultiChannelAuthenticationToken authenticated = (MultiChannelAuthenticationToken) authentication;
            UserEntity user = authenticated.getAuthenticatedUser();

            // 5. Reset any lockout state
            user.resetFailedAttempts();
            userRepository.save(user);

            // 6. Issue access token (JWT) + persist opaque refresh token (UUID)
            String accessToken = jwtService.generateAccessToken(authentication);

            RefreshTokenEntity refreshTokenEntity = RefreshTokenEntity.builder()
                    .userId(user.getId())
                    .token(UUID.randomUUID().toString())
                    .expiryDate(LocalDateTime.now().plusDays(7))
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
            log.warn("Locked account login attempt: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account is locked. Try again later."));

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt: {}", e.getMessage());

            // Track failed attempt — attempt to locate the user based on lane
            // (matricule for floor staff, email for admin)
            if (request.matricule() != null) {
                tryUpdateFailedAttemptsByMatricule(Integer.parseInt(request.matricule()));
            } else if (request.email() != null) {
                tryUpdateFailedAttemptsByEmail(request.email());
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }
    }

    // ──────────────────────────────────────────────
    //  Refresh Token
    // ──────────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(@RequestBody Map<String, String> body) {
        String refreshTokenValue = body.get("refreshToken");
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "refreshToken is required"));
        }

        var storedToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElse(null);

        if (storedToken == null || !storedToken.isValid()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired refresh token"));
        }

        UserEntity user = userRepository.findById(storedToken.getUserId())
                .orElseThrow(() -> new incident.management.system.exception.ResourceNotFoundException(
                        "User", "id", storedToken.getUserId()));

        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "User account is deactivated"));
        }

        // Build a lightweight Authentication for token generation
        Authentication authentication = new MultiChannelAuthenticationToken(user);

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
    //  Hybrid Password Reset Lifecycle
    // ──────────────────────────────────────────────

    /**
     * Track A — No-Email Manual Token (for CHEF_ATELIER &amp; floor staff).
     * Returns the short alphanumeric code directly in the JSON response
     * so it can be rendered on a manager dashboard.
     */
    @PostMapping("/password-reset/request-manual")
    public ResponseEntity<Map<String, Object>> requestPasswordResetManual(
            @Valid @RequestBody PasswordResetRequest request) {

        String token = authService.requestPasswordResetManual(request.matricule());

        return ResponseEntity.ok(Map.of(
                "message", "Manual password reset token generated.",
                "token", token,
                "expiresInMinutes", 15));
    }

    /**
     * Track B — Corporate Email Loop (for ADMIN).
     * Generates a secure token and delegates to the async email dispatcher stub.
     */
    @PostMapping("/password-reset/request-email")
    public ResponseEntity<Map<String, Object>> requestPasswordResetEmail(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "email is required"));
        }

        String token = authService.requestPasswordResetEmail(email);

        return ResponseEntity.ok(Map.of(
                "message", "If the email address is registered, a password reset link has been sent.",
                "token", token, // Exposed for development/testing; remove in production
                "expiresInMinutes", 10));
    }

    /**
     * Track C — Unified Confirmation Endpoint.
     * Accepts the token (manual or email) alongside the new password.
     */
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Map<String, String>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request) {

        authService.confirmPasswordReset(request.token(), request.newPassword());

        return ResponseEntity.ok(Map.of("message", "Password has been successfully reset"));
    }

    // ──────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────

    /**
     * Detects the operational channel from the presence of specific fields.
     */
    private UserRole detectLane(LoginRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            return UserRole.ADMIN;
        }
        if (request.password() != null && !request.password().isBlank()) {
            return UserRole.CHEF_ATELIER;
        }
        return UserRole.SOUS_CHEF;
    }

    /**
     * Builds a {@link MultiChannelAuthenticationToken} appropriate for the
     * detected lane, extracting the correct principal and credentials.
     */
    private MultiChannelAuthenticationToken buildAuthToken(LoginRequest request, UserRole lane) {
        return switch (lane) {
            case ADMIN -> new MultiChannelAuthenticationToken(
                    request.email(), request.password(), lane, null, null);
            case CHEF_ATELIER -> new MultiChannelAuthenticationToken(
                    request.matricule(), request.password(), lane,
                    request.firstName(), request.lastName());
            case SOUS_CHEF -> new MultiChannelAuthenticationToken(
                    request.matricule(), null, lane,
                    request.firstName(), request.lastName());
        };
    }

    private void tryUpdateFailedAttemptsByMatricule(int matricule) {
        userRepository.findByMatricule(matricule).ifPresent(user -> {
            user.incrementFailedAttempts();
            userRepository.save(user);
            if (user.isLocked()) {
                log.warn("Account locked for matricule: {} due to 5 failed attempts", matricule);
            }
        });
    }

    private void tryUpdateFailedAttemptsByEmail(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.incrementFailedAttempts();
            userRepository.save(user);
            if (user.isLocked()) {
                log.warn("Account locked for email: {} due to 5 failed attempts", email);
            }
        });
    }
}
