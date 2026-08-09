package incident.management.system.dto;

import incident.management.system.enums.IncidentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Audit trail entry for a single incident status transition.
 * The {@code actor} is resolved from the incident's own user references
 * (declarer / claimedBy / resolvedBy) when determinable.
 */
@Schema(description = "Audit-trail entry for one incident status transition, with the acting user resolved "
        + "server-side.")
public record IncidentHistoryResponse(
        @Schema(description = "History entry primary key", example = "5501")
        Long id,
        @Schema(description = "Parent incident id", example = "1042")
        Long incidentId,
        @Schema(description = "Status before the transition (null for the initial declaration)", example = "DECLARED")
        IncidentStatus previousStatus,
        @Schema(description = "Status after the transition", example = "CLAIMED")
        IncidentStatus currentStatus,
        @Schema(description = "Transition timestamp", example = "2026-08-09T09:02:00")
        LocalDateTime changedAt,
        @Schema(description = "Optional transition comment/note", example = "Prise en charge par l'équipe mécanique")
        String comment,
        @Schema(description = "Acting user (when determinable)")
        UserSummaryResponse actor
) {}
