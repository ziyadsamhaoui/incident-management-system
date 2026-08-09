package incident.management.system.controller;

import incident.management.system.dto.analytics.HeatmapResponse;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.dto.analytics.RepeatSignalResponse;
import incident.management.system.dto.analytics.VolumeSpeedResponse;
import incident.management.system.dto.analytics.WorkloadEntry;
import incident.management.system.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Analytical & quality-engineering endpoints powering the /analytics page.
 *
 * <p>Every query is parameterised with the active date window — no hardcoded
 * year/month boundaries — and all time-bucketing happens at the database
 * layer ({@code DATE_TRUNC} / window functions). The workload endpoint is the
 * only ADMIN-scoped surface and is deliberately framed as aggregate
 * team-health data, never a competitive ranking.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * Time-bucketed volume, resolution quality, MTTR, time-to-claim and
     * period-over-period deltas (when {@code compare=true}).
     */
    @GetMapping("/volume-speed")
    public ResponseEntity<VolumeSpeedResponse> getVolumeSpeed(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(defaultValue = "false") boolean compare) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getVolumeSpeed(start, end, departmentId, compare));
    }

    /** Category Pareto (80/20) analysis with server-side cumulative percentages. */
    @GetMapping("/pareto")
    public ResponseEntity<ParetoResponse> getPareto(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long departmentId) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getPareto(start, end, departmentId));
    }

    /** Hour-of-day × day-of-week shift heatmap matrix. */
    @GetMapping("/heatmap")
    public ResponseEntity<HeatmapResponse> getHeatmap(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long departmentId) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getHeatmap(start, end, departmentId));
    }

    /** Rule-based repeat-incident signals (≥ 3 same station+category in 14 days). */
    @GetMapping("/repeat-signals")
    public ResponseEntity<RepeatSignalResponse> getRepeatSignals(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long departmentId) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getRepeatSignals(start, end, departmentId));
    }

    /**
     * ADMIN-scoped aggregate team workload — resolution throughput and mean
     * resolution duration per evaluator. Strictly workload-balancing data;
     * no ranking or gamified callouts are exposed.
     */
    @GetMapping("/workload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<WorkloadEntry>> getWorkload(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long departmentId) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getWorkload(start, end, departmentId));
    }
}
