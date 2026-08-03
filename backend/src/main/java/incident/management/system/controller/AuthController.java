package incident.management.system.controller;

import incident.management.system.config.JwtService;
import incident.management.system.dto.ClaimAccountRequest;
import incident.management.system.dto.JwtAuthenticationResponse;
import incident.management.system.dto.LoginRequest;
import incident.management.system.dto.PasswordResetConfirmRequest;
import incident.management.system.dto.PasswordResetRequest;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.AccountUnclaimedException;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
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
    private final PasswordEncoder passwordEncoder;

    // Multi-Channel Login

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {

        try {
            UserRole lane = detectLane(request);
            MultiChannelAuthenticationToken authToken = buildAuthToken(request, lane);
            Authentication authentication = authenticationManager.authenticate(authToken);

            MultiChannelAuthenticationToken authenticated = (MultiChannelAuthenticationToken) authentication;
            UserEntity user = authenticated.getAuthenticatedUser();

            user.resetFailedAttempts();
            userRepository.save(user);

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

        } catch (AccountUnclaimedException e) {
            log.warn("Account unclaimed login attempt: {}", e.getMessage());
            Map<String, String> body = new LinkedHashMap<>();
            body.put("code", e.getCode());
            body.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);

        } catch (LockedException e) {
            log.warn("Locked account login attempt: {}", e.getMessage());

            // Include the lockout expiry so the frontend can render an accurate countdown
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", e.getMessage() != null ? e.getMessage() : "Account is locked. Try again later.");
            findUserForLockout(request).ifPresent(user -> {
                if (user.getLockoutEnd() != null) {
                    body.put("lockoutEnd", user.getLockoutEnd().toString());
                }
            });

            return ResponseEntity.status(HttpStatus.LOCKED).body(body);

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt: {}", e.getMessage());

            if (request.matricule() != null) {
                tryUpdateFailedAttemptsByMatricule(Integer.parseInt(request.matricule()));
            } else if (request.email() != null) {
                tryUpdateFailedAttemptsByEmail(request.email());
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }
    }

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

        Authentication authentication = new MultiChannelAuthenticationToken(user);
        String newAccessToken = jwtService.generateAccessToken(authentication);

        return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken,
                "type", "Bearer"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader("Authorization") String authHeader) {

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            tokenBlacklistService.blacklist(accessToken);
        }

        return ResponseEntity.ok(Map.of("message", "Successfully logged out"));
    }

    // Hybrid Password Reset Lifecycle

    @PostMapping("/password-reset/request-manual")
    public ResponseEntity<Map<String, Object>> requestPasswordResetManual(
            @Valid @RequestBody PasswordResetRequest request) {

        String token = authService.requestPasswordResetManual(
                request.matricule(), request.firstName(), request.lastName());

        return ResponseEntity.ok(Map.of(
                "message", "Manual password reset token generated.",
                "token", token,
                "expiresInMinutes", 15));
    }

    @PostMapping("/password-reset/request-email")
    public ResponseEntity<Map<String, Object>> requestPasswordResetEmail(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            // Validation is deliberately generic — an empty field must not be
            // distinguishable from an unknown address.
            return ResponseEntity.ok(Map.of(
                    "message", AuthService.EMAIL_NEUTRAL_MESSAGE,
                    "expiresInMinutes", 10));
        }

        AuthService.EmailResetResult result = authService.requestPasswordResetEmail(email);

        // Anti-enumeration: ALWAYS the same neutral 200 — whether or not the
        // address exists. The plaintext token is echoed ONLY in stub (dev) mode
        // for a known address so local testing works without a real mailbox.
        Map<String, Object> bodyOut = new LinkedHashMap<>();
        bodyOut.put("message", AuthService.EMAIL_NEUTRAL_MESSAGE);
        bodyOut.put("expiresInMinutes", 10);
        if (result.token() != null) {
            bodyOut.put("token", result.token());
        }
        return ResponseEntity.ok(bodyOut);
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Map<String, Object>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request) {

        AuthService.ResetConfirmation confirmation =
                authService.confirmPasswordReset(request.token(), request.newPassword());

        // role + loginIdentifier let the frontend route to the correct login
        // lane with the matricule/email pre-filled (no auto-login).
        return ResponseEntity.ok(Map.of(
                "message", "Password has been successfully reset",
                "role", confirmation.role().name(),
                "loginIdentifier", confirmation.loginIdentifier()));
    }

    // Matricule Verification (Boolean-Only, No PII)

    @GetMapping("/check-matricule")
    public ResponseEntity<Map<String, Object>> checkMatricule(
            @RequestParam("matricule") String matricule) {

        String sanitized = matricule.trim();
        boolean exists = false;
        boolean eligibleToClaim = false;

        try {
            int parsed = Integer.parseInt(sanitized);
            var userOpt = userRepository.findByMatricule(parsed);
            if (userOpt.isPresent()) {
                UserEntity user = userOpt.get();
                exists = true;
                // Eligible to claim: role == CHEF_ATELIER AND passwordHash IS NULL
                eligibleToClaim = user.getRole() == UserRole.CHEF_ATELIER
                        && (user.getPasswordHash() == null || user.getPasswordHash().isBlank());
            }
        } catch (NumberFormatException e) {
            // Non-numeric input — treat as not existing
        }

        // CRITICAL: NEVER return firstName, lastName, or any PII
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("exists", exists);
        response.put("eligibleToClaim", eligibleToClaim);
        return ResponseEntity.ok(response);
    }

    // Account Claim Endpoint (Replaces Public Self-Register)

    @PostMapping("/claim")
    public ResponseEntity<?> claimAccount(@Valid @RequestBody ClaimAccountRequest request) {
        String sanitizedMatricule = request.matricule().trim();

        int matriculeInt;
        try {
            matriculeInt = Integer.parseInt(sanitizedMatricule);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Le matricule doit être un nombre valide"));
        }

        // 1. Lookup user by matricule
        UserEntity user = userRepository.findByMatricule(matriculeInt)
                .orElseThrow(() -> new incident.management.system.exception.ResourceNotFoundException(
                        "User", "matricule", matriculeInt));

        // 2. Verify role == CHEF_ATELIER
        if (user.getRole() != UserRole.CHEF_ATELIER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("code", "NOT_ELIGIBLE",
                            "message", "Seuls les comptes Chef d'atelier peuvent être réclamés."));
        }

        // 3. Verify passwordHash IS NULL (not already claimed)
        if (user.getPasswordHash() != null && !user.getPasswordHash().isBlank()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("code", "ALREADY_CLAIMED",
                            "message", "Ce compte a déjà été réclamé."));
        }

        // 4. Compare firstName and lastName (case-insensitive, trimmed)
        if (!request.firstName().trim().equalsIgnoreCase(user.getFirstName().trim())
                || !request.lastName().trim().equalsIgnoreCase(user.getLastName().trim())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "IDENTITY_MISMATCH",
                            "message", "Les informations fournies ne correspondent pas à nos enregistrements."));
        }

        // 5. Hash newPassword with BCrypt, save, and return JWT
        String encodedPassword = passwordEncoder.encode(request.newPassword());
        user.setPasswordHash(encodedPassword);
        userRepository.save(user);

        // Generate JWT token for immediate login
        Authentication authentication = new MultiChannelAuthenticationToken(user);
        String accessToken = jwtService.generateAccessToken(authentication);

        RefreshTokenEntity refreshTokenEntity = RefreshTokenEntity.builder()
                .userId(user.getId())
                .token(UUID.randomUUID().toString())
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        List<String> roles = List.of("ROLE_" + user.getRole().name());

        JwtAuthenticationResponse response = new JwtAuthenticationResponse(
                accessToken, refreshTokenEntity.getToken(), user.getMatricule(), roles);

        log.info("Account claimed for matricule: {} (userId: {})", matriculeInt, user.getId());
        return ResponseEntity.ok(response);
    }

    // Private helpers

    private UserRole detectLane(LoginRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            return UserRole.ADMIN;
        }
        if (request.password() != null && !request.password().isBlank()) {
            return UserRole.CHEF_ATELIER;
        }
        return UserRole.SOUS_CHEF;
    }

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

    // Resolve the account referenced by the login request so lockout metadata can be returned.
    private java.util.Optional<UserEntity> findUserForLockout(LoginRequest request) {
        if (request.email() != null && !request.email().isBlank()) {
            return userRepository.findByEmail(request.email());
        }
        if (request.matricule() != null && !request.matricule().isBlank()) {
            try {
                return userRepository.findByMatricule(Integer.parseInt(request.matricule()));
            } catch (NumberFormatException ignored) {
                return java.util.Optional.empty();
            }
        }
        return java.util.Optional.empty();
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
