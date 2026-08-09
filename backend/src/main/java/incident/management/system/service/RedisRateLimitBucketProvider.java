package incident.management.system.service;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * Redis-backed {@link RateLimitBucketProvider}.
 *
 * <p>Delegates bucket retrieval to a Lettuce bucket4j {@link ProxyManager}. The
 * bucket <em>state</em> (token counter + refill schedule) is stored in Redis
 * under keys managed by the Lettuce CAS backend, with an explicit write
 * expiration strategy configured in {@code RedisConfig} — so rate-limit
 * budgets survive application restarts and are enforced consistently across
 * every application instance behind the load balancer.
 */
@Component
public class RedisRateLimitBucketProvider implements RateLimitBucketProvider {

    private final ProxyManager<byte[]> proxyManager;

    /**
     * Explicit constructor (not Lombok-generated) so the {@code @Lazy} lands on
     * the constructor <em>parameter</em> — Lombok's {@code @RequiredArgsConstructor}
     * does not copy field annotations to generated parameters without a
     * {@code lombok.config} entry, which would silently turn this into an eager
     * dependency and connect to Redis at application startup.
     */
    public RedisRateLimitBucketProvider(@Lazy ProxyManager<byte[]> proxyManager) {
        this.proxyManager = proxyManager;
    }

    @Override
    public Bucket getBucket(byte[] key, BucketConfiguration configuration) {
        return proxyManager.builder().build(key, configuration);
    }
}
