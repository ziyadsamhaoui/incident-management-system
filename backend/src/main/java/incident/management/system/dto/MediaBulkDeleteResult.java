package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Result of an admin bulk media deletion — used to drive the UI's
 * "espace libéré" confirmation summary.
 */
@Schema(description = "Bulk media deletion result — drives the 'espace libéré' summary in the UI.")
public record MediaBulkDeleteResult(
        @Schema(description = "Number of files actually deleted", example = "3")
        int deletedCount,
        @Schema(description = "Exact disk bytes freed", example = "52428800")
        long freedBytes,
        @Schema(description = "Ids skipped (unknown/already-deleted/AUDIO)", example = "[999]")
        List<Long> skippedIds
) {
}
