package incident.management.system.dto.analytics;

import java.util.List;

/**
 * Response of {@code GET /api/analytics/pareto} — the industrial Pareto
 * (80/20) analysis of incident categories.
 *
 * <p>Sorting, cumulative percentages and the 80% insight are all computed
 * server-side from the aggregated rows; the client only renders.
 */
public record ParetoResponse(
        /** Categories sorted strictly descending by incident count. */
        List<Category> categories,
        /** Total incidents considered by the analysis. */
        long totalCount,
        /** 80% threshold insight; {@code null} when there are no incidents. */
        Insight insight
) {

    /**
     * @param cumulativePct running share (0–100) once the category and every
     *                      category before it (higher count) are summed.
     */
    public record Category(String name, long count, double cumulativePct) {}

    /**
     * {@code N of M categories account for P% of all recorded incidents}.
     *
     * @param categoriesTo80 number of top categories whose combined share
     *                       first reaches the 80% threshold
     * @param totalCategories total distinct categories
     * @param pctCovered      combined share (0–100) of those top categories
     */
    public record Insight(int categoriesTo80, int totalCategories, double pctCovered) {}
}
