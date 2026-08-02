package incident.management.system.service;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserActivityResponse;
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

    /**
     * On-demand activity analytics for the given user (declared / claimed /
     * resolved counts plus per-day buckets). Metrics are computed via SQL
     * {@code COUNT(*) + GROUP BY DATE(...)} — no denormalized counters.
     */
    UserActivityResponse getUserActivity(Long id);

    /**
     * Demotes a CHEF_ATELIER back to {@code SOUS_CHEF}: resets the password
     * (unclaimed sentinel — must re-claim if re-promoted) and clears the
     * department assignment.
     */
    UserResponse demoteToSousChef(Long id);

    /**
     * Cancels a pending promotion for an unclaimed CHEF_ATELIER: reverts the
     * role to {@code SOUS_CHEF}, clears unused password-reset tokens and
     * resets the account status to active.
     */
    UserResponse cancelPromotion(Long id);

    /**
     * Number of currently active ADMIN accounts — used by the last-active-admin
     * guard on the admin surface.
     */
    long countActiveAdmins();

    void deleteUser(Long id);

    UserResponse activateUser(Long id);

    UserResponse deactivateUser(Long id);

    //  Admin Department Subscriptions

    void subscribeToDepartment(Long adminId, Long departmentId);

    void unsubscribeFromDepartment(Long adminId, Long departmentId);

    List<DepartmentResponse> getSubscribedDepartments(Long adminId);

    /**
     * Promotes a SOUS_CHEF user to CHEF_ATELIER.
     * The promoted user will have an empty {@code passwordHash},
     * requiring them to claim their account on first login.
     */
    UserResponse promoteToChefAtelier(Long id);
}
