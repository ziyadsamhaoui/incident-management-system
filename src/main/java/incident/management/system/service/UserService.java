package incident.management.system.service;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface UserService {

    UserResponse createUser(CreateUserRequest request);

    UserResponse updateUser(Long id, UpdateUserRequest request);

    UserResponse getUserById(Long id);

    UserResponse getUserByEmail(String email);

    UserResponse getUserByMatricule(int matricule);

    Page<UserResponse> getAllUsers(Pageable pageable);

    void deleteUser(Long id);

    UserResponse activateUser(Long id);

    UserResponse deactivateUser(Long id);

    //  Admin Department Subscriptions

    void subscribeToDepartment(Long adminId, Long departmentId);

    void unsubscribeFromDepartment(Long adminId, Long departmentId);

    List<DepartmentResponse> getSubscribedDepartments(Long adminId);
}
