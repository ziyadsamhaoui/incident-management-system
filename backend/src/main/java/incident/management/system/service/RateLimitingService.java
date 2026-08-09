package incident.management.system.service;

import incident.management.system.exception.RateLimitExceededException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Distributed API rate limiting built on Bucket4j.
 *
 * <p>The legacy implementation held every bucket's token state in a
 * {@code ConcurrentHashMap} — a user could dodge the limit by triggering a
 * restart, and multiple instances enforced unrelated budgets. The bucket state
 * now lives in Redis (via {@link RedisRateLimitBucketProvider}) under
 * {@code rate_limit:api:{rule}:{clientKey}}, so limits are strict across
 * restarts and across every horizontally scaled instance.
 *
 * <p>Key resolution mirrors the previous behaviour: authenticated users on
 * incident-creation endpoints are keyed by matricule, everyone else by IP
 * (see {@code RateLimitingFilter#resolveClientKey}).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RateLimitingService {

    /** Redis key prefix for every rate-limit bucket. */
    public static final String KEY_PREFIX = "rate_limit:api:";

    /** Lower bound on Retry-After (bucket4j may report 0 when fully drained). */
    private static final long RETRY_AFTER_MIN_SECONDS = 1L;

    private final RateLimitBucketProvider bucketProvider;

    /**
     * Consumes one token from the client's bucket for the given endpoint rule.
     *
     * @throws RateLimitExceededException when the bucket is empty.
     */
    public void consume(String clientKey, String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        if (rule == null) {
            return; // Endpoint is not rate-limited
        }

        Bucket bucket = bucketProvider.getBucket(redisKey(clientKey, rule), rule.configuration());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (!probe.isConsumed()) {
            long retryAfterSeconds = retryAfterSeconds(probe, rule);
            log.warn("Rate limit exceeded for client '{}' on {} {} — retry after {}s",
                    clientKey, httpMethod, requestPath, retryAfterSeconds);
            throw new RateLimitExceededException(
                    "Rate limit exceeded. Please try again in " + retryAfterSeconds + " seconds.",
                    retryAfterSeconds);
        }
    }

    /**
     * Returns the number of remaining tokens, or {@code -1} when no rule applies.
     */
    public long getRemainingTokens(String clientKey, String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        if (rule == null) {
            return -1;
        }
        Bucket bucket = bucketProvider.getBucket(redisKey(clientKey, rule), rule.configuration());
        return bucket.getAvailableTokens();
    }

    /**
     * Returns the maximum number of requests allowed, or {@code -1} when no rule applies.
     */
    public long getLimit(String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        return rule != null ? rule.maxRequests() : -1;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Rule resolution (public — reused by RateLimitingFilter)
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Resolves the applicable rate-limit rule for a request path + HTTP method.
     *
     * <p>Order matters: the stricter manual password-reset rule is checked
     * before the catch-all AUTH rule so it always wins.
     */
    public static RateLimitRule resolveRule(String requestPath, String httpMethod) {
        if (requestPath == null || httpMethod == null) {
            return null;
        }

        String path = requestPath.toLowerCase();
        String method = httpMethod.toUpperCase();

        // Public manual password-reset: stricter budget than the generic auth rule
        // (checked first so it wins over the catch-all AUTH rule below).
        if ("POST".equals(method) && (path.equals("/api/auth/password-reset/request-manual")
                || path.equals("/api/auth/password-reset/request-manual/"))) {
            return RateLimitRule.PASSWORD_RESET_MANUAL;
        }

        // Auth endpoints: all POST requests under /api/auth/**
        if ("POST".equals(method) && path.startsWith("/api/auth/")) {
            return RateLimitRule.AUTH;
        }

        // Incident creation: POST /api/incidents (exact path or with trailing slash)
        if ("POST".equals(method) && (path.equals("/api/incidents")
                || path.equals("/api/incidents/"))) {
            return RateLimitRule.INCIDENT_CREATE;
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────────────────────────────

    private static byte[] redisKey(String clientKey, RateLimitRule rule) {
        return (KEY_PREFIX + rule.ruleName() + ":" + clientKey).getBytes(StandardCharsets.UTF_8);
    }

    private static long retryAfterSeconds(ConsumptionProbe probe, RateLimitRule rule) {
        long nanosToWait = probe.getNanosToWaitForRefill();
        if (nanosToWait <= 0) {
            // Bucket fully drained — wait one full window.
            return Math.max(RETRY_AFTER_MIN_SECONDS, rule.window().toSeconds());
        }
        long seconds = (long) Math.ceil(nanosToWait / 1_000_000_000.0);
        return Math.max(RETRY_AFTER_MIN_SECONDS, seconds);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Inner types
    // ──────────────────────────────────────────────────────────────────────

    enum RateLimitRule {

        AUTH("auth", 5, Duration.ofMinutes(1)),
        INCIDENT_CREATE("incident_create", 10, Duration.ofMinutes(1)),
        PASSWORD_RESET_MANUAL("password_reset_manual", 3, Duration.ofMinutes(15));

        private final String name;
        private final int maxRequests;
        private final Duration window;
        private final BucketConfiguration configuration;

        RateLimitRule(String name, int maxRequests, Duration window) {
            this.name = name;
            this.maxRequests = maxRequests;
            this.window = window;
            this.configuration = BucketConfiguration.builder()
                    .addLimit(Bandwidth.classic(maxRequests, Refill.greedy(maxRequests, window)))
                    .build();
        }

        String ruleName() {
            return name;
        }

        int maxRequests() {
            return maxRequests;
        }

        Duration window() {
            return window;
        }

        BucketConfiguration configuration() {
            return configuration;
        }
    }
}
