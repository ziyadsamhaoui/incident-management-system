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

// In-memory blacklist for JWT tokens on logout

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

    // Blacklist a token by storing it with its expiration time. If the expiration cannot be determined, store it for 15 minutes as a fallback.

    public void blacklist(String token) {
        try {
            long expiryMs = jwtService.getExpirationFromToken(token).getTime();
            blacklist.put(token, expiryMs);
            log.debug("Token blacklisted, expires at {}", Instant.ofEpochMilli(expiryMs));
        } catch (Exception e) {
            log.warn("Could not extract expiry for blacklisted token", e);
            log.debug("Storing token in blacklist for 15 minutes");
            // Keep entry for 15 minutes
            blacklist.put(token, Instant.now().plusMillis(900_000).toEpochMilli());
        }
    }

    // Returns true if the token is blacklisted and has expired

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
