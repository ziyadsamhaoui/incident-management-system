package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import incident.management.system.dto.IncidentAttachmentResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentAttachmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentAttachmentRepository;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the self-hosted local media pipeline.
 * <p>
 * Bytes NEVER buffer in the JVM heap — {@code LocalFileStorageService.store()}
 * streams via {@code MultipartFile.transferTo(Path)} and is mocked here, so the
 * tests only exercise the service's policy/verification logic. All physical
 * writes happen through the storage service abstraction.
 */
@ExtendWith(MockitoExtension.class)
class IncidentAttachmentServiceTest {

    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00, 0x01};
    private static final byte[] GIF_MAGIC = {'G', 'I', 'F', '8', '9', 'a'};

    @Mock
    private IncidentRepository incidentRepository;
    @Mock
    private IncidentAttachmentRepository attachmentRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private LocalFileStorageService fileStorage;
    @Mock
    private MediaUrlSigner urlSigner;

    private MediaStorageProperties mediaProperties;
    private IncidentAttachmentService service;

    private UserEntity admin;
    private UserEntity chef;
    private UserEntity sousChef;
    private DepartmentEntity department;

    @BeforeEach
    void setUp() {
        mediaProperties = new MediaStorageProperties();
        mediaProperties.setStoragePath("/data/incident-media");
        mediaProperties.setRetentionDays(90);

        service = new IncidentAttachmentService(
                incidentRepository, attachmentRepository, userRepository,
                fileStorage, urlSigner, mediaProperties);

        department = DepartmentEntity.builder().id(10L).name("Mécanique").build();

        admin = user(1L, UserRole.ADMIN, null);
        chef = user(2L, UserRole.CHEF_ATELIER, department);
        sousChef = user(3L, UserRole.SOUS_CHEF, null);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserEntity user(Long id, UserRole role, DepartmentEntity dept) {
        return UserEntity.builder()
                .id(id)
                .firstName("First")
                .lastName("Last")
                .matricule(id.intValue())
                .role(role)
                .department(dept)
                .isActive(true)
                .build();
    }

    private void authenticateAs(UserEntity user) {
        when(userRepository.findByMatricule(user.getMatricule())).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        String.valueOf(user.getMatricule()), "pass", List.of()));
    }

    private IncidentEntity incident(Long id, IncidentStatus status, UserEntity declarer, DepartmentEntity dept) {
        return IncidentEntity.builder()
                .id(id)
                .reference("INC-TEST-" + id)
                .status(status)
                .user(declarer)
                .department(dept)
                .build();
    }

    private MultipartFile file(String name, String contentType, byte[] content) {
        return new MockMultipartFile("file", name, contentType, content);
    }

    private void stubStorageHappyPath(String contentType, byte[] magic) {
        when(fileStorage.store(any(MultipartFile.class), anyLong(), anyString(), anyString()))
                .thenReturn(Path.of("/data/incident-media/1/uuid-1.jpg"));
        when(fileStorage.readFirstBytes(any(Path.class), eq(16))).thenReturn(magic);
    }

    private IncidentAttachmentEntity savedEntity(Long id, IncidentEntity incident) {
        return IncidentAttachmentEntity.builder()
                .id(id)
                .incident(incident)
                .objectKey("1/uuid-1.jpg")
                .fileName("photo.jpg")
                .fileType(AttachmentType.IMAGE)
                .mimeType("image/jpeg")
                .fileSizeBytes(2048L)
                .uploadedBy(admin)
                .build();
    }

    // ── Terminal lock ────────────────────────────────────────────────────

    @Test
    void upload_rejectsTerminalIncident() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.RESOLVED, sousChef, department)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void upload_rejectsNonResolvedIncident() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.NON_RESOLVED, sousChef, department)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    // ── Count / size / type limits ───────────────────────────────────────

    @Test
    void upload_rejectsWhenCountLimitReached() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));
        when(attachmentRepository.countByIncidentId(1L)).thenReturn(5L);

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void upload_rejectsEmptyFile() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("empty.jpg", "image/jpeg", new byte[0]), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void upload_rejectsDisallowedContentType() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("evil.html", "text/html", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void upload_rejectsOversizedVideo() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));

        byte[] big = new byte[26 * 1024 * 1024]; // 26 Mo > 25 Mo cap
        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("clip.mp4", "video/mp4", big), AttachmentType.VIDEO))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ── Magic-byte verification + happy path ─────────────────────────────

    @Test
    void upload_persistsAfterSuccessfulMagicByteVerification() {
        authenticateAs(admin);
        IncidentEntity incident = incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(incident));
        when(attachmentRepository.countByIncidentId(1L)).thenReturn(0L);
        stubStorageHappyPath("image/jpeg", JPEG_MAGIC);
        when(urlSigner.sign(1L, 99L)).thenReturn("signed-token");
        when(attachmentRepository.save(any(IncidentAttachmentEntity.class)))
                .thenAnswer(inv -> {
                    IncidentAttachmentEntity entity = inv.getArgument(0);
                    entity.setId(99L);
                    return entity;
                });

        IncidentAttachmentResponse response = service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", JPEG_MAGIC), AttachmentType.IMAGE);

        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.incidentId()).isEqualTo(1L);
        assertThat(response.fileType()).isEqualTo(AttachmentType.IMAGE);
        assertThat(response.mimeType()).isEqualTo("image/jpeg");
        assertThat(response.fileSizeBytes()).isEqualTo(5L); // JPEG_MAGIC length
        assertThat(response.fileName()).isEqualTo("photo.jpg");
        assertThat(response.fileUrl()).isEqualTo("/api/incidents/1/attachments/99?token=signed-token");
        verify(attachmentRepository).save(any(IncidentAttachmentEntity.class));
    }

    @Test
    void upload_rejectsSpoofedPayloadAndDeletesStoredFile() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));
        when(attachmentRepository.countByIncidentId(1L)).thenReturn(0L);
        // GIF magic declared as JPEG → spoofed payload
        stubStorageHappyPath("image/jpeg", GIF_MAGIC);

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("fake.jpg", "image/jpeg", GIF_MAGIC), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        verify(fileStorage).deleteIfExists(Path.of("/data/incident-media/1/uuid-1.jpg"));
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    void upload_storageUnavailable_answers503() {
        authenticateAs(admin);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));
        when(attachmentRepository.countByIncidentId(1L)).thenReturn(0L);
        when(fileStorage.store(any(MultipartFile.class), anyLong(), anyString(), anyString()))
                .thenThrow(new AttachmentPolicyException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Le stockage média local n'est pas disponible sur ce serveur."));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", JPEG_MAGIC), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    // ── Access rules ─────────────────────────────────────────────────────

    @Test
    void access_sousChefCannotAttachToOthersIncident() {
        UserEntity other = user(50L, UserRole.SOUS_CHEF, null);
        authenticateAs(other);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void access_sousChefCanAttachToOwnIncident() {
        authenticateAs(sousChef);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, department)));
        when(attachmentRepository.countByIncidentId(1L)).thenReturn(0L);
        stubStorageHappyPath("image/jpeg", JPEG_MAGIC);
        when(urlSigner.sign(anyLong(), anyLong())).thenReturn("token");
        when(attachmentRepository.save(any(IncidentAttachmentEntity.class)))
                .thenAnswer(inv -> {
                    IncidentAttachmentEntity entity = inv.getArgument(0);
                    entity.setId(99L);
                    return entity;
                });

        IncidentAttachmentResponse response = service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", JPEG_MAGIC), AttachmentType.IMAGE);

        assertThat(response.id()).isEqualTo(99L);
    }

    @Test
    void access_chefAtelierScopedToOwnDepartment() {
        DepartmentEntity otherDept = DepartmentEntity.builder().id(99L).name("Électrique").build();
        authenticateAs(chef);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(
                incident(1L, IncidentStatus.IN_PROGRESS, sousChef, otherDept)));

        assertThatThrownBy(() -> service.uploadAttachment(
                1L, file("photo.jpg", "image/jpeg", new byte[]{1}), AttachmentType.IMAGE))
                .isInstanceOf(AttachmentPolicyException.class)
                .satisfies(e -> assertThat(((AttachmentPolicyException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── Listing ──────────────────────────────────────────────────────────

    @Test
    void list_returnsAttachmentsWithSignedReadUrls() {
        authenticateAs(admin);
        IncidentEntity incident = incident(1L, IncidentStatus.RESOLVED, sousChef, department);
        when(incidentRepository.findById(1L)).thenReturn(Optional.of(incident));
        when(urlSigner.sign(1L, 7L)).thenReturn("token-7");
        when(attachmentRepository.findByIncidentIdOrderByUploadedAtDesc(1L))
                .thenReturn(List.of(savedEntity(7L, incident)));

        List<IncidentAttachmentResponse> responses = service.listAttachments(1L);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).id()).isEqualTo(7L);
        assertThat(responses.get(0).fileUrl()).isEqualTo("/api/incidents/1/attachments/7?token=token-7");
        assertThat(responses.get(0).uploadedBy().id()).isEqualTo(1L);
    }

    // ── Retention + metrics ─────────────────────────────────────────────

    @Test
    void cleanupExpiredTerminalMedia_purgesFilesAndRows() {
        when(attachmentRepository.findExpiredTerminal(
                eq(List.of(IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED)), any(LocalDateTime.class)))
                .thenReturn(List.of(savedEntity(7L, incident(1L, IncidentStatus.RESOLVED, sousChef, department))));
        when(fileStorage.resolve("1/uuid-1.jpg")).thenReturn(Path.of("/data/incident-media/1/uuid-1.jpg"));

        int purged = service.cleanupExpiredTerminalMedia();

        assertThat(purged).isEqualTo(1);
        verify(fileStorage).deleteIfExists(Path.of("/data/incident-media/1/uuid-1.jpg"));
        verify(attachmentRepository).delete(any(IncidentAttachmentEntity.class));
    }

    @Test
    void storageStatus_reportsConfiguredMetrics() {
        when(fileStorage.isConfigured()).thenReturn(true);
        when(fileStorage.diskUsage())
                .thenReturn(new LocalFileStorageService.DiskUsage(900_000_000L, 1_000_000_000L));
        when(attachmentRepository.sumFileSizeBytes()).thenReturn(123_456L);

        IncidentAttachmentService.MediaStorageStatus status = service.storageStatus();

        assertThat(status.configured()).isTrue();
        assertThat(status.storedBytes()).isEqualTo(123_456L);
        assertThat(status.usableBytes()).isEqualTo(900_000_000L);
        assertThat(status.totalBytes()).isEqualTo(1_000_000_000L);
        assertThat(status.storagePath()).isEqualTo("/data/incident-media");
    }
}
