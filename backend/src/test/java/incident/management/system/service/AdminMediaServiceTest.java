package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import incident.management.system.dto.AdminMediaResponse;
import incident.management.system.dto.AdminMediaStatsResponse;
import incident.management.system.dto.MediaBulkDeleteResult;
import incident.management.system.enums.AttachmentType;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.CategoryEntity;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentAttachmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentAttachmentRepository;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the Media Administration & Quota surface: paginated listing,
 * storage stats, single + bulk deletion with disk removal and DB audit stubs.
 */
@ExtendWith(MockitoExtension.class)
class AdminMediaServiceTest {

    @Mock
    private IncidentAttachmentRepository attachmentRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private LocalFileStorageService fileStorage;
    @Mock
    private MediaUrlSigner urlSigner;

    private MediaStorageProperties mediaProperties;
    private AdminMediaService service;
    private UserEntity admin;
    private DepartmentEntity department;
    private CategoryEntity category;

    @BeforeEach
    void setUp() {
        mediaProperties = new MediaStorageProperties();
        mediaProperties.setStoragePath("/data/incident-media");
        mediaProperties.setRetentionDays(90);

        service = new AdminMediaService(
                attachmentRepository, userRepository, fileStorage, urlSigner, mediaProperties);

        department = DepartmentEntity.builder().id(10L).name("Mécanique").build();
        category = CategoryEntity.builder().id(20L).name("Sécurité").build();
        admin = UserEntity.builder()
                .id(1L).firstName("Jane").lastName("Doe").matricule(1001)
                .role(UserRole.ADMIN).isActive(true)
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAsAdmin() {
        when(userRepository.findByMatricule(1001)).thenReturn(Optional.of(admin));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("1001", "pass", List.of()));
    }

    private IncidentEntity incident(Long id, IncidentStatus status) {
        return IncidentEntity.builder()
                .id(id)
                .reference("INC-TEST-" + id)
                .status(status)
                .department(department)
                .category(category)
                .build();
    }

    private IncidentAttachmentEntity attachment(Long id, IncidentEntity inc, AttachmentType type,
                                                long bytes, String objectKey, LocalDateTime uploadedAt) {
        return IncidentAttachmentEntity.builder()
                .id(id)
                .incident(inc)
                .objectKey(objectKey)
                .fileName("media." + (type == AttachmentType.IMAGE ? "jpg" : "mp4"))
                .fileType(type)
                .mimeType(type == AttachmentType.IMAGE ? "image/jpeg" : "video/mp4")
                .fileSizeBytes(bytes)
                .uploadedBy(admin)
                .uploadedAt(uploadedAt)
                .build();
    }

    //  ---------------------------------------------------------------------
    //  LIST
    //  ---------------------------------------------------------------------

    @Nested
    @DisplayName("listMedia")
    class ListMedia {

        @Test
        @DisplayName("returns paginated media items with incident context + retention countdown")
        void listMedia_mapsEntitiesWithRetention() {
            IncidentEntity inc = incident(7L, IncidentStatus.RESOLVED);
            IncidentAttachmentEntity att = attachment(
                    5L, inc, AttachmentType.IMAGE, 2048L, "7/uuid.jpg",
                    LocalDateTime.now().minusDays(76)); // 76 days ago → 14 days left of 90

            when(attachmentRepository.findAll(any(Specification.class), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of(att)));
            when(urlSigner.sign(7L, 5L)).thenReturn("tok");

            Page<AdminMediaResponse> page = service.listMedia(
                    null, null, null, null, null,
                    PageRequest.of(0, 24, Sort.by(Sort.Direction.DESC, "uploadedAt")));

            assertThat(page.getTotalElements()).isEqualTo(1);
            AdminMediaResponse r = page.getContent().get(0);
            assertThat(r.id()).isEqualTo(5L);
            assertThat(r.incidentId()).isEqualTo(7L);
            assertThat(r.incidentReference()).isEqualTo("INC-TEST-7");
            assertThat(r.departmentName()).isEqualTo("Mécanique");
            assertThat(r.categoryName()).isEqualTo("Sécurité");
            assertThat(r.fileType()).isEqualTo(AttachmentType.IMAGE);
            assertThat(r.fileSizeBytes()).isEqualTo(2048L);
            assertThat(r.fileUrl()).isEqualTo("/api/incidents/7/attachments/5?token=tok");
            assertThat(r.uploadedBy().firstName()).isEqualTo("Jane");
            assertThat(r.retentionDaysRemaining()).isEqualTo(14);
        }

