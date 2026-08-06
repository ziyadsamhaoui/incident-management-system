package incident.management.system.dto;

/**
 * Storage summary for the admin media banner ({@code GET /api/admin/media/stats}).
 * <p>
 * {@code storedBytes / photoBytes / videoBytes} come from the DB
 * ({@code SELECT SUM(file_size_bytes)} over non-deleted rows); the disk
 * headroom comes from {@code Files.getFileStore().getUsableSpace()} on the host
 * that backs {@code app.media.storage-path}.
 */
public record AdminMediaStatsResponse(
        boolean configured,
        String storagePath,
        long storedBytes,
        long photoBytes,
        long videoBytes,
        long photoCount,
        long videoCount,
        long totalCount,
        long usableBytes,
        long totalBytes
) {
    /** Fraction of the hosting disk already consumed by media (0..1). */
    public double usedRatio() {
        return totalBytes > 0 ? (double) storedBytes / totalBytes : 0d;
    }
}
