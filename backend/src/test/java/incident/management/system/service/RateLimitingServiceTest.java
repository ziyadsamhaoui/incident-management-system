package incident.management.system.service;

import incident.management.system.exception.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RateLimitingServiceTest {

    private RateLimitingService rateLimitingService;

    @BeforeEach
    void setUp() {
        rateLimitingService = new RateLimitingService();
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
}
