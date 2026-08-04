package incident.management.system.exception;

import org.springframework.http.HttpStatus;

/**
 * Business-rule violation in the media-attachment pipeline (terminal-state
 * lock, per-incident count limit, per-type size limits, MIME mismatch, …).
 * Carries the HTTP status the {@link GlobalExceptionHandler} should answer with.
 */
public class AttachmentPolicyException extends RuntimeException {

    private final HttpStatus status;

    public AttachmentPolicyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
