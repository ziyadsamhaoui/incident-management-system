package incident.management.system.dto.analytics;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One row of {@code GET /api/analytics/workload} — an aggregate, team-health
 * oriented workload snapshot per ADMIN / CHEF_ATELIER evaluator.
 *
 * <p>Deliberately framed as workload-balancing data (never a competitive
 * ranking): fields describe throughput and average handling time, and no
 * derived rank/score is exposed.
 */
@Schema(description = "Aggregate workload snapshot per evaluator — throughput and average handling time, "
        + "deliberately non-competitive.")
public record WorkloadEntry(
        @Schema(description = "Evaluator user id", example = "42")
        Long userId,
        @Schema(description = "Evaluator first name", example = "Yassine")
        String firstName,
        @Schema(description = "Evaluator last name", example = "El Amrani")
        String lastName,
        @Schema(description = "Incidents claimed (taken into charge) in the window", example = "23")
        long claimedCount,
        @Schema(description = "Incidents evaluated RESOLVED in the window", example = "19")
        long resolvedCount,
        @Schema(description = "Incidents evaluated NON_RESOLVED in the window", example = "4")
        long nonResolvedCount,
        @Schema(description = "Total evaluations (RESOLVED + NON_RESOLVED)", example = "23")
        long evaluatedCount,
        @Schema(description = "Mean resolution duration in hours (RESOLVED only; null when none)", example = "3.1")
        Double avgResolutionHours
) {}
