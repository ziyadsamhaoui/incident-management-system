package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import incident.management.system.dto.IncidentAttachmentResponse;
import incident.management.system.dto.UserSummaryResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.IncidentAttachmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentAttachmentRepository;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.CurrentUserResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Self-hosted media attachment pipeline (photos / video / voice clips).
 * <p>
 * Bytes NEVER buffer into the JVM heap: {@code POST /api/incidents/{id}/attachments}
 * streams the multipart payload straight to local disk via
 * {@link MultipartFile#transferTo(Path)} (see {@link LocalFileStorageService}).
 * Physical file names are random UUIDs — the user's original name is stored in
 * the {@code incident_attachments} table for display only, eliminating path
 * traversal via user input. Reads are served by
 * {@link org.springframework.web.servlet.resource.ResourceHttpRequestHandler}
 * with HTTP Range support for video seeking.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class IncidentAttachmentService {

    /** Hard limit on attachments per incident. */
    public static final int MAX_ATTACHMENTS_PER_INCIDENT = 5;

    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final long MAX_VIDEO_BYTES = 25L * 1024 * 1024;
    private static final long MAX_AUDIO_BYTES = 5L * 1024 * 1024;

    private static final Map<AttachmentType, Set<String>> ALLOWED_CONTENT_TYPES = Map.of(
            AttachmentType.IMAGE, Set.of(
                    "image/jpeg", "image/png", "image/webp", "image/gif",
                    "image/heic", "image/heif", "image/avif"),
            AttachmentType.VIDEO, Set.of(
                    "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"),
            AttachmentType.AUDIO, Set.of(
                    "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4",
                    "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/aac")
    );

    /** Canonical extension per content type — the on-disk extension is NEVER taken from the client. */
    private static final Map<String, String> EXTENSION_BY_MIME = Map.ofEntries(
            Map.entry("image/jpeg", "jpg"),
            Map.entry("image/png", "png"),
            Map.entry("image/webp", "webp"),
            Map.entry("image/gif", "gif"),
            Map.entry("image/heic", "heic"),
            Map.entry("image/heif", "heif"),
            Map.entry("image/avif", "avif"),
            Map.entry("video/mp4", "mp4"),
            Map.entry("video/webm", "webm"),
            Map.entry("video/quicktime", "mov"),
            Map.entry("video/x-msvideo", "avi"),
            Map.entry("audio/webm", "webm"),
            Map.entry("audio/ogg", "ogg"),
            Map.entry("audio/mpeg", "mp3"),
            Map.entry("audio/mp4", "m4a"),
            Map.entry("audio/x-m4a", "m4a"),
            Map.entry("audio/wav", "wav"),
            Map.entry("audio/x-wav", "wav"),
            Map.entry("audio/aac", "aac")
    );

    /** Characters allowed in the display-only file name. */
    private static final Pattern INVALID_FILENAME_CHARS = Pattern.compile("[^A-Za-z0-9._\\-]");

    private final IncidentRepository incidentRepository;
    private final IncidentAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final LocalFileStorageService fileStorage;
    private final MediaUrlSigner urlSigner;
    private final MediaStorageProperties mediaProperties;

    //  ========================================================================
    //  UPLOAD — multipart streaming to local disk
    //  ========================================================================

    public IncidentAttachmentResponse uploadAttachment(Long incidentId, MultipartFile file, AttachmentType fileType) {
        IncidentEntity incident = getIncident(incidentId);
        UserEntity currentUser = CurrentUserResolver.resolve(userRepository);
        MediaAccessPolicy.assertCanAccess(incident, currentUser);
        assertNotTerminal(incident);

        if (file == null || file.isEmpty()) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST, "Aucun fichier reçu.");
        }
        if (attachmentRepository.countByIncidentId(incidentId) >= MAX_ATTACHMENTS_PER_INCIDENT) {
            throw new AttachmentPolicyException(HttpStatus.CONFLICT,
                    "Cet incident a déjà atteint la limite de " + MAX_ATTACHMENTS_PER_INCIDENT + " pièces jointes.");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.get(fileType).contains(contentType)) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST,
                    "Type de contenu non autorisé pour " + fileType.name().toLowerCase() + " : " + contentType);
        }

        long maxBytes = maxBytesFor(fileType);
        if (file.getSize() > maxBytes) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST,
                    "Fichier trop volumineux (" + file.getSize() + " octets) — limite "
                            + (maxBytes / (1024 * 1024)) + " Mo pour les " + fileType.name().toLowerCase() + "s.");
        }

        String displayName = sanitizeFileName(file.getOriginalFilename());
        if (displayName.isBlank()) {
            displayName = "media." + extensionFor(contentType);
        }

        // Server-generated UUID name — original filename is display-only.
        String uuid = UUID.randomUUID().toString();
        String extension = extensionFor(contentType);
        Path stored = fileStorage.store(file, incidentId, uuid, extension);

        // Defense-in-depth: magic-byte sniff on the first 16 bytes of the written file.
        byte[] head = fileStorage.readFirstBytes(stored, 16);
        if (!MagicByteValidator.matches(fileType, contentType, head)) {
            fileStorage.deleteIfExists(stored);
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST,
                    "Le contenu du fichier ne correspond pas au type de média déclaré.");
        }

        String objectKey = incidentId + "/" + uuid + "." + extension;

        IncidentAttachmentEntity entity = IncidentAttachmentEntity.builder()
                .incident(incident)
                .objectKey(objectKey)
                .fileName(displayName)
                .fileType(fileType)
                .mimeType(contentType)
                .fileSizeBytes(file.getSize())
                .uploadedBy(currentUser)
                .build();
        IncidentAttachmentEntity saved = attachmentRepository.save(entity);

        log.info("Stored attachment {} for incident {} ({} / {}, {} bytes)",
                objectKey, incidentId, fileType, contentType, file.getSize());
        return toResponse(saved);
    }

    //  ========================================================================
    //  LIST — signed read URLs for browser rendering
    //  ========================================================================

    @Transactional(readOnly = true)
    public List<IncidentAttachmentResponse> listAttachments(Long incidentId) {
        IncidentEntity incident = getIncident(incidentId);
        UserEntity user = CurrentUserResolver.resolve(userRepository);
        MediaAccessPolicy.assertCanAccess(incident, user);
        return attachmentRepository.findByIncidentIdOrderByUploadedAtDesc(incidentId).stream()
                .map(this::toResponse)
                .toList();
    }

    //  ========================================================================
    //  RETENTION & METRICS
    //  ========================================================================

    /**
     * Deletes media files + rows for terminal incidents older than the retention
     * window. Invoked by the scheduled {@code MediaRetentionJob}.
     *
     * @return number of attachments purged
     */
    public int cleanupExpiredTerminalMedia() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(Math.max(1, mediaProperties.getRetentionDays()));
        List<IncidentAttachmentEntity> expired =
                attachmentRepository.findExpiredTerminal(List.of(
                        IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED), cutoff);

        int purged = 0;
        for (IncidentAttachmentEntity attachment : expired) {
            Path path = fileStorage.resolve(attachment.getObjectKey());
            fileStorage.deleteIfExists(path);
            attachmentRepository.delete(attachment);
            purged++;
        }
        if (purged > 0) {
            log.info("Retention job purged {} media file(s) of terminal incidents older than {} day(s)",
                    purged, mediaProperties.getRetentionDays());
        }
        return purged;
    }

    /** Total bytes stored in {@code incident_attachments} (from the DB — no filesystem walk). */
    @Transactional(readOnly = true)
    public long totalStoredBytes() {
        return attachmentRepository.sumFileSizeBytes();
    }

    public MediaStorageStatus storageStatus() {
        LocalFileStorageService.DiskUsage disk = fileStorage.diskUsage();
        return new MediaStorageStatus(
                fileStorage.isConfigured(),
                totalStoredBytes(),
                disk.usableBytes(),
                disk.totalBytes(),
                mediaProperties.getStoragePath());
    }

    public record MediaStorageStatus(boolean configured, long storedBytes,
                                     long usableBytes, long totalBytes, String storagePath) {
    }

    //  ========================================================================
    //  GUARDRAILS & HELPERS
    //  ========================================================================

    private IncidentEntity getIncident(Long incidentId) {
        return incidentRepository.findById(incidentId)
                .orElseThrow(() -> new ResourceNotFoundException("Incident", "id", incidentId));
    }

    private void assertNotTerminal(IncidentEntity incident) {
        if (incident.getStatus() == IncidentStatus.RESOLVED
                || incident.getStatus() == IncidentStatus.NON_RESOLVED) {
            throw new AttachmentPolicyException(HttpStatus.CONFLICT,
                    "Cet incident est clôturé (résolu / non résolu) — les pièces jointes ne peuvent plus être modifiées.");
        }
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) {
            return "";
        }
        int semi = contentType.indexOf(';');
        String base = semi >= 0 ? contentType.substring(0, semi) : contentType;
        return base.trim().toLowerCase(Locale.ROOT);
    }

    private long maxBytesFor(AttachmentType type) {
        return switch (type) {
            case IMAGE -> MAX_IMAGE_BYTES;
            case VIDEO -> MAX_VIDEO_BYTES;
            case AUDIO -> MAX_AUDIO_BYTES;
        };
    }

    /** Canonical disk extension for a content type — never derived from client input. */
    private String extensionFor(String contentType) {
        return EXTENSION_BY_MIME.getOrDefault(contentType, "bin");
    }

    /** Keeps only safe characters, collapses separators and bounds the length (display-only). */
    private String sanitizeFileName(String fileName) {
        if (fileName == null) {
            return "";
        }
        String cleaned = INVALID_FILENAME_CHARS.matcher(fileName).replaceAll("_");
        cleaned = cleaned.replaceAll("_+", "_");
        cleaned = cleaned.replaceAll("^[._-]+|[._-]+$", "");
        if (cleaned.length() > 120) {
            cleaned = cleaned.substring(cleaned.length() - 120);
        }
        return cleaned;
    }

    private IncidentAttachmentResponse toResponse(IncidentAttachmentEntity entity) {
        UserSummaryResponse uploader = entity.getUploadedBy() != null
                ? new UserSummaryResponse(
                        entity.getUploadedBy().getId(),
                        entity.getUploadedBy().getFirstName(),
                        entity.getUploadedBy().getLastName(),
                        entity.getUploadedBy().getMatricule())
                : null;
        Long incidentId = entity.getIncident() != null ? entity.getIncident().getId() : null;
        String fileUrl = incidentId != null
                ? "/api/incidents/" + incidentId + "/attachments/" + entity.getId()
                + "?token=" + urlSigner.sign(incidentId, entity.getId())
                : null;
        return new IncidentAttachmentResponse(
                entity.getId(),
                incidentId,
                entity.getFileType(),
                entity.getMimeType(),
                entity.getFileSizeBytes(),
                entity.getFileName(),
                fileUrl,
                uploader,
                entity.getUploadedAt());
    }
}
