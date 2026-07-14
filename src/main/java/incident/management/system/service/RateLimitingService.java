package incident.management.system.service;

import incident.management.system.exception.RateLimitExceededException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.Refill;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;


@Service
@Slf4j
public class RateLimitingService {

    // Auth endpoints: 5 requests per minute
    private static final int AUTH_MAX_REQUESTS = 5;
    private static final Duration AUTH_WINDOW = Duration.ofMinutes(1);

    // Incident creation: 10 requests per minute
    private static final int INCIDENT_MAX_REQUESTS = 10;
    private static final Duration INCIDENT_WINDOW = Duration.ofMinutes(1);

    // Stale bucket eviction: 5 minutes of inactivity
    private static final Duration EVICTION_IDLE_TIMEOUT = Duration.ofMinutes(5);

    //  State
    private final Map<String, BucketEntry> buckets = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor();


    @PostConstruct
    void startCleaner() {
        cleaner.scheduleAtFixedRate(this::evictStaleEntries, 1, 1, TimeUnit.MINUTES);
        log.info("RateLimitingService initialized: auth={}/min, incident creation={}/min",
                AUTH_MAX_REQUESTS, INCIDENT_MAX_REQUESTS);
    }

    @PreDestroy
    void shutdownCleaner() {
        cleaner.shutdown();
        log.debug("RateLimitingService cleaner shut down");
    }


    public void consume(String clientKey, String requestPath, String httpMethod) {
        // Determine which rate-limit rule applies
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        if (rule == null) {
            return;
        }

        // Resolve or create the bucket for this client
        Bucket bucket = getOrCreateBucket(clientKey, rule);

        // Try to consume one token
        if (!bucket.tryConsume(1)) {
            long retryAfterSeconds = bucket.getAvailableTokens() == 0
                    ? rule.window.toSeconds()
                    : (long) Math.ceil(
                            (double) (rule.window.toNanos())
                            / (double) rule.maxRequests
                            / 1_000_000_000.0);

            log.warn("Rate limit exceeded for client '{}' on {} {} — retry after {}s",
                    clientKey, httpMethod, requestPath, retryAfterSeconds);

            throw new RateLimitExceededException(
                    "Rate limit exceeded. Please try again in " + retryAfterSeconds + " seconds.",
                    retryAfterSeconds);
        }
    }

    // Returns the number of remaining tokens, returns -1 if no rate limiting applies
    public long getRemainingTokens(String clientKey, String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        if (rule == null) {
            return -1;
        }
        BucketEntry entry = buckets.get(bucketKey(clientKey, rule));
        if (entry == null) {
            return rule.maxRequests;
        }
        return entry.bucket.getAvailableTokens();
    }

    // Returns the maximum number of requests allowed, returns -1 if no rate limiting applies
    public long getLimit(String requestPath, String httpMethod) {
        RateLimitRule rule = resolveRule(requestPath, httpMethod);
        return rule != null ? rule.maxRequests : -1;
    }


    //  Private helpers
    private Bucket getOrCreateBucket(String clientKey, RateLimitRule rule) {
        String key = bucketKey(clientKey, rule);
        BucketEntry entry = buckets.get(key);

        if (entry == null) {
            Bucket newBucket = Bucket.builder()
                    .addLimit(Bandwidth.classic(rule.maxRequests, Refill.greedy(rule.maxRequests, rule.window)))
                    .build();
            entry = new BucketEntry(newBucket, System.nanoTime());
            BucketEntry existing = buckets.putIfAbsent(key, entry);
            if (existing != null) {
                entry = existing; // Another thread created it first
            }
        } else {
            entry.lastAccessNanos = System.nanoTime();
        }

        return entry.bucket;
    }


    private static String bucketKey(String clientKey, RateLimitRule rule) {
        return rule.name + "::" + clientKey;
    }


    public static RateLimitRule resolveRule(String requestPath, String httpMethod) {
        if (requestPath == null || httpMethod == null) {
            return null;
        }

        String path = requestPath.toLowerCase();
        String method = httpMethod.toUpperCase();

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

    private void evictStaleEntries() {
        long now = System.nanoTime();
        long idleThresholdNanos = EVICTION_IDLE_TIMEOUT.toNanos();
        int evicted = 0;

        for (Map.Entry<String, BucketEntry> entry : buckets.entrySet()) {
            if (now - entry.getValue().lastAccessNanos > idleThresholdNanos) {
                buckets.remove(entry.getKey());
                evicted++;
            }
        }

        if (evicted > 0) {
            log.debug("Evicted {} stale rate-limit buckets. Current size: {}", evicted, buckets.size());
        }
    }


    //  Inner types
    enum RateLimitRule {
        AUTH("auth", AUTH_MAX_REQUESTS, AUTH_WINDOW),
        INCIDENT_CREATE("incident_create", INCIDENT_MAX_REQUESTS, INCIDENT_WINDOW);

        final String name;
        final int maxRequests;
        final Duration window;

        RateLimitRule(String name, int maxRequests, Duration window) {
            this.name = name;
            this.maxRequests = maxRequests;
            this.window = window;
        }
    }


    private static class BucketEntry {
        final Bucket bucket;
        volatile long lastAccessNanos;

        BucketEntry(Bucket bucket, long lastAccessNanos) {
            this.bucket = bucket;
            this.lastAccessNanos = lastAccessNanos;
        }
    }
}
