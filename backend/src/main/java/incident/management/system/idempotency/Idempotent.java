package incident.management.system.idempotency;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method as idempotent: the client must send a unique
 * {@code X-Idempotency-Key} header per logical operation attempt.
 *
 * <p>{@link IdempotencyAspect} enforces the contract:
 * <ol>
 *   <li>an atomic {@code SETNX idempotency:{key}} lock (TTL = {@link #ttlSeconds()})
 *       is taken before the method executes;</li>
 *   <li>a retry with the same key inside the TTL window is answered with the
 *       cached successful response, or {@code 409 Conflict} while the first
 *       attempt is still in flight;</li>
 *   <li>a failed attempt releases the lock so the operator can retry.</li>
 * </ol>
 *
 * <p>Use on write endpoints whose double-submission would corrupt data —
 * primarily incident creation over flaky factory Wi-Fi.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {

    /**
     * The header carrying the per-attempt client-generated UUID.
     */
    String headerName() default "X-Idempotency-Key";

    /**
     * Width of the deduplication window. The lock — and any cached response —
     * expire after this many seconds, allowing the same key to be reused later.
     */
    long ttlSeconds() default 30;

    /**
     * When {@code true} (default), a missing/blank header is rejected with
     * {@code 400 Bad Request} before the method runs. Set to {@code false} for
     * endpoints where the header is optional (defense-in-depth only).
     */
    boolean required() default true;
}
