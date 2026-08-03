package incident.management.system.repository;

import incident.management.system.enums.UserRole;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByMatricule(int matricule);

    Optional<UserEntity> findByEmail(String email);

    /**
     * Case-insensitive email lookup (emails are stored canonicalized to
     * lowercase, but this tolerates mixed-case input from legacy rows and
     * human typists on the login / reset screens).
     */
    Optional<UserEntity> findByEmailIgnoreCase(String email);

    /**
     * True when any account already holds the email (case-insensitive) —
     * used by {@code UserServiceImpl.createUser} to reject duplicate admin
     * emails with a friendly 400 before the DB unique constraint fires.
     */
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Finds the user holding an active supervisor-mediated reset code
     * (hashed code + expiry in the future). See {@code V5__password_reset_hardening.sql}.
     */
    Optional<UserEntity> findByClaimCodeHashAndClaimCodeExpiresAtAfter(
            String claimCodeHash, java.time.LocalDateTime now);

    boolean existsByMatricule(int matricule);

    List<UserEntity> findByDepartmentAndRole(DepartmentEntity department, UserRole role);

    /**
     * Count of users with the given role and activation flag — used by the
     * last-active-admin guard ({@code role = ADMIN, is_active = true}).
     */
    long countByRoleAndIsActive(UserRole role, boolean isActive);
}
