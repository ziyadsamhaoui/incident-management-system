package incident.management.system.dto.analytics;

import io.swagger.v3.oas.annotations.media.Schema;

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
@Schema(description = "Volume & speed analytical payload: dense time-bucketed series, exact totals, "
        + "period-over-period deltas and ranked department volume.")
public record VolumeSpeedResponse(
        @Schema(description = "Time-bucketed series, ordered chronologically and gap-free")
        List<Bucket> buckets,
        @Schema(description = "Exact aggregate metrics over the full window")
        Totals totals,
        @Schema(description = "Period-over-period percentage deltas vs the previous window (null when "
                + "the previous period has no comparable data)")
        Deltas deltas,
        @Schema(description = "Total incident volume ranked by department (descending)")
        List<DepartmentVolume> departments
) {

    /**
     * One time bucket. {@code mttrHours} / {@code timeToClaimHours} are null
     * when the bucket contains no resolved / claimed incidents respectively.
     */
    @Schema(description = "One dense time bucket.")
    public record Bucket(
            @Schema(description = "Bucket label (day/week/month granularity)", example = "2026-08-09")
            String label,
            @Schema(description = "Incidents reported in the bucket", example = "18")
            long reported,
            @Schema(description = "Incidents resolved in the bucket", example = "12")
            long resolved,
            @Schema(description = "Incidents evaluated NON_RESOLVED in the bucket", example = "3")
            long nonResolved,
            @Schema(description = "Mean resolution time in hours (null when no resolved)", example = "3.5")
            Double mttrHours,
            @Schema(description = "Mean time-to-claim in hours (null when no claimed)", example = "0.75")
            Double timeToClaimHours
    ) {}

    @Schema(description = "Exact aggregate metrics over the full window.")
    public record Totals(
            @Schema(description = "Total reported incidents", example = "960")
            long reported,
            @Schema(description = "Total resolved incidents", example = "720")
            long resolved,
            @Schema(description = "Total NON_RESOLVED incidents", example = "180")
            long nonResolved,
            @Schema(description = "RESOLVED share of evaluated incidents, in percent", example = "80.0")
            double resolutionRatePct,
            @Schema(description = "Mean resolution time in hours over the window", example = "4.2")
            Double mttrHours,
            @Schema(description = "Mean time-to-claim in hours over the window", example = "0.9")
            Double timeToClaimHours
    ) {}

    /**
     * A single period-over-period percentage change.
     */
    @Schema(description = "A single period-over-period percentage change.")
    public record Delta(
            @Schema(description = "Percentage delta (null when not computable)", example = "-12.5")
            Double pct,
            @Schema(description = "Metric polarity — true when an increase is an improvement "
                    + "(e.g. resolution rate)", example = "true")
            boolean goodWhenUp
    ) {}

    @Schema(description = "Period-over-period deltas of the headline metrics.")
    public record Deltas(
            @Schema(description = "Reported volume delta")
            Delta reported,
            @Schema(description = "Resolution-rate delta")
            Delta resolutionRate,
            @Schema(description = "MTTR delta")
            Delta mttr,
            @Schema(description = "Time-to-claim delta")
            Delta timeToClaim
    ) {}

    /** Ranked department volume within the window. */
    @Schema(description = "Ranked department volume within the window.")
    public record DepartmentVolume(
            @Schema(description = "Department name", example = "Montage")
            String name,
            @Schema(description = "Incident count", example = "412")
            long count
    ) {}
}
