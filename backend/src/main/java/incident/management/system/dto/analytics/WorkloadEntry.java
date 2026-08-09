package incident.management.system.dto.analytics;

/**
 * One row of {@code GET /api/analytics/workload} — an aggregate, team-health
 * oriented workload snapshot per ADMIN / CHEF_ATELIER evaluator.
 *
 * <p>Deliberately framed as workload-balancing data (never a competitive
 * ranking): fields describe throughput and average handling time, and no
 * derived rank/score is exposed.
 */
public record WorkloadEntry(
        Long userId,
        String firstName,
        String lastName,
        /** Incidents this user claimed (took into charge) in the window. */
        long claimedCount,
        /** Incidents evaluated as RESOLVED by this user in the window. */
        long resolvedCount,
        /** Incidents evaluated as NON_RESOLVED by this user in the window. */
        long nonResolvedCount,
        /** Total evaluations (RESOLVED + NON_RESOLVED). */
        long evaluatedCount,
        /** Mean resolution duration in hours (RESOLVED only); null when none. */
        Double avgResolutionHours
) {}
