package incident.management.system.dto;

import incident.management.system.enums.AttachmentType;

import java.time.LocalDateTime;

/** Read model of a persisted incident attachment (with a fresh read URL). */
public record IncidentAttachmentResponse(
        Long id,
        Long incidentId,
        AttachmentType fileType,
        String mimeType,
        Long fileSizeBytes,
        String fileName,
        String fileUrl,
        UserSummaryResponse uploadedBy,
        LocalDateTime uploadedAt
) {
}
