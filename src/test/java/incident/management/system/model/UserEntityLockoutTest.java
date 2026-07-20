package incident.management.system.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;


class UserEntityLockoutTest {

    private UserEntity createUser() {
        return UserEntity.builder()
                .id(1L)
                .matricule(1001)
                .firstName("Test")
                .lastName("User")
                .passwordHash("hash")
                .role(incident.management.system.enums.UserRole.SOUS_CHEF)
                .isActive(true)
                .failedLoginAttempts(0)
                .build();
    }

    // 5-strike lockout rule
    @Nested
    @DisplayName("5-strike lockout rule")
    class FiveStrikeRule {

        @Test
        @DisplayName("fewer than 5 failures does not lock account")
        void partialFailures_doesNotLock() {
            UserEntity user = createUser();

            user.incrementFailedAttempts(); // 1
            user.incrementFailedAttempts(); // 2
            user.incrementFailedAttempts(); // 3

            assertThat(user.isLocked()).isFalse();
            assertThat(user.getLockoutEnd()).isNull();
        }

        @Test
        @DisplayName("exactly 5 failures locks account and sets lockoutEnd")
        void fiveFailures_locksAccount() {
            UserEntity user = createUser();

            user.incrementFailedAttempts(); // 1
            user.incrementFailedAttempts(); // 2
            user.incrementFailedAttempts(); // 3
            user.incrementFailedAttempts(); // 4
            user.incrementFailedAttempts(); // 5

            assertThat(user.getFailedLoginAttempts()).isEqualTo(5);
            assertThat(user.isLocked()).isTrue();
            assertThat(user.getLockoutEnd()).isNotNull();
        }

        @Test
        @DisplayName("more than 5 failures keeps account locked")
        void moreThanFiveFailures_keepsLocked() {
            UserEntity user = createUser();

            for (int i = 0; i < 7; i++) {
                user.incrementFailedAttempts();
            }

            assertThat(user.getFailedLoginAttempts()).isEqualTo(7);
            assertThat(user.isLocked()).isTrue();
        }
    }

    // Lockout expiry
    @Nested
    @DisplayName("Lockout expiry behavior")
    class LockoutExpiry {

        @Test
        @DisplayName("isLocked returns false when lockoutEnd is in the past")
        void expiredLockout_unlocksAccount() {
            UserEntity user = createUser();
            // Simulate 5 failures with lockout in the past
            user.setFailedLoginAttempts(5);
            user.setLockoutEnd(LocalDateTime.now().minusMinutes(1)); // expired 1 minute ago

            assertThat(user.isLocked()).isFalse();
        }

        @Test
        @DisplayName("incrementFailedAttempts resets counter when lockout has expired")
        void expiredLockout_resetsCounterOnIncrement() {
            UserEntity user = createUser();
            user.setFailedLoginAttempts(5);
            user.setLockoutEnd(LocalDateTime.now().minusMinutes(1));

            // A new failure after lockout expiry should reset and start fresh
            user.incrementFailedAttempts();

            assertThat(user.getFailedLoginAttempts()).isEqualTo(1);
            assertThat(user.isLocked()).isFalse(); // 1 failure only
        }
    }

    // Reset on successful login
    @Nested
    @DisplayName("Successful login reset")
    class SuccessfulLoginReset {

        @Test
        @DisplayName("resetFailedAttempts clears failure count and lockoutEnd")
        void resetFailedAttempts_clearsLockout() {
            UserEntity user = createUser();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts(); // locked

            assertThat(user.isLocked()).isTrue();

            user.resetFailedAttempts();

            assertThat(user.getFailedLoginAttempts()).isZero();
            assertThat(user.getLockoutEnd()).isNull();
            assertThat(user.isLocked()).isFalse();
        }

        @Test
        @DisplayName("resetFailedAttempts on non-locked account is safe")
        void resetOnCleanAccount_isSafe() {
            UserEntity user = createUser();

            user.resetFailedAttempts();

            assertThat(user.getFailedLoginAttempts()).isZero();
            assertThat(user.getLockoutEnd()).isNull();
        }
    }

    // Deactivation state
    @Nested
    @DisplayName("Account deactivation")
    class AccountDeactivation {

        @Test
        @DisplayName("deactivate sets isActive false and populates deletedAt")
        void deactivate_setsFlags() {
            UserEntity user = createUser();

            user.deactivate();

            assertThat(user.isActive()).isFalse();
            assertThat(user.getDeletedAt()).isNotNull();
        }

        @Test
        @DisplayName("deactivation does not affect lockout state")
        void deactivation_doesNotAffectLockout() {
            UserEntity user = createUser();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();
            user.incrementFailedAttempts();

            assertThat(user.isLocked()).isTrue();

            user.deactivate();

            assertThat(user.isActive()).isFalse();
            assertThat(user.isLocked()).isTrue(); // lockout state preserved
        }
    }
}
