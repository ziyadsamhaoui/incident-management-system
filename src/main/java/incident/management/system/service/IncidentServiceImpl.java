package incident.management.system.service;

import incident.management.system.dto.*;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.exception.InvalidStatusTransitionException;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.*;
import incident.management.system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class IncidentServiceImpl implements IncidentService {

    private final IncidentRepository incidentRepository;
    private final IncidentHistoryRepository incidentHistoryRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final StationRepository stationRepository;
    private final CategoryRepository categoryRepository;
    private final NotificationService notificationService;
    private final IncidentReferenceGenerator referenceGenerator;

    //  -------------------------------------------------------------------------
    //  6-Stage Linear State Machine
    //  -------------------------------------------------------------------------
    //  DECLARED → CLAIMED → IN_PROGRESS → RESOLVED/NON_RESOLVED → CLOSED
    //  -------------------------------------------------------------------------

    private static final Map<IncidentStatus, IncidentStatus[]> VALID_TRANSITIONS = Map.of(
            IncidentStatus.DECLARED,       new IncidentStatus[]{IncidentStatus.CLAIMED},
            IncidentStatus.CLAIMED,        new IncidentStatus[]{IncidentStatus.IN_PROGRESS},
            IncidentStatus.IN_PROGRESS,    new IncidentStatus[]{IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED},
            IncidentStatus.RESOLVED,       new IncidentStatus[]{IncidentStatus.CLOSED},
            IncidentStatus.NON_RESOLVED,   new IncidentStatus[]{IncidentStatus.CLOSED},
            IncidentStatus.CLOSED,         new IncidentStatus[]{}
    );

    //  ========================================================================
    //  CREATE INCIDENT
    //  ========================================================================

    @Override
    public IncidentResponse createIncident(CreateIncidentRequest request) {
        UserEntity user = userRepository.findById(request.userId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.userId()));
        DepartmentEntity department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.departmentId()));
        StationEntity station = stationRepository.findById(request.stationId())
                .orElseThrow(() -> new ResourceNotFoundException("Station", "id", request.stationId()));
        CategoryEntity category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.categoryId()));

        IncidentEntity incident = IncidentEntity.builder()
                .reference(referenceGenerator.generateReference())
                .user(user)
                .department(department)
                .station(station)
                .category(category)
                .priority(request.priority())
                .status(IncidentStatus.DECLARED)
                .description(request.description())
                .declaredAt(LocalDateTime.now())
                .build();

        IncidentEntity saved = incidentRepository.save(incident);

        // Audit trail: initial declaration entry
        recordHistory(saved, IncidentStatus.DECLARED, IncidentStatus.DECLARED, null);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " has been declared with " + saved.getPriority() + " priority.");

        return toResponse(saved);
    }

    //  ========================================================================
    //  READ OPERATIONS
    //  ========================================================================

    @Override
    @Transactional(readOnly = true)
    public IncidentResponse getIncidentById(Long id) {
        return incidentRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));
    }

    @Override
    @Transactional(readOnly = true)
    public IncidentResponse getIncidentByReference(String reference) {
        return incidentRepository.findByReference(reference)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "reference", reference));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getAllIncidents(Pageable pageable) {
        return incidentRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getIncidentsByUser(Long userId, Pageable pageable) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return incidentRepository.findByUser(user, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getIncidentsByDepartment(Long departmentId, Pageable pageable) {
        DepartmentEntity department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));
        return incidentRepository.findByDepartment(department, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getIncidentsByStatus(String status, Pageable pageable) {
        IncidentStatus incidentStatus;
        try {
            incidentStatus = IncidentStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
        return incidentRepository.findByStatus(incidentStatus, pageable).map(this::toResponse);
    }

    //  ========================================================================
    //  A. CLAIM INCIDENT  —  DECLARED → CLAIMED
    //  ========================================================================

    @Override
    public IncidentResponse claimIncident(Long id) {
        IncidentEntity incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));

        validateTransition(incident.getStatus(), IncidentStatus.CLAIMED);

        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.CLAIMED);
        incident.setClaimedAt(LocalDateTime.now());

        IncidentEntity saved = incidentRepository.save(incident);

        // Dual-write: audit trail
        recordHistory(saved, previousStatus, IncidentStatus.CLAIMED, null);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " has been claimed by an administrator.");

        return toResponse(saved);
    }

    //  ========================================================================
    //  B. PROGRESS INCIDENT  —  CLAIMED → IN_PROGRESS
    //  ========================================================================

    @Override
    public IncidentResponse progressIncident(Long id) {
        IncidentEntity incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));

        validateTransition(incident.getStatus(), IncidentStatus.IN_PROGRESS);

        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.IN_PROGRESS);
        incident.setInProgressAt(LocalDateTime.now());

        IncidentEntity saved = incidentRepository.save(incident);

        // Dual-write: audit trail
        recordHistory(saved, previousStatus, IncidentStatus.IN_PROGRESS, null);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " is now in progress.");

        return toResponse(saved);
    }

    //  ========================================================================
    //  C. EVALUATE INCIDENT  —  IN_PROGRESS → RESOLVED / NON_RESOLVED
    //     Dual-write comment architecture: note saved to incident.resolutionNote
    //     AND mirrored to incident_history.comment
    //  ========================================================================

    @Override
    public IncidentResponse evaluateIncident(Long id, EvaluateIncidentRequest request) {
        IncidentEntity incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));

        IncidentStatus targetStatus = request.status();

        //  Strict transition check: only allowed from IN_PROGRESS
        //  validateTransition() already enforces this via the state machine map
        validateTransition(incident.getStatus(), targetStatus);

        //  Conditional mandatory note for NON_RESOLVED
        if (targetStatus == IncidentStatus.NON_RESOLVED) {
            String note = request.note();
            if (note == null || note.isBlank()) {
                throw new IllegalArgumentException(
                        "An explanatory note is mandatory when marking an incident as non-resolved.");
            }
        }

        //  Capture the note (may be null for RESOLVED without a comment)
        String resolutionNote = request.note();

        //  Persist — unified transactional boundary
        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(targetStatus);
        incident.setResolutionNote(resolutionNote);
        if (targetStatus == IncidentStatus.RESOLVED || targetStatus == IncidentStatus.NON_RESOLVED) {
            incident.setResolvedAt(LocalDateTime.now());
        }

        IncidentEntity saved = incidentRepository.save(incident);

        //  Dual-write: mirror the note into incident_history.comment
        recordHistory(saved, previousStatus, targetStatus, resolutionNote);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " has been marked as " + targetStatus + ".");

        return toResponse(saved);
    }

    //  ========================================================================
    //  D. CLOSE INCIDENT  —  RESOLVED / NON_RESOLVED → CLOSED
    //  ========================================================================

    @Override
    public IncidentResponse closeIncident(Long id) {
        IncidentEntity incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));

        validateTransition(incident.getStatus(), IncidentStatus.CLOSED);

        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.CLOSED);
        incident.setClosedAt(LocalDateTime.now());

        IncidentEntity saved = incidentRepository.save(incident);

        // Dual-write: audit trail
        recordHistory(saved, previousStatus, IncidentStatus.CLOSED, null);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " has been closed.");

        return toResponse(saved);
    }

    //  ========================================================================
    //  DELETE
    //  ========================================================================

    @Override
    public void deleteIncident(Long id) {
        if (!incidentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Incident", "id", id);
        }
        incidentRepository.deleteById(id);
    }

    //  ========================================================================
    //  VALIDATION & HELPERS
    //  ========================================================================

    /**
     * Validates that a transition from {@code current} to {@code target} is
     * allowed according to the state machine defined in {@link #VALID_TRANSITIONS}.
     * <p>
     * Same-state transitions are silently allowed (idempotent).
     */
    private void validateTransition(IncidentStatus current, IncidentStatus target) {
        if (current == target) {
            return;
        }
        IncidentStatus[] allowedNext = VALID_TRANSITIONS.get(current);
        if (allowedNext == null) {
            throw new InvalidStatusTransitionException(current, target);
        }
        for (IncidentStatus allowed : allowedNext) {
            if (allowed == target) {
                return;
            }
        }
        throw new InvalidStatusTransitionException(current, target);
    }

    /**
     * Persists an {@link IncidentHistory} row for every status transition.
     * <p>
     * This implements the <strong>dual-write comment architecture</strong>:
     * evaluation notes are stored both on the {@link IncidentEntity#resolutionNote}
     * column and mirrored here in the {@code comment} column for chronological audit.
     */
    private void recordHistory(IncidentEntity incident,
                               IncidentStatus previousStatus,
                               IncidentStatus newStatus,
                               String comment) {
        IncidentHistory history = IncidentHistory.builder()
                .incident(incident)
                .previousStatus(previousStatus)
                .currentStatus(newStatus)
                .changedAt(LocalDateTime.now())
                .comment(comment)
                .build();
        incidentHistoryRepository.save(history);
    }

    //  ========================================================================
    //  DTO MAPPING
    //  ========================================================================

    private IncidentResponse toResponse(IncidentEntity entity) {
        UserSummaryResponse userSummary = entity.getUser() != null
                ? new UserSummaryResponse(
                        entity.getUser().getId(),
                        entity.getUser().getFirstName(),
                        entity.getUser().getLastName(),
                        entity.getUser().getMatricule())
                : null;

        DepartmentResponse deptResponse = entity.getDepartment() != null
                ? new DepartmentResponse(entity.getDepartment().getId(), entity.getDepartment().getName())
                : null;

        StationResponse stationResponse = entity.getStation() != null
                ? new StationResponse(
                        entity.getStation().getId(),
                        entity.getStation().getCode(),
                        entity.getStation().getRowIndex(),
                        entity.getStation().getLineIndex(),
                        entity.getStation().isWorking(),
                        entity.getStation().getProductionLine() != null
                                ? entity.getStation().getProductionLine().getId()
                                : null)
                : null;

        CategoryResponse categoryResponse = entity.getCategory() != null
                ? new CategoryResponse(entity.getCategory().getId(), entity.getCategory().getName())
                : null;

        UserSummaryResponse assignedTo = entity.getAssignedTo() != null
                ? new UserSummaryResponse(
                        entity.getAssignedTo().getId(),
                        entity.getAssignedTo().getFirstName(),
                        entity.getAssignedTo().getLastName(),
                        entity.getAssignedTo().getMatricule())
                : null;

        return new IncidentResponse(
                entity.getId(),
                entity.getReference(),
                userSummary,
                assignedTo,
                deptResponse,
                stationResponse,
                categoryResponse,
                entity.getPriority(),
                entity.getStatus(),
                entity.getDescription(),
                entity.getResolutionNote(),
                entity.getDeclaredAt(),
                entity.getClaimedAt(),
                entity.getInProgressAt(),
                entity.getResolvedAt(),
                entity.getClosedAt()
        );
    }
}
