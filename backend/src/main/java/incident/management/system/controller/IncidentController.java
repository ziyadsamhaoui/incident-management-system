package incident.management.system.controller;

import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.dto.IncidentHistoryResponse;
import incident.management.system.dto.IncidentResponse;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.idempotency.Idempotent;
import incident.management.system.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Incidents",
        description = "Incident lifecycle: filtered listing, declaration, the DECLARED → CLAIMED → "
                + "IN_PROGRESS → RESOLVED/NON_RESOLVED state machine, and the per-incident audit trail. "
                + "Requires a valid JWT (Bearer) for every operation; state transitions are role-gated.")
public class IncidentController {

    private final IncidentService incidentService;

    //  Get incidents, with combinable filters. The `status` param accepts either
    //  a single value or a comma-separated group, e.g.
    //  `status=DECLARED,CLAIMED,IN_PROGRESS` (Actifs) or
    //  `status=RESOLVED,NON_RESOLVED` (Logs).
    @GetMapping
    @Operation(summary = "List incidents with combinable filters",
            description = "Paginated incident listing. `status` accepts a single value or a comma-separated "
                    + "group (e.g. DECLARED,CLAIMED,IN_PROGRESS for active incidents, RESOLVED,NON_RESOLVED "
                    + "for the logs archive). `search` matches reference/description/resolutionNote "
                    + "case-insensitively; `departmentId`/`userId` narrow the scope; `startDate`/`endDate` "
                    + "bound the `dateField` column (`declaredAt` default, `resolvedAt` for logs). Spring "
                    + "Data pagination via `page`/`size`/`sort`.")
    @ApiResponses({
            // Paginated payload — springdoc's PageOpenAPIConverter derives the
            // PageIncidentResponse schema (with content items) from the return type.
            @ApiResponse(responseCode = "200", description = "Paginated incidents (Page<IncidentResponse>)"),
            @ApiResponse(responseCode = "400", description = "Invalid status token or malformed date range"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public ResponseEntity<Page<IncidentResponse>> getIncidents(
            @Parameter(description = "Single status or comma-separated group, e.g. DECLARED,CLAIMED")
            @RequestParam(required = false) List<String> status,
            @Parameter(description = "Case-insensitive search over reference, description and resolution note")
            @RequestParam(required = false) String search,
            @Parameter(description = "Filter by department id")
            @RequestParam(required = false) Long departmentId,
            @Parameter(description = "Filter by declarer user id")
            @RequestParam(required = false) Long userId,
            @Parameter(description = "Inclusive lower date bound (ISO yyyy-MM-dd)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Inclusive upper date bound (ISO yyyy-MM-dd)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Date column the range filter applies to: declaredAt (default) or resolvedAt")
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
    //
    //  Idempotent: operators on flaky factory Wi-Fi re-tap "Déclarer" after a
    //  client-side timeout. @Idempotent deduplicates via X-Idempotency-Key
    //  (atomic SETNX lock + cached response replay) so a double-submit can never
    //  create two incidents.
    @PostMapping
    @PreAuthorize("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER', 'ADMIN')")
    @Idempotent
    @Operation(summary = "Declare a new incident",
            description = "Creates an incident in the DECLARED state. Roles: SOUS_CHEF, CHEF_ATELIER or "
                    + "ADMIN. Idempotent: send the X-Idempotency-Key header so a client retry after a "
                    + "timeout can never create duplicates (atomic SETNX lock + cached response replay). "
                    + "The description is optional (photo-only declarations are allowed).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Incident created",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation failure or missing idempotency key"),
            @ApiResponse(responseCode = "403", description = "Role not allowed to declare incidents"),
            @ApiResponse(responseCode = "409", description = "Duplicate request in flight for the same X-Idempotency-Key")
    })
    public ResponseEntity<IncidentResponse> createIncident(
            @Parameter(in = ParameterIn.HEADER, name = "X-Idempotency-Key",
                    description = "Client-generated deduplication key (UUID recommended) — required for this endpoint",
                    example = "5f4dcc3b-5aa7-4f0c-9e9a-1f2c3d4e5f6a")
            @Valid @RequestBody CreateIncidentRequest request) {
        IncidentResponse response = incidentService.createIncident(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an incident by id",
            description = "Full incident detail: reporter, assignee, resolver, department/station/category, "
                    + "priority, status and the complete state-machine timestamps. Access is scoped by role "
                    + "(ADMIN everything, CHEF_ATELIER own department, SOUS_CHEF own declared incidents).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Incident detail",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<IncidentResponse> getIncidentById(@PathVariable Long id) {
        IncidentResponse response = incidentService.getIncidentById(id);
        return ResponseEntity.ok(response);
    }

    //  Aging incidents — CLAIMED / IN_PROGRESS for more than 2 hours
    @GetMapping("/stale")
    @Operation(summary = "List aging incidents",
            description = "Incidents stuck in CLAIMED or IN_PROGRESS for more than 2 hours — feeds the "
                    + "operational 'incidents en retard' widget.")
    @ApiResponses({
            // Array schema is derived from the List<IncidentResponse> return type.
            @ApiResponse(responseCode = "200", description = "Aging incidents (IncidentResponse[])")
    })
    public ResponseEntity<List<IncidentResponse>> getStaleIncidents() {
        return ResponseEntity.ok(incidentService.getStaleIncidents());
    }

    //  Full audit trail for a single incident
    @GetMapping("/{id}/history")
    @Operation(summary = "Get the full audit trail of an incident",
            description = "Reverse-chronological list of every status transition with the acting user "
                    + "resolved server-side. Powers the timeline on the incident detail views.")
    @ApiResponses({
            // Array schema is derived from the List<IncidentHistoryResponse> return type.
            @ApiResponse(responseCode = "200", description = "Audit trail entries (IncidentHistoryResponse[])"),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<List<IncidentHistoryResponse>> getIncidentHistory(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getIncidentHistory(id));
    }

    //  DECLARED → CLAIMED
    //  Actor: ADMIN
    //  Idempotency: optional header (required=false) — the state machine already
    //  makes a duplicate claim a no-op (same-state transitions are allowed), so
    //  the key only adds defense-in-depth.
    @PutMapping("/{id}/claim")
    @PreAuthorize("hasRole('ADMIN')")
    @Idempotent(required = false)
    @Operation(summary = "Claim an incident (DECLARED → CLAIMED)",
            description = "Takes an incident into charge. Actor: ADMIN. Idempotency header is optional — "
                    + "the state machine already treats same-state transitions as a no-op.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Incident claimed",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "State transition not allowed"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<IncidentResponse> claimIncident(
            @Parameter(in = ParameterIn.HEADER, name = "X-Idempotency-Key", required = false,
                    description = "Optional deduplication key — the state machine already makes duplicate claims a no-op")
            @PathVariable Long id) {
        IncidentResponse response = incidentService.claimIncident(id);
        return ResponseEntity.ok(response);
    }

    //  CLAIMED → IN_PROGRESS
    //  Actor: CLIENT
    @PutMapping("/{id}/progress")
    @Idempotent(required = false)
    @Operation(summary = "Move an incident to IN_PROGRESS (CLAIMED → IN_PROGRESS)",
            description = "System-driven transition as the client starts working the incident. Idempotency "
                    + "header is optional.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Incident in progress",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "State transition not allowed"),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<IncidentResponse> progressIncident(
            @Parameter(in = ParameterIn.HEADER, name = "X-Idempotency-Key", required = false,
                    description = "Optional deduplication key — the state machine already makes duplicate transitions a no-op")
            @PathVariable Long id) {
        IncidentResponse response = incidentService.progressIncident(id);
        return ResponseEntity.ok(response);
    }

    //  IN_PROGRESS → RESOLVED / NON_RESOLVED
    //  Actor: ADMIN
    @PutMapping("/{id}/evaluate")
    @PreAuthorize("hasRole('ADMIN')")
    @Idempotent(required = false)
    @Operation(summary = "Evaluate an incident (IN_PROGRESS → RESOLVED / NON_RESOLVED)",
            description = "Terminal evaluation by an ADMIN. The request carries the outcome status "
                    + "(RESOLVED or NON_RESOLVED) and an optional resolution note. After this transition "
                    + "the incident becomes read-only and its media enter the retention lifecycle.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Incident evaluated",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid outcome status or state transition"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<IncidentResponse> evaluateIncident(
            @Parameter(in = ParameterIn.HEADER, name = "X-Idempotency-Key", required = false,
                    description = "Optional deduplication key — the state machine already makes duplicate evaluations a no-op")
            @PathVariable Long id,
            @Valid @RequestBody EvaluateIncidentRequest request) {
        IncidentResponse response = incidentService.evaluateIncident(id, request);
        return ResponseEntity.ok(response);
    }
}
