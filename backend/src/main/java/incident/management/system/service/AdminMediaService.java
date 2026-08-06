package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import incident.management.system.dto.AdminMediaResponse;
import incident.management.system.dto.AdminMediaStatsResponse;
import incident.management.system.dto.MediaBulkDeleteResult;
import incident.management.system.dto.UserSummaryResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.IncidentAttachmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentAttachmentRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.CurrentUserResolver;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Media Administration & Quota Management surface ({@code /api/admin/media}).
 * <p>
 * Operational rules of this surface:
 * <ul>
 *   <li><b>Scope:</b> IMAGE + VIDEO only — AUDIO voice clips are strictly
 *       excluded from every query ({@code file_type IN ('IMAGE','VIDEO')}).</li>
 *   <li><b>Deletion strategy:</b> the physical file is hard-deleted from disk
 *       ({@code Files.deleteIfExists}), but the DB row is <b>soft-deleted</b>
 *       into an audit stub ({@code object_key = NULL}, {@code is_deleted = TRUE},
 *       {@code deletion_audit = "… supprimée par [admin] le [ts]"}). Rows are
 *       never silently removed — legal audit trails must survive.</li>
 *   <li><b>No unconfirmed bulk deletes:</b> the endpoint returns the exact
 *       freed-byte count so the UI can show a calculated confirmation modal.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AdminMediaService {

    private static final DateTimeFormatter AUDIT_TIMESTAMP = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final IncidentAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final LocalFileStorageService fileStorage;
    private final MediaUrlSigner urlSigner;
    private final MediaStorageProperties mediaProperties;

    //  ========================================================================
    //  LIST — paginated, IMAGE/VIDEO only, combinable filters
    //  ========================================================================

    @Transactional(readOnly = true)
    public Page<AdminMediaResponse> listMedia(String search,
                                              Long departmentId,
                                              AttachmentType fileType,
                                              LocalDate startDate,
                                              LocalDate endDate,
                                              Pageable pageable) {
        Specification<IncidentAttachmentEntity> spec =
                buildFilterSpec(search, departmentId, fileType, startDate, endDate);
        return attachmentRepository.findAll(spec, pageable).map(this::toResponse);
    }

    /**
     * Combined filter behind {@code GET /api/admin/media}. Every query on this
     * surface hard-codes {@code fileType IN (IMAGE, VIDEO)} — audio voice clips
     * are never visible to admins here.
     */
    private Specification<IncidentAttachmentEntity> buildFilterSpec(String search,
                                                                    Long departmentId,
                                                                    AttachmentType fileType,
                                                                    LocalDate startDate,
                                                                    LocalDate endDate) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(root.get("fileType").in(AttachmentType.IMAGE, AttachmentType.VIDEO));
            predicates.add(cb.isFalse(root.get("deleted")));

            if (search != null && !search.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("incident").get("reference")),
                        "%" + search.trim().toLowerCase() + "%"));
            }
            if (departmentId != null) {
                predicates.add(cb.equal(root.get("incident").get("department").get("id"), departmentId));
            }
            if (fileType != null) {
                predicates.add(cb.equal(root.get("fileType"), fileType));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("uploadedAt"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("uploadedAt"), endDate.plusDays(1).atStartOfDay()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    //  ========================================================================
    //  STATS — storage summary strip (DB bytes + real host disk headroom)
    //  ========================================================================

    @Transactional(readOnly = true)
    public AdminMediaStatsResponse stats() {
        long photoBytes = attachmentRepository.sumFileSizeBytesByType(AttachmentType.IMAGE);
        long videoBytes = attachmentRepository.sumFileSizeBytesByType(AttachmentType.VIDEO);
        long photoCount = attachmentRepository.countByFileTypeAndNotDeleted(AttachmentType.IMAGE);
        long videoCount = attachmentRepository.countByFileTypeAndNotDeleted(AttachmentType.VIDEO);

        LocalFileStorageService.DiskUsage disk = fileStorage.diskUsage();
        return new AdminMediaStatsResponse(
                fileStorage.isConfigured(),
                mediaProperties.getStoragePath(),
                photoBytes + videoBytes,
                photoBytes,
                videoBytes,
                photoCount,
                videoCount,
                photoCount + videoCount,
                disk.usableBytes(),
                disk.totalBytes());
    }

    //  ========================================================================
    //  SINGLE DELETE — disk removal + DB audit stub
    //  ========================================================================

    public void deleteMedia(Long id) {
        IncidentAttachmentEntity attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment", "id", id));
        UserEntity admin = requireAdmin();
        assertLiveImageOrVideo(attachment);

        deleteOne(attachment, admin);
        log.info("ADMIN {} deleted media {} (incident {}, {} bytes)",
                admin.getAuditLabel(), attachment.getId(),
                attachment.getIncident() != null ? attachment.getIncident().getReference() : "?",
                attachment.getFileSizeBytes());
    }

    //  ========================================================================
    //  BULK DELETE — iterates ids, reports freed bytes + skipped ids
    //  ========================================================================

    /**
     * Deletes the physical files of the requested media and transforms their DB
     * records into audit stubs. Unknown / already-deleted ids are reported in
     * {@code skippedIds} instead of failing the whole batch, so a stale client
     * selection cannot wedge the admin surface.
     *
     * @return count + exact freed bytes (sum of {@code file_size_bytes}) to
     *         power the UI's calculated confirmation summary
     */
    public MediaBulkDeleteResult bulkDelete(List<Long> ids) {
        UserEntity admin = requireAdmin();
        int deleted = 0;
        long freedBytes = 0L;
        List<Long> skippedIds = new ArrayList<>();

        for (Long id : ids) {
            try {
                IncidentAttachmentEntity attachment = attachmentRepository.findById(id).orElse(null);
                // Unknown / already-deleted / AUDIO (excluded from this surface) → skipped.
                if (attachment == null || attachment.isDeleted()
                        || attachment.getFileType() == AttachmentType.AUDIO) {
                    skippedIds.add(id);
                    continue;
                }
                long freed = deleteOne(attachment, admin);
                deleted++;
                freedBytes += freed;
            } catch (Exception e) {
                // One bad row must not abort the whole batch — report it as skipped.
                log.warn("Bulk media delete failed for id {}: {}", id, e.getMessage());
                skippedIds.add(id);
            }
        }

        if (deleted > 0) {
            log.info("ADMIN {} bulk-deleted {} media file(s), freeing {} bytes ({} skipped)",
                    admin.getAuditLabel(), deleted, freedBytes, skippedIds.size());
        }
        return new MediaBulkDeleteResult(deleted, freedBytes, skippedIds);
    }

    //  ========================================================================
    //  SHARED DELETE PRIMITIVE
    //  ========================================================================

    /**
     * Soft-deletes the DB row into an audit stub FIRST, then hard-deletes the
     * physical file. Ordering matters: if the stub persist fails, the
     * transaction rolls back cleanly and the file is untouched — a live row can
     * never be left pointing at a deleted file. Returns the bytes actually
     * freed (only counted when the file existed on disk).
     */
    private long deleteOne(IncidentAttachmentEntity attachment, UserEntity admin) {
        String typeLabel = attachment.getFileType() == AttachmentType.VIDEO ? "Vidéo" : "Photo";
        String objectKey = attachment.getObjectKey();
        LocalDateTime now = LocalDateTime.now();

        // 1. Soft-delete the metadata row — retain the stub for the audit trail.
        attachment.setObjectKey(null);
        attachment.setDeleted(true);
        attachment.setDeletedAt(now);
        attachment.setDeletionAudit(typeLabel + " supprimée par "
                + admin.getFirstName() + " " + admin.getLastName()
                + " le " + AUDIT_TIMESTAMP.format(now));
        attachmentRepository.save(attachment);

        // 2. Physical removal — best effort, after the stub is persisted.
        long bytes = attachment.getFileSizeBytes() != null ? attachment.getFileSizeBytes() : 0L;
        if (objectKey != null && fileStorage.deleteIfExistsReported(objectKey)) {
            return bytes;
        }
        return 0L;
    }

    //  ========================================================================
    //  GUARDS & MAPPING
    //  ========================================================================

    private UserEntity requireAdmin() {
        UserEntity admin = CurrentUserResolver.resolve(userRepository);
        if (admin == null) {
            throw new AttachmentPolicyException(HttpStatus.UNAUTHORIZED, "Authentification requise.");
        }
        return admin;
    }

    /**
     * Guard shared by the single-delete path: the row must be live AND of an
     * administrable type. Voice clips (AUDIO) are strictly excluded from this
     * surface — they can only be managed on their incident detail pages.
     */
    private void assertLiveImageOrVideo(IncidentAttachmentEntity attachment) {
        if (attachment.isDeleted()) {
            throw new AttachmentPolicyException(HttpStatus.CONFLICT,
                    "Ce fichier a déjà été supprimé.");
        }
        if (attachment.getFileType() == AttachmentType.AUDIO) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST,
                    "Les clips vocaux (AUDIO) sont exclus de la gestion média administrative.");
        }
    }

    private AdminMediaResponse toResponse(IncidentAttachmentEntity entity) {
        IncidentEntity incident = entity.getIncident();
        Long incidentId = incident != null ? incident.getId() : null;
        String fileUrl = incidentId != null && !entity.isDeleted()
                ? "/api/incidents/" + incidentId + "/attachments/" + entity.getId()
                + "?token=" + urlSigner.sign(incidentId, entity.getId())
                : null;

        UserSummaryResponse uploader = entity.getUploadedBy() != null
                ? new UserSummaryResponse(
                        entity.getUploadedBy().getId(),
                        entity.getUploadedBy().getFirstName(),
                        entity.getUploadedBy().getLastName(),
                        entity.getUploadedBy().getMatricule())
                : null;

        return new AdminMediaResponse(
                entity.getId(),
                incidentId,
                incident != null ? incident.getReference() : null,
                incident != null && incident.getDepartment() != null ? incident.getDepartment().getName() : null,
                incident != null && incident.getCategory() != null ? incident.getCategory().getName() : null,
                entity.getFileType(),
                entity.getMimeType(),
                entity.getFileSizeBytes(),
                entity.getFileName(),
                fileUrl,
                uploader,
                entity.getUploadedAt(),
                retentionDaysRemaining(incident, entity.getUploadedAt()));
    }

    /**
     * Days until the daily {@code MediaRetentionJob} would auto-delete this
     * file. Only meaningful for terminal incidents ({@code RESOLVED} /
     * {@code NON_RESOLVED}) — for open incidents the job never touches the file,
     * so {@code null} is returned and the UI hides the countdown badge.
     */
    private Integer retentionDaysRemaining(IncidentEntity incident, LocalDateTime uploadedAt) {
        if (incident == null || uploadedAt == null) {
            return null;
        }
        IncidentStatus status = incident.getStatus();
        if (status != IncidentStatus.RESOLVED && status != IncidentStatus.NON_RESOLVED) {
            return null;
        }
        long elapsed = ChronoUnit.DAYS.between(uploadedAt.toLocalDate(), LocalDate.now());
        return (int) Math.max(0, mediaProperties.getRetentionDays() - elapsed);
    }
}
