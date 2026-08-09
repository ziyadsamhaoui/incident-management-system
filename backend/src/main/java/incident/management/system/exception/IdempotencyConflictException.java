package incident.management.system.exception;

/**
 * Thrown when a duplicate request carrying the same {@code X-Idempotency-Key}
 * arrives while the first attempt is still being processed (the idempotency
 * lock is held but no response has been cached yet).
 *
 * <p>Mapped to {@code HTTP 409 Conflict} by {@link GlobalExceptionHandler}.
 */
public class IdempotencyConflictException extends RuntimeException {

    private final String idempotencyKey;

    public IdempotencyConflictException(String idempotencyKey) {
        super("A request with this idempotency key is already being processed. Please retry shortly.");
        this.idempotencyKey = idempotencyKey;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }
}
