package incident.management.system.exception;

import incident.management.system.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Global {@link RestControllerAdvice} that intercepts exceptions thrown across
 * all controllers and returns a standardized {@link ErrorResponse} payload.
 * <p>
 * Prevents internal stack traces and database details from leaking to the
 * network by returning safe, user-facing messages for generic failures while
 * logging the full root cause server-side.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ──────────────────────────────────────────────
    //  A. Resource & Entity Not Found → 404
    // ──────────────────────────────────────────────

    /**
     * Handles {@link ResourceNotFoundException} (and subclasses like
     * {@code IncidentNotFoundException} / {@code UserNotFoundException} if
     * introduced later).
     * <p>
     * Returns the exception's own message (e.g. "Incident not found with
     * reference: 'INC-20260707-0001'") so the client knows exactly what was
     * requested.
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(
                        HttpStatus.NOT_FOUND.value(),
                        HttpStatus.NOT_FOUND.getReasonPhrase(),
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  B. Illegal Business Logic / State Operations → 400
    // ──────────────────────────────────────────────

    /**
     * Handles {@link InvalidStatusTransitionException} thrown when an incident
     * status transition violates the state machine rules.
     */
    @ExceptionHandler(InvalidStatusTransitionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStatusTransition(InvalidStatusTransitionException ex) {
        log.warn("Invalid status transition: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(
                        HttpStatus.BAD_REQUEST.value(),
                        HttpStatus.BAD_REQUEST.getReasonPhrase(),
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  C. Request Validation Failures → 400
    // ──────────────────────────────────────────────

    /**
     * Handles {@link MethodArgumentNotValidException} triggered when
     * {@code @Valid} annotations on {@code @RequestBody} DTOs fail Hibernate
     * Validator checks.
     * <p>
     * Extracts every field-level violation and populates the {@code errors}
     * map so the frontend can display precise per-field feedback.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationError(MethodArgumentNotValidException ex) {
        log.warn("Validation failed on {} field(s)", ex.getBindingResult().getErrorCount());

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(
                        HttpStatus.BAD_REQUEST.value(),
                        "Validation Failure",
                        "One or more fields failed validation. See 'errors' for details.",
                        fieldErrors));
    }

    // ──────────────────────────────────────────────
    //  D. Illegal Argument / Bad Client Input → 400
    // ──────────────────────────────────────────────

    /**
     * Handles {@link IllegalArgumentException} thrown by service-layer
     * validation (e.g. invalid/expired password reset token). These are
     * client errors, not server failures, so they map to 400 rather than 500.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(
                        HttpStatus.BAD_REQUEST.value(),
                        HttpStatus.BAD_REQUEST.getReasonPhrase(),
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  E. Generic Runtime Catch-All → 500
    // ──────────────────────────────────────────────

    /**
     * Catch-all for any unhandled {@link Exception}. Returns a safe,
     * generic message to the client while logging the full stack trace
     * server-side so operators can diagnose the root cause.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        log.error("Unhandled exception caught by global handler", ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(
                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                        "An unexpected error occurred. Please contact system support."));
    }
}
