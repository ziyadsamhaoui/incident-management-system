package incident.management.system.service;

import incident.management.system.exception.RateLimitExceededException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.local.LocalBucketBuilder;
import io.lettuce.core.RedisConnectionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link RateLimitingService}.
 *
 * <p>Production uses {@link RedisRateLimitBucketProvider} (bucket state in
 * Redis, shared across instances). These tests exercise the exact same service
 * logic against an in-memory {@link RateLimitBucketProvider} fake that returns
 * real bucket4j buckets, so the token accounting rules are validated with real
 * bucket semantics but without a Redis server. The cross-instance behaviour is
 * covered by {@code RedisDistributedStateIntegrationTest}.
 */
class RateLimitingServiceTest {

    private RateLimitingService rateLimitingService;

    @BeforeEach
    void setUp() {
        rateLimitingService = new RateLimitingService(new InMemoryBucketProvider());
    }

    // Auth endpoint rate limiting (5 req/min)
    @Nested
    @DisplayName("Auth endpoint: 5 requests/minute")
    class AuthRateLimiting {

        private static final String CLIENT_KEY = "ip:127.0.0.1";
        private static final String AUTH_PATH = "/api/auth/login";
        private static final String HTTP_METHOD = "POST";

        @Test
        @DisplayName("first request is allowed")
        void firstRequest_allowed() {
            rateLimitingService.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);
            // Should not throw
        }

