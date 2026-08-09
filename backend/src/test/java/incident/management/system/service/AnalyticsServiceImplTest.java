package incident.management.system.service;

import incident.management.system.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AnalyticsServiceImpl} (no Spring context, no database).
 *
 * <p>Focuses on the empty-window regression: PostgreSQL aggregates like
 * {@code SELECT AVG(...)} over an empty set return ONE row whose value is
 * NULL, and Hibernate maps such an all-NULL row to a {@code null} element
 * inside the returned list — the service must not NPE on it.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AnalyticsServiceImpl: empty-window & bucket handling")
class AnalyticsServiceImplTest {

    @Mock
    private IncidentRepository incidentRepository;

    private AnalyticsServiceImpl analyticsService;

    private final LocalDate start = LocalDate.of(2026, 7, 10);
    private final LocalDate end = LocalDate.of(2026, 8, 8);

    @BeforeEach
    void setUp() {
        analyticsService = new AnalyticsServiceImpl(incidentRepository);
    }

    /** Shared stubs for a window with zero incidents (all trend queries empty). */
    private void stubEmptyWindow() {
        when(incidentRepository.analyticsVolumeBuckets(any(), any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsMttrBuckets(any(), any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsTimeToClaimBuckets(any(), any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsTotals(any(), any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{0L, 0L, 0L}));
        when(incidentRepository.analyticsDepartmentVolumes(any(), any(), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("empty window: all-NULL aggregate rows (Hibernate null-element mapping) must not NPE")
    void emptyWindow_nullAggregateRow_doesNotThrow() {
        // SELECT AVG(...) over zero rows → Hibernate returns [null] (a list with one null row).
        when(incidentRepository.analyticsAvgMttrHours(any(), any(), any()))
                .thenReturn(Collections.singletonList(null));
        when(incidentRepository.analyticsAvgTimeToClaimHours(any(), any(), any()))
                .thenReturn(Collections.singletonList(null));
        stubEmptyWindow();

        var response = analyticsService.getVolumeSpeed(start, end, null, false);

        assertThat(response.totals().reported()).isZero();
        assertThat(response.totals().mttrHours()).isNull();
        assertThat(response.totals().timeToClaimHours()).isNull();
        // The series stays dense (one zero-filled bucket per day) even when empty.
        assertThat(response.buckets()).hasSize(30);
        assertThat(response.buckets()).allSatisfy(b -> {
            assertThat(b.reported()).isZero();
            assertThat(b.mttrHours()).isNull();
            assertThat(b.timeToClaimHours()).isNull();
        });
        assertThat(response.deltas().reported()).isNull();
    }

    @Test
    @DisplayName("empty window: empty aggregate lists are equally tolerated")
    void emptyWindow_emptyAggregateLists_doesNotThrow() {
        when(incidentRepository.analyticsAvgMttrHours(any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsAvgTimeToClaimHours(any(), any(), any())).thenReturn(List.of());
        stubEmptyWindow();

        var response = analyticsService.getVolumeSpeed(start, end, null, true);

        assertThat(response.totals().reported()).isZero();
        assertThat(response.totals().mttrHours()).isNull();
        assertThat(response.totals().timeToClaimHours()).isNull();
    }

    @Test
    @DisplayName("avg aggregate rows are parsed into hours (BigDecimal → Double)")
    void avgAggregateRows_areParsed() {
        when(incidentRepository.analyticsVolumeBuckets(any(), any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsMttrBuckets(any(), any(), any(), any())).thenReturn(List.of());
        when(incidentRepository.analyticsTimeToClaimBuckets(any(), any(), any(), any())).thenReturn(List.of());
        // Current window has incidents; the identical-length previous window is empty.
        when(incidentRepository.analyticsTotals(any(), any(), any()))
                .thenAnswer(inv -> {
                    LocalDateTime s = inv.getArgument(0);
                    return s.equals(start.atStartOfDay())
                            ? List.<Object[]>of(new Object[]{10L, 4L, 2L})
                            : List.<Object[]>of(new Object[]{0L, 0L, 0L});
                });
        when(incidentRepository.analyticsAvgMttrHours(any(), any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{BigDecimal.valueOf(3.5)}));
        when(incidentRepository.analyticsAvgTimeToClaimHours(any(), any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{BigDecimal.valueOf(1.25)}));
        when(incidentRepository.analyticsDepartmentVolumes(any(), any(), any())).thenReturn(List.of());

        var response = analyticsService.getVolumeSpeed(start, end, null, true);

        assertThat(response.totals().reported()).isEqualTo(10L);
        assertThat(response.totals().resolved()).isEqualTo(4L);
        assertThat(response.totals().nonResolved()).isEqualTo(2L);
        assertThat(response.totals().resolutionRatePct()).isEqualTo(66.67);
        assertThat(response.totals().mttrHours()).isEqualTo(3.5);
        assertThat(response.totals().timeToClaimHours()).isEqualTo(1.25);
        // Previous window is empty → reported delta is null (no division by zero).
        assertThat(response.deltas().reported().pct()).isNull();
    }

    @Test
    @DisplayName("empty pareto window returns an empty category list with no insight")
    void emptyPareto_returnsEmptyList() {
        when(incidentRepository.analyticsCategoryCounts(any(), any(), any())).thenReturn(List.of());

        var response = analyticsService.getPareto(start, end, null);

        assertThat(response.categories()).isEmpty();
        assertThat(response.totalCount()).isZero();
        assertThat(response.insight()).isNull();
    }

    @Test
    @DisplayName("pareto insight flags the 80% threshold across categories")
    void pareto_insightDetects80Percent() {
        when(incidentRepository.analyticsCategoryCounts(any(), any(), any()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{"Panne électrique", 8L},
                        new Object[]{"Désalignement", 5L},
                        new Object[]{"Fuite hydraulique", 2L},
                        new Object[]{"Autre", 1L}));

        var response = analyticsService.getPareto(start, end, null);

        assertThat(response.totalCount()).isEqualTo(16L);
        assertThat(response.insight().categoriesTo80()).isEqualTo(2);
        assertThat(response.insight().totalCategories()).isEqualTo(4);
        // 13 / 16 = 81.25% reached within the first 2 categories.
        assertThat(response.insight().pctCovered()).isEqualTo(81.25);
    }
}
