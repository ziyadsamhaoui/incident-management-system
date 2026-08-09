package incident.management.system.dto.analytics;

import java.util.List;

/**
 * Response of {@code GET /api/analytics/volume-speed} — the analytical payload
 * behind the "Volume & Speed" trend widgets.
 *
 * <p>All aggregation is computed at the database layer ({@code DATE_TRUNC})
 * and the {@code buckets} series is dense: the service fills every slot
 * between the window boundaries with zero-counts, so the client never needs
 * to fabricate missing points.
 */
public record VolumeSpeedResponse(
        /** Time-bucketed series, ordered chronologically and gap-free. */
        List<Bucket> buckets,
        /** Exact aggregate metrics over the full window. */
        Totals totals,
        /**
         * Period-over-period percentage deltas vs. the previous window of the
         * same length. All {@code pct} fields are {@code null} when the
         * previous period has no comparable data (zero denominator).
         */
        Deltas deltas,
        /** Total incident volume ranked by department (descending). */
        List<DepartmentVolume> departments
) {

    /**
     * One time bucket. {@code mttrHours} / {@code timeToClaimHours} are null
     * when the bucket contains no resolved / claimed incidents respectively.
     */
    public record Bucket(
            String label,
            long reported,
            long resolved,
            long nonResolved,
            Double mttrHours,
            Double timeToClaimHours
    ) {}

    public record Totals(
            long reported,
            long resolved,
            long nonResolved,
            /** RESOLVED share of evaluated (RESOLVED + NON_RESOLVED) incidents, in percent. */
            double resolutionRatePct,
            Double mttrHours,
            Double timeToClaimHours
    ) {}

    /**
     * A single period-over-period percentage change.
     *
     * @param pct        percentage delta ({@code null} when not computable)
     * @param goodWhenUp metric polarity — {@code true} for metrics where an
     *                   increase is an improvement (e.g. resolution rate),
     *                   {@code false} where a decrease is better (volume, MTTR,
     *                   time-to-claim). Lets the client colour the badge without
     *                   hardcoding business rules.
     */
    public record Delta(Double pct, boolean goodWhenUp) {}

    public record Deltas(
            Delta reported,
            Delta resolutionRate,
            Delta mttr,
            Delta timeToClaim
    ) {}

    /** Ranked department volume within the window. */
    public record DepartmentVolume(String name, long count) {}
}
