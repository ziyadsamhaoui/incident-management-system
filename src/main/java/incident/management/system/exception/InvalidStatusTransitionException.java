package incident.management.system.exception;

import incident.management.system.enums.IncidentStatus;

import java.io.Serial;

public class InvalidStatusTransitionException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public InvalidStatusTransitionException(IncidentStatus current, IncidentStatus target) {
        super(String.format("Invalid status transition from %s to %s", current, target));
    }
}