        @Test
        @DisplayName("open (non-terminal) incidents report no retention countdown")
        void listMedia_openIncident_hasNullRetention() {
            IncidentEntity inc = incident(8L, IncidentStatus.IN_PROGRESS);
            IncidentAttachmentEntity att = attachment(
                    6L, inc, AttachmentType.VIDEO, 1024L, "8/uuid.mp4", LocalDateTime.now().minusDays(2));

            when(attachmentRepository.findAll(any(Specification.class), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of(att)));

            AdminMediaResponse r = service.listMedia(null, null, null, null, null,
                    PageRequest.of(0, 24)).getContent().get(0);

            assertThat(r.retentionDaysRemaining()).isNull();
        }
    }

    //  ---------------------------------------------------------------------
    //  STATS
    //  ---------------------------------------------------------------------

    @Nested
    @DisplayName("stats")
    class Stats {

        @Test
        @DisplayName("aggregates per-type bytes + counts and exposes host disk headroom")
        void stats_aggregatesTypeBreakdownAndDisk() {
            when(attachmentRepository.sumFileSizeBytesByType(AttachmentType.IMAGE)).thenReturn(1_000L);
            when(attachmentRepository.sumFileSizeBytesByType(AttachmentType.VIDEO)).thenReturn(2_000L);
            when(attachmentRepository.countByFileTypeAndNotDeleted(AttachmentType.IMAGE)).thenReturn(2L);
            when(attachmentRepository.countByFileTypeAndNotDeleted(AttachmentType.VIDEO)).thenReturn(1L);
            when(fileStorage.isConfigured()).thenReturn(true);
            when(fileStorage.diskUsage())
                    .thenReturn(new LocalFileStorageService.DiskUsage(90_000L, 100_000L));

            AdminMediaStatsResponse stats = service.stats();

            assertThat(stats.configured()).isTrue();
            assertThat(stats.storedBytes()).isEqualTo(3_000L);
            assertThat(stats.photoBytes()).isEqualTo(1_000L);
            assertThat(stats.videoBytes()).isEqualTo(2_000L);
            assertThat(stats.photoCount()).isEqualTo(2L);
            assertThat(stats.videoCount()).isEqualTo(1L);
            assertThat(stats.totalCount()).isEqualTo(3L);
            assertThat(stats.usableBytes()).isEqualTo(90_000L);
            assertThat(stats.totalBytes()).isEqualTo(100_000L);
            assertThat(stats.usedRatio()).isEqualTo(0.03d);
        }
    }

    //  ---------------------------------------------------------------------
    //  SINGLE DELETE
    //  ---------------------------------------------------------------------

    @Nested
    @DisplayName("deleteMedia")
    class DeleteMedia {

        @Test
        @DisplayName("soft-deletes the DB row (audit stub) and hard-deletes the file")
        void deleteMedia_deletesFileAndKeepsAuditStub() {
            authenticateAsAdmin();
            IncidentAttachmentEntity att = attachment(
                    5L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.IMAGE,
                    2048L, "7/uuid.jpg", LocalDateTime.now().minusDays(1));
            when(attachmentRepository.findById(5L)).thenReturn(Optional.of(att));
            when(fileStorage.deleteIfExistsReported("7/uuid.jpg")).thenReturn(true);

            service.deleteMedia(5L);

            verify(fileStorage).deleteIfExistsReported("7/uuid.jpg");
            ArgumentCaptor<IncidentAttachmentEntity> captor =
                    ArgumentCaptor.forClass(IncidentAttachmentEntity.class);
            verify(attachmentRepository).save(captor.capture());

            IncidentAttachmentEntity saved = captor.getValue();
            assertThat(saved.isDeleted()).isTrue();
            assertThat(saved.getObjectKey()).isNull();
            assertThat(saved.getDeletedAt()).isNotNull();
            assertThat(saved.getDeletionAudit())
                    .contains("Photo supprimée par")
                    .contains("Jane Doe");
        }

