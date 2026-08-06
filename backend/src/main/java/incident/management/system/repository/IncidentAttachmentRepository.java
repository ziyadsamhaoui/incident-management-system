package incident.management.system.repository;

import incident.management.system.enums.AttachmentType;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.IncidentAttachmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface IncidentAttachmentRepository
        extends JpaRepository<IncidentAttachmentEntity, Long>,
        JpaSpecificationExecutor<IncidentAttachmentEntity> {

    List<IncidentAttachmentEntity> findByIncidentIdOrderByUploadedAtDesc(Long incidentId);

    long countByIncidentId(Long incidentId);

    /**
     * Attachments of terminal incidents uploaded before the cutoff — retention
     * candidates. Soft-deleted audit stubs are excluded: the admin surface
     * already removed their physical files.
     */
    @Query("""
            SELECT a FROM IncidentAttachmentEntity a
            WHERE a.incident.status IN :terminalStatuses
              AND a.uploadedAt < :cutoff
              AND a.deleted = false
            """)
    List<IncidentAttachmentEntity> findExpiredTerminal(
            @Param("terminalStatuses") Collection<IncidentStatus> terminalStatuses,
            @Param("cutoff") LocalDateTime cutoff);

    /** Total bytes of live (non-deleted) media — DB-side metric, no filesystem walk. */
    @Query("SELECT COALESCE(SUM(a.fileSizeBytes), 0) FROM IncidentAttachmentEntity a WHERE a.deleted = false")
    long sumFileSizeBytes();

    /** Live bytes for one media type (IMAGE / VIDEO / AUDIO). */
    @Query("""
            SELECT COALESCE(SUM(a.fileSizeBytes), 0) FROM IncidentAttachmentEntity a
            WHERE a.deleted = false AND a.fileType = :type
            """)
    long sumFileSizeBytesByType(@Param("type") AttachmentType type);

    /** Live file count for one media type. */
    @Query("""
            SELECT COUNT(a) FROM IncidentAttachmentEntity a
            WHERE a.deleted = false AND a.fileType = :type
            """)
    long countByFileTypeAndNotDeleted(@Param("type") AttachmentType type);
}
