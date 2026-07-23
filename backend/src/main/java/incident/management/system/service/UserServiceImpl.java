package incident.management.system.service;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserResponse;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.AdminDepartmentSubscription;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.AdminDepartmentSubscriptionRepository;
import incident.management.system.repository.DepartmentRepository;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminDepartmentSubscriptionRepository subscriptionRepository;

    @Override
    public UserResponse createUser(CreateUserRequest request) {
        DepartmentEntity department = null;
        if (request.departmentId() != null) {
            department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.departmentId()));
        }

        UserEntity user = UserEntity.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
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
        return userRepository.findByEmail(email)
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
        user.deactivate();
        return toResponse(userRepository.save(user));
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
                entity.isActive(),
                entity.getRole(),
                deptResponse,
                entity.getCreatedAt()
        );
    }
}
