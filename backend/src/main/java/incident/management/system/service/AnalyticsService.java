package incident.management.system.service;

import incident.management.system.dto.analytics.HeatmapResponse;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.dto.analytics.RepeatSignalResponse;
import incident.management.system.dto.analytics.VolumeSpeedResponse;
import incident.management.system.dto.analytics.WorkloadEntry;

import java.time.LocalDate;
import java.util.List;

/**
 * Analytical & quality-engineering queries backing the /analytics page.
 *
 * <p>All metrics are computed on demand from the {@code incidents} table with
 * database-level time bucketing ({@code DATE_TRUNC}) and SQL window functions —
 * the service never pulls raw unbounded datasets to aggregate in memory.
 */
public interface AnalyticsService {

    /**
     * Time-bucketed volume/speed analytics over {@code [start, end]}.
     *
     * @param compare when true, also computes period-over-period deltas against
     *                the previous window of identical length.
     */
    VolumeSpeedResponse getVolumeSpeed(LocalDate start, LocalDate end,
                                       Long departmentId, boolean compare);

    /** Category Pareto (80/20) analysis over the window. */
    ParetoResponse getPareto(LocalDate start, LocalDate end, Long departmentId);

    /** Hour-of-day × day-of-week incident density matrix over the window. */
    HeatmapResponse getHeatmap(LocalDate start, LocalDate end, Long departmentId);

    /** Rule-based repeat-incident signals (≥ 3 same station+category in 14 days). */
    RepeatSignalResponse getRepeatSignals(LocalDate start, LocalDate end, Long departmentId);

    /** ADMIN-scoped aggregate team workload per evaluator. */
    List<WorkloadEntry> getWorkload(LocalDate start, LocalDate end, Long departmentId);
}
