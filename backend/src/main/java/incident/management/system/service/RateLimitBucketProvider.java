package incident.management.system.service;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;

/**
 * Abstraction over the bucket store used by {@link RateLimitingService}.
 *
 * <p>Production uses the Redis-backed {@link RedisRateLimitBucketProvider}
 * (bucket4j {@code ProxyManager} → Lettuce) so bucket state survives restarts
 * and is shared across horizontally scaled instances. Unit tests substitute a
 * plain in-memory fake — the production path never keeps bucket state in the
 * JVM heap.
 */
public interface RateLimitBucketProvider {

    /**
     * Returns the bucket for the given key, creating it with {@code configuration}
     * when it does not yet exist. Implementations must apply an explicit
     * expiration policy to every stored bucket so no Redis key lives forever.
     */
    Bucket getBucket(byte[] key, BucketConfiguration configuration);
}
