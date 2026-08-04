package incident.management.system.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Self-hosted local media storage configuration.
 * <p>
 * Media bytes live on the application host's disk (NOT object storage / cloud).
 * {@code app.media.storage-path} must point outside the deployment directory so
 * redeploys never wipe media. On Docker, bind-mount or named-volume a host
 * directory (e.g. {@code /data/incident-media}) to the same container path; on
 * systemd, ensure the app process user can write the directory.
 */
@Data
@ConfigurationProperties(prefix = "app.media")
public class MediaStorageProperties {

    /** Root directory where media files are stored (must be outside the deploy dir). */
    private String storagePath = "/data/incident-media";

    /** Files of terminal incidents older than this are deleted by the retention job. */
    private int retentionDays = 90;

    /** HMAC secret used to sign short-lived media read URLs (defaults to the JWT secret). */
    private String signingSecret = "";

    /** Validity of signed media read URLs (minutes). */
    private long readTokenTtlMinutes = 15;

    public boolean isConfigured() {
        return storagePath != null && !storagePath.isBlank();
    }
}
