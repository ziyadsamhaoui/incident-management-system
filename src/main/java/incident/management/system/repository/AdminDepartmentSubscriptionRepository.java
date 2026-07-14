package incident.management.system.repository;

import incident.management.system.model.AdminDepartmentSubscription;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminDepartmentSubscriptionRepository
        extends JpaRepository<AdminDepartmentSubscription, Long> {

    List<AdminDepartmentSubscription> findByAdmin(UserEntity admin);

    List<AdminDepartmentSubscription> findByDepartment(DepartmentEntity department);

    Optional<AdminDepartmentSubscription> findByAdminAndDepartment(UserEntity admin, DepartmentEntity department);

    boolean existsByAdminAndDepartment(UserEntity admin, DepartmentEntity department);

    void deleteByAdminAndDepartment(UserEntity admin, DepartmentEntity department);
}
