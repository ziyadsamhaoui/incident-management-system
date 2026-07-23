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

    List<UserEntity> findByDepartmentAndRole(DepartmentEntity department, UserRole role);
}
