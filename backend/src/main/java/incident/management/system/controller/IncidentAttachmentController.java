package incident.management.system.controller;

import incident.management.system.dto.IncidentAttachmentResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.service.IncidentAttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Media-attachment endpoints (self-hosted local storage).
 * <p>
 * {@code POST /api/incidents/{id}/attachments} streams the multipart payload to
 * local disk (never into JVM heap). File bytes are served by
 * {@code GET /api/incidents/{id}/attachments/{attId}} — implemented by
 * {@link org.springframework.web.servlet.resource.ResourceHttpRequestHandler}
 * (see {@code MediaServingConfig}) with HTTP Range support for video seeking.
 */
@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentAttachmentController {

    private final IncidentAttachmentService attachmentService;

    /** Multipart upload — streamed to disk via {@code MultipartFile.transferTo(Path)}. */
    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<IncidentAttachmentResponse> uploadAttachment(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "fileType", required = false) AttachmentType fileType) {
        AttachmentType type = fileType != null ? fileType : inferType(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attachmentService.uploadAttachment(id, file, type));
    }

    /** Read-only gallery (signed read URLs). */
    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<IncidentAttachmentResponse>> listAttachments(@PathVariable Long id) {
        return ResponseEntity.ok(attachmentService.listAttachments(id));
    }

    /** Storage metrics (used bytes from DB + host disk headroom). */
    @GetMapping("/attachments/storage-status")
    public ResponseEntity<IncidentAttachmentService.MediaStorageStatus> storageStatus() {
        return ResponseEntity.ok(attachmentService.storageStatus());
    }

    /** Last-resort type inference when the multipart field is absent. */
    private AttachmentType inferType(MultipartFile file) {
        String contentType = file != null && file.getContentType() != null
                ? file.getContentType().toLowerCase()
                : "";
        if (contentType.startsWith("image/")) return AttachmentType.IMAGE;
        if (contentType.startsWith("video/")) return AttachmentType.VIDEO;
        if (contentType.startsWith("audio/")) return AttachmentType.AUDIO;
        return AttachmentType.IMAGE;
    }
}
