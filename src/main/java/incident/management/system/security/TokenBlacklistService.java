package incident.management.system.security;

import incident.management.system.config.JwtService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-memory token blacklist for revoking access tokens on logout.
 * <p>
 * Entries are automatically evicted once the token's original expiry has passed,
 * preventing unbounded memory growth. For production, replace with a Redis-backed
 * or database-backed implementation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TokenBlacklistService {

    private final JwtService jwtService;

    private final Map<String, Long> blacklist = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    void startCleaner() {
        cleaner.scheduleAtFixedRate(this::evictExpiredEntries, 1, 5, TimeUnit.MINUTES);
    }

    @PreDestroy
    void shutdownCleaner() {
        cleaner.shutdown();
        log.debug("Token blacklist cleaner shut down");
    }

    /**
     * Adds a token to the blacklist. The token will be rejected by the
     * {@link JwtAuthenticationFilter} until its natural expiry cleans it up.
     *
     * @param token the JWT access token to revoke
     */
    public void blacklist(String token) {
        try {
            long expiryMs = jwtService.getExpirationFromToken(token).getTime();
            blacklist.put(token, expiryMs);
            log.debug("Token blacklisted, expires at {}", Instant.ofEpochMilli(expiryMs));
        } catch (Exception e) {
            log.warn("Could not extract expiry for blacklisted token", e);
            // Fallback: keep entry for 15 minutes
            blacklist.put(token, Instant.now().plusMillis(900_000).toEpochMilli());
        }
    }

    /**
     * Returns true if the token has been blacklisted.
     *
     * @param token the JWT access token to check
     * @return true if the token is blacklisted
     */
    public boolean isBlacklisted(String token) {
        Long expiry = blacklist.get(token);
        if (expiry == null) {
            return false;
        }
        if (Instant.now().toEpochMilli() >= expiry) {
            blacklist.remove(token);
            return false;
        }
        return true;
    }

    private void evictExpiredEntries() {
        long now = Instant.now().toEpochMilli();
        blacklist.entrySet().removeIf(entry -> now >= entry.getValue());
        log.debug("Blacklist cleanup completed. Current size: {}", blacklist.size());
    }
}
