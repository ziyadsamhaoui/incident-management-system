package incident.management.system.service;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

public interface UserService {

    UserResponse createUser(CreateUserRequest request);

    UserResponse updateUser(Long id, UpdateUserRequest request);

    UserResponse getUserById(Long id);

    UserResponse getUserByMatricule(int matricule);

    Page<UserResponse> getAllUsers(Pageable pageable);

    void deleteUser(Long id);

    UserResponse activateUser(Long id);

    UserResponse deactivateUser(Long id);
}
