package incident.management.system.dto;

import incident.management.system.enums.AttachmentType;

import java.time.LocalDateTime;

/**
 * Read model of a media item on the admin surface ({@code GET /api/admin/media}).
 * <p>
 * Strictly IMAGE / VIDEO — audio voice clips are excluded from this
 * administrative view. {@code retentionDaysRemaining} is {@code null} when the
 * parent incident is not terminal (no scheduled retention deletion applies).
 */
public record AdminMediaResponse(
        Long id,
        Long incidentId,
        String incidentReference,
        String departmentName,
        String categoryName,
        AttachmentType fileType,
        String mimeType,
        Long fileSizeBytes,
        String fileName,
        String fileUrl,
        UserSummaryResponse uploadedBy,
        LocalDateTime uploadedAt,
        Integer retentionDaysRemaining
) {
}
