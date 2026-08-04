package incident.management.system.job;

import incident.management.system.service.IncidentAttachmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Automated media retention: purges local files (via {@code Files.deleteIfExists})
 * and their {@code incident_attachments} rows for terminal incidents
 * ({@code RESOLVED} / {@code NON_RESOLVED}) older than the configured window
 * ({@code app.media.retention-days}, default 90).
 * <p>
 * Runs daily at 03:15. Safe to overlap with active uploads — rows are only
 * selected once their parent incident is terminal and older than the window.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MediaRetentionJob {

    private final IncidentAttachmentService attachmentService;

    @Scheduled(cron = "0 15 3 * * *")
    public void purgeExpiredMedia() {
        try {
            int purged = attachmentService.cleanupExpiredTerminalMedia();
            if (purged > 0) {
                log.info("Media retention: purged {} expired attachment(s)", purged);
            }
        } catch (Exception e) {
            log.error("Media retention job failed", e);
        }
    }
}
