package incident.management.system.dto;

import java.util.List;

/**
 * Result of an admin bulk media deletion — used to drive the UI's
 * "espace libéré" confirmation summary.
 */
public record MediaBulkDeleteResult(
        int deletedCount,
        long freedBytes,
        List<Long> skippedIds
) {
}
