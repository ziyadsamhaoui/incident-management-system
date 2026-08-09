package incident.management.system.service;

import incident.management.system.config.CacheNames;
import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.IncidentHistory;
import incident.management.system.repository.IncidentHistoryRepository;
import incident.management.system.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Read-heavy dashboard aggregations.
 *
 * <p>Every aggregation is {@code @Cacheable} in the shared
 * {@link CacheNames#DASHBOARD_STATS} cache (TTL 90s, configured in
 * {@code RedisConfig}). Cache keys are explicit string literals — the methods
 * take no parameters, so without them every entry would collide on the same
 * {@code SimpleKey.EMPTY}.
 *
 * <p>The cache is evicted wholesale by {@code @EvictDashboardCaches} on every
 * incident status mutation, so the dashboards never serve data older than the
 * last state change (bounded by the TTL as a safety net).
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final IncidentRepository incidentRepository;
    private final IncidentHistoryRepository incidentHistoryRepository;

    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'by-status'")
    public Map<String, Long> getIncidentsGroupedByStatus() {
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
        return new TreeMap<>(stats);
    }

    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'by-priority'")
    public Map<String, Long> getIncidentsGroupedByPriority() {
        List<IncidentEntity> all = incidentRepository.findAll();
        Map<String, Long> stats = all.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getPriority().name(),
                        Collectors.counting()
                ));
        for (IncidentPriority priority : IncidentPriority.values()) {
            stats.putIfAbsent(priority.name(), 0L);
        }
        return new TreeMap<>(stats);
    }

    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'by-department'")
    public Map<String, Long> getIncidentsGroupedByDepartment() {
        List<IncidentEntity> all = incidentRepository.findAll();
        Map<String, Long> stats = all.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getDepartment() != null ? i.getDepartment().getName() : "Unassigned",
                        Collectors.counting()
                ));
        return new TreeMap<>(stats);
    }

    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'recent-activities'")
    public List<Map<String, Object>> getRecentIncidentActivities() {
        Page<IncidentEntity> recent = incidentRepository.findAll(
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "declaredAt")));

        return recent.getContent().stream()
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
    }

    /**
     * Audit activity log — chronological status transitions across all
     * incidents (derived from the incident_history table).
     */
    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'activity'")
    public List<Map<String, Object>> getActivityLog() {
        List<IncidentHistory> history = incidentHistoryRepository.findAll(
                Sort.by(Sort.Direction.DESC, "changedAt"))
                .stream()
                .limit(40)
                .toList();

        return history.stream()
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
    }

    /**
     * Admin evaluation heatmap — number of RESOLVED / NON_RESOLVED
     * evaluations per calendar day over the last 12 months.
     */
    @Cacheable(value = CacheNames.DASHBOARD_STATS, key = "'admin-activity'")
    public List<Map<String, Object>> getAdminActivity() {
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

        return result;
    }
}
