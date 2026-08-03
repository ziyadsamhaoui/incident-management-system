package incident.management.system.repository;

import incident.management.system.model.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLogEntity, Long> {

    /**
     * Most recent audit entries targeting a given user (newest first) — feeds
     * the "piste d'audit" strip on the admin user detail page.
     */
    List<AuditLogEntity> findTop50ByTargetUserIdOrderByCreatedAtDesc(Long targetUserId);
}
