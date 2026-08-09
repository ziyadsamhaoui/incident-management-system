package incident.management.system.exception;

import incident.management.system.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.LinkedHashMap;
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
    //  A. Account Unclaimed → 403
    // ──────────────────────────────────────────────

    /**
     * Handles {@link AccountUnclaimedException} thrown when a CHEF_ATELIER
     * user tries to log in but has not claimed their account yet
     * ({@code passwordHash IS NULL}).
     * <p>
     * Returns a structured JSON payload the frontend can use to redirect
     * the user to the claim-account flow.
     */
    @ExceptionHandler(AccountUnclaimedException.class)
    public ResponseEntity<Map<String, String>> handleAccountUnclaimed(AccountUnclaimedException ex) {
        log.warn("Account unclaimed: {}", ex.getMessage());
        Map<String, String> body = new LinkedHashMap<>();
        body.put("code", ex.getCode());
        body.put("message", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(body);
    }

    // ──────────────────────────────────────────────
    //  B. Resource & Entity Not Found → 404
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
    //  D2. Attachment Policy Violation → 4xx (status carried by the exception)
    // ──────────────────────────────────────────────

    /**
     * Handles {@link AttachmentPolicyException} (terminal-state lock, attachment
     * count/size/MIME limits, storage access denied…). The HTTP status is carried
     * by the exception itself (400 / 403 / 404 / 409).
     */
    @ExceptionHandler(AttachmentPolicyException.class)
    public ResponseEntity<ErrorResponse> handleAttachmentPolicy(AttachmentPolicyException ex) {
        log.warn("Attachment policy violation ({}): {}", ex.getStatus(), ex.getMessage());
        return ResponseEntity
                .status(ex.getStatus())
                .body(ErrorResponse.of(
                        ex.getStatus().value(),
                        ex.getStatus().getReasonPhrase(),
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  D2b. Missing static resource → 404
    //  (e.g. /swagger-ui/index.html when the docs are disabled in the
    //  current profile — never a 500).
    // ──────────────────────────────────────────────

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("Static resource not found: {}", ex.getResourcePath());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(
                        HttpStatus.NOT_FOUND.value(),
                        HttpStatus.NOT_FOUND.getReasonPhrase(),
                        "Resource not found."));
    }

    // ──────────────────────────────────────────────
    //  D3. Type-Mismatch / Multipart Errors → 400
    // ──────────────────────────────────────────────

    /**
     * Handles {@link MethodArgumentTypeMismatchException} (e.g. an invalid
     * {@code fileType} enum value on the media upload endpoint) as a 400
     * instead of falling into the generic 500 catch-all.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Bad request (type mismatch on '{}'): {}", ex.getName(), ex.getMessage());
        return ResponseEntity.badRequest().body(ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Paramètre invalide : " + ex.getName()));
    }

    /**
     * Handles {@link MultipartException} (malformed multipart body, missing
     * part, or a file exceeding {@code spring.servlet.multipart.max-file-size})
     * as a 400 — client input problem, never a server failure.
     */
    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipart(MultipartException ex) {
        log.warn("Multipart upload rejected: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Requête multipart invalide ou fichier trop volumineux."));
    }

    // ──────────────────────────────────────────────
    //  D4. Idempotency Failures → 409 / 400
    // ──────────────────────────────────────────────

    /**
     * Handles {@link IdempotencyConflictException} — a duplicate request with
     * the same {@code X-Idempotency-Key} arrived while the first attempt is
     * still being processed. The client should either wait for the in-flight
     * response or re-query the created resource.
     */
    @ExceptionHandler(IdempotencyConflictException.class)
    public ResponseEntity<ErrorResponse> handleIdempotencyConflict(IdempotencyConflictException ex) {
        log.warn("Idempotency conflict: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of(
                        HttpStatus.CONFLICT.value(),
                        "Conflict",
                        ex.getMessage()));
    }

    /**
     * Handles {@link MissingIdempotencyKeyException} — a protected endpoint
     * requires the {@code X-Idempotency-Key} header and it was absent.
     */
    @ExceptionHandler(MissingIdempotencyKeyException.class)
    public ResponseEntity<ErrorResponse> handleMissingIdempotencyKey(MissingIdempotencyKeyException ex) {
        log.warn("Missing idempotency key: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(
                        HttpStatus.BAD_REQUEST.value(),
                        "Bad Request",
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  E. Rate Limiting Exceeded → 429
    // ──────────────────────────────────────────────

    /**
     * Handles {@link RateLimitExceededException} thrown when a client has
     * exceeded the allowed request rate. Returns HTTP 429 with a descriptive
     * message and the retry-after hint embedded in the response body.
     * <p>
     * Note: In the filter-based rate-limiting flow, the 429 response is
     * written directly by {@code RateLimitingFilter}. This handler serves
     * as a safety net for any rate-limit exceptions that propagate from
     * deeper layers.
     */
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleRateLimitExceeded(RateLimitExceededException ex) {
        log.warn("Rate limit exceeded: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .body(ErrorResponse.of(
                        HttpStatus.TOO_MANY_REQUESTS.value(),
                        "Too Many Requests",
                        ex.getMessage()));
    }

    // ──────────────────────────────────────────────
    //  F. Generic Runtime Catch-All → 500
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
