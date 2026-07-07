package incident.management.system.controller;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.dto.UpdateIncidentStatusRequest;
import incident.management.system.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(@Valid @RequestBody CreateIncidentRequest request) {
        IncidentResponse response = incidentService.createIncident(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<IncidentResponse>> getIncidents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long userId,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<IncidentResponse> incidents;

        if (status != null) {
            incidents = incidentService.getIncidentsByStatus(status, pageable);
        } else if (departmentId != null) {
            incidents = incidentService.getIncidentsByDepartment(departmentId, pageable);
        } else if (userId != null) {
            incidents = incidentService.getIncidentsByUser(userId, pageable);
        } else {
            incidents = incidentService.getAllIncidents(pageable);
        }

        return ResponseEntity.ok(incidents);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(@PathVariable Long id) {
        IncidentResponse response = incidentService.getIncidentById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<IncidentResponse> updateIncidentStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateIncidentStatusRequest request) {
        IncidentResponse response = incidentService.updateIncidentStatus(id, request);
        return ResponseEntity.ok(response);
    }
}
