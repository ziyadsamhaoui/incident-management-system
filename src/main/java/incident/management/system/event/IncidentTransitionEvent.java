package incident.management.system.event;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentEntity;

/**
 * Domain event published whenever an incident transitions from one status to
 * another. Consumed by {@link incident.management.system.listener.IncidentNotificationListener}
 * to create notifications without coupling notification logic into the
 * incident service.
 *
 * @param incident    the incident that transitioned (attached to a committed
 *                    transaction when received via {@code AFTER_COMMIT})
 * @param previousStatus the status before the transition
 * @param newStatus      the status after the transition
 * @param actorUserId    the ID of the user who triggered the transition, or
 *                       {@code null} if the transition was triggered by the
 *                       system (e.g. auto-closure scheduler)
 */
public record IncidentTransitionEvent(
        IncidentEntity incident,
        IncidentStatus previousStatus,
        IncidentStatus newStatus,
        Long actorUserId
) {}
