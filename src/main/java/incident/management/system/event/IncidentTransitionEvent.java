package incident.management.system.event;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentEntity;

// Event triggered when an incident transitions from one status to another
public record IncidentTransitionEvent(
        IncidentEntity incident,
        IncidentStatus previousStatus,
        IncidentStatus newStatus,
        Long actorUserId
) {}
