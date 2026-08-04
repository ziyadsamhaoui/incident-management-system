package incident.management.system.repository;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentAttachmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface IncidentAttachmentRepository extends JpaRepository<IncidentAttachmentEntity, Long> {

    List<IncidentAttachmentEntity> findByIncidentIdOrderByUploadedAtDesc(Long incidentId);

    long countByIncidentId(Long incidentId);

    /** Attachments of terminal incidents uploaded before the cutoff — retention candidates. */
    @Query("""
            SELECT a FROM IncidentAttachmentEntity a
            WHERE a.incident.status IN :terminalStatuses AND a.uploadedAt < :cutoff
            """)
    List<IncidentAttachmentEntity> findExpiredTerminal(
            @Param("terminalStatuses") Collection<IncidentStatus> terminalStatuses,
            @Param("cutoff") LocalDateTime cutoff);

    /** Total bytes stored (DB-side metric, no filesystem walk). */
    @Query("SELECT COALESCE(SUM(a.fileSizeBytes), 0) FROM IncidentAttachmentEntity a")
    long sumFileSizeBytes();
}
