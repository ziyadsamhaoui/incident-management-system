package incident.management.system.dto;

import incident.management.system.enums.AttachmentType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Read model of a media item on the admin surface ({@code GET /api/admin/media}).
 * <p>
 * Strictly IMAGE / VIDEO — audio voice clips are excluded from this
 * administrative view. {@code retentionDaysRemaining} is {@code null} when the
 * parent incident is not terminal (no scheduled retention deletion applies).
 */
@Schema(description = "Media inventory item on the admin surface — strictly IMAGE/VIDEO (AUDIO excluded).")
public record AdminMediaResponse(
        @Schema(description = "Attachment primary key (BIGSERIAL)", example = "812")
        Long id,
        @Schema(description = "Parent incident id", example = "1042")
        Long incidentId,
        @Schema(description = "Parent incident reference", example = "INC-2026-0042")
        String incidentReference,
        @Schema(description = "Owning department name", example = "Montage")
        String departmentName,
        @Schema(description = "Incident category name", example = "Mécanique")
        String categoryName,
        @Schema(description = "Media type — IMAGE or VIDEO on this surface", example = "VIDEO")
        AttachmentType fileType,
        @Schema(description = "MIME type", example = "video/mp4")
        String mimeType,
        @Schema(description = "File size in bytes", example = "18432000")
        Long fileSizeBytes,
        @Schema(description = "Original client filename (display only)", example = "panne-moteur.mp4")
        String fileName,
        @Schema(description = "Signed read URL (15-minute TTL)", example = "/api/incidents/1042/attachments/812?token=...")
        String fileUrl,
        @Schema(description = "Uploading user")
        UserSummaryResponse uploadedBy,
        @Schema(description = "Upload timestamp", example = "2026-08-09T09:35:00")
        LocalDateTime uploadedAt,
        @Schema(description = "Days until the retention job purges this file (null for non-terminal incidents)",
                example = "87")
        Integer retentionDaysRemaining
) {
}
