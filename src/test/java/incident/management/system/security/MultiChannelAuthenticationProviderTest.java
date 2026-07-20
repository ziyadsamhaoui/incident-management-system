package incident.management.system.security;

import incident.management.system.enums.UserRole;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;


@ExtendWith(MockitoExtension.class)
class MultiChannelAuthenticationProviderTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private MultiChannelAuthenticationProvider provider;

    @Captor
    private ArgumentCaptor<String> passwordEncoderArgumentCaptor;

    @BeforeEach
    void setUp() {
        provider = new MultiChannelAuthenticationProvider(userRepository, passwordEncoder);
    }

    // Helper methods
    private UserEntity createUser(int matricule, String firstName, String lastName,
                                  String passwordHash, UserRole role, boolean isActive) {
        return UserEntity.builder()
                .id((long) matricule)
                .matricule(matricule)
                .firstName(firstName)
                .lastName(lastName)
                .passwordHash(passwordHash)
                .role(role)
                .isActive(isActive)
                .failedLoginAttempts(0)
                .build();
    }

    private UserEntity createUser(int matricule, String firstName, String lastName,
                                  String passwordHash, UserRole role) {
        return createUser(matricule, firstName, lastName, passwordHash, role, true);
    }

    // SOUS_CHEF: identity-only, NO BCrypt
    @Nested
    @DisplayName("SOUS_CHEF lane: identity-only authentication (BCrypt bypassed)")
    class SousChefLane {

        private static final int MATRICULE = 1001;
        private static final String FIRST_NAME = "Alice";
        private static final String LAST_NAME = "Martin";

        @Test
        @DisplayName("valid identity match → authenticated without password check")
        void validIdentity_authenticatesWithoutPassword() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, "encoded-hash", UserRole.SOUS_CHEF);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), null, UserRole.SOUS_CHEF, FIRST_NAME, LAST_NAME);

            var result = (MultiChannelAuthenticationToken) provider.authenticate(token);

            assertThat(result).isNotNull();
            assertThat(result.isAuthenticated()).isTrue();
            assertThat(result.getAuthenticatedUser()).isEqualTo(user);

            // CRITICAL: BCrypt must NOT have been called for SOUS_CHEF
            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }

        @Test
        @DisplayName("identity mismatch → BadCredentialsException")
        void identityMismatch_throwsException() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, "encoded-hash", UserRole.SOUS_CHEF);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            // Wrong last name
            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), null, UserRole.SOUS_CHEF, FIRST_NAME, "WrongName");

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }

        @Test
        @DisplayName("deactivated account → BadCredentialsException")
        void deactivatedAccount_throwsException() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, "encoded-hash", UserRole.SOUS_CHEF, false);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), null, UserRole.SOUS_CHEF, FIRST_NAME, LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Account is deactivated");

            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }

        @Test
        @DisplayName("locked account → LockedException")
        void lockedAccount_throwsException() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, "encoded-hash", UserRole.SOUS_CHEF);
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts(); // 5th failure → lockoutEnd is set
            assertThat(user.isLocked()).isTrue();

            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), null, UserRole.SOUS_CHEF, FIRST_NAME, LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(LockedException.class)
                    .hasMessageContaining("Account is locked");
        }

        @Test
        @DisplayName("invalid matricule format → BadCredentialsException")
        void invalidMatriculeFormat_throwsException() {
            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    "not-a-number", null, UserRole.SOUS_CHEF, FIRST_NAME, LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid matricule format");
        }
    }

    // CHEF_ATELIER: identity + BCrypt password verification
    @Nested
    @DisplayName("CHEF_ATELIER lane — identity + BCrypt password verification")
    class ChefAtelierLane {

        private static final int MATRICULE = 2001;
        private static final String FIRST_NAME = "Bob";
        private static final String LAST_NAME = "Smith";
        private static final String RAW_PASSWORD = "securePassword123";
        private static final String ENCODED_HASH = "$2a$10$encodedHashForSecurePassword";

        @Test
        @DisplayName("valid identity + correct password → authenticated")
        void validIdentityAndPassword_authenticates() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, ENCODED_HASH, UserRole.CHEF_ATELIER);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches(RAW_PASSWORD, ENCODED_HASH)).thenReturn(true);

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), RAW_PASSWORD, UserRole.CHEF_ATELIER, FIRST_NAME, LAST_NAME);

            var result = (MultiChannelAuthenticationToken) provider.authenticate(token);

            assertThat(result).isNotNull();
            assertThat(result.isAuthenticated()).isTrue();

            // CRITICAL: BCrypt matches() MUST have been called
            verify(passwordEncoder).matches(RAW_PASSWORD, ENCODED_HASH);
        }

        @Test
        @DisplayName("correct identity + wrong password → BadCredentialsException")
        void wrongPassword_throwsException() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, ENCODED_HASH, UserRole.CHEF_ATELIER);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches(anyString(), eq(ENCODED_HASH))).thenReturn(false);

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), "wrongPassword", UserRole.CHEF_ATELIER, FIRST_NAME, LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(passwordEncoder).matches("wrongPassword", ENCODED_HASH);
        }

        @Test
        @DisplayName("null password → BadCredentialsException")
        void nullPassword_throwsException() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, ENCODED_HASH, UserRole.CHEF_ATELIER);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), null, UserRole.CHEF_ATELIER, FIRST_NAME, LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }

        @Test
        @DisplayName("identity mismatch → BadCredentialsException before password check")
        void identityMismatch_rejectsBeforePasswordCheck() {
            UserEntity user = createUser(MATRICULE, FIRST_NAME, LAST_NAME, ENCODED_HASH, UserRole.CHEF_ATELIER);
            when(userRepository.findByMatricule(MATRICULE)).thenReturn(Optional.of(user));

            // Wrong first name
            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    String.valueOf(MATRICULE), RAW_PASSWORD, UserRole.CHEF_ATELIER, "WrongFirst", LAST_NAME);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            // Password check should NOT be reached if identity fails
            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }
    }

    // ADMIN: email + BCrypt password verification
    @Nested
    @DisplayName("ADMIN lane — email + BCrypt password verification")
    class AdminLane {

        private static final String EMAIL = "admin@example.com";
        private static final String RAW_PASSWORD = "adminPass!";
        private static final String ENCODED_HASH = "$2a$10$encodedHashForAdminPass";
        private static final int MATRICULE = 999;

        @Test
        @DisplayName("valid email + correct password → authenticated")
        void validEmailAndPassword_authenticates() {
            UserEntity user = createUser(MATRICULE, "Admin", "User", ENCODED_HASH, UserRole.ADMIN);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches(RAW_PASSWORD, ENCODED_HASH)).thenReturn(true);

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    EMAIL, RAW_PASSWORD, UserRole.ADMIN, null, null);

            var result = (MultiChannelAuthenticationToken) provider.authenticate(token);

            assertThat(result).isNotNull();
            assertThat(result.isAuthenticated()).isTrue();

            // CRITICAL: BCrypt matches() MUST have been called
            verify(passwordEncoder).matches(RAW_PASSWORD, ENCODED_HASH);
        }

        @Test
        @DisplayName("unknown email → BadCredentialsException")
        void unknownEmail_throwsException() {
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    EMAIL, RAW_PASSWORD, UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");
        }

        @Test
        @DisplayName("wrong password → BadCredentialsException")
        void wrongPassword_throwsException() {
            UserEntity user = createUser(MATRICULE, "Admin", "User", ENCODED_HASH, UserRole.ADMIN);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches(anyString(), eq(ENCODED_HASH))).thenReturn(false);

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    EMAIL, "wrongPassword", UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(passwordEncoder).matches("wrongPassword", ENCODED_HASH);
        }

        @Test
        @DisplayName("null password → BadCredentialsException")
        void nullPassword_throwsException() {
            UserEntity user = createUser(MATRICULE, "Admin", "User", ENCODED_HASH, UserRole.ADMIN);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    EMAIL, null, UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");
        }

        @Test
        @DisplayName("locked account → LockedException before password check")
        void lockedAccount_throwsException() {
            UserEntity user = createUser(MATRICULE, "Admin", "User", ENCODED_HASH, UserRole.ADMIN);
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            assertThat(user.isLocked()).isTrue();

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    EMAIL, RAW_PASSWORD, UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(LockedException.class)
                    .hasMessageContaining("Account is locked");

            // Password check should NOT be reached if account is locked
            verify(passwordEncoder, never()).matches(anyString(), anyString());
        }
    }

    // Role mismatch rejection (ADMIN attempting SOUS_CHEF lane)
    @Nested
    @DisplayName("Role mismatch: principals rejected from wrong lanes")
    class LaneRoleMismatch {

        @Test
        @DisplayName("ADMIN user cannot authenticate via SOUS_CHEF lane (role mismatch)")
        void adminUser_cannotUseSousChefLane() {
            UserEntity admin = createUser(999, "Admin", "User", "hash", UserRole.ADMIN);
            when(userRepository.findByMatricule(999)).thenReturn(Optional.of(admin));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    "999", null, UserRole.SOUS_CHEF, "Admin", "User");

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");
        }

        @Test
        @DisplayName("CHEF_ATELIER user cannot authenticate via SOUS_CHEF lane (role mismatch)")
        void chefAtelierUser_cannotUseSousChefLane() {
            UserEntity chef = createUser(2001, "Bob", "Smith", "hash", UserRole.CHEF_ATELIER);
            when(userRepository.findByMatricule(2001)).thenReturn(Optional.of(chef));

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    "2001", null, UserRole.SOUS_CHEF, "Bob", "Smith");

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");
        }

        @Test
        @DisplayName("SOUS_CHEF user cannot authenticate via CHEF_ATELIER lane (wrong password — mismatched lane)")
        void sousChefUser_cannotUseChefAtelierLane() {
            // SOUS_CHEF user with no matching passwordHash for the provided password
            UserEntity sousChef = createUser(1001, "Alice", "Martin", "some-hash", UserRole.SOUS_CHEF);
            when(userRepository.findByMatricule(1001)).thenReturn(Optional.of(sousChef));
            when(passwordEncoder.matches("anyPassword", "some-hash")).thenReturn(false);

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    "1001", "anyPassword", UserRole.CHEF_ATELIER, "Alice", "Martin");

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");

            verify(passwordEncoder).matches("anyPassword", "some-hash");
        }

        @Test
        @DisplayName("SOUS_CHEF user authenticating via ADMIN lane fails (email not matched)")
        void sousChefUser_cannotUseAdminLane() {
            when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.empty());

            MultiChannelAuthenticationToken token = new MultiChannelAuthenticationToken(
                    "alice@test.com", "somePass", UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> provider.authenticate(token))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessage("Invalid credentials");
        }
    }

    // Provider support check
    @Nested
    @DisplayName("Provider support check")
    class SupportCheck {

        @Test
        @DisplayName("supports MultiChannelAuthenticationToken")
        void supportsMultiChannelToken() {
            assertThat(provider.supports(MultiChannelAuthenticationToken.class)).isTrue();
        }

        @Test
        @DisplayName("does not support other authentication types")
        void doesNotSupportOtherTypes() {
            assertThat(provider.supports(String.class)).isFalse();
        }
    }
}
