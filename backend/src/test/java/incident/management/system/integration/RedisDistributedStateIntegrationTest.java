package incident.management.system.integration;

import incident.management.system.config.CacheNames;
import incident.management.system.config.JwtService;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.exception.RateLimitExceededException;
import incident.management.system.repository.BaseRepositoryIntegrationTest;
import incident.management.system.security.TokenBlacklistService;
import incident.management.system.service.AnalyticsService;
import incident.management.system.service.DashboardService;
import incident.management.system.service.RateLimitingService;
import incident.management.system.service.RedisRateLimitBucketProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Distributed-state proof over a real Redis instance (Testcontainers
 * {@code redis:7-alpine}) with the full Spring context.
 *
 * <p>Verifies that the state written by the Redis-backed services actually
 * lives <em>outside</em> the JVM:
 * <ul>
 *   <li>JWT revocation keys land in Redis with a bounded TTL and are honoured
 *       on the O(1) {@code hasKey} lookup;</li>
 *   <li>rate-limit buckets are shared across two service instances (simulating
 *       horizontal scaling) — tokens consumed by instance A are seen by
 *       instance B;</li>
 *   <li>idempotency locks are atomic — a second {@code SETNX} with the same key
 *       is rejected;</li>
 *   <li>the {@code dashboard_stats} cache is written to Redis.</li>
 * </ul>
 */
@DisplayName("Redis distributed state (real Redis container)")
class RedisDistributedStateIntegrationTest extends BaseRepositoryIntegrationTest {

    private static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    static {
        REDIS.start();
    }

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitingService rateLimitingService;

    @Autowired
    private RedisRateLimitBucketProvider redisRateLimitBucketProvider;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void flushRedis() {
        stringRedisTemplate.getConnectionFactory()
                .getConnection().serverCommands().flushDb();
    }

    @Test
    @DisplayName("JWT revocation: key stored in Redis with bounded TTL, honoured by hasKey")
    void jwtRevocation_isStoredInRedisWithTtl() {
        var auth = new UsernamePasswordAuthenticationToken(
                "9001", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        String token = jwtService.generateAccessToken(auth);

        String jti = jwtService.getJtiFromToken(token);
        assertThat(jti).isNotBlank();

        tokenBlacklistService.blacklist(token);

        String key = "blacklist:jwt:" + jti;
        assertThat(stringRedisTemplate.hasKey(key)).isTrue();
        assertThat(stringRedisTemplate.getExpire(key)).isGreaterThan(0); // explicit, bounded TTL
        assertThat(tokenBlacklistService.isBlacklisted(token)).isTrue();
    }

    @Test
    @DisplayName("rate limiting: bucket state is shared across service instances")
    void rateLimiting_bucketsSharedAcrossInstances() {
        // Second "instance" sharing the same Redis store (horizontal scaling).
        RateLimitingService instanceB = new RateLimitingService(redisRateLimitBucketProvider);

        String client = "integration-client";
        for (int i = 0; i < 5; i++) {
            rateLimitingService.consume(client, "/api/auth/login", "POST");
        }

        // Instance B must observe the tokens already consumed by instance A.
        assertThatThrownBy(() ->
                instanceB.consume(client, "/api/auth/login", "POST"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    @DisplayName("idempotency: SETNX lock is atomic — duplicate key rejected")
    void idempotencyLock_isAtomic() {
        String key = "idempotency:integration-key";
        var ops = stringRedisTemplate.opsForValue();

        assertThat(ops.setIfAbsent(key, "IN_PROGRESS", Duration.ofSeconds(30))).isTrue();
        assertThat(ops.setIfAbsent(key, "IN_PROGRESS", Duration.ofSeconds(30))).isFalse();

        // Keys carry an explicit TTL — never unlimited.
        assertThat(stringRedisTemplate.getExpire(key)).isGreaterThan(0);
    }

    @Test
    @DisplayName("dashboard_stats cache entry is persisted to Redis")
    void dashboardCache_isWrittenToRedis() {
        dashboardService.getIncidentsGroupedByStatus();

        assertThat(stringRedisTemplate.hasKey("dashboard_stats::v2:by-status")).isTrue();
    }

    @Test
    @DisplayName("analytics DTO round-trips through Redis (JSON serialize + deserialize)")
    void analyticsCache_roundTripsThroughRedis() {
        LocalDate start = LocalDate.now().minusDays(30);
        LocalDate end = LocalDate.now();
        // v2 namespace — the pre-typing serializer entries (raw LinkedHashMap
        // JSON) must never be served; see RedisConfig#cacheValueSerializer.
        String cacheKey = "v2:pareto:" + start + ":" + end + ":null";

        analyticsService.getPareto(start, end, null);

        // Entry exists in Redis with a bounded TTL (120s for analytics_metrics).
        String redisKey = CacheNames.ANALYTICS_METRICS + "::" + cacheKey;
        assertThat(stringRedisTemplate.hasKey(redisKey)).isTrue();
        assertThat(stringRedisTemplate.getExpire(redisKey)).isLessThanOrEqualTo(120);

        // Reading through the cache manager exercises the Jackson 3 deserializer —
        // proves the record DTO survives the JSON round-trip.
        Cache cache = cacheManager.getCache(CacheNames.ANALYTICS_METRICS);
        assertThat(cache).isNotNull();
        Cache.ValueWrapper wrapper = cache.get(cacheKey);
        assertThat(wrapper).isNotNull();
        assertThat(wrapper.get()).isInstanceOf(ParetoResponse.class);
    }
}
