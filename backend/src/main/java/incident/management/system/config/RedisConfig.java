package incident.management.system.config;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ClientSideConfig;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulConnection;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.ByteArrayCodec;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.RedisSerializer;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.DefaultTyping;
import tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import tools.jackson.databind.jsontype.PolymorphicTypeValidator;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Redis infrastructure for distributed state.
 *
 * <p>Responsibilities:
 * <ul>
 *   <li><b>Connection:</b> Lettuce driver with commons-pool2 connection pooling,
 *       configured from {@code spring.data.redis.*} (env-overridable via the
 *       {@code SPRING_REDIS_*} variables through relaxed binding).</li>
 *   <li><b>Serialization standard:</b> {@code RedisTemplate<String,Object>} with
 *       {@link RedisSerializer#string()} keys and JSON values
 *       ({@link GenericJacksonJsonRedisSerializer} — the Jackson&nbsp;3 variant
 *       matching this Spring Boot 4 application). Native JDK serialization is
 *       never used.</li>
 *   <li><b>Query caching:</b> {@link RedisCacheManager} with a default TTL and
 *       per-cache TTL overrides ({@link CacheNames#DASHBOARD_STATS} 90s,
 *       {@link CacheNames#ANALYTICS_METRICS} 120s).</li>
 *   <li><b>Distributed rate limiting:</b> a Lettuce-backed bucket4j
 *       {@link ProxyManager} storing bucket state in Redis with an explicit
 *       write-expiration strategy (bounded by the longest rate-limit window,
 *       15 minutes) — never unlimited TTLs, never JVM-heap buckets.</li>
 * </ul>
 */
@Configuration
@EnableCaching
@Slf4j
public class RedisConfig {

    // ──────────────────────────────────────────────────────────────────────
    // 1. Connection factory (Lettuce + pooling)
    // ──────────────────────────────────────────────────────────────────────

    @Bean
    public RedisConnectionFactory redisConnectionFactory(
            @Value("${spring.data.redis.host:localhost}") String host,
            @Value("${spring.data.redis.port:6379}") int port,
            @Value("${spring.data.redis.password:}") String password,
            @Value("${spring.data.redis.database:0}") int database,
            @Value("${spring.data.redis.timeout:2s}") Duration commandTimeout,
            @Value("${spring.data.redis.lettuce.pool.max-active:16}") int maxActive,
            @Value("${spring.data.redis.lettuce.pool.max-idle:8}") int maxIdle,
            @Value("${spring.data.redis.lettuce.pool.min-idle:2}") int minIdle) {

        RedisStandaloneConfiguration standalone = new RedisStandaloneConfiguration(host, port);
        if (password != null && !password.isBlank()) {
            standalone.setPassword(RedisPassword.of(password));
        }
        standalone.setDatabase(database);

        GenericObjectPoolConfig<StatefulConnection<?, ?>> poolConfig = new GenericObjectPoolConfig<>();
        poolConfig.setMaxTotal(maxActive);
        poolConfig.setMaxIdle(maxIdle);
        poolConfig.setMinIdle(minIdle);

        LettuceClientConfiguration clientConfig = LettucePoolingClientConfiguration.builder()
                .poolConfig(poolConfig)
                .commandTimeout(commandTimeout)
                .build();

        log.info("Redis connection factory: {}:{}/{} (pool {}/{}/{})",
                host, port, database, maxActive, maxIdle, minIdle);
        return new LettuceConnectionFactory(standalone, clientConfig);
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2. RedisTemplate<String,Object> — String keys + JSON values
    // ──────────────────────────────────────────────────────────────────────

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(RedisSerializer.string());
        template.setHashKeySerializer(RedisSerializer.string());

        // Typed JSON serializer — stores runtime type metadata (@class) so
        // polymorphic DTOs round-trip exactly (see {@link #cacheValueSerializer()}).
        GenericJacksonJsonRedisSerializer jsonSerializer = cacheValueSerializer();
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    // ──────────────────────────────────────────────────────────────────────
    // 3. RedisCacheManager — explicit TTLs per cache
    // ──────────────────────────────────────────────────────────────────────

    @Bean
    public RedisCacheManager cacheManager(
            RedisConnectionFactory connectionFactory,
            @Value("${app.cache.default-ttl-seconds:90}") long defaultTtlSeconds,
            @Value("${app.cache.dashboard-ttl-seconds:90}") long dashboardTtlSeconds,
            @Value("${app.cache.analytics-ttl-seconds:120}") long analyticsTtlSeconds) {

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(defaultTtlSeconds))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(RedisSerializer.string()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(cacheValueSerializer()))
                // Aggregation results are never null — refuse to cache nulls
                // (a null entry would otherwise require a longer expiry hack).
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> perCache = new HashMap<>();
        perCache.put(CacheNames.DASHBOARD_STATS,
                base.entryTtl(Duration.ofSeconds(dashboardTtlSeconds)));
        perCache.put(CacheNames.ANALYTICS_METRICS,
                base.entryTtl(Duration.ofSeconds(analyticsTtlSeconds)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(base)
                .withInitialCacheConfigurations(perCache)
                .build();
    }

    /**
     * JSON value serializer for cached data with runtime type preservation.
     *
     * <p>Why this exact configuration (both halves are load-bearing):
     * <ul>
     *   <li><b>Default typing {@code NON_FINAL_AND_RECORDS}</b> — the cached
     *       analytics payloads are Java records (final classes). A plain JSON
     *       serializer deserialises them back as {@code LinkedHashMap}, which
     *       breaks the typed controller responses
     *       ({@code ClassCastException: LinkedHashMap cannot be cast to
     *       WorkloadEntry}). Embedding an {@code @class} hint lets records,
     *       collections and JDK types round-trip to their exact runtime type.
     *       The type validator is a strict allowlist: only our DTO package and
     *       the JDK collection/time/lang types the cache ever stores.</li>
     *   <li><b>{@code USE_LONG_FOR_INTS}</b> — the dashboard aggregates are
     *       {@code Map<String, Long>} whose JSON numbers arrive as {@code Integer};
     *       without this feature the typed {@code Map<String, Long>} response
     *       writer fails with {@code Integer cannot be cast to Long}.</li>
     * </ul>
     */
    private GenericJacksonJsonRedisSerializer cacheValueSerializer() {
        PolymorphicTypeValidator typeValidator = BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType(Object.class)
                .allowIfSubType("java.util.")
                .allowIfSubType("java.time.")
                .allowIfSubType("java.lang.")
                .allowIfSubType("incident.management.system.")
                .allowIfSubTypeIsArray()
                .build();
        return GenericJacksonJsonRedisSerializer.builder()
                .customize(b -> b
                        .activateDefaultTypingAsProperty(typeValidator,
                                DefaultTyping.NON_FINAL_AND_RECORDS, "@class")
                        .enable(DeserializationFeature.USE_LONG_FOR_INTS))
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────
    // 4. bucket4j distributed rate-limiting state (Lettuce ProxyManager)
    // ──────────────────────────────────────────────────────────────────────
    // A dedicated Lettuce client keeps the rate-limit traffic isolated from
    // the cached/template traffic. Lettuce multiplexes asynchronously over a
    // single connection, so one shared StatefulRedisConnection is sufficient
    // and thread-safe for the proxy manager.

    @Bean(destroyMethod = "shutdown")
    public RedisClient rateLimitRedisClient(
            @Value("${spring.data.redis.host:localhost}") String host,
            @Value("${spring.data.redis.port:6379}") int port,
            @Value("${spring.data.redis.password:}") String password,
            @Value("${spring.data.redis.database:0}") int database,
            @Value("${spring.data.redis.timeout:2s}") Duration commandTimeout) {
        RedisURI.Builder uri = RedisURI.builder()
                .withHost(host)
                .withPort(port)
                .withDatabase(database);
        // Bound command latency so a Redis outage degrades to fail-open in
        // seconds, not minutes: an established-but-disconnected Lettuce
        // connection (Redis up, then down) otherwise queues commands until the
        // 60s default timeout. 2s matches the pooled factory's command timeout.
        uri.withTimeout(commandTimeout);
        if (password != null && !password.isBlank()) {
            uri.withPassword(password);
        }
        return RedisClient.create(uri.build());
    }

    /**
     * Lazy: Lettuce's {@code connect()} throws synchronously when Redis is down
     * (verified empirically — {@code RedisConnectionException} on ECONNREFUSED).
     * Deferring the connect until the first rate-limit operation keeps the
     * application bootable during a Redis outage. At request time an unreachable
     * Redis fails closed (rate limiting cannot be enforced ⇒ the request errors)
     * rather than silently falling back to an in-memory budget.
     */
    @Bean(destroyMethod = "close")
    @Lazy
    public StatefulRedisConnection<byte[], byte[]> rateLimitRedisConnection(RedisClient rateLimitRedisClient) {
        return rateLimitRedisClient.connect(ByteArrayCodec.INSTANCE);
    }

    /**
     * Distributed bucket4j proxy manager (lazy — see above). Bucket state lives
     * in Redis (keys are {@code bucket_state:{...}} under the Lettuce CAS
     * backend) and is shared across every application instance. The
     * write-expiration strategy bounds every key's TTL by the refill horizon,
     * capped at the longest configured rate-limit window (15 minutes) — no key
     * outlives its usefulness.
     */
    @Bean
    @Lazy
    public ProxyManager<byte[]> rateLimitProxyManager(
            StatefulRedisConnection<byte[], byte[]> rateLimitRedisConnection) {
        return LettuceBasedProxyManager.builderFor(rateLimitRedisConnection)
                .withExpirationStrategy(ExpirationAfterWriteStrategy
                        .basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(15)))
                .withClientSideConfig(ClientSideConfig.getDefault())
                .build();
    }
}
