package incident.management.system.controller;

import incident.management.system.dto.IncidentAttachmentResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.service.IncidentAttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Incident Attachments",
        description = "Self-hosted media attachments (photos, videos, voice clips) streamed to local disk. "
                + "Upload is a single multipart POST; byte serving is handled by a resource handler with "
                + "Range support, authorized by a short-lived HMAC signed token or the JWT session.")
public class IncidentAttachmentController {

    private final IncidentAttachmentService attachmentService;

    /** Multipart upload — streamed to disk via {@code MultipartFile.transferTo(Path)}. */
    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload an attachment",
            description = "Streams one multipart file (field `file`) to local disk — never buffered in the "
                    + "JVM heap. Optional `fileType` (IMAGE/VIDEO/AUDIO) is inferred from the content-type "
                    + "when absent. Server-side guardrails: terminal incidents are locked (409), max 5 "
                    + "attachments/incident (409), per-type size caps (image/audio ≤ 5 Mo, video ≤ 25 Mo) "
                    + "and MIME allow-list (400), plus a 16-byte magic-byte sniff (400 on mismatch).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Attachment persisted",
                    content = @Content(schema = @Schema(implementation = IncidentAttachmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Oversized file, disallowed MIME or magic-byte mismatch"),
            @ApiResponse(responseCode = "403", description = "Not authorized for this incident"),
            @ApiResponse(responseCode = "404", description = "Incident not found"),
            @ApiResponse(responseCode = "409", description = "Incident is terminal or the 5-attachment cap is reached")
    })
    public ResponseEntity<IncidentAttachmentResponse> uploadAttachment(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @Parameter(description = "Media type override — IMAGE, VIDEO or AUDIO (inferred when absent)")
            @RequestParam(value = "fileType", required = false) AttachmentType fileType) {
        AttachmentType type = fileType != null ? fileType : inferType(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attachmentService.uploadAttachment(id, file, type));
    }

    /** Read-only gallery (signed read URLs). */
    @GetMapping("/{id}/attachments")
    @Operation(summary = "List attachments of an incident",
            description = "Read-only gallery with fresh signed read URLs (15-minute TTL) suitable for "
                    + "<img>/<video>/<audio> tags. Soft-deleted rows are excluded.")
    @ApiResponses({
            // Array schema is derived from the List<IncidentAttachmentResponse> return type.
            @ApiResponse(responseCode = "200", description = "Attachment list (IncidentAttachmentResponse[])"),
            @ApiResponse(responseCode = "403", description = "Not authorized for this incident"),
            @ApiResponse(responseCode = "404", description = "Incident not found")
    })
    public ResponseEntity<List<IncidentAttachmentResponse>> listAttachments(@PathVariable Long id) {
        return ResponseEntity.ok(attachmentService.listAttachments(id));
    }

    /** Storage metrics (used bytes from DB + host disk headroom). */
    @GetMapping("/attachments/storage-status")
    @Operation(summary = "Get media storage status",
            description = "ADMIN-facing metrics: total DB-tracked bytes (SUM(file_size_bytes) over non-deleted "
                    + "rows) plus real host disk headroom from the filesystem backing app.media.storage-path.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Storage status",
                    content = @Content(schema = @Schema(implementation = IncidentAttachmentService.MediaStorageStatus.class)))
    })
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
