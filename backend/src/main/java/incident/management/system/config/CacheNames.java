package incident.management.system.config;

/**
 * Central registry of Spring Cache cache names (Redis cache keys are prefixed
 * with these values by {@link RedisCacheManager}).
 *
 * <p>Keeping the names in one place guarantees the {@code @Cacheable} /
 * {@code @CacheEvict} annotations and the per-cache TTL map in {@link RedisConfig}
 * can never drift apart.
 */
public final class CacheNames {

    /** Read-heavy dashboard aggregations (status / priority / department stats…). */
    public static final String DASHBOARD_STATS = "dashboard_stats";

    /** Date-bucketed analytics aggregations (volume-speed, pareto, heatmap…). */
    public static final String ANALYTICS_METRICS = "analytics_metrics";

    private CacheNames() {
        // Constants holder — never instantiated.
    }
}
