package incident.management.system.dto.analytics;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response of {@code GET /api/analytics/repeat-signals} — rule-based
 * recurrence detection (SQL windowing): a station reports the same category of
 * incident ≥ 3 times within any 14-day window.
 */
@Schema(description = "Rule-based repeat-incident signals (≥ 3 same station+category within any 14-day window).")
public record RepeatSignalResponse(
        @Schema(description = "Signals, most recently active first")
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
    @Schema(description = "One repeat signal for a station+category cluster.")
    public record Signal(
            @Schema(description = "Station primary key", example = "17")
            Long stationId,
            @Schema(description = "Station code", example = "STN_12")
            String stationCode,
            @Schema(description = "Recurring category primary key", example = "5")
            Long categoryId,
            @Schema(description = "Recurring category label", example = "Désalignement courroie")
            String categoryName,
            @Schema(description = "Owning department name (nullable)", example = "Montage")
            String departmentName,
            @Schema(description = "Total incidents of this station+category in the window", example = "5")
            long incidentCount,
            @Schema(description = "Oldest qualifying declaration", example = "2026-07-26T08:10:00")
            LocalDateTime firstOccurrence,
            @Schema(description = "Most recent qualifying declaration", example = "2026-08-09T11:45:00")
            LocalDateTime lastOccurrence,
            @Schema(description = "Reference of the most recent incident in the group", example = "INC-2026-0042")
            String latestReference,
            @Schema(description = "Id of the latest incident — deep link into the detail view", example = "1042")
            Long latestIncidentId
    ) {}
}
