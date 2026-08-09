package incident.management.system.dto.analytics;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Response of {@code GET /api/analytics/heatmap} — the 2D shift matrix
 * (Hour of Day × Day of Week) used to surface peak failure windows.
 *
 * <p>Only non-zero cells are returned (sparse payload); the client lays them
 * out on the 24×7 grid and derives colour intensity from {@code count}.
 */
@Schema(description = "Sparse hour × day-of-week heatmap matrix (only non-zero cells are returned).")
public record HeatmapResponse(
        @Schema(description = "Non-zero matrix cells")
        List<Cell> cells,
        @Schema(description = "Total incidents covered by the matrix", example = "1280")
        long totalCount
) {

    /**
     * @param dayOfWeek 0 = Monday … 6 = Sunday (ISO-8601 ordering, Monday-first
     *                  so the work week reads left-to-right on the matrix)
     * @param hour      0–23 local hour of the incident declaration
     * @param count     number of incidents declared in that slot
     */
    @Schema(description = "One non-zero heatmap cell.")
    public record Cell(
            @Schema(description = "Day of week — 0 = Monday … 6 = Sunday", example = "1")
            int dayOfWeek,
            @Schema(description = "Local hour of declaration (0–23)", example = "9")
            int hour,
            @Schema(description = "Incidents declared in this slot", example = "37")
            long count
    ) {}
}
