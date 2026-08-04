package incident.management.system.controller;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.dto.IncidentHistoryResponse;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    //  Get incidents, with combinable filters. The `status` param accepts either
    //  a single value or a comma-separated group, e.g.
    //  `status=DECLARED,CLAIMED,IN_PROGRESS` (Actifs) or
    //  `status=RESOLVED,NON_RESOLVED` (Logs).
    @GetMapping
    public ResponseEntity<Page<IncidentResponse>> getIncidents(
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "declaredAt") String dateField,
            @PageableDefault(size = 20) Pageable pageable) {

        List<IncidentStatus> statuses = parseStatuses(status);

        Page<IncidentResponse> incidents = incidentService.getFilteredIncidents(
                statuses, search, departmentId, userId, startDate, endDate, dateField, pageable);

        return ResponseEntity.ok(incidents);
    }

    //  Parses the comma-separated / repeated `status` query param into enum values.
    private List<IncidentStatus> parseStatuses(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<IncidentStatus> statuses = new ArrayList<>();
        for (String value : raw) {
            for (String token : value.split(",")) {
                if (token.isBlank()) {
                    continue;
                }
                try {
                    statuses.add(IncidentStatus.valueOf(token.trim().toUpperCase()));
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("Invalid status: " + token);
                }
            }
        }
        return statuses;
    }


    //  DECLARED
    //  Actor: SOUS_CHEF, CHEF_ATELIER or ADMIN (admin declare flow from the incidents console)
    @PostMapping
    @PreAuthorize("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER', 'ADMIN')")
    public ResponseEntity<IncidentResponse> createIncident(@Valid @RequestBody CreateIncidentRequest request) {
        IncidentResponse response = incidentService.createIncident(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(@PathVariable Long id) {
        IncidentResponse response = incidentService.getIncidentById(id);
        return ResponseEntity.ok(response);
    }

    //  Aging incidents — CLAIMED / IN_PROGRESS for more than 2 hours
    @GetMapping("/stale")
    public ResponseEntity<List<IncidentResponse>> getStaleIncidents() {
        return ResponseEntity.ok(incidentService.getStaleIncidents());
    }

    //  Full audit trail for a single incident
    @GetMapping("/{id}/history")
    public ResponseEntity<List<IncidentHistoryResponse>> getIncidentHistory(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getIncidentHistory(id));
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
}
