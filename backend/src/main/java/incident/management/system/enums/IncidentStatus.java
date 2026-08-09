package incident.management.system.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Incident state-machine status. Transitions: DECLARED → CLAIMED → IN_PROGRESS → "
        + "RESOLVED/NON_RESOLVED (terminal). There is no CLOSED status.")
public enum IncidentStatus {
    DECLARED,
    CLAIMED,
    IN_PROGRESS,
    RESOLVED,
    NON_RESOLVED
}
