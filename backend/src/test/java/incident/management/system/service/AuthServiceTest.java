package incident.management.system.service;

import incident.management.system.dto.GenerateResetCodeResponse;
import incident.management.system.enums.UserRole;
import incident.management.system.model.AuditLogEntity;
import incident.management.system.model.PasswordResetToken;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.AuditLogRepository;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthService} authentication-hardening behaviours:
 * the full identity bar on the public manual reset, the supervisor-mediated
 * reset code (hash + TTL + audit log) and claim-code redemption.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Pattern CODE_PATTERN =
            Pattern.compile("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}");

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository, passwordResetTokenRepository, auditLogRepository, passwordEncoder);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserEntity user(long id, int matricule, String firstName, String lastName,
                            UserRole role, boolean active, String passwordHash) {
        return UserEntity.builder()
                .id(id)
                .matricule(matricule)
                .firstName(firstName)
                .lastName(lastName)
                .role(role)
                .isActive(active)
                .passwordHash(passwordHash)
                .failedLoginAttempts(0)
                .build();
    }

    private UserEntity claimedChef() {
        return user(2001L, 2001, "Bob", "Smith", UserRole.CHEF_ATELIER, true, "encoded-hash");
    }

    @Nested
    @DisplayName("Public manual reset — identity bar")
    class ManualReset {

        @Test
        @DisplayName("matricule + first/last name match (case-insensitive) → 6-char token issued")
        void validIdentity_issuesToken() {
            UserEntity chef = claimedChef();
            when(userRepository.findByMatricule(2001)).thenReturn(Optional.of(chef));
            when(passwordResetTokenRepository.findByUserIdAndUsedFalse(2001L))
                    .thenReturn(Optional.empty());

            String token = authService.requestPasswordResetManual(2001, "bob", "SMITH");

            assertThat(token).matches(CODE_PATTERN.pattern());

            ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
            verify(passwordResetTokenRepository).save(captor.capture());
            PasswordResetToken saved = captor.getValue();
            assertThat(saved.getUserId()).isEqualTo(2001L);
            assertThat(saved.getToken()).isEqualTo(token);
            assertThat(saved.isUsed()).isFalse();
            assertThat(saved.getExpiryDate()).isAfter(LocalDateTime.now());
            assertThat(saved.getExpiryDate()).isBefore(LocalDateTime.now().plusMinutes(16));
        }

        @Test
        @DisplayName("mismatched lastName → generic 'Identifiants invalides', no token saved")
        void wrongLastName_rejectsGeneric() {
            when(userRepository.findByMatricule(2001)).thenReturn(Optional.of(claimedChef()));

            assertThatThrownBy(() -> authService.requestPasswordResetManual(2001, "Bob", "Attacker"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Identifiants invalides");

            verify(passwordResetTokenRepository, never()).save(any(PasswordResetToken.class));
        }

        @Test
        @DisplayName("unknown matricule → generic 'Identifiants invalides'")
        void unknownMatricule_rejectsGeneric() {
            when(userRepository.findByMatricule(9999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.requestPasswordResetManual(9999, "X", "Y"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Identifiants invalides");
        }

        @Test
        @DisplayName("SOUS_CHEF target → generic 'Identifiants invalides'")
        void sousChefRole_rejectsGeneric() {
            UserEntity operator = user(3001L, 3001, "Alice", "Martin", UserRole.SOUS_CHEF, true, "");
            when(userRepository.findByMatricule(3001)).thenReturn(Optional.of(operator));

            assertThatThrownBy(() -> authService.requestPasswordResetManual(3001, "Alice", "Martin"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Identifiants invalides");
        }

        @Test
        @DisplayName("unclaimed CHEF_ATELIER (blank password) → generic 'Identifiants invalides'")
        void unclaimedChef_rejectsGeneric() {
            UserEntity unclaimed = user(2002L, 2002, "Eve", "Dupont", UserRole.CHEF_ATELIER, true, "");
            when(userRepository.findByMatricule(2002)).thenReturn(Optional.of(unclaimed));

            assertThatThrownBy(() -> authService.requestPasswordResetManual(2002, "Eve", "Dupont"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Identifiants invalides");
        }
    }

    @Nested
    @DisplayName("Supervisor-mediated reset code generation")
    class AdminResetCode {

        @Test
        @DisplayName("CHEF_ATELIER target → plaintext code returned, hash + TTL persisted, audit logged")
        void chefAtelierTarget_generatesCodeAndAudits() {
            UserEntity chef = claimedChef();
            UserEntity admin = user(1L, 1001, "Admin", "User", UserRole.ADMIN, true, "admin-hash");
            when(userRepository.findById(2001L)).thenReturn(Optional.of(chef));
            when(userRepository.findByMatricule(1001)).thenReturn(Optional.of(admin));
            // Three-arg constructor = authenticated principal (two-arg sets
            // authenticated=false, which CurrentUserResolver rejects).
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            "1001", "dummy", List.of(() -> "ROLE_ADMIN")));

            GenerateResetCodeResponse response = authService.generateAdminResetCode(2001L);

            // Plaintext code is well-formed and returned for in-person handoff.
            assertThat(response.code()).matches(CODE_PATTERN.pattern());
            assertThat(response.expiresAt()).isAfter(LocalDateTime.now());
            assertThat(response.expiresAt()).isBefore(LocalDateTime.now().plusMinutes(16));

            // Only the hash is persisted — never the plaintext — with a strict TTL.
            assertThat(chef.getClaimCodeHash()).isNotNull().hasSize(64);
            assertThat(chef.getClaimCodeHash()).isNotEqualTo(response.code());
            assertThat(chef.getClaimCodeExpiresAt()).isEqualTo(response.expiresAt());
            verify(userRepository).save(chef);

            // System audit log entry with the acting admin.
            ArgumentCaptor<AuditLogEntity> auditCaptor = ArgumentCaptor.forClass(AuditLogEntity.class);
            verify(auditLogRepository).save(auditCaptor.capture());
            AuditLogEntity audit = auditCaptor.getValue();
            assertThat(audit.getAction()).isEqualTo("GENERATE_RESET_CODE");
            assertThat(audit.getActorUserId()).isEqualTo(1L);
            assertThat(audit.getTargetUserId()).isEqualTo(2001L);
        }

        @Test
        @DisplayName("ADMIN target → rejected")
        void adminTarget_rejected() {
            UserEntity admin = user(1L, 1001, "Admin", "User", UserRole.ADMIN, true, "admin-hash");
            when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

            assertThatThrownBy(() -> authService.generateAdminResetCode(1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Impossible");
        }

        @Test
        @DisplayName("inactive target → rejected")
        void inactiveTarget_rejected() {
            UserEntity inactive = user(2003L, 2003, "Zoe", "Test", UserRole.CHEF_ATELIER, false, "h");
            when(userRepository.findById(2003L)).thenReturn(Optional.of(inactive));

            assertThatThrownBy(() -> authService.generateAdminResetCode(2003L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Impossible");
        }
    }

    @Nested
    @DisplayName("Password reset confirmation")
    class ConfirmReset {

        @Test
        @DisplayName("supervisor-mediated code → password reset and code consumed")
        void claimCode_resetsAndConsumes() {
            UserEntity chef = claimedChef();
            when(userRepository.findByClaimCodeHashAndClaimCodeExpiresAtAfter(anyString(), any()))
                    .thenReturn(Optional.of(chef));
            when(passwordEncoder.encode("newSecret")).thenReturn("encoded-newSecret");

            authService.confirmPasswordReset("X7K9P2", "newSecret");

            assertThat(chef.getPasswordHash()).isEqualTo("encoded-newSecret");
            assertThat(chef.getClaimCodeHash()).isNull();
            assertThat(chef.getClaimCodeExpiresAt()).isNull();
            verify(userRepository).save(chef);
            // Legacy token table must not be consulted for this path.
            verify(passwordResetTokenRepository, never()).findByToken(anyString());
        }

        @Test
        @DisplayName("legacy Track A/B token → existing behaviour preserved")
        void legacyToken_stillWorks() {
            when(userRepository.findByClaimCodeHashAndClaimCodeExpiresAtAfter(anyString(), any()))
                    .thenReturn(Optional.empty());

            UserEntity chef = claimedChef();
            PasswordResetToken legacy = PasswordResetToken.builder()
                    .id(7L)
                    .userId(2001L)
                    .token("ABCDEF")
                    .expiryDate(LocalDateTime.now().plusMinutes(10))
                    .used(false)
                    .build();
            when(passwordResetTokenRepository.findByToken("ABCDEF")).thenReturn(Optional.of(legacy));
            when(userRepository.findById(2001L)).thenReturn(Optional.of(chef));
            when(passwordEncoder.encode("newSecret")).thenReturn("encoded-newSecret");

            authService.confirmPasswordReset("ABCDEF", "newSecret");

            assertThat(chef.getPasswordHash()).isEqualTo("encoded-newSecret");
            assertThat(legacy.isUsed()).isTrue();
            verify(userRepository).save(chef);
            verify(passwordResetTokenRepository).save(legacy);
        }
    }
}
