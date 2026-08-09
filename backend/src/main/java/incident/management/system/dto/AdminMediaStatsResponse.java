package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Storage summary for the admin media banner ({@code GET /api/admin/media/stats}).
 * <p>
 * {@code storedBytes / photoBytes / videoBytes} come from the DB
 * ({@code SELECT SUM(file_size_bytes)} over non-deleted rows); the disk
 * headroom comes from {@code Files.getFileStore().getUsableSpace()} on the host
 * that backs {@code app.media.storage-path}.
 */
@Schema(description = "Storage summary strip payload: DB-tracked bytes by type + real host disk headroom.")
public record AdminMediaStatsResponse(
        @Schema(description = "Whether local storage is configured and reachable", example = "true")
        boolean configured,
        @Schema(description = "Configured storage root", example = "D:/icglma/incident-media")
        String storagePath,
        @Schema(description = "Total stored bytes (non-deleted rows)", example = "53687091200")
        long storedBytes,
        @Schema(description = "Photo bytes", example = "8589934592")
        long photoBytes,
        @Schema(description = "Video bytes", example = "45097156608")
        long videoBytes,
        @Schema(description = "Photo count", example = "1240")
        long photoCount,
        @Schema(description = "Video count", example = "312")
        long videoCount,
        @Schema(description = "Total media count", example = "1552")
        long totalCount,
        @Schema(description = "Usable disk bytes on the storage volume", example = "107374182400")
        long usableBytes,
        @Schema(description = "Total disk bytes on the storage volume", example = "214748364800")
        long totalBytes
) {
    /** Fraction of the hosting disk already consumed by media (0..1). */
    public double usedRatio() {
        return totalBytes > 0 ? (double) storedBytes / totalBytes : 0d;
    }
}
