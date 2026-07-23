package incident.management.system.exception;

import java.io.Serial;

/**
 * Thrown when a client has exceeded the allowed rate limit for a specific
 * API endpoint. Mapped to HTTP 429 Too Many Requests by
 * {@link GlobalExceptionHandler}.
 * <p>
 * Carries the {@code retryAfterSeconds} hint so the error response can
 * inform the client when it is safe to retry.
 */
public class RateLimitExceededException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    private final long retryAfterSeconds;

    public RateLimitExceededException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /**
     * Returns the number of seconds the client should wait before retrying.
     */
    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
