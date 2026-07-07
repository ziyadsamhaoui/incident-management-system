package incident.management.system.repository;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IncidentRepository extends JpaRepository<IncidentEntity, Long> {

    Page<IncidentEntity> findByStatus(IncidentStatus status, Pageable pageable);

    Page<IncidentEntity> findByUser(UserEntity user, Pageable pageable);

    Page<IncidentEntity> findByDepartment(DepartmentEntity department, Pageable pageable);

    Optional<IncidentEntity> findByReference(String reference);
}
