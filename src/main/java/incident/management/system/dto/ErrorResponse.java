package incident.management.system.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
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
public class ErrorResponse {

    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;

    /**
     * Optional map of field-level validation errors.
     * Key = the field name, Value = the validation message.
     */
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
