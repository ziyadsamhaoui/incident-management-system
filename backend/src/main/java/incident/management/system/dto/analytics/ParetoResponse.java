package incident.management.system.dto.analytics;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Response of {@code GET /api/analytics/pareto} — the industrial Pareto
 * (80/20) analysis of incident categories.
 *
 * <p>Sorting, cumulative percentages and the 80% insight are all computed
 * server-side from the aggregated rows; the client only renders.
 */
@Schema(description = "Industrial Pareto (80/20) analysis of incident categories — cumulative percentages "
        + "and the 80% insight are computed server-side.")
public record ParetoResponse(
        @Schema(description = "Categories sorted strictly descending by incident count")
        List<Category> categories,
        @Schema(description = "Total incidents considered by the analysis", example = "960")
        long totalCount,
        @Schema(description = "80% threshold insight — null when there are no incidents")
        Insight insight
) {

    /**
     * @param cumulativePct running share (0–100) once the category and every
     *                      category before it (higher count) are summed.
     */
    @Schema(description = "One Pareto category row.")
    public record Category(
            @Schema(description = "Category name", example = "Mécanique")
            String name,
            @Schema(description = "Incident count for this category", example = "412")
            long count,
            @Schema(description = "Running cumulative share (0–100)", example = "42.9")
            double cumulativePct
    ) {}

    /**
     * {@code N of M categories account for P% of all recorded incidents}.
     */
    @Schema(description = "Pareto 80% insight.")
    public record Insight(
            @Schema(description = "Number of top categories whose combined share first reaches 80%", example = "3")
            int categoriesTo80,
            @Schema(description = "Total distinct categories", example = "12")
            int totalCategories,
            @Schema(description = "Combined share (0–100) of those top categories", example = "86.4")
            double pctCovered
    ) {}
}
