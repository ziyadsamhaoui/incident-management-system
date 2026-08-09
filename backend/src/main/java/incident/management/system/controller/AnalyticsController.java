package incident.management.system.controller;

import incident.management.system.dto.analytics.HeatmapResponse;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.dto.analytics.RepeatSignalResponse;
import incident.management.system.dto.analytics.VolumeSpeedResponse;
import incident.management.system.dto.analytics.WorkloadEntry;
import incident.management.system.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Analytics",
        description = "Historical analytics & quality-engineering endpoints. Shared parameters: "
                + "startDate/endDate (ISO dates, inclusive; default = rolling last-30-days) and optional "
                + "departmentId. All time-bucketing and Pareto/recurrence math runs in PostgreSQL.")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * Time-bucketed volume, resolution quality, MTTR, time-to-claim and
     * period-over-period deltas (when {@code compare=true}).
     */
    @GetMapping("/volume-speed")
    @Operation(summary = "Volume & speed trends",
            description = "Dense, gap-free time-bucketed series (day ≤ 32 days, week ≤ 120 days, month "
                    + "beyond) of reported/resolved/nonResolved incidents plus exact window totals "
                    + "(resolution rate, MTTR, time-to-claim) and ranked department volume. When "
                    + "compare=true, period-over-period percentage deltas vs. the previous identical-length "
                    + "window are included.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Volume & speed payload",
                    content = @Content(schema = @Schema(implementation = VolumeSpeedResponse.class))),
            @ApiResponse(responseCode = "400", description = "endDate before startDate")
    })
    public ResponseEntity<VolumeSpeedResponse> getVolumeSpeed(
            @Parameter(description = "Inclusive lower bound (ISO yyyy-MM-dd); default = 29 days ago")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Inclusive upper bound (ISO yyyy-MM-dd); default = today")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Filter by department id")
            @RequestParam(required = false) Long departmentId,
            @Parameter(description = "Include period-over-period deltas vs the previous window")
            @RequestParam(defaultValue = "false") boolean compare) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().minusDays(29);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return ResponseEntity.ok(analyticsService.getVolumeSpeed(start, end, departmentId, compare));
    }

    /** Category Pareto (80/20) analysis with server-side cumulative percentages. */
    @GetMapping("/pareto")
    @Operation(summary = "Category Pareto (80/20) analysis",
            description = "Incident categories sorted strictly descending by count with server-side "
                    + "cumulative percentages and the 80% threshold insight (categoriesTo80 / totalCategories "
                    + "/ pctCovered).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Pareto payload",
                    content = @Content(schema = @Schema(implementation = ParetoResponse.class))),
            @ApiResponse(responseCode = "400", description = "endDate before startDate")
    })
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
    @Operation(summary = "Shift heatmap (hour × day-of-week)",
            description = "Sparse 2D matrix cells (dayOfWeek 0 = Monday … 6 = Sunday, hour 0-23) with "
                    + "incident counts per slot, used to surface peak failure windows. Only non-zero cells "
                    + "are returned.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Heatmap payload",
                    content = @Content(schema = @Schema(implementation = HeatmapResponse.class))),
            @ApiResponse(responseCode = "400", description = "endDate before startDate")
    })
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
    @Operation(summary = "Repeat-incident signals",
            description = "Rule-based recurrence detection via SQL windowing: a station reporting the same "
                    + "category ≥ 3 times within any 14-day window. Each signal carries group stats "
                    + "(incident count, first/last occurrence) and a deep link into the latest incident.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Repeat signals",
                    content = @Content(schema = @Schema(implementation = RepeatSignalResponse.class))),
            @ApiResponse(responseCode = "400", description = "endDate before startDate")
    })
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
    @Operation(summary = "Team workload per evaluator (ADMIN only)",
            description = "ADMIN-only aggregate team-health snapshot per evaluator: claimed/resolved/"
                    + "nonResolved counts and mean resolution hours. Deliberately workload-balancing data — "
                    + "no derived rank or score is exposed.")
    @ApiResponses({
            // Array schema is derived from the List<WorkloadEntry> return type.
            @ApiResponse(responseCode = "200", description = "Workload entries (WorkloadEntry[])"),
            @ApiResponse(responseCode = "400", description = "endDate before startDate"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
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
