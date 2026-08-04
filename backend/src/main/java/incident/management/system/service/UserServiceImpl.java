package incident.management.system.service;

import incident.management.system.dto.AuditLogResponse;
import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserActivityResponse;
import incident.management.system.dto.UserResponse;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.AdminDepartmentSubscription;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.model.AuditLogEntity;
import incident.management.system.repository.AdminDepartmentSubscriptionRepository;
import incident.management.system.repository.AuditLogRepository;
import incident.management.system.repository.DepartmentRepository;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.CurrentUserResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static incident.management.system.enums.IncidentStatus.CLAIMED;
import static incident.management.system.enums.IncidentStatus.DECLARED;
import static incident.management.system.enums.IncidentStatus.IN_PROGRESS;
import static incident.management.system.enums.IncidentStatus.NON_RESOLVED;
import static incident.management.system.enums.IncidentStatus.RESOLVED;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final IncidentRepository incidentRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminDepartmentSubscriptionRepository subscriptionRepository;

    @Override
    public UserResponse createUser(CreateUserRequest request) {
        // ADMIN accounts authenticate by email + password — the email is their
        // login identifier, so it is mandatory (and must be well-formed; the
        // @Email DTO constraint already rejected malformed values).
        if (request.role() == UserRole.ADMIN
                && (request.email() == null || request.email().isBlank())) {
            throw new IllegalArgumentException(
                    "L'email est requis pour un compte administrateur.");
        }

        // Emails are canonicalized (trim + lowercase) so login / reset lookups
        // (findByEmailIgnoreCase) and the unique constraint always agree.
        String email = request.email() == null
                ? null
                : request.email().trim().toLowerCase(Locale.ROOT);

        // Friendly duplicate guard — the DB unique constraint would otherwise
        // surface as a generic 500 (no DataIntegrityViolation handler here).
        if (email != null && userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException(
                    "Un utilisateur avec cet email existe déjà.");
        }

        DepartmentEntity department = null;
        if (request.departmentId() != null) {
            department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.departmentId()));
        }

        UserEntity user = UserEntity.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .matricule(request.matricule())
                .role(request.role())
                .isActive(true)
                .department(department)
                .build();

        UserResponse response = toResponse(userRepository.save(user));

        // Soft nudge: ADMIN users should have at least one department subscription
        if (request.role() == UserRole.ADMIN && request.departmentId() == null) {
            log.warn("Admin user '{}' ({}) created without a department — they should subscribe to "
                    + "at least one department via the subscription endpoints to receive notifications.",
                    response.firstName() + " " + response.lastName(), response.matricule());
        }

        return response;
    }

    @Override
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (request.firstName() != null) {
            user.setFirstName(request.firstName());
        }
        if (request.lastName() != null) {
            user.setLastName(request.lastName());
        }
        if (request.role() != null) {
            user.setRole(request.role());
        }
        if (request.departmentId() != null) {
            DepartmentEntity department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.departmentId()));
            user.setDepartment(department);
        }

        return toResponse(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return userRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional(readOnly = true)
    @Override
    public UserResponse getUserByMatricule(int matricule) {
        return userRepository.findByMatricule(matricule)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("User", "matricule", matricule));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    public void deleteUser(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        user.deactivate();
        userRepository.save(user);
    }

    @Override
    public UserResponse activateUser(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        user.setActive(true);
        user.setDeletedAt(null);
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse deactivateUser(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        //  Hard safety guard #1: an admin cannot deactivate their own account.
        UserEntity current = CurrentUserResolver.resolve(userRepository);
        if (current != null && current.getId().equals(user.getId())) {
            throw new IllegalArgumentException(
                    "Impossible de désactiver votre propre compte.");
        }

        //  Hard safety guard #2: never deactivate the last active admin.
        if (user.getRole() == UserRole.ADMIN && user.isActive()
                && userRepository.countByRoleAndIsActive(UserRole.ADMIN, true) <= 1) {
            throw new IllegalArgumentException(
                    "Action impossible : il s'agit du dernier administrateur actif du système.");
        }

        user.deactivate();
        return toResponse(userRepository.save(user));
    }

    //  ========================================================================
    //  Promotion: SOUS_CHEF → CHEF_ATELIER
    //  ========================================================================

    @Override
    public UserResponse promoteToChefAtelier(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (user.getRole() != UserRole.SOUS_CHEF) {
            throw new IllegalArgumentException(
                    "Seuls les utilisateurs avec le rôle SOUS_CHEF peuvent être promus Chef d'atelier.");
        }

        user.setRole(UserRole.CHEF_ATELIER);
        // Empty passwordHash signals the account is unclaimed (satisfies the DB NOT NULL
        // constraint — see DevSeedConfig roster seeding which uses the same sentinel).
        user.setPasswordHash("");

        UserEntity saved = userRepository.save(user);
        log.info("User {} (matricule: {}) promoted from SOUS_CHEF to CHEF_ATELIER. Account needs claiming.",
                saved.getId(), saved.getMatricule());

        return toResponse(saved);
    }

    //  ========================================================================
    //  Per-user activity analytics
    //  ========================================================================

    @Override
    @Transactional(readOnly = true)
    public UserActivityResponse getUserActivity(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        List<UserActivityResponse.DayCount> declaredByDay = incidentRepository
                .countDeclaredByDay(id).stream()
                .map(row -> new UserActivityResponse.DayCount(
                        (String) row[0],
                        ((Number) row[1]).longValue()))
                .toList();

        List<UserActivityResponse.DayCount> resolvedByDay = incidentRepository
                .countResolvedByDay(id).stream()
                .map(row -> new UserActivityResponse.DayCount(
                        (String) row[0],
                        ((Number) row[1]).longValue()))
                .toList();

        Double avgTimeToClaim = incidentRepository.avgTimeToClaimMinutes(id);
        Double avgMttr = incidentRepository.avgMttrMinutes(id);

        return new UserActivityResponse(
                incidentRepository.countByUser(user),
                incidentRepository.countByUserAndStatusIn(
                        user, List.of(DECLARED, CLAIMED, IN_PROGRESS)),
                incidentRepository.countByResolvedBy(user),
                incidentRepository.countByUserAndStatusIn(
                        user, List.of(RESOLVED, NON_RESOLVED)),
                incidentRepository.countByClaimedBy(user),
                avgTimeToClaim != null ? avgTimeToClaim : 0.0,
                avgMttr != null ? avgMttr : 0.0,
                declaredByDay,
                resolvedByDay
        );
    }

    //  ========================================================================
    //  Role state transitions (danger zone)
    //  ========================================================================

    @Override
    public UserResponse demoteToSousChef(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (user.getRole() != UserRole.CHEF_ATELIER) {
            throw new IllegalArgumentException(
                    "Seuls les comptes Chef d'atelier peuvent être rétrogradés.");
        }

        // Revert role + reset credentials to the unclaimed sentinel (""), so a
        // future re-promotion forces the user back through the claim flow.
        user.setRole(UserRole.SOUS_CHEF);
        user.setPasswordHash("");
        user.setDepartment(null);

        UserEntity saved = userRepository.save(user);
        log.info("User {} (matricule: {}) demoted from CHEF_ATELIER to SOUS_CHEF.",
                saved.getId(), saved.getMatricule());
        return toResponse(saved);
    }

    @Override
    public UserResponse cancelPromotion(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (user.getRole() != UserRole.CHEF_ATELIER || !isUnclaimed(user)) {
            throw new IllegalArgumentException(
                    "Seules les promotions en attente de réclamation peuvent être annulées.");
        }

        // Clear any pending password-reset tokens so no stale token can be used later.
        passwordResetTokenRepository.deleteByUserIdAndUsedFalse(user.getId());

        user.setRole(UserRole.SOUS_CHEF);
        user.setPasswordHash("");   // keep the unclaimed sentinel
        user.setActive(true);       // reset status back to Actif
        user.setDeletedAt(null);

        UserEntity saved = userRepository.save(user);
        log.info("Promotion cancelled for user {} (matricule: {}) — reverted to SOUS_CHEF.",
                saved.getId(), saved.getMatricule());
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveAdmins() {
        return userRepository.countByRoleAndIsActive(UserRole.ADMIN, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getUserAuditLogs(Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        List<AuditLogEntity> entries =
                auditLogRepository.findTop50ByTargetUserIdOrderByCreatedAtDesc(user.getId());

        // Batch-resolve actor names with a single IN query (no N+1 lookups).
        List<Long> actorIds = entries.stream()
                .map(AuditLogEntity::getActorUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> actorNames = actorIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(actorIds).stream()
                        .collect(Collectors.toMap(
                                UserEntity::getId,
                                a -> a.getFirstName() + " " + a.getLastName()));

        return entries.stream()
                .map(entry -> new AuditLogResponse(
                        entry.getId(),
                        entry.getAction(),
                        entry.getActorUserId() != null
                                ? actorNames.get(entry.getActorUserId())
                                : null,
                        entry.getDetails(),
                        entry.getCreatedAt()))
                .collect(Collectors.toList());
    }

    //  ========================================================================
    //  Admin Department Subscriptions
    //  ========================================================================

    @Override
    public void subscribeToDepartment(Long adminId, Long departmentId) {
        UserEntity admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", adminId));
        DepartmentEntity department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        if (subscriptionRepository.existsByAdminAndDepartment(admin, department)) {
            return; // Already subscribed — idempotent
        }

        AdminDepartmentSubscription subscription = AdminDepartmentSubscription.builder()
                .admin(admin)
                .department(department)
                .build();
        subscriptionRepository.save(subscription);
    }

    @Override
    public void unsubscribeFromDepartment(Long adminId, Long departmentId) {
        UserEntity admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", adminId));
        DepartmentEntity department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        subscriptionRepository.deleteByAdminAndDepartment(admin, department);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentResponse> getSubscribedDepartments(Long adminId) {
        UserEntity admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", adminId));

        return subscriptionRepository.findByAdmin(admin).stream()
                .map(sub -> new DepartmentResponse(
                        sub.getDepartment().getId(),
                        sub.getDepartment().getName()))
                .collect(Collectors.toList());
    }

    //  ========================================================================
    //  Helpers
    //  ========================================================================

    private boolean isUnclaimed(UserEntity user) {
        return user.getPasswordHash() == null || user.getPasswordHash().isBlank();
    }

    //  ========================================================================
    //  DTO Mapping
    //  ========================================================================

    private UserResponse toResponse(UserEntity entity) {
        DepartmentResponse deptResponse = entity.getDepartment() != null
                ? new DepartmentResponse(entity.getDepartment().getId(), entity.getDepartment().getName())
                : null;

        return new UserResponse(
                entity.getId(),
                entity.getFirstName(),
                entity.getLastName(),
                entity.getMatricule(),
                entity.getEmail(),
                entity.isActive(),
                entity.getRole(),
                deptResponse,
                entity.getCreatedAt(),
                !isUnclaimed(entity)
        );
    }
}
