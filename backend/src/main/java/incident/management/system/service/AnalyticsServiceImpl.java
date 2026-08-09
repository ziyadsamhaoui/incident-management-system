package incident.management.system.service;

import incident.management.system.config.CacheNames;
import incident.management.system.dto.analytics.HeatmapResponse;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.dto.analytics.RepeatSignalResponse;
import incident.management.system.dto.analytics.VolumeSpeedResponse;
import incident.management.system.dto.analytics.WorkloadEntry;
import incident.management.system.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Default implementation of {@link AnalyticsService}.
 *
 * <p>Granularity is derived from the window length — daily under ~1 month,
 * weekly under ~4 months, monthly beyond — so chart series stay readable
 * (≈8–31 points) without ever hardcoding a fixed year/month boundary.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {

    private static final int DAILY_MAX_DAYS = 32;
    private static final int WEEKLY_MAX_DAYS = 120;

    private final IncidentRepository incidentRepository;

    // ──────────────────────────────────────────────────────────────────────
    //  Public API
    // ──────────────────────────────────────────────────────────────────────

    // Keys carry a v2 namespace: entries written before the typed JSON cache
    // serializer (see RedisConfig#cacheValueSerializer) deserialised back as
    // LinkedHashMap instead of the record DTOs — bumping the namespace makes
    // every stale entry miss automatically without a manual Redis flush.
    @Override
    @Cacheable(value = CacheNames.ANALYTICS_METRICS,
            key = "'v2:volumeSpeed:' + #start + ':' + #end + ':' + #departmentId + ':' + #compare")
    public VolumeSpeedResponse getVolumeSpeed(LocalDate start, LocalDate end,
                                              Long departmentId, boolean compare) {
        validateRange(start, end);
        String granularity = granularityFor(start, end);
        LocalDate effectiveStart = truncate(start, granularity);
        LocalDateTime queryStart = effectiveStart.atStartOfDay();
        LocalDateTime queryEnd = end.plusDays(1).atStartOfDay();

        Map<String, long[]> volumeByLabel = indexVolumeBuckets(
                incidentRepository.analyticsVolumeBuckets(granularity, queryStart, queryEnd, departmentId));
        Map<String, Double> mttrByLabel = indexAvgBuckets(
                incidentRepository.analyticsMttrBuckets(granularity, queryStart, queryEnd, departmentId));
        Map<String, Double> ttcByLabel = indexAvgBuckets(
                incidentRepository.analyticsTimeToClaimBuckets(granularity, queryStart, queryEnd, departmentId));

        List<VolumeSpeedResponse.Bucket> buckets = new ArrayList<>();
        for (String label : bucketLabels(effectiveStart, end, granularity)) {
            long[] v = volumeByLabel.getOrDefault(label, new long[3]);
            buckets.add(new VolumeSpeedResponse.Bucket(
                    label,
                    v[0],
                    v[1],
                    v[2],
                    mttrByLabel.get(label),
                    ttcByLabel.get(label)));
        }

        VolumeSpeedResponse.Totals totals = buildTotals(queryStart, queryEnd, departmentId);
        VolumeSpeedResponse.Deltas deltas = compare
                ? buildDeltas(effectiveStart, end, departmentId)
                : new VolumeSpeedResponse.Deltas(null, null, null, null);

        List<VolumeSpeedResponse.DepartmentVolume> departments =
                departmentId == null ? departmentVolumes(queryStart, queryEnd) : List.of();

        return new VolumeSpeedResponse(buckets, totals, deltas, departments);
    }

    @Override
    @Cacheable(value = CacheNames.ANALYTICS_METRICS,
            key = "'v2:pareto:' + #start + ':' + #end + ':' + #departmentId")
    public ParetoResponse getPareto(LocalDate start, LocalDate end, Long departmentId) {
        validateRange(start, end);
        LocalDateTime queryStart = start.atStartOfDay();
        LocalDateTime queryEnd = end.plusDays(1).atStartOfDay();

        List<Object[]> rows = incidentRepository.analyticsCategoryCounts(queryStart, queryEnd, departmentId);
        long total = rows.stream().mapToLong(r -> toLong(r[1])).sum();

        List<ParetoResponse.Category> categories = new ArrayList<>(rows.size());
        long running = 0;
        for (Object[] row : rows) {
            running += toLong(row[1]);
            double cumulativePct = total > 0 ? running * 100.0 / total : 0.0;
            categories.add(new ParetoResponse.Category(
                    (String) row[0], toLong(row[1]), round2(cumulativePct)));
        }

        return new ParetoResponse(categories, total, insight(categories, total));
    }

    @Override
    @Cacheable(value = CacheNames.ANALYTICS_METRICS,
            key = "'v2:heatmap:' + #start + ':' + #end + ':' + #departmentId")
    public HeatmapResponse getHeatmap(LocalDate start, LocalDate end, Long departmentId) {
        validateRange(start, end);
        LocalDateTime queryStart = start.atStartOfDay();
        LocalDateTime queryEnd = end.plusDays(1).atStartOfDay();

        List<Object[]> rows = incidentRepository.analyticsHeatmapCells(queryStart, queryEnd, departmentId);
        List<HeatmapResponse.Cell> cells = new ArrayList<>(rows.size());
        long total = 0;
        for (Object[] row : rows) {
            // PostgreSQL DOW: 0=Sunday … 6=Saturday → ISO Monday-first index.
            int dow = (toInt(row[0]) + 6) % 7;
            int hour = toInt(row[1]);
            long count = toLong(row[2]);
            total += count;
            cells.add(new HeatmapResponse.Cell(dow, hour, count));
        }
        return new HeatmapResponse(cells, total);
    }

    @Override
    @Cacheable(value = CacheNames.ANALYTICS_METRICS,
            key = "'v2:repeatSignals:' + #start + ':' + #end + ':' + #departmentId")
    public RepeatSignalResponse getRepeatSignals(LocalDate start, LocalDate end, Long departmentId) {
        validateRange(start, end);
        LocalDateTime queryStart = start.atStartOfDay();
        LocalDateTime queryEnd = end.plusDays(1).atStartOfDay();

        List<Object[]> rows = incidentRepository.analyticsRepeatSignals(queryStart, queryEnd, departmentId);
        List<RepeatSignalResponse.Signal> signals = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            signals.add(new RepeatSignalResponse.Signal(
                    toLong(row[0]),
                    (String) row[1],
                    toLong(row[2]),
                    (String) row[3],
                    (String) row[4],
                    toLong(row[5]),
                    toLocalDateTime(row[6]),
                    toLocalDateTime(row[7]),
                    (String) row[8],
                    toLong(row[9])));
        }
        return new RepeatSignalResponse(signals);
    }

    @Override
    @Cacheable(value = CacheNames.ANALYTICS_METRICS,
            key = "'v2:workload:' + #start + ':' + #end + ':' + #departmentId")
    public List<WorkloadEntry> getWorkload(LocalDate start, LocalDate end, Long departmentId) {
        validateRange(start, end);
        LocalDateTime queryStart = start.atStartOfDay();
        LocalDateTime queryEnd = end.plusDays(1).atStartOfDay();

        List<Object[]> rows = incidentRepository.analyticsWorkload(queryStart, queryEnd, departmentId);
        List<WorkloadEntry> entries = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            long resolved = toLong(row[4]);
            long nonResolved = toLong(row[5]);
            entries.add(new WorkloadEntry(
                    toLong(row[0]),
                    (String) row[1],
                    (String) row[2],
                    toLong(row[3]),
                    resolved,
                    nonResolved,
                    resolved + nonResolved,
                    toNullableDouble(row[6])));
        }
        return entries;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Volume / speed helpers
    // ──────────────────────────────────────────────────────────────────────

    private VolumeSpeedResponse.Totals buildTotals(LocalDateTime start, LocalDateTime end, Long departmentId) {
        List<Object[]> totalsRow = incidentRepository.analyticsTotals(start, end, departmentId);
        long reported = 0, resolved = 0, nonResolved = 0;
        if (!totalsRow.isEmpty() && totalsRow.get(0) != null) {
            reported = toLong(totalsRow.get(0)[0]);
            resolved = toLong(totalsRow.get(0)[1]);
            nonResolved = toLong(totalsRow.get(0)[2]);
        }
        double resolutionRatePct = (resolved + nonResolved) > 0
                ? round2(resolved * 100.0 / (resolved + nonResolved))
                : 0.0;
        Double mttr = avgHours(incidentRepository.analyticsAvgMttrHours(start, end, departmentId));
        Double ttc = avgHours(incidentRepository.analyticsAvgTimeToClaimHours(start, end, departmentId));
        return new VolumeSpeedResponse.Totals(reported, resolved, nonResolved,
                resolutionRatePct, mttr, ttc);
    }

    /**
     * Period-over-period deltas: the current window is compared against the
     * window of identical length immediately preceding it.
     */
    private VolumeSpeedResponse.Deltas buildDeltas(LocalDate effectiveStart, LocalDate end, Long departmentId) {
        long spanDays = ChronoUnit.DAYS.between(effectiveStart, end) + 1;
        LocalDateTime prevStart = effectiveStart.minusDays(spanDays).atStartOfDay();
        LocalDateTime prevEnd = effectiveStart.atStartOfDay();

        VolumeSpeedResponse.Totals current = buildTotals(effectiveStart.atStartOfDay(),
                end.plusDays(1).atStartOfDay(), departmentId);
        VolumeSpeedResponse.Totals previous = buildTotals(prevStart, prevEnd, departmentId);

        return new VolumeSpeedResponse.Deltas(
                pctDelta(current.reported(), previous.reported(), false),
                resolutionRateDelta(current, previous),
                pctDelta(current.mttrHours(), previous.mttrHours(), false),
                pctDelta(current.timeToClaimHours(), previous.timeToClaimHours(), false));
    }

    /**
     * Relative change of the resolution rate between two windows. Null when
     * either window has no evaluations, or the previous rate is zero (the
     * relative delta would be infinite — a percentage-point comparison would
     * be misleading).
     */
    private VolumeSpeedResponse.Delta resolutionRateDelta(VolumeSpeedResponse.Totals current,
                                                          VolumeSpeedResponse.Totals previous) {
        boolean prevHasEvals = (previous.resolved() + previous.nonResolved()) > 0;
        boolean curHasEvals = (current.resolved() + current.nonResolved()) > 0;
        if (!prevHasEvals || !curHasEvals || previous.resolutionRatePct() == 0.0) {
            return new VolumeSpeedResponse.Delta(null, true);
        }
        double delta = (current.resolutionRatePct() - previous.resolutionRatePct())
                / previous.resolutionRatePct() * 100.0;
        return new VolumeSpeedResponse.Delta(round2(delta), true);
    }

    private VolumeSpeedResponse.Delta pctDelta(double current, double previous, boolean goodWhenUp) {
        return previous > 0
                ? new VolumeSpeedResponse.Delta(round2((current - previous) / previous * 100.0), goodWhenUp)
                : new VolumeSpeedResponse.Delta(null, goodWhenUp);
    }

    private VolumeSpeedResponse.Delta pctDelta(Double current, Double previous, boolean goodWhenUp) {
        if (current == null || previous == null || previous == 0.0) {
            return new VolumeSpeedResponse.Delta(null, goodWhenUp);
        }
        return new VolumeSpeedResponse.Delta(round2((current - previous) / previous * 100.0), goodWhenUp);
    }

    private List<VolumeSpeedResponse.DepartmentVolume> departmentVolumes(
            LocalDateTime start, LocalDateTime end) {
        List<Object[]> rows = incidentRepository.analyticsDepartmentVolumes(start, end, null);
        return rows.stream()
                .map(r -> new VolumeSpeedResponse.DepartmentVolume((String) r[0], toLong(r[1])))
                .toList();
    }

    private Map<String, long[]> indexVolumeBuckets(List<Object[]> rows) {
        Map<String, long[]> byLabel = new HashMap<>();
        for (Object[] row : rows) {
            byLabel.put((String) row[0], new long[]{
                    toLong(row[1]), toLong(row[2]), toLong(row[3])});
        }
        return byLabel;
    }

    private Map<String, Double> indexAvgBuckets(List<Object[]> rows) {
        Map<String, Double> byLabel = new HashMap<>();
        // NB: source queries GROUP BY their label, so rows are never all-NULL
        // (unlike the standalone AVG() aggregates consumed by avgHours).
        for (Object[] row : rows) {
            byLabel.put((String) row[0], toNullableDouble(row[1]));
        }
        return byLabel;
    }

    /**
     * First column of the single aggregate row, or {@code null} when the query
     * returned nothing. NB: an aggregate over an empty set yields one row whose
     * value is NULL — Hibernate maps such an all-NULL row to a {@code null}
     * array — so both the empty list AND the null row must be guarded.
     */
    private Double avgHours(List<Object[]> rows) {
        if (rows.isEmpty() || rows.get(0) == null) {
            return null;
        }
        return toNullableDouble(rows.get(0)[0]);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Pareto helpers
    // ──────────────────────────────────────────────────────────────────────

    private ParetoResponse.Insight insight(List<ParetoResponse.Category> categories, long total) {
        if (total <= 0 || categories.isEmpty()) {
            return null;
        }
        double cumulative = 0.0;
        for (int i = 0; i < categories.size(); i++) {
            cumulative += categories.get(i).count() * 100.0 / total;
            if (cumulative >= 80.0) {
                return new ParetoResponse.Insight(
                        i + 1, categories.size(), round2(Math.min(cumulative, 100.0)));
            }
        }
        // 80% never reached (heavily fragmented categories) — report the full set.
        return new ParetoResponse.Insight(categories.size(), categories.size(),
                round2(cumulative));
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Shared helpers
    // ──────────────────────────────────────────────────────────────────────

    private void validateRange(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            throw new IllegalArgumentException("Les dates de début et de fin sont obligatoires.");
        }
        if (end.isBefore(start)) {
            throw new IllegalArgumentException(
                    "La date de fin doit être postérieure ou égale à la date de début.");
        }
    }

    /** Window length → aggregation granularity for {@code DATE_TRUNC}. */
    private String granularityFor(LocalDate start, LocalDate end) {
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days <= DAILY_MAX_DAYS) {
            return "day";
        }
        if (days <= WEEKLY_MAX_DAYS) {
            return "week";
        }
        return "month";
    }

    private LocalDate truncate(LocalDate date, String granularity) {
        return switch (granularity) {
            case "day" -> date;
            case "week" -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            default -> date.withDayOfMonth(1);
        };
    }

    private LocalDate nextBucket(LocalDate date, String granularity) {
        return switch (granularity) {
            case "day" -> date.plusDays(1);
            case "week" -> date.plusWeeks(1);
            default -> date.plusMonths(1);
        };
    }

    /**
     * Dense, gap-free series of bucket labels from {@code from} (inclusive) to
     * {@code to} (inclusive), aligned with the {@code DATE_TRUNC} boundaries
     * used by the SQL queries.
     */
    private List<String> bucketLabels(LocalDate from, LocalDate to, String granularity) {
        List<String> labels = new ArrayList<>();
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) {
            labels.add(cursor.toString());
            cursor = nextBucket(cursor, granularity);
        }
        return labels;
    }

    private static long toLong(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(value.toString());
    }

    private static int toInt(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(value.toString());
    }

    private static Double toNullableDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Double d) {
            return d;
        }
        if (value instanceof BigDecimal bd) {
            return bd.doubleValue();
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return Double.parseDouble(value.toString());
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt;
        }
        return LocalDateTime.parse(value.toString());
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
