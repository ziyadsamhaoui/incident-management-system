package incident.management.system.dto;

import java.util.List;

/**
 * On-demand per-user activity analytics for {@code GET /api/users/{id}/activity}.
 * <p>
 * All metrics are computed at request time via SQL {@code COUNT(*)} /
 * {@code AVG(...)} — there are no denormalized counters.
 *
 * @param declaredCount        incidents declared by the user
 * @param openCount            declared incidents currently in an open (non-terminal) state
 * @param resolvedCount        incidents resolved (RESOLVED / NON_RESOLVED) by the user
 * @param terminalCount        declared incidents that reached a terminal state (RESOLVED / NON_RESOLVED)
 * @param claimedCount         incidents claimed by the user
 * @param avgTimeToClaimMinutes average time between declaration and claim, in minutes
 * @param avgMttrMinutes       average time between declaration and resolution, in minutes
 * @param declaredByDay        per-day buckets of declarations ({@code YYYY-MM-DD})
 * @param resolvedByDay        per-day buckets of resolutions ({@code YYYY-MM-DD})
 */
public record UserActivityResponse(
        long declaredCount,
        long openCount,
        long resolvedCount,
        long terminalCount,
        long claimedCount,
        double avgTimeToClaimMinutes,
        double avgMttrMinutes,
        List<DayCount> declaredByDay,
        List<DayCount> resolvedByDay
) {

    /**
     * A single {@code YYYY-MM-DD} bucket of an aggregated count.
     */
    public record DayCount(String date, long count) {}
}
