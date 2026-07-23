package incident.management.system.repository;

import incident.management.system.model.NotificationEntity;
import incident.management.system.model.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {

    Page<NotificationEntity> findByRecipientAndIsReadFalse(UserEntity recipient, Pageable pageable);
}
