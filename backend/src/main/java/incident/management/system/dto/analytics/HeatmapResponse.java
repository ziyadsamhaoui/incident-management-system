package incident.management.system.dto.analytics;

import java.util.List;

/**
 * Response of {@code GET /api/analytics/heatmap} — the 2D shift matrix
 * (Hour of Day × Day of Week) used to surface peak failure windows.
 *
 * <p>Only non-zero cells are returned (sparse payload); the client lays them
 * out on the 24×7 grid and derives colour intensity from {@code count}.
 */
public record HeatmapResponse(
        List<Cell> cells,
        long totalCount
) {

    /**
     * @param dayOfWeek 0 = Monday … 6 = Sunday (ISO-8601 ordering, Monday-first
     *                  so the work week reads left-to-right on the matrix)
     * @param hour      0–23 local hour of the incident declaration
     * @param count     number of incidents declared in that slot
     */
    public record Cell(int dayOfWeek, int hour, long count) {}
}
