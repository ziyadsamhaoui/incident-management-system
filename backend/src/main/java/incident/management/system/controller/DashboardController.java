package incident.management.system.controller;

import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.IncidentHistory;
import incident.management.system.repository.IncidentHistoryRepository;
import incident.management.system.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final IncidentRepository incidentRepository;
    private final IncidentHistoryRepository incidentHistoryRepository;

    @GetMapping("/statistics/by-status")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByStatus() {
        List<IncidentEntity> all = incidentRepository.findAll();
        Map<String, Long> stats = all.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getStatus().name(),
                        Collectors.counting()
                ));

        // Ensure all statuses appear even when count is zero
        for (IncidentStatus status : IncidentStatus.values()) {
            stats.putIfAbsent(status.name(), 0L);
        }
        return ResponseEntity.ok(new TreeMap<>(stats));
    }

    @GetMapping("/statistics/by-priority")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByPriority() {
        List<IncidentEntity> all = incidentRepository.findAll();
        Map<String, Long> stats = all.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getPriority().name(),
                        Collectors.counting()
                ));
        for (IncidentPriority priority : IncidentPriority.values()) {
            stats.putIfAbsent(priority.name(), 0L);
        }
        return ResponseEntity.ok(new TreeMap<>(stats));
    }

    @GetMapping("/statistics/by-department")
    public ResponseEntity<Map<String, Long>> getIncidentsGroupedByDepartment() {
        List<IncidentEntity> all = incidentRepository.findAll();
        Map<String, Long> stats = all.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getDepartment() != null ? i.getDepartment().getName() : "Unassigned",
                        Collectors.counting()
                ));
        return ResponseEntity.ok(new TreeMap<>(stats));
    }

    @GetMapping("/recent-activities")
    public ResponseEntity<List<Map<String, Object>>> getRecentIncidentActivities() {
        Page<IncidentEntity> recent = incidentRepository.findAll(
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "declaredAt")));

        List<Map<String, Object>> activities = recent.getContent().stream()
                .map(incident -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id", incident.getId());
                    entry.put("reference", incident.getReference());
                    entry.put("status", incident.getStatus().name());
                    entry.put("priority", incident.getPriority().name());
                    entry.put("department", incident.getDepartment() != null
                            ? incident.getDepartment().getName() : null);
                    entry.put("declaredAt", incident.getDeclaredAt().toString());
                    return entry;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(activities);
    }

    /**
     * Audit activity log — chronological status transitions across all
     * incidents (derived from the incident_history table).
     * Each entry exposes the transition, actor label (when determinable)
     * and the incident reference.
     */
    @GetMapping("/activity")
    public ResponseEntity<List<Map<String, Object>>> getActivityLog() {
        List<IncidentHistory> history = incidentHistoryRepository.findAll(
                Sort.by(Sort.Direction.DESC, "changedAt"))
                .stream()
                .limit(40)
                .toList();

        List<Map<String, Object>> activities = history.stream()
                .map(entry -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", entry.getId());
                    map.put("incidentId", entry.getIncident() != null ? entry.getIncident().getId() : null);
                    map.put("incidentReference", entry.getIncident() != null
                            ? entry.getIncident().getReference() : null);
                    map.put("previousStatus", entry.getPreviousStatus() != null
                            ? entry.getPreviousStatus().name() : null);
                    map.put("currentStatus", entry.getCurrentStatus() != null
                            ? entry.getCurrentStatus().name() : null);
                    map.put("comment", entry.getComment());
                    map.put("changedAt", entry.getChangedAt() != null
                            ? entry.getChangedAt().toString() : null);
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(activities);
    }

    /**
     * Admin evaluation heatmap — number of RESOLVED / NON_RESOLVED
     * evaluations per calendar day over the last 12 months.
     */
    @GetMapping("/admin-activity")
    public ResponseEntity<List<Map<String, Object>>> getAdminActivity() {
        LocalDateTime since = LocalDateTime.now().minusMonths(12);
        List<IncidentHistory> evaluations = incidentHistoryRepository
                .findByCurrentStatusInAndChangedAtAfter(
                        List.of(IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED),
                        since);

        Map<LocalDate, Long> counts = evaluations.stream()
                .filter(h -> h.getChangedAt() != null)
                .collect(Collectors.groupingBy(
                        h -> h.getChangedAt().toLocalDate(),
                        TreeMap::new,
                        Collectors.counting()));

        List<Map<String, Object>> result = counts.entrySet().stream()
                .map(e -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("date", e.getKey().toString());
                    entry.put("count", e.getValue());
                    return entry;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}
