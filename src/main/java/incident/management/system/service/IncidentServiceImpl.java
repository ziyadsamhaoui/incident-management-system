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
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Transactional
public class IncidentServiceImpl implements IncidentService {

    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final StationRepository stationRepository;
    private final CategoryRepository categoryRepository;
    private final NotificationService notificationService;

    private static final String REFERENCE_PREFIX = "INC";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private final Map<String, AtomicLong> dailyCounters = new ConcurrentHashMap<>();

    private static final Map<IncidentStatus, IncidentStatus> VALID_TRANSITIONS = Map.of(
            IncidentStatus.DECLARED, IncidentStatus.ASSIGNED,
            IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS,
            IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED,
            IncidentStatus.RESOLVED, IncidentStatus.CLOSED
    );

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
                .reference(generateReference())
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

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " has been declared with " + saved.getPriority() + " priority.");

        return toResponse(saved);
    }

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

    @Override
    public IncidentResponse updateIncidentStatus(Long id, UpdateIncidentStatusRequest request) {
        IncidentEntity incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", id));

        IncidentStatus currentStatus = incident.getStatus();
        IncidentStatus targetStatus = request.status();

        validateTransition(currentStatus, targetStatus);
        applyStatusTransition(incident, targetStatus);

        IncidentEntity saved = incidentRepository.save(incident);

        notificationService.notifyStatusChange(saved,
                "Incident " + saved.getReference() + " status changed from " + currentStatus + " to " + targetStatus + ".");

        return toResponse(saved);
    }

    // ASSIGN INCIDENT (OPTIONAL)

    @Override
    public void deleteIncident(Long id) {
        if (!incidentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Incident", "id", id);
        }
        incidentRepository.deleteById(id);
    }

    // HELPER METHODS

    private String generateReference() {
        String datePart = LocalDateTime.now().format(DATE_FORMATTER);
        String key = REFERENCE_PREFIX + "-" + datePart;
        AtomicLong counter = dailyCounters.computeIfAbsent(key, k -> new AtomicLong(1));
        long sequence = counter.getAndIncrement();
        return String.format("%s-%s-%04d", REFERENCE_PREFIX, datePart, sequence);
    }

    private void validateTransition(IncidentStatus current, IncidentStatus target) {
        if (current == target) {
            return;
        }
        IncidentStatus allowedNext = VALID_TRANSITIONS.get(current);
        if (allowedNext == null || allowedNext != target) {
            throw new InvalidStatusTransitionException(current, target);
        }
    }

    private void applyStatusTransition(IncidentEntity incident, IncidentStatus targetStatus) {
        incident.setStatus(targetStatus);
        LocalDateTime now = LocalDateTime.now();

        switch (targetStatus) {
            case ASSIGNED -> incident.setAssignedAt(now);
            case IN_PROGRESS -> incident.setInProgressAt(now);
            case RESOLVED -> incident.setResolvedAt(now);
            case CLOSED -> incident.setClosedAt(now);
            default -> {
            }
        }
    }
//
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

        return new IncidentResponse(
                entity.getId(),
                entity.getReference(),
                userSummary,
                deptResponse,
                stationResponse,
                categoryResponse,
                entity.getPriority(),
                entity.getStatus(),
                entity.getDescription(),
                entity.getDeclaredAt(),
                entity.getAssignedAt(),
                entity.getInProgressAt(),
                entity.getResolvedAt(),
                entity.getClosedAt()
        );
    }
}
