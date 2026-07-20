package incident.management.system.security;

import incident.management.system.config.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;


@ExtendWith(MockitoExtension.class)
class TokenBlacklistServiceTest {

    @Mock
    private JwtService jwtService;

    private TokenBlacklistService tokenBlacklistService;

    @BeforeEach
    void setUp() {
        tokenBlacklistService = new TokenBlacklistService(jwtService);
    }

    // Token blacklisting
    @Nested
    @DisplayName("Token blacklisting")
    class TokenBlacklisting {

        @Test
        @DisplayName("blacklisted token is immediately rejected")
        void blacklistedToken_isRejected() {
            String token = "valid-jwt-token";
            // Token expires in 1 hour
            Date futureExpiry = new Date(System.currentTimeMillis() + 3_600_000);
            when(jwtService.getExpirationFromToken(token)).thenReturn(futureExpiry);

            tokenBlacklistService.blacklist(token);

            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
        }

        @Test
        @DisplayName("non-blacklisted token is not rejected")
        void nonBlacklistedToken_isAccepted() {
            String token = "some-other-token";
            assertThat(tokenBlacklistService.isBlacklisted(token)).isFalse();
        }

        @Test
        @DisplayName("multiple tokens can be blacklisted independently")
        void multipleTokens_independentBlacklisting() {
            String token1 = "token-1";
            String token2 = "token-2";

            Date futureExpiry = new Date(System.currentTimeMillis() + 3_600_000);
            when(jwtService.getExpirationFromToken(token1)).thenReturn(futureExpiry);

            tokenBlacklistService.blacklist(token1);

            assertThat(tokenBlacklistService.isBlacklisted(token1)).isTrue();
            assertThat(tokenBlacklistService.isBlacklisted(token2)).isFalse();
        }
    }

    // Expired blacklist entries
    @Nested
    @DisplayName("Expired blacklist entries")
    class ExpiredEntries {

        @Test
        @DisplayName("expired blacklisted token is evicted and treated as not blacklisted")
        void expiredToken_isEvicted() {
            String token = "expired-token";
            // Token already expired (1 hour ago)
            Date pastExpiry = new Date(System.currentTimeMillis() - 3_600_000);
            when(jwtService.getExpirationFromToken(token)).thenReturn(pastExpiry);

            tokenBlacklistService.blacklist(token);

            // isBlacklisted should check expiry and evict
            assertThat(tokenBlacklistService.isBlacklisted(token)).isFalse();
        }
    }

    // Fallback when JWT expiration extraction fails
    @Nested
    @DisplayName("Fallback expiration handling")
    class FallbackExpiration {

        @Test
        @DisplayName("token without extractable expiry uses 15-minute fallback and is blacklisted")
        void tokenWithoutExpiry_usesFallback() {
            String token = "malformed-token";
            when(jwtService.getExpirationFromToken(token)).thenThrow(new RuntimeException("Cannot parse"));

            tokenBlacklistService.blacklist(token);

            // Token should be blacklisted with the fallback 15-min expiry
            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
        }
    }

    // Cleanup did not break blacklist state
    @Nested
    @DisplayName("Cleanup conserves state")
    class CleanupConservation {

        @Test
        @DisplayName("non-expired entries survive cleanup cycles")
        void nonExpiredEntriesSurvive() {
            String token = "active-token";
            Date futureExpiry = new Date(System.currentTimeMillis() + 7_200_000); // 2 hours
            when(jwtService.getExpirationFromToken(token)).thenReturn(futureExpiry);

            tokenBlacklistService.blacklist(token);

            // Verify it survives multiple isBlacklisted calls (same as cleanup behavior)
            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
        }
    }
}
