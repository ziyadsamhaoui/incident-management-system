package incident.management.system.service;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.dto.UpdateIncidentStatusRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface IncidentService {

    IncidentResponse createIncident(CreateIncidentRequest request);

    IncidentResponse getIncidentById(Long id);

    IncidentResponse getIncidentByReference(String reference);

    Page<IncidentResponse> getAllIncidents(Pageable pageable);

    Page<IncidentResponse> getIncidentsByUser(Long userId, Pageable pageable);

    Page<IncidentResponse> getIncidentsByDepartment(Long departmentId, Pageable pageable);

    Page<IncidentResponse> getIncidentsByStatus(String status, Pageable pageable);

    IncidentResponse updateIncidentStatus(Long id, UpdateIncidentStatusRequest request);

    // IncidentResponse assignIncident(Long id, Long userId);

    void deleteIncident(Long id);
}
