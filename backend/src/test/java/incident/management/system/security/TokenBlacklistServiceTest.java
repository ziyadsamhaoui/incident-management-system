package incident.management.system.security;

import incident.management.system.config.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the Redis-backed {@link TokenBlacklistService}.
 *
 * <p>The blacklist state now lives in Redis (key {@code blacklist:jwt:{jti}})
 * with an explicit TTL — no in-memory map, no scheduled eviction. These tests
 * verify the key scheme, the dynamic TTL and the O(1) {@code hasKey} lookup;
 * the distributed behaviour against a real Redis instance is covered by
 * {@code RedisDistributedStateIntegrationTest}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TokenBlacklistService (Redis-backed)")
class TokenBlacklistServiceTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private TokenBlacklistService tokenBlacklistService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        tokenBlacklistService = new TokenBlacklistService(jwtService, redisTemplate);
    }

    @Nested
    @DisplayName("Blacklisting")
    class Blacklisting {

        @Test
        @DisplayName("blacklists by jti with a TTL equal to the token's remaining validity")
        void blacklist_storesKeyWithDynamicTtl() {
            String token = "valid-jwt-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-123");
            Date futureExpiry = new Date(System.currentTimeMillis() + 3_600_000); // 1 hour
            when(jwtService.getExpirationFromToken(token)).thenReturn(futureExpiry);

            tokenBlacklistService.blacklist(token);

            verify(valueOperations).set(
                    eq("blacklist:jwt:jti-123"),
                    eq("1"),
                    anyLong(),
                    eq(TimeUnit.MILLISECONDS));
        }

        @Test
        @DisplayName("isBlacklisted performs an O(1) hasKey lookup on the jti key")
        void isBlacklisted_hasKeyOnJtiKey() {
            String token = "valid-jwt-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-123");
            when(redisTemplate.hasKey("blacklist:jwt:jti-123")).thenReturn(true);

            assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
            verify(redisTemplate).hasKey("blacklist:jwt:jti-123");
        }

        @Test
        @DisplayName("non-blacklisted token is not rejected")
        void nonBlacklistedToken_isAccepted() {
            String token = "some-other-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-other");
            when(redisTemplate.hasKey("blacklist:jwt:jti-other")).thenReturn(false);

            assertThat(tokenBlacklistService.isBlacklisted(token)).isFalse();
        }

        @Test
        @DisplayName("legacy tokens without a jti fall back to a SHA-256 digest key")
        void tokenWithoutJti_usesDigestKey() {
            String token = "legacy-token-no-jti";
            when(jwtService.getJtiFromToken(token)).thenReturn(null);

            tokenBlacklistService.isBlacklisted(token);

            verify(redisTemplate).hasKey("blacklist:jwt:" + sha256(token));
        }

        @Test
        @DisplayName("multiple tokens are blacklisted independently")
        void multipleTokens_independentBlacklisting() {
            when(jwtService.getJtiFromToken("token-1")).thenReturn("jti-1");
            when(jwtService.getJtiFromToken("token-2")).thenReturn("jti-2");
            when(redisTemplate.hasKey("blacklist:jwt:jti-1")).thenReturn(true);
            when(redisTemplate.hasKey("blacklist:jwt:jti-2")).thenReturn(false);

            tokenBlacklistService.blacklist("token-1");

            assertThat(tokenBlacklistService.isBlacklisted("token-1")).isTrue();
            assertThat(tokenBlacklistService.isBlacklisted("token-2")).isFalse();
        }

        @Test
        @DisplayName("malformed token is treated as not blacklisted (validation handles it downstream)")
        void malformedToken_isNotBlacklisted() {
            String token = "garbage";
            when(jwtService.getJtiFromToken(token)).thenThrow(new RuntimeException("Cannot parse"));

            assertThat(tokenBlacklistService.isBlacklisted(token)).isFalse();
        }
    }

    @Nested
    @DisplayName("TTL discipline")
    class TtlDiscipline {

        @Test
        @DisplayName("already-expired token is still recorded with a floor TTL of 1 second")
        void expiredToken_usesFloorTtl() {
            String token = "expired-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-expired");
            Date pastExpiry = new Date(System.currentTimeMillis() - 3_600_000);
            when(jwtService.getExpirationFromToken(token)).thenReturn(pastExpiry);

            tokenBlacklistService.blacklist(token);

            // TTL must never be negative or zero — Redis would reject it.
            verify(valueOperations).set(eq("blacklist:jwt:jti-expired"), eq("1"),
                    eq(1_000L), eq(TimeUnit.MILLISECONDS));
        }

        @Test
        @DisplayName("unparseable expiry falls back to a 15-minute TTL")
        void unparseableExpiry_usesFallbackTtl() {
            String token = "malformed-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-fallback");
            when(jwtService.getExpirationFromToken(token)).thenThrow(new RuntimeException("Cannot parse"));

            tokenBlacklistService.blacklist(token);

            verify(valueOperations).set(eq("blacklist:jwt:jti-fallback"), eq("1"),
                    eq(900_000L), eq(TimeUnit.MILLISECONDS));
        }

        @Test
        @DisplayName("blacklist is idempotent — re-blacklisting refreshes the TTL")
        void reBlacklisting_refreshesTtl() {
            String token = "active-token";
            when(jwtService.getJtiFromToken(token)).thenReturn("jti-active");
            when(jwtService.getExpirationFromToken(token))
                    .thenReturn(new Date(System.currentTimeMillis() + 7_200_000));

            tokenBlacklistService.blacklist(token);
            tokenBlacklistService.blacklist(token);

            verify(valueOperations, org.mockito.Mockito.times(2))
                    .set(eq("blacklist:jwt:jti-active"), eq("1"), anyLong(), eq(TimeUnit.MILLISECONDS));
        }
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
