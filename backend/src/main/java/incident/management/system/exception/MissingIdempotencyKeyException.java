package incident.management.system.exception;

/**
 * Thrown when a {@link incident.management.system.idempotency.Idempotent}
 * endpoint with {@code required = true} receives no (or a blank)
 * {@code X-Idempotency-Key} header.
 *
 * <p>Mapped to {@code HTTP 400 Bad Request} by {@link GlobalExceptionHandler}.
 */
public class MissingIdempotencyKeyException extends RuntimeException {

    public MissingIdempotencyKeyException(String headerName) {
        super("Missing required header '" + headerName
                + "'. Generate a unique UUID per submission attempt.");
    }
}
