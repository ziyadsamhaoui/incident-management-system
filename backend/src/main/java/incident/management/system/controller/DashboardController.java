package incident.management.system.controller;

import incident.management.system.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Dashboard read endpoints. All aggregation logic lives in
 * {@link DashboardService}, where results are cached in Redis
 * ({@code dashboard_stats}, 90s TTL) and evicted on every incident mutation.
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard",
        description = "Dashboard aggregation endpoints for any authenticated role. Results are cached in "
                + "Redis (90s TTL) and evicted on every incident mutation.")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/statistics/by-status")
    @Operation(summary = "Incident counts grouped by status",
            description = "Map of status → incident count, e.g. {\"DECLARED\": 4, \"IN_PROGRESS\": 2}.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Counts by status",
                    content = @Content(schema = @Schema(type = "object", example = "{\"DECLARED\": 4, \"CLAIMED\": 1, \"IN_PROGRESS\": 2, \"RESOLVED\": 9, \"NON_RESOLVED\": 3}")))
    })
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByStatus() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByStatus());
    }

    @GetMapping("/statistics/by-priority")
    @Operation(summary = "Incident counts grouped by priority",
            description = "Map of priority → incident count, e.g. {\"HIGH\": 3}.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Counts by priority",
                    content = @Content(schema = @Schema(type = "object", example = "{\"LOW\": 2, \"MEDIUM\": 6, \"HIGH\": 3, \"CRITICAL\": 1}")))
    })
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByPriority() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByPriority());
    }

    @GetMapping("/statistics/by-department")
    @Operation(summary = "Incident counts grouped by department",
            description = "Map of department name → incident count.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Counts by department",
                    content = @Content(schema = @Schema(type = "object", example = "{\"Montage\": 12}")))
    })
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByDepartment() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByDepartment());
    }

    @GetMapping("/recent-activities")
    @Operation(summary = "Recent incident activities",
            description = "Chronological feed of recent incident activity entries (list of key/value objects).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Recent activities",
                    content = @Content(schema = @Schema(type = "array")))
    })
    public ResponseEntity<List<Map<String, Object>>> getRecentIncidentActivities() {
        return ResponseEntity.ok(dashboardService.getRecentIncidentActivities());
    }

    @GetMapping("/activity")
    @Operation(summary = "Audit activity log",
            description = "Audit log feed of system activity entries (list of key/value objects).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Activity log",
                    content = @Content(schema = @Schema(type = "array")))
    })
    public ResponseEntity<List<Map<String, Object>>> getActivityLog() {
        return ResponseEntity.ok(dashboardService.getActivityLog());
    }

    @GetMapping("/admin-activity")
    @Operation(summary = "Admin evaluation activity",
            description = "Evaluation counts per calendar day over the last 12 months — feeds the admin "
                    + "contribution heatmap. List of key/value objects.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Admin activity",
                    content = @Content(schema = @Schema(type = "array")))
    })
    public ResponseEntity<List<Map<String, Object>>> getAdminActivity() {
        return ResponseEntity.ok(dashboardService.getAdminActivity());
    }
}
