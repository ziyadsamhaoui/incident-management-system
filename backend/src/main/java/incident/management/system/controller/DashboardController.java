package incident.management.system.controller;

import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentEntity;
import incident.management.system.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
