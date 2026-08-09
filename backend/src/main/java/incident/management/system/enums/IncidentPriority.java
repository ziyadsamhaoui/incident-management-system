package incident.management.system.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Incident priority level.")
public enum IncidentPriority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