        @Test
        @DisplayName("5 requests within window are all allowed")
        void fiveRequests_allAllowed() {
            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);
            }
            // Should not throw
        }

        @Test
        @DisplayName("6th request within same window is rejected with RateLimitExceededException")
        void sixthRequest_rejected() {
            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);
            }

            assertThatThrownBy(() ->
                    rateLimitingService.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD))
                    .isInstanceOf(RateLimitExceededException.class)
                    .hasMessageContaining("Rate limit exceeded")
                    .satisfies(ex -> {
                        RateLimitExceededException rle = (RateLimitExceededException) ex;
                        assertThat(rle.getRetryAfterSeconds()).isPositive();
                    });
        }

        @Test
        @DisplayName("different clients have independent buckets")
        void differentClients_independentBuckets() {
            // Client A uses all 5 tokens
            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume("ip:client-a", AUTH_PATH, HTTP_METHOD);
            }

            // Client B should still have all 5 tokens
            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume("ip:client-b", AUTH_PATH, HTTP_METHOD);
            }
            // Neither should throw
        }

        @Test
        @DisplayName("getLimit returns 5 for auth endpoints")
        void getLimit_returns5() {
            assertThat(rateLimitingService.getLimit(AUTH_PATH, HTTP_METHOD)).isEqualTo(5);
        }

        @Test
        @DisplayName("getRemainingTokens returns correct count after consumption")
        void getRemainingTokens_reflectsConsumption() {
            assertThat(rateLimitingService.getRemainingTokens(CLIENT_KEY, AUTH_PATH, HTTP_METHOD)).isEqualTo(5);

            rateLimitingService.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);

            assertThat(rateLimitingService.getRemainingTokens(CLIENT_KEY, AUTH_PATH, HTTP_METHOD)).isEqualTo(4);
        }
    }

    // Incident creation rate limiting (10 req/min)
    @Nested
    @DisplayName("Incident creation: 10 requests/minute")
    class IncidentRateLimiting {

        private static final String CLIENT_KEY = "user:2001";
        private static final String INCIDENT_PATH = "/api/incidents";
        private static final String HTTP_METHOD = "POST";

        @Test
        @DisplayName("10 requests within window are all allowed")
        void tenRequests_allAllowed() {
            for (int i = 0; i < 10; i++) {
                rateLimitingService.consume(CLIENT_KEY, INCIDENT_PATH, HTTP_METHOD);
            }
            // Should not throw
        }

        @Test
        @DisplayName("11th request within same window is rejected with RateLimitExceededException")
        void eleventhRequest_rejected() {
            for (int i = 0; i < 10; i++) {
                rateLimitingService.consume(CLIENT_KEY, INCIDENT_PATH, HTTP_METHOD);
            }

            assertThatThrownBy(() ->
                    rateLimitingService.consume(CLIENT_KEY, INCIDENT_PATH, HTTP_METHOD))
                    .isInstanceOf(RateLimitExceededException.class)
                    .hasMessageContaining("Rate limit exceeded")
                    .satisfies(ex -> {
                        RateLimitExceededException rle = (RateLimitExceededException) ex;
                        assertThat(rle.getRetryAfterSeconds()).isPositive();
                    });
        }

        @Test
        @DisplayName("getLimit returns 10 for incident creation endpoints")
        void getLimit_returns10() {
            assertThat(rateLimitingService.getLimit(INCIDENT_PATH, HTTP_METHOD)).isEqualTo(10);
        }

        @Test
        @DisplayName("getRemainingTokens returns 10 initially")
        void getRemainingTokens_initially10() {
            assertThat(rateLimitingService.getRemainingTokens(CLIENT_KEY, INCIDENT_PATH, HTTP_METHOD)).isEqualTo(10);
        }
    }

    // Manual password-reset rate limiting (3 req / 15 min)
    @Nested
    @DisplayName("Manual password-reset: 3 requests / 15 minutes")
    class PasswordResetRateLimiting {

        private static final String CLIENT_KEY = "ip:127.0.0.1";
        private static final String RESET_PATH = "/api/auth/password-reset/request-manual";
        private static final String HTTP_METHOD = "POST";

        @Test
        @DisplayName("3 requests within window are all allowed")
        void threeRequests_allAllowed() {
            for (int i = 0; i < 3; i++) {
                rateLimitingService.consume(CLIENT_KEY, RESET_PATH, HTTP_METHOD);
            }
            // Should not throw
        }

        @Test
        @DisplayName("4th request within same window is rejected with RateLimitExceededException")
        void fourthRequest_rejected() {
            for (int i = 0; i < 3; i++) {
                rateLimitingService.consume(CLIENT_KEY, RESET_PATH, HTTP_METHOD);
            }

            assertThatThrownBy(() ->
                    rateLimitingService.consume(CLIENT_KEY, RESET_PATH, HTTP_METHOD))
                    .isInstanceOf(RateLimitExceededException.class)
                    .hasMessageContaining("Rate limit exceeded")
                    .satisfies(ex -> {
                        RateLimitExceededException rle = (RateLimitExceededException) ex;
                        assertThat(rle.getRetryAfterSeconds()).isPositive();
                    });
        }

        @Test
        @DisplayName("getLimit returns 3 for the manual password-reset endpoint")
        void getLimit_returns3() {
            assertThat(rateLimitingService.getLimit(RESET_PATH, HTTP_METHOD)).isEqualTo(3);
        }

        @Test
        @DisplayName("different clients have independent password-reset buckets")
        void differentClients_independentBuckets() {
            for (int i = 0; i < 3; i++) {
                rateLimitingService.consume("ip:client-a", RESET_PATH, HTTP_METHOD);
            }
            for (int i = 0; i < 3; i++) {
                rateLimitingService.consume("ip:client-b", RESET_PATH, HTTP_METHOD);
            }
            // Neither should throw
        }
    }

    // Rule resolution
    @Nested
    @DisplayName("Rule resolution")
    class RuleResolution {

        @Test
        @DisplayName("auth login endpoint matches AUTH rule")
        void authLogin_matchesAuthRule() {
            assertThat(RateLimitingService.resolveRule("/api/auth/login", "POST")).isNotNull();
        }

        @Test
        @DisplayName("auth refresh endpoint matches AUTH rule")
        void authRefresh_matchesAuthRule() {
            assertThat(RateLimitingService.resolveRule("/api/auth/refresh", "POST")).isNotNull();
        }

        @Test
        @DisplayName("manual password-reset endpoint matches its dedicated rule (not the generic AUTH rule)")
        void manualPasswordReset_matchesDedicatedRule() {
            assertThat(RateLimitingService.resolveRule(
                    "/api/auth/password-reset/request-manual", "POST")).isNotNull();
            assertThat(rateLimitingService.getLimit(
                    "/api/auth/password-reset/request-manual", "POST")).isEqualTo(3);
        }

        @Test
        @DisplayName("incident creation endpoint matches INCIDENT_CREATE rule")
        void incidentCreate_matchesIncidentRule() {
            assertThat(RateLimitingService.resolveRule("/api/incidents", "POST")).isNotNull();
        }

        @Test
        @DisplayName("incident creation with trailing slash matches INCIDENT_CREATE rule")
        void incidentCreateTrailingSlash_matchesIncidentRule() {
            assertThat(RateLimitingService.resolveRule("/api/incidents/", "POST")).isNotNull();
        }

        @Test
        @DisplayName("GET on incidents does not match any rule")
        void getOnIncidents_noRule() {
            assertThat(RateLimitingService.resolveRule("/api/incidents", "GET")).isNull();
        }

        @Test
        @DisplayName("unrelated endpoint returns null")
        void unrelatedEndpoint_noRule() {
            assertThat(RateLimitingService.resolveRule("/api/users", "GET")).isNull();
        }
    }

    // Retry-After header validation
    @Nested
    @DisplayName("Retry-After compliance")
    class RetryAfterCompliance {

        private static final String AUTH_PATH = "/api/auth/login";
        private static final String HTTP_METHOD = "POST";

        @Test
        @DisplayName("RateLimitExceededException carries positive retryAfterSeconds")
        void exceptionCarries_retryAfterSeconds() {
            String clientKey = "ip:192.168.1.1";

            // Exhaust the bucket
            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume(clientKey, AUTH_PATH, HTTP_METHOD);
            }

            assertThatThrownBy(() ->
                    rateLimitingService.consume(clientKey, AUTH_PATH, HTTP_METHOD))
                    .isInstanceOfSatisfying(RateLimitExceededException.class, ex -> {
                        assertThat(ex.getRetryAfterSeconds()).isPositive();
                        assertThat(ex.getRetryAfterSeconds()).isLessThanOrEqualTo(60L); // max 60s for 1-min window
                    });
        }

        @Test
        @DisplayName("multiple sequential rejections all carry Retry-After")
        void sequentialRejections_allCarryRetryAfter() {
            String clientKey = "ip:10.0.0.1";

            for (int i = 0; i < 5; i++) {
                rateLimitingService.consume(clientKey, AUTH_PATH, HTTP_METHOD);
            }

            // First rejection
            assertThatThrownBy(() ->
                    rateLimitingService.consume(clientKey, AUTH_PATH, HTTP_METHOD))
                    .isInstanceOfSatisfying(RateLimitExceededException.class, ex -> {
                        assertThat(ex.getRetryAfterSeconds()).isPositive();
                    });

            // Subsequent rejection still has Retry-After
            assertThatThrownBy(() ->
                    rateLimitingService.consume(clientKey, AUTH_PATH, HTTP_METHOD))
                    .isInstanceOfSatisfying(RateLimitExceededException.class, ex -> {
                        assertThat(ex.getRetryAfterSeconds()).isPositive();
                    });
        }
    }

    // Redis unreachable → fail-open (login must not 500 when Redis is down)
    @Nested
    @DisplayName("Redis unreachable — degraded fail-open mode")
    class RedisUnreachable {

        private static final String CLIENT_KEY = "ip:127.0.0.1";
        private static final String AUTH_PATH = "/api/auth/login";
        private static final String HTTP_METHOD = "POST";

        @Test
        @DisplayName("consume() does not throw when the bucket provider hits a Redis connection failure")
        void consume_skipsEnforcementWhenRedisDown() {
            RateLimitingService degraded = new RateLimitingService(new RedisDownBucketProvider());
            degraded.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);
            // Must not throw — the request proceeds without rate limiting
        }

        @Test
        @DisplayName("consume() fails open when Redis dies during the deferred GET (tryConsume), not just at bucket acquisition")
        void consume_failsOpenWhenRedisDiesMidConsume() {
            // bucket4j's remote proxy defers the actual Redis command to
            // tryConsumeAndReturnRemaining — this is the real outage failure
            // point observed against a live instance (GET timed out after 2s).
            Bucket bucket = org.mockito.Mockito.mock(Bucket.class);
            org.mockito.Mockito.when(bucket.tryConsumeAndReturnRemaining(1))
                    .thenThrow(new io.lettuce.core.RedisCommandTimeoutException(
                            "GET. Command timed out after 2 second(s)"));
            RateLimitBucketProvider provider = org.mockito.Mockito.mock(RateLimitBucketProvider.class);
            org.mockito.Mockito.when(provider.getBucket(
                            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(bucket);

            RateLimitingService degraded = new RateLimitingService(provider);
            degraded.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD);
            // Must not throw — enforcement skipped, request proceeds
        }

        @Test
        @DisplayName("getRemainingTokens() fails open when the deferred GET dies mid-call")
        void getRemainingTokens_failsOpenWhenRedisDiesMidCall() {
            Bucket bucket = org.mockito.Mockito.mock(Bucket.class);
            org.mockito.Mockito.when(bucket.getAvailableTokens())
                    .thenThrow(new io.lettuce.core.RedisCommandTimeoutException(
                            "GET. Command timed out after 2 second(s)"));
            RateLimitBucketProvider provider = org.mockito.Mockito.mock(RateLimitBucketProvider.class);
            org.mockito.Mockito.when(provider.getBucket(
                            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(bucket);

            RateLimitingService degraded = new RateLimitingService(provider);
            org.assertj.core.api.Assertions.assertThat(
                    degraded.getRemainingTokens(CLIENT_KEY, AUTH_PATH, HTTP_METHOD)).isEqualTo(-1);
        }

        @Test
        @DisplayName("consume() still throws when the provider fails for a non-Redis reason")
        void consume_propagatesNonRedisFailures() {
            RateLimitingService degraded = new RateLimitingService(new ExplodingBucketProvider());
            org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                    degraded.consume(CLIENT_KEY, AUTH_PATH, HTTP_METHOD))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("boom");
        }

        @Test
        @DisplayName("getRemainingTokens() returns -1 in degraded mode so headers are omitted")
        void getRemainingTokens_returnsMinusOneWhenRedisDown() {
            RateLimitingService degraded = new RateLimitingService(new RedisDownBucketProvider());
            org.assertj.core.api.Assertions.assertThat(
                    degraded.getRemainingTokens(CLIENT_KEY, AUTH_PATH, HTTP_METHOD)).isEqualTo(-1);
        }

        @Test
        @DisplayName("getLimit() still resolves the rule without touching Redis")
        void getLimit_stillWorksWhenRedisDown() {
            RateLimitingService degraded = new RateLimitingService(new RedisDownBucketProvider());
            org.assertj.core.api.Assertions.assertThat(
                    degraded.getLimit(AUTH_PATH, HTTP_METHOD)).isEqualTo(5);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    //  In-memory fake — real bucket4j buckets, no Redis. Production uses
    //  RedisRateLimitBucketProvider instead; this fake exists only for tests.
    // ──────────────────────────────────────────────────────────────────────

    private static final class RedisDownBucketProvider implements RateLimitBucketProvider {

        @Override
        public Bucket getBucket(byte[] key, BucketConfiguration configuration) {
            // Mirrors the Lettuce failure seen at request time when Redis is
            // down, including the Spring bean-creation wrapper thrown when the
            // lazy rate-limit connection is first materialized.
            throw new org.springframework.beans.factory.BeanCreationException(
                    "rateLimitRedisConnection", "Failed to instantiate",
                    new RedisConnectionException("Unable to connect to localhost/<unresolved>:6379"));
        }
    }

    private static final class ExplodingBucketProvider implements RateLimitBucketProvider {

        @Override
        public Bucket getBucket(byte[] key, BucketConfiguration configuration) {
            throw new IllegalStateException("boom");
        }
    }

    private static final class InMemoryBucketProvider implements RateLimitBucketProvider {

        private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

        @Override
        public Bucket getBucket(byte[] key, BucketConfiguration configuration) {
            String stringKey = new String(key, StandardCharsets.UTF_8);
            return buckets.computeIfAbsent(stringKey, ignored -> {
                LocalBucketBuilder builder = Bucket.builder();
                for (Bandwidth bandwidth : configuration.getBandwidths()) {
                    builder.addLimit(bandwidth);
                }
                return builder.build();
            });
        }
    }
}
