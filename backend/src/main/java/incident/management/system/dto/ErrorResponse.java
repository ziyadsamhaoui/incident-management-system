package incident.management.system.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Standardized error contract returned to the client whenever an exception is
 * intercepted by {@link incident.management.system.exception.GlobalExceptionHandler}.
 * <p>
 * When validation fails, the {@code errors} map is populated with
 * field-name → error-message entries so the frontend can display
 * precise per-field feedback.
 */
@Data
@Builder
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Standardized error contract returned by the global exception handler. On validation "
        + "failures the `errors` map holds field-name → message entries.")
public class ErrorResponse {

    @Schema(description = "Server-side timestamp of the error", example = "2026-08-09T14:30:00")
    private LocalDateTime timestamp;

    @Schema(description = "HTTP status code", example = "400")
    private int status;

    @Schema(description = "HTTP reason phrase", example = "Bad Request")
    private String error;

    @Schema(description = "Human-readable error message", example = "One or more fields failed validation. See 'errors' for details.")
    private String message;

    /**
     * Optional map of field-level validation errors.
     * Key = the field name, Value = the validation message.
     */
    @Schema(description = "Field-level validation errors (key = field name, value = message)",
            example = "{\"newPassword\": \"Le mot de passe doit contenir au moins 8 caractères\"}")
    private Map<String, String> errors;

    /**
     * Convenience factory for simple (non-validation) errors.
     */
    public static ErrorResponse of(int status, String error, String message) {
        return ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status)
                .error(error)
                .message(message)
                .build();
    }

    /**
     * Convenience factory for validation errors with field-level detail.
     */
    public static ErrorResponse of(int status, String error, String message, Map<String, String> errors) {
        return ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status)
                .error(error)
                .message(message)
                .errors(errors)
                .build();
    }
}
