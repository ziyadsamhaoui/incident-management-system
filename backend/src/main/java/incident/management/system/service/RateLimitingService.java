package incident.management.system.service;

import incident.management.system.exception.RateLimitExceededException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.Refill;
import io.lettuce.core.RedisException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

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
 *
 * <p><b>Degradation policy:</b> when Redis is unreachable the bucket cannot be
 * read, so enforcement is <em>skipped</em> (fail-open) and a throttled warning
 * is logged. A rate limiter is availability protection, not a security
 * boundary — taking down every authenticated endpoint because Redis blinked
 * is strictly worse than letting a few extra requests through. The JWT
 * revocation blacklist, by contrast, fails <em>closed</em> (see
 * {@link incident.management.system.security.TokenBlacklistService}).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RateLimitingService {

    /** Redis key prefix for every rate-limit bucket. */
    public static final String KEY_PREFIX = "rate_limit:api:";

    /** Lower bound on Retry-After (bucket4j may report 0 when fully drained). */
    private static final long RETRY_AFTER_MIN_SECONDS = 1L;

    /** Minimum interval between degraded-mode warnings (prevents log spam). */
    private static final long DEGRADED_WARN_INTERVAL_MILLIS = 30_000L;

    private final RateLimitBucketProvider bucketProvider;

    /** Last time a degraded-mode warning was emitted (throttling). */
    private final AtomicLong lastDegradedWarnAt = new AtomicLong(0L);

    /**
     * Consumes one token from the client's bucket for the given endpoint rule.
     *
     * <p>Redis I/O is wrapped in the degraded-mode guard: bucket4j's remote
     * proxy defers the actual command to {@code tryConsume...} (not to bucket
     * acquisition), so both the acquisition <em>and</em> the consumption must
     * sit inside the guarded block for fail-open to fire on an outage.
     *
     * @throws RateLimitExceededException when the bucket is empty.
     */
    public void consume(String clientKey, String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        if (rule == null) {
            return; // Endpoint is not rate-limited
        }

        try {
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
        } catch (RuntimeException e) {
            if (isRedisUnavailable(e)) {
                warnDegraded(clientKey, e);
                return; // Redis unreachable — degraded mode, enforcement skipped
            }
            throw e;
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
        try {
            Bucket bucket = bucketProvider.getBucket(redisKey(clientKey, rule), rule.configuration());
            return bucket.getAvailableTokens();
        } catch (RuntimeException e) {
            if (isRedisUnavailable(e)) {
                warnDegraded(clientKey, e);
                return -1;
            }
            throw e;
        }
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

    /**
     * Returns whether the failure chain originates from Redis being
     * unreachable. The cause chain is inspected so both the raw Lettuce
     * {@link RedisException} (connect refused, command timeout) and the
     * Spring-wrapped {@link RedisConnectionFailureException} — including the
     * lazy bean-creation wrapper thrown when the bucket4j proxy manager is
     * first materialized — are recognised. Any other failure propagates.
     */
    private static boolean isRedisUnavailable(Throwable t) {
        for (Throwable cause = t; cause != null; cause = cause.getCause()) {
            if (cause instanceof RedisException
                    || cause instanceof RedisConnectionFailureException) {
                return true;
            }
        }
        return false;
    }

    private void warnDegraded(String clientKey, Throwable cause) {
        long now = System.currentTimeMillis();
        long last = lastDegradedWarnAt.get();
        if (now - last >= DEGRADED_WARN_INTERVAL_MILLIS
                && lastDegradedWarnAt.compareAndSet(last, now)) {
            log.warn("Redis unreachable — rate limiting degraded to fail-open for client '{}': {}",
                    clientKey, rootMessage(cause));
        }
    }

    private static String rootMessage(Throwable t) {
        Throwable deepest = t;
        while (deepest.getCause() != null) {
            deepest = deepest.getCause();
        }
        return deepest.getMessage() != null ? deepest.getMessage() : t.getMessage();
    }

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
