package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * On-demand per-user activity analytics for {@code GET /api/users/{id}/activity}.
 * <p>
 * All metrics are computed at request time via SQL {@code COUNT(*)} /
 * {@code AVG(...)} — there are no denormalized counters.
 */
@Schema(description = "On-demand per-user activity analytics (computed at request time via SQL).")
public record UserActivityResponse(
        @Schema(description = "Incidents declared by the user", example = "14")
        long declaredCount,
        @Schema(description = "Declared incidents currently in a non-terminal state", example = "3")
        long openCount,
        @Schema(description = "Incidents resolved (RESOLVED / NON_RESOLVED) by the user", example = "11")
        long resolvedCount,
        @Schema(description = "Declared incidents that reached a terminal state", example = "12")
        long terminalCount,
        @Schema(description = "Incidents claimed by the user", example = "9")
        long claimedCount,
        @Schema(description = "Average time between declaration and claim, in minutes", example = "45.5")
        double avgTimeToClaimMinutes,
        @Schema(description = "Average time between declaration and resolution, in minutes", example = "210.75")
        double avgMttrMinutes,
        @Schema(description = "Per-day declaration buckets (YYYY-MM-DD)")
        List<DayCount> declaredByDay,
        @Schema(description = "Per-day resolution buckets (YYYY-MM-DD)")
        List<DayCount> resolvedByDay
) {

    /**
     * A single {@code YYYY-MM-DD} bucket of an aggregated count.
     */
    @Schema(description = "A single day bucket of an aggregated count.")
    public record DayCount(
            @Schema(description = "Bucket date (YYYY-MM-DD)", example = "2026-08-09")
            String date,
            @Schema(description = "Count for that day", example = "4")
            long count
    ) {}
}
