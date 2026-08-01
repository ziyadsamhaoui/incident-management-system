package incident.management.system.service;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.dto.IncidentHistoryResponse;
import incident.management.system.dto.IncidentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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

    Page<IncidentResponse> getAllIncidents(Pageable pageable);

    Page<IncidentResponse> getIncidentsByUser(Long userId, Pageable pageable);

    Page<IncidentResponse> getIncidentsByDepartment(Long departmentId, Pageable pageable);

    Page<IncidentResponse> getIncidentsByStatus(String status, Pageable pageable);

    //  6-Stage Lifecycle Methods

    IncidentResponse claimIncident(Long id);

    IncidentResponse progressIncident(Long id);

    IncidentResponse evaluateIncident(Long id, EvaluateIncidentRequest request);

    void deleteIncident(Long id);
}
