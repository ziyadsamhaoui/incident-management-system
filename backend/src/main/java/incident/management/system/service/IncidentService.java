package incident.management.system.service;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.dto.IncidentHistoryResponse;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.enums.IncidentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface IncidentService {

    IncidentResponse createIncident(CreateIncidentRequest request);

    IncidentResponse getIncidentById(Long id);

    IncidentResponse getIncidentByReference(String reference);

    /**
     * Full chronological audit trail for a single incident.
     */
    List<IncidentHistoryResponse> getIncidentHistory(Long id);

    /**
     * Aging incidents — currently in {@code CLAIMED} or {@code IN_PROGRESS}
     * for longer than the staleness threshold (2 hours).
     */
    List<IncidentResponse> getStaleIncidents();

    /**
     * All incidents, combinable filters:
     *
     * @param statuses     optional terminal/active status group (empty = all statuses)
     * @param search       optional case-insensitive term matched against reference,
     *                     description and resolutionNote
     * @param departmentId optional department filter
     * @param userId       optional declaring-user filter
     * @param startDate    optional inclusive lower bound on the {@code dateField} column
     * @param endDate      optional inclusive upper bound on the {@code dateField} column
     * @param dateField    timestamp column used by the date range
     *                     ({@code declaredAt} by default, {@code resolvedAt} for Logs)
     * @param pageable     pagination + sort (e.g. {@code sort=resolvedAt,desc})
     */
    Page<IncidentResponse> getFilteredIncidents(List<IncidentStatus> statuses,
                                                String search,
                                                Long departmentId,
                                                Long userId,
                                                LocalDate startDate,
                                                LocalDate endDate,
                                                String dateField,
                                                Pageable pageable);

    //  6-Stage Lifecycle Methods

    IncidentResponse claimIncident(Long id);

    IncidentResponse progressIncident(Long id);

    IncidentResponse evaluateIncident(Long id, EvaluateIncidentRequest request);

    void deleteIncident(Long id);
}
