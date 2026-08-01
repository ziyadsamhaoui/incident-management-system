package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;

import java.time.LocalDateTime;

/**
 * Audit trail entry for a single incident status transition.
 * The {@code actor} is resolved from the incident's own user references
 * (declarer / claimedBy / resolvedBy) when determinable.
 */
public record IncidentHistoryResponse(
        Long id,
        Long incidentId,
        IncidentStatus previousStatus,
        IncidentStatus currentStatus,
        LocalDateTime changedAt,
        String comment,
        UserSummaryResponse actor
) {}
