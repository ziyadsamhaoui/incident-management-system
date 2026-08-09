package incident.management.system.controller;

import incident.management.system.service.DashboardService;
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
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/statistics/by-status")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByStatus() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByStatus());
    }

    @GetMapping("/statistics/by-priority")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByPriority() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByPriority());
    }

    @GetMapping("/statistics/by-department")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByDepartment() {
        return ResponseEntity.ok(dashboardService.getIncidentsGroupedByDepartment());
    }

    @GetMapping("/recent-activities")
    public ResponseEntity<List<Map<String, Object>>> getRecentIncidentActivities() {
        return ResponseEntity.ok(dashboardService.getRecentIncidentActivities());
    }

    @GetMapping("/activity")
    public ResponseEntity<List<Map<String, Object>>> getActivityLog() {
        return ResponseEntity.ok(dashboardService.getActivityLog());
    }

    @GetMapping("/admin-activity")
    public ResponseEntity<List<Map<String, Object>>> getAdminActivity() {
        return ResponseEntity.ok(dashboardService.getAdminActivity());
    }
}
