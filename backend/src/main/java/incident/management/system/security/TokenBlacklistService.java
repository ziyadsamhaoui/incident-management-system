package incident.management.system.security;

import incident.management.system.config.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;

/**
 * Distributed JWT revocation blacklist backed by Redis.
 *
 * <p>Replaces the legacy {@code ConcurrentHashMap} implementation whose entries
 * vanished on every redeploy and were invisible to other application instances.
 *
 * <p><b>Key scheme:</b> {@code blacklist:jwt:{jti}} where {@code jti} is the
 * token's unique identifier claim. Legacy tokens without a {@code jti} fall back
 * to the SHA-256 digest of the raw token so the lookup stays deterministic and
 * O(1).
 *
 * <p><b>TTL discipline:</b> every key is written with a TTL exactly matching the
 * token's remaining validity ({@code expiration − now}), capped at a 15-minute
 * fallback when the expiry cannot be extracted. Redis evicts the entry on its
 * own — there is no in-memory map and no scheduled cleaner.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TokenBlacklistService {

    public static final String KEY_PREFIX = "blacklist:jwt:";

    /** Fallback TTL when the token's expiry cannot be extracted (15 minutes). */
    private static final long FALLBACK_TTL_MILLIS = 900_000L;

    /** Minimum TTL (1s) — a blacklisted-but-already-expired token is still recorded. */
    private static final long MIN_TTL_MILLIS = 1_000L;

    private final JwtService jwtService;
    private final StringRedisTemplate redisTemplate;

    /**
     * Revokes a token by storing its identifier in Redis for the remainder of
     * its natural validity. Idempotent — re-blacklisting the same token just
     * refreshes the TTL.
     */
    public void blacklist(String token) {
        String key = resolveKey(token);
        try {
            Date expiry = jwtService.getExpirationFromToken(token);
            long ttlMillis = Math.max(MIN_TTL_MILLIS, expiry.getTime() - System.currentTimeMillis());
            redisTemplate.opsForValue().set(key, "1", ttlMillis, TimeUnit.MILLISECONDS);
            log.debug("Token blacklisted under '{}' — TTL {} ms (expires {})",
                    key, ttlMillis, Instant.ofEpochMilli(expiry.getTime()));
        } catch (Exception e) {
            log.warn("Could not extract expiry for blacklisted token — using {} ms fallback TTL", FALLBACK_TTL_MILLIS);
            redisTemplate.opsForValue().set(key, "1", FALLBACK_TTL_MILLIS, TimeUnit.MILLISECONDS);
        }
    }

    /**
     * O(1) revocation check: a single {@code EXISTS} on {@code blacklist:jwt:{jti}}.
     *
     * <p>Malformed tokens are treated as not-blacklisted — JWT signature/expiry
     * validation downstream is the authoritative gate for those. Redis
     * <em>infrastructure</em> failures are deliberately NOT swallowed: if the
     * blacklist cannot be consulted, the request fails closed instead of letting
     * a revoked token through during an outage.
     */
    public boolean isBlacklisted(String token) {
        String key;
        try {
            key = resolveKey(token);
        } catch (Exception e) {
            log.debug("Could not resolve blacklist key for token", e);
            return false;
        }
        // A Redis connection failure propagates here (fail closed) — only token
        // parsing errors are tolerated above.
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    // ──────────────────────────────────────────────────────────────────────

    private String resolveKey(String token) {
        String jti;
        try {
            jti = jwtService.getJtiFromToken(token);
        } catch (Exception e) {
            jti = null;
        }
        return KEY_PREFIX + ((jti != null && !jti.isBlank()) ? jti : sha256(token));
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable in this JVM", e);
        }
    }
}
