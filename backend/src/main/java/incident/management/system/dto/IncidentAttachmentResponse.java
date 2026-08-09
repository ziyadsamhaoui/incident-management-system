package incident.management.system.dto;

import incident.management.system.enums.AttachmentType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** Read model of a persisted incident attachment (with a fresh read URL). */
@Schema(description = "Read model of a persisted incident attachment, carrying a fresh signed read URL "
        + "(15-minute TTL) for media tags.")
public record IncidentAttachmentResponse(
        @Schema(description = "Attachment primary key", example = "812")
        Long id,
        @Schema(description = "Parent incident id", example = "1042")
        Long incidentId,
        @Schema(description = "Media type — IMAGE, VIDEO or AUDIO", example = "IMAGE")
        AttachmentType fileType,
        @Schema(description = "Detected MIME type", example = "image/jpeg")
        String mimeType,
        @Schema(description = "File size in bytes", example = "482613")
        Long fileSizeBytes,
        @Schema(description = "Original client filename (display only)", example = "courroie-ligne2.jpg")
        String fileName,
        @Schema(description = "Signed read URL (15-minute TTL)", example = "/api/incidents/1042/attachments/812?token=...")
        String fileUrl,
        @Schema(description = "Uploading user")
        UserSummaryResponse uploadedBy,
        @Schema(description = "Upload timestamp", example = "2026-08-09T09:35:00")
        LocalDateTime uploadedAt
) {
}
