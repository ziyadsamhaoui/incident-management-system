package incident.management.system.controller;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    //  Get all incidents, optionally filtered by status, department, or user.
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


    //  DECLARED
    //  Actor: SOUS_CHEF or CHEF_ATELIER
    @PostMapping
    @PreAuthorize("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER')")
    public ResponseEntity<IncidentResponse> createIncident(@Valid @RequestBody CreateIncidentRequest request) {
        IncidentResponse response = incidentService.createIncident(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(@PathVariable Long id) {
        IncidentResponse response = incidentService.getIncidentById(id);
        return ResponseEntity.ok(response);
    }

    //  DECLARED → CLAIMED
    //  Actor: ADMIN
    @PutMapping("/{id}/claim")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> claimIncident(@PathVariable Long id) {
        IncidentResponse response = incidentService.claimIncident(id);
        return ResponseEntity.ok(response);
    }

    //  CLAIMED → IN_PROGRESS
    //  Actor: CLIENT
    @PutMapping("/{id}/progress")
    public ResponseEntity<IncidentResponse> progressIncident(@PathVariable Long id) {
        IncidentResponse response = incidentService.progressIncident(id);
        return ResponseEntity.ok(response);
    }

    //  IN_PROGRESS → RESOLVED / NON_RESOLVED
    //  Actor: ADMIN
    @PutMapping("/{id}/evaluate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> evaluateIncident(
            @PathVariable Long id,
            @Valid @RequestBody EvaluateIncidentRequest request) {
        IncidentResponse response = incidentService.evaluateIncident(id, request);
        return ResponseEntity.ok(response);
    }

    //  RESOLVED → CLOSED
    // Actor: CLIENT via scheduler/IncidentAutoClosureJob
}