        @Test
        @DisplayName("AUDIO voice clips are rejected — strictly excluded from this surface")
        void deleteMedia_audioFile_throws400() {
            authenticateAsAdmin();
            IncidentAttachmentEntity att = attachment(
                    9L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.AUDIO,
                    512L, "7/uuid.webm", LocalDateTime.now().minusDays(1));
            when(attachmentRepository.findById(9L)).thenReturn(Optional.of(att));

            assertThatThrownBy(() -> service.deleteMedia(9L))
                    .isInstanceOf(AttachmentPolicyException.class)
                    .extracting(e -> ((AttachmentPolicyException) e).getStatus())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            verify(attachmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("already-soft-deleted row → 409 Conflict, no file deletion retried")
        void deleteMedia_alreadyDeleted_throwsConflict() {
            authenticateAsAdmin();
            IncidentAttachmentEntity att = attachment(
                    5L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.IMAGE,
                    2048L, null, LocalDateTime.now());
            att.setDeleted(true);
            when(attachmentRepository.findById(5L)).thenReturn(Optional.of(att));

            assertThatThrownBy(() -> service.deleteMedia(5L))
                    .isInstanceOf(AttachmentPolicyException.class)
                    .extracting(e -> ((AttachmentPolicyException) e).getStatus())
                    .isEqualTo(HttpStatus.CONFLICT);
            verify(fileStorage, never()).deleteIfExistsReported(any());
            verify(attachmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("unknown id → 404")
        void deleteMedia_unknownId_throws404() {
            when(attachmentRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteMedia(99L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    //  ---------------------------------------------------------------------
    //  BULK DELETE
    //  ---------------------------------------------------------------------

    @Nested
    @DisplayName("bulkDelete")
    class BulkDelete {

        @Test
        @DisplayName("sums freed bytes across files and skips unknown ids")
        void bulkDelete_reportsFreedBytesAndSkippedIds() {
            authenticateAsAdmin();
            IncidentAttachmentEntity a1 = attachment(
                    1L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.IMAGE,
                    100L, "7/a.jpg", LocalDateTime.now().minusDays(1));
            IncidentAttachmentEntity a2 = attachment(
                    2L, incident(8L, IncidentStatus.IN_PROGRESS), AttachmentType.VIDEO,
                    300L, "8/b.mp4", LocalDateTime.now().minusDays(1));
            when(attachmentRepository.findById(1L)).thenReturn(Optional.of(a1));
            when(attachmentRepository.findById(2L)).thenReturn(Optional.of(a2));
            when(attachmentRepository.findById(99L)).thenReturn(Optional.empty());
            when(fileStorage.deleteIfExistsReported("7/a.jpg")).thenReturn(true);
            when(fileStorage.deleteIfExistsReported("8/b.mp4")).thenReturn(true);

            MediaBulkDeleteResult result = service.bulkDelete(List.of(1L, 2L, 99L));

            assertThat(result.deletedCount()).isEqualTo(2);
            assertThat(result.freedBytes()).isEqualTo(400L);
            assertThat(result.skippedIds()).containsExactly(99L);
            verify(fileStorage, times(2)).deleteIfExistsReported(any());
            verify(attachmentRepository, times(2)).save(any());
        }

        @Test
        @DisplayName("AUDIO items are skipped, never deleted through this surface")
        void bulkDelete_skipsAudioItems() {
            authenticateAsAdmin();
            IncidentAttachmentEntity voice = attachment(
                    3L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.AUDIO,
                    200L, "7/uuid.webm", LocalDateTime.now().minusDays(1));
            when(attachmentRepository.findById(3L)).thenReturn(Optional.of(voice));

            MediaBulkDeleteResult result = service.bulkDelete(List.of(3L));

            assertThat(result.deletedCount()).isZero();
            assertThat(result.freedBytes()).isZero();
            assertThat(result.skippedIds()).containsExactly(3L);
            verify(attachmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("already-deleted items are skipped, not re-processed")
        void bulkDelete_skipsDeletedItems() {
            authenticateAsAdmin();
            IncidentAttachmentEntity a1 = attachment(
                    1L, incident(7L, IncidentStatus.IN_PROGRESS), AttachmentType.IMAGE,
                    100L, null, LocalDateTime.now().minusDays(1));
            a1.setDeleted(true);
            when(attachmentRepository.findById(1L)).thenReturn(Optional.of(a1));

            MediaBulkDeleteResult result = service.bulkDelete(List.of(1L));

            assertThat(result.deletedCount()).isZero();
            assertThat(result.freedBytes()).isZero();
            assertThat(result.skippedIds()).containsExactly(1L);
            verify(fileStorage, never()).deleteIfExistsReported(any());
        }
    }
}
