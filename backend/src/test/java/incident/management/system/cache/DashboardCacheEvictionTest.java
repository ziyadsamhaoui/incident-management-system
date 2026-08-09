package incident.management.system.cache;

import incident.management.system.config.CacheNames;
import incident.management.system.config.EvictDashboardCaches;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the composed {@link EvictDashboardCaches} annotation (a meta-annotated
 * {@code @Caching} combining two {@code @CacheEvict}s) actually invalidates
 * both the {@code dashboard_stats} and {@code analytics_metrics} caches —
 * guarding against stale dashboards after an incident mutation.
 */
@SpringJUnitConfig(DashboardCacheEvictionTest.TestConfig.class)
@DisplayName("@EvictDashboardCaches composed annotation")
class DashboardCacheEvictionTest {

    @Configuration
    @EnableCaching
    static class TestConfig {

        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager(
                    CacheNames.DASHBOARD_STATS, CacheNames.ANALYTICS_METRICS);
        }

        @Bean
        CacheableService cacheableService() {
            return new CacheableService();
        }

        @Bean
        EvictingService evictingService() {
            return new EvictingService();
        }
    }

    @Service
    static class CacheableService {

        @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'by-status'")
        public String dashboardStats() {
            return "stats";
        }

        @Cacheable(value = CacheNames.ANALYTICS_METRICS, key = "'pareto:window'")
        public String analyticsMetrics() {
            return "pareto";
        }
    }

    @Service
    static class EvictingService {

        @EvictDashboardCaches
        public void mutateIncident() {
            // Simulates create/claim/progress/evaluate/delete in IncidentServiceImpl.
        }
    }

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private CacheableService cacheableService;

    @Autowired
    private EvictingService evictingService;

    @Test
    @DisplayName("a mutation evicts every entry in both caches")
    void mutation_evictsBothCaches() {
        cacheableService.dashboardStats();
        cacheableService.analyticsMetrics();

        assertThat(cacheManager.getCache(CacheNames.DASHBOARD_STATS).get("by-status")).isNotNull();
        assertThat(cacheManager.getCache(CacheNames.ANALYTICS_METRICS).get("pareto:window")).isNotNull();

        evictingService.mutateIncident();

        assertThat(cacheManager.getCache(CacheNames.DASHBOARD_STATS).get("by-status")).isNull();
        assertThat(cacheManager.getCache(CacheNames.ANALYTICS_METRICS).get("pareto:window")).isNull();
    }
}
