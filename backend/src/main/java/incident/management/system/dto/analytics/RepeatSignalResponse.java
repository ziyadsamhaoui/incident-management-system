package incident.management.system.dto.analytics;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response of {@code GET /api/analytics/repeat-signals} — rule-based
 * recurrence detection (SQL windowing): a station reports the same category of
 * incident ≥ 3 times within any 14-day window.
 */
public record RepeatSignalResponse(
        /** Signals, most recently active first. */
        List<Signal> signals
) {

    /**
     * @param stationId        station primary key (deep-link target key)
     * @param stationCode      station code, e.g. {@code STN_12}
     * @param categoryId       recurring category primary key
     * @param categoryName     recurring category label, e.g. "Désalignement courroie"
     * @param departmentName   department owning the station (nullable)
     * @param incidentCount    total incidents of this station+category in the window
     * @param firstOccurrence  oldest qualifying declaration
     * @param lastOccurrence   most recent qualifying declaration
     * @param latestReference  reference of the most recent incident in the group
     * @param latestIncidentId id of that incident — used as the deep link into the
     *                         incident detail view (works for terminal states too)
     */
    public record Signal(
            Long stationId,
            String stationCode,
            Long categoryId,
            String categoryName,
            String departmentName,
            long incidentCount,
            LocalDateTime firstOccurrence,
            LocalDateTime lastOccurrence,
            String latestReference,
            Long latestIncidentId
    ) {}
}
