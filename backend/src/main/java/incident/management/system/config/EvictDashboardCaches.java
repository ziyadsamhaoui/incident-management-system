package incident.management.system.config;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Composed caching annotation applied to every incident <em>mutation</em>
 * (create, claim, progress, evaluate, delete).
 *
 * <p>Status changes invalidate both read-heavy aggregation caches at once:
 * the dashboard stats ({@link CacheNames#DASHBOARD_STATS}) and the analytics
 * metrics ({@link CacheNames#ANALYTICS_METRICS}). {@code allEntries = true} is
 * required because the aggregation keys are derived from time windows and
 * department scopes that are not known at mutation time.
 *
 * <p>{@code beforeInvocation = true} evicts <em>before</em> the mutation runs
 * rather than after it returns: with {@code @Transactional} the default
 * post-invocation eviction can fire before the commit lands, letting a
 * concurrent dashboard read repopulate the cache with pre-commit data. A
 * failed mutation then only costs a cache miss on the next read.
 */
@Caching(evict = {
        @CacheEvict(value = CacheNames.DASHBOARD_STATS, allEntries = true, beforeInvocation = true),
        @CacheEvict(value = CacheNames.ANALYTICS_METRICS, allEntries = true, beforeInvocation = true)
})
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface EvictDashboardCaches {
}
