package incident.management.system.web;

import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.IncidentAttachmentController;
import incident.management.system.dto.IncidentAttachmentResponse;
import incident.management.system.dto.UserSummaryResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.service.IncidentAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web-slice tests for the self-hosted media endpoints:
 * multipart upload (streamed, never buffered), listing and storage metrics.
 */
class IncidentAttachmentControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private IncidentAttachmentService attachmentService;

    private IncidentAttachmentController controller;

    @BeforeEach
    void setUp() {
        controller = new IncidentAttachmentController(attachmentService);
        buildMockMvc(controller);
    }

    private IncidentAttachmentResponse response(Long id) {
        return new IncidentAttachmentResponse(
                id, 1L, AttachmentType.IMAGE, "image/jpeg", 2048L,
                "photo.jpg", "/api/incidents/1/attachments/" + id + "?token=t",
                new UserSummaryResponse(1L, "First", "Last", 1),
                LocalDateTime.now());
    }

    @Nested
    @DisplayName("POST /api/incidents/{id}/attachments (multipart)")
    class Upload {

        @Test
        @DisplayName("valid multipart → 201 Created with the persisted attachment")
        void upload_validMultipart_returnsCreated() throws Exception {
            when(attachmentService.uploadAttachment(
                    eq(1L), any(org.springframework.web.multipart.MultipartFile.class),
                    eq(AttachmentType.IMAGE)))
                    .thenReturn(response(99L));

            mockMvc.perform(multipart("/api/incidents/1/attachments")
                            .file(new MockMultipartFile(
                                    "file", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3}))
                            .param("fileType", "IMAGE"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(99))
                    .andExpect(jsonPath("$.fileType").value("IMAGE"))
                    .andExpect(jsonPath("$.fileUrl").value("/api/incidents/1/attachments/99?token=t"));
        }

        @Test
        @DisplayName("fileType omitted → inferred by the controller")
        void upload_withoutFileTypeParam_infersType() throws Exception {
            when(attachmentService.uploadAttachment(
                    eq(1L), any(org.springframework.web.multipart.MultipartFile.class),
                    eq(AttachmentType.IMAGE)))
                    .thenReturn(response(1L));

            mockMvc.perform(multipart("/api/incidents/1/attachments")
                            .file(new MockMultipartFile(
                                    "file", "photo.png", "image/png", new byte[]{1})))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("terminal incident → 409 Conflict via GlobalExceptionHandler")
        void upload_terminalIncident_returnsConflict() throws Exception {
            when(attachmentService.uploadAttachment(
                    eq(1L), any(org.springframework.web.multipart.MultipartFile.class),
                    eq(AttachmentType.IMAGE)))
                    .thenThrow(new AttachmentPolicyException(
                            HttpStatus.CONFLICT,
                            "Cet incident est clôturé (résolu / non résolu) — les pièces jointes ne peuvent plus être modifiées."));

            mockMvc.perform(multipart("/api/incidents/1/attachments")
                            .file(new MockMultipartFile(
                                    "file", "photo.jpg", "image/jpeg", new byte[]{1}))
                            .param("fileType", "IMAGE"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409));
        }
    }

    @Nested
    @DisplayName("GET /api/incidents/{id}/attachments")
    class Listing {

        @Test
        @DisplayName("lists attachments with signed read URLs")
        void list_returnsAttachments() throws Exception {
            when(attachmentService.listAttachments(1L)).thenReturn(List.of(response(7L)));

            mockMvc.perform(get("/api/incidents/1/attachments"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(7))
                    .andExpect(jsonPath("$[0].mimeType").value("image/jpeg"));
        }
    }

    @Nested
    @DisplayName("GET /api/incidents/attachments/storage-status")
    class StorageStatus {

        @Test
        @DisplayName("returns DB-tracked bytes + host disk headroom")
        void storageStatus_returnsMetrics() throws Exception {
            when(attachmentService.storageStatus()).thenReturn(
                    new IncidentAttachmentService.MediaStorageStatus(
                            true, 123_456L, 900_000_000L, 1_000_000_000L, "/data/incident-media"));

            mockMvc.perform(get("/api/incidents/attachments/storage-status")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.configured").value(true))
                    .andExpect(jsonPath("$.storedBytes").value(123456))
                    .andExpect(jsonPath("$.storagePath").value("/data/incident-media"));
        }
    }
}
