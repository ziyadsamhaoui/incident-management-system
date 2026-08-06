package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import incident.management.system.exception.AttachmentPolicyException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * File-system backed media store for the self-hosted pipeline.
 * <p>
 * Raw bytes NEVER buffer into the JVM heap: {@link MultipartFile#transferTo(Path)}
 * streams the multipart input directly to the target path on disk. Physical file
 * names are always server-generated {@code UUID}s — user-supplied original names
 * are stored in the {@code incident_attachments} table for display only.
 * <p>
 * Layout: {@code {storagePath}/{incidentId}/{uuid}.{ext}}. Every resolved path is
 * normalized and verified to stay under the storage root (path-traversal guard).
 */
@Service
@Slf4j
public class LocalFileStorageService {

    private final Path root;

    public LocalFileStorageService(MediaStorageProperties props) {
        this.root = Paths.get(props.getStoragePath()).toAbsolutePath().normalize();
    }

    @PostConstruct
    void ensureRootExists() {
        try {
            Files.createDirectories(root);
            log.info("Local media storage ready at {}", root);
        } catch (IOException e) {
            log.warn("Media storage root {} is not writable: {}. Attachment uploads will answer 503.",
                    root, e.getMessage());
        }
    }

    public boolean isConfigured() {
        return Files.isDirectory(root) && Files.isWritable(root);
    }

    /**
     * Streams the incoming multipart file to {@code {root}/{incidentId}/{uuid}.{ext}}.
     * Never calls {@code getBytes()}. Returns the stored absolute path.
     */
    public Path store(MultipartFile file, Long incidentId, String uuid, String extension) {
        if (!isConfigured()) {
            throw new AttachmentPolicyException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Le stockage média local n'est pas disponible sur ce serveur.");
        }
        Path dir = root.resolve(String.valueOf(incidentId)).normalize();
        if (!dir.startsWith(root)) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST, "Chemin de stockage invalide.");
        }
        try {
            Files.createDirectories(dir);
            Path target = dir.resolve(uuid + "." + extension).normalize();
            if (!target.startsWith(dir)) {
                throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST, "Chemin de stockage invalide.");
            }
            file.transferTo(target);
            log.info("Stored media {} ({} bytes) via transferTo", target, file.getSize());
            return target;
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to persist media file", e);
        }
    }

    /**
     * Resolves a stored relative key (e.g. {@code 12/8f3c-….jpg}) to an absolute
     * path, rejecting any attempt to escape the storage root.
     */
    public Path resolve(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new AttachmentPolicyException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable.");
        }
        Path candidate = root.resolve(objectKey).normalize();
        if (!candidate.startsWith(root)) {
            throw new AttachmentPolicyException(HttpStatus.BAD_REQUEST, "Chemin de stockage invalide.");
        }
        return candidate;
    }

    /** Reads only the first {@code maxLength} bytes (magic-byte sniff) — never the whole file. */
    public byte[] readFirstBytes(Path path, int maxLength) {
        try (InputStream in = Files.newInputStream(path)) {
            return in.readNBytes(maxLength);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read media prefix", e);
        }
    }

    public void deleteIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Failed to delete media file {}: {}", path, e.getMessage());
        }
    }

    /**
     * Deletes the physical file for a stored relative key (path-traversal
     * guarded, like {@link #resolve(String)}).
     *
     * @return {@code true} when a file was actually present on disk and removed
     *         — used by the admin media surface to report exact freed bytes;
     *         {@code false} when the file was already gone or deletion failed
     */
    public boolean deleteIfExistsReported(String objectKey) {
        try {
            return Files.deleteIfExists(resolve(objectKey));
        } catch (IOException e) {
            log.warn("Failed to delete media file {}: {}", objectKey, e.getMessage());
            return false;
        }
    }

    /** Copies bytes between paths using streaming (used only by the retention job tests / fallbacks). */
    public void moveTo(Path source, Path target) {
        try {
            Files.createDirectories(target.getParent());
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to move media file", e);
        }
    }

    /** Free + total bytes on the filesystem hosting the storage root. */
    public DiskUsage diskUsage() {
        try {
            var store = Files.getFileStore(root);
            return new DiskUsage(store.getUsableSpace(), store.getTotalSpace());
        } catch (IOException e) {
            return new DiskUsage(0L, 0L);
        }
    }

    public record DiskUsage(long usableBytes, long totalBytes) {
    }
}
