package incident.management.system.repository;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.CategoryEntity;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.ProductionLineEntity;
import incident.management.system.model.SectionEntity;
import incident.management.system.model.StationEntity;
import incident.management.system.model.UserEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;


// Integration tests for IncidentRepository, focusing on paginated filters and per-user activity analytics.
class IncidentRepositoryTest extends BaseRepositoryIntegrationTest {

    @Autowired
    private IncidentRepository incidentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private StationRepository stationRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private ProductionLineRepository productionLineRepository;

    // shared reference entities for all tests

    private UserEntity userA;
    private UserEntity userB;
    private DepartmentEntity departmentA;
    private DepartmentEntity departmentB;
    private StationEntity station;
    private CategoryEntity category;

    @BeforeEach
    void setUp() {
        // Persist reference entities shared across all tests
        departmentA = departmentRepository.save(TestEntityFactory.createDepartment());
        departmentB = departmentRepository.save(TestEntityFactory.createDepartment());

        SectionEntity section = sectionRepository.save(TestEntityFactory.createSection());
        ProductionLineEntity line = productionLineRepository.save(
                TestEntityFactory.createProductionLine(section));
        station = stationRepository.save(TestEntityFactory.createStation(line));

        category = categoryRepository.save(TestEntityFactory.createCategory());

        userA = TestEntityFactory.createUser();
        userA.setDepartment(departmentA);
        userA = userRepository.save(userA);

        userB = TestEntityFactory.createUser();
        userB.setDepartment(departmentB);
        userB = userRepository.save(userB);
    }

    //  Paginated filter: findByStatus
    @Nested
    @DisplayName("findByStatus")
    class FindByStatusTest {

        @Test
        @DisplayName("should return incidents matching the given status")
        void returnsMatchingStatus() {
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            persistIncident(userA, departmentA, IncidentStatus.CLAIMED);
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            Page<IncidentEntity> page = incidentRepository.findByStatus(
                    IncidentStatus.DECLARED, Pageable.ofSize(10));

            assertThat(page.getContent())
                    .hasSize(2)
                    .allMatch(i -> i.getStatus() == IncidentStatus.DECLARED);
        }

        @Test
        @DisplayName("should return empty page when no incidents match the status")
        void returnsEmptyWhenNoMatch() {
            persistIncident(userA, departmentA, IncidentStatus.RESOLVED);

            Page<IncidentEntity> page = incidentRepository.findByStatus(
                    IncidentStatus.DECLARED, Pageable.ofSize(10));

            assertThat(page).isEmpty();
        }

        @Test
        @DisplayName("should respect pagination parameters")
        void respectsPagination() {
            for (int i = 0; i < 5; i++) {
                persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            }

            Page<IncidentEntity> first = incidentRepository.findByStatus(
                    IncidentStatus.DECLARED, PageRequest.of(0, 2));
            Page<IncidentEntity> second = incidentRepository.findByStatus(
                    IncidentStatus.DECLARED, PageRequest.of(1, 2));

            assertThat(first.getContent()).hasSize(2);
            assertThat(second.getContent()).hasSize(2);
            assertThat(first.getContent())
                    .doesNotContainAnyElementsOf(second.getContent());
        }
    }

    //  Paginated filter: findByUser
    @Nested
    @DisplayName("findByUser")
    class FindByUserTest {

        @Test
        @DisplayName("should return incidents belonging to the specified user")
        void returnsIncidentsForUser() {
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            persistIncident(userB, departmentA, IncidentStatus.DECLARED);
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            Page<IncidentEntity> page = incidentRepository.findByUser(
                    userA, Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent())
                    .extracting(IncidentEntity::getUser)
                    .allMatch(u -> u.getId().equals(userA.getId()));
        }

        @Test
        @DisplayName("should return empty page when user has no incidents")
        void emptyWhenNoIncidents() {
            Page<IncidentEntity> page = incidentRepository.findByUser(
                    userB, Pageable.ofSize(10));
            assertThat(page).isEmpty();
        }
    }

    //  Paginated filter: findByDepartment
    @Nested
    @DisplayName("findByDepartment")
    class FindByDepartmentTest {

        @Test
        @DisplayName("should return incidents belonging to the specified department")
        void returnsIncidentsForDepartment() {
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            persistIncident(userA, departmentB, IncidentStatus.DECLARED);
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            Page<IncidentEntity> page = incidentRepository.findByDepartment(
                    departmentA, Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent())
                    .extracting(IncidentEntity::getDepartment)
                    .allMatch(d -> d.getId().equals(departmentA.getId()));
        }

        @Test
        @DisplayName("should return empty page when department has no incidents")
        void emptyWhenNoIncidents() {
            DepartmentEntity otherDept = departmentRepository.save(
                    TestEntityFactory.createDepartment());
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            Page<IncidentEntity> page = incidentRepository.findByDepartment(
                    otherDept, Pageable.ofSize(10));

            assertThat(page).isEmpty();
        }
    }

    //  Per-user activity analytics (GET /api/users/{id}/activity)
    @Nested
    @DisplayName("Per-user activity analytics")
    class UserActivityAnalyticsTest {

        @Test
        @DisplayName("aggregate counts match declared / claimed / resolved actions")
        void aggregateCountsMatchReportedActions() {
            // userA declares one incident
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            // userB declares two incidents, both claimed by userA
            IncidentEntity claimed1 = persistIncident(userB, departmentA, IncidentStatus.CLAIMED);
            claimed1.setClaimedBy(userA);
            incidentRepository.save(claimed1);

            IncidentEntity claimed2 = persistIncident(userB, departmentA, IncidentStatus.IN_PROGRESS);
            claimed2.setClaimedBy(userA);
            incidentRepository.save(claimed2);

            // userB declares one more, resolved by userA
            IncidentEntity resolved = persistIncident(userB, departmentB, IncidentStatus.RESOLVED);
            resolved.setResolvedBy(userA);
            resolved.setResolvedAt(LocalDateTime.now().minusHours(1));
            incidentRepository.save(resolved);

            assertThat(incidentRepository.countByUser(userA)).isEqualTo(1);
            assertThat(incidentRepository.countByUser(userB)).isEqualTo(3);
            assertThat(incidentRepository.countByClaimedBy(userA)).isEqualTo(2);
            assertThat(incidentRepository.countByResolvedBy(userA)).isEqualTo(1);
            assertThat(incidentRepository.countByResolvedBy(userB)).isZero();

            // Open (non-terminal) buckets for the reporter view — userB's third
            // incident is RESOLVED (terminal) and therefore excluded.
            assertThat(incidentRepository.countByUserAndStatusIn(
                    userA, List.of(IncidentStatus.DECLARED, IncidentStatus.CLAIMED, IncidentStatus.IN_PROGRESS)))
                    .isEqualTo(1);
            assertThat(incidentRepository.countByUserAndStatusIn(
                    userB, List.of(IncidentStatus.DECLARED, IncidentStatus.CLAIMED, IncidentStatus.IN_PROGRESS)))
                    .isEqualTo(2);
            // Terminal bucket — RESOLVED / NON_RESOLVED only
            assertThat(incidentRepository.countByUserAndStatusIn(
                    userA, List.of(IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED))).isZero();
        }

        @Test
        @DisplayName("daily buckets group declarations and resolutions by calendar date")
        void dailyBucketsGroupByCalendarDate() {
            // Two incidents declared by userA (today)
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            // One declared by userB — must be excluded from userA's buckets
            persistIncident(userB, departmentA, IncidentStatus.DECLARED);

            // userA resolved one incident yesterday. resolved_at is mapped with
            // @Column(updatable = false), so it must be populated before the
            // INSERT — setting it after save() would be a no-op UPDATE.
            IncidentEntity resolved = TestEntityFactory.createIncident();
            resolved.setUser(userA);
            resolved.setDepartment(departmentB);
            resolved.setStation(station);
            resolved.setCategory(category);
            resolved.setStatus(IncidentStatus.RESOLVED);
            resolved.setResolvedBy(userA);
            resolved.setResolvedAt(LocalDateTime.now().minusDays(1));
            incidentRepository.save(resolved);

            // userA declared 3 incidents today in total: the two still-DECLARED
            // ones plus the RESOLVED one (all three were reported today).
            List<Object[]> declaredDays = incidentRepository.countDeclaredByDay(userA.getId());
            assertThat(declaredDays).hasSize(1);
            assertThat(declaredDays.get(0)[0]).isEqualTo(LocalDate.now().toString());
            assertThat(declaredDays.get(0)[1]).isEqualTo(3L);

            List<Object[]> resolvedDays = incidentRepository.countResolvedByDay(userA.getId());
            assertThat(resolvedDays).hasSize(1);
            assertThat(resolvedDays.get(0)[0]).isEqualTo(LocalDate.now().minusDays(1).toString());
            assertThat(resolvedDays.get(0)[1]).isEqualTo(1L);

            // userB has no resolutions
            assertThat(incidentRepository.countResolvedByDay(userB.getId())).isEmpty();
        }
    }

    //  Analytics & Quality Engineering queries (GET /api/analytics/**)
    @Nested
    @DisplayName("Analytics & Quality Engineering queries")
    class AnalyticsQueriesTest {

        @Autowired
        private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

        private CategoryEntity categoryB;
        private StationEntity stationB;

        @BeforeEach
        void setUpAnalytics() {
            categoryB = categoryRepository.save(TestEntityFactory.createCategory());
            ProductionLineEntity line2 = productionLineRepository.save(
                    TestEntityFactory.createProductionLine(sectionRepository.save(
                            TestEntityFactory.createSection())));
            stationB = stationRepository.save(TestEntityFactory.createStation(line2));
        }

        @Test
        @DisplayName("volume buckets group declarations per day with terminal-outcome split")
        void volumeBuckets_groupByDeclaredDay() {
            IncidentEntity i1 = persistIncident(userA, departmentA, IncidentStatus.DECLARED);
            backdateDeclaredAt(i1, LocalDateTime.of(2026, 1, 5, 10, 0));

            IncidentEntity i2 = persistResolvedIncident(userA, departmentA, LocalDateTime.of(2026, 1, 5, 18, 0));
            backdateDeclaredAt(i2, LocalDateTime.of(2026, 1, 5, 12, 0));

            IncidentEntity i3 = persistIncident(userA, departmentA, IncidentStatus.NON_RESOLVED);
            backdateDeclaredAt(i3, LocalDateTime.of(2026, 1, 6, 9, 0));

            List<Object[]> rows = incidentRepository.analyticsVolumeBuckets(
                    "day", LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 7, 0, 0), null);

            assertThat(rows).hasSize(2);
            assertThat(rows.get(0)[0]).isEqualTo("2026-01-05");
            assertThat(rows.get(0)[1]).isEqualTo(2L);  // reported
            assertThat(rows.get(0)[2]).isEqualTo(1L);  // resolved
            assertThat(((Number) rows.get(0)[3]).longValue()).isZero(); // non-resolved
            assertThat(rows.get(1)[0]).isEqualTo("2026-01-06");
            assertThat(rows.get(1)[1]).isEqualTo(1L);
            assertThat(((Number) rows.get(1)[3]).longValue()).isEqualTo(1L);
        }

        @Test
        @DisplayName("volume buckets support DATE_TRUNC week granularity")
        void volumeBuckets_weekGranularity() {
            // Wednesday + Saturday of the same ISO week
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 7, 10, 0));
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 10, 10, 0));

            List<Object[]> rows = incidentRepository.analyticsVolumeBuckets(
                    "week", LocalDateTime.of(2026, 1, 1, 0, 0),
                    LocalDateTime.of(2026, 2, 1, 0, 0), null);

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0)[0]).isEqualTo("2026-01-05"); // Monday of that ISO week
            assertThat(rows.get(0)[1]).isEqualTo(2L);
        }

        @Test
        @DisplayName("volume buckets respect the department filter")
        void volumeBuckets_departmentFilter() {
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 10, 0));
            backdateDeclaredAt(persistIncident(userB, departmentB, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 11, 0));

            List<Object[]> all = incidentRepository.analyticsVolumeBuckets(
                    "day", LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 6, 0, 0), null);
            List<Object[]> filtered = incidentRepository.analyticsVolumeBuckets(
                    "day", LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 6, 0, 0), departmentA.getId());

            assertThat(all.get(0)[1]).isEqualTo(2L);
            assertThat(filtered.get(0)[1]).isEqualTo(1L);
        }

        @Test
        @DisplayName("MTTR buckets average resolution hours per resolved-day bucket")
        void mttrBuckets_averageResolutionHours() {
            // 2h and 4h resolution durations, both resolved the same day
            backdateDeclaredAt(persistResolvedIncident(userA, departmentA,
                    LocalDateTime.of(2026, 1, 6, 14, 0)), LocalDateTime.of(2026, 1, 6, 12, 0));
            backdateDeclaredAt(persistResolvedIncident(userA, departmentA,
                    LocalDateTime.of(2026, 1, 6, 18, 0)), LocalDateTime.of(2026, 1, 6, 14, 0));

            List<Object[]> rows = incidentRepository.analyticsMttrBuckets(
                    "day", LocalDateTime.of(2026, 1, 6, 0, 0),
                    LocalDateTime.of(2026, 1, 7, 0, 0), null);

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0)[0]).isEqualTo("2026-01-06");
            assertThat(((Number) rows.get(0)[1]).doubleValue()).isEqualTo(3.0); // avg of 2h + 4h
        }

        @Test
        @DisplayName("time-to-claim buckets average claim latency per claimed-day bucket")
        void timeToClaimBuckets_averageClaimLatency() {
            IncidentEntity claimed = persistIncident(userA, departmentA, IncidentStatus.CLAIMED);
            claimed.setClaimedBy(userA);
            claimed.setClaimedAt(LocalDateTime.of(2026, 1, 6, 11, 0));
            incidentRepository.save(claimed);
            backdateDeclaredAt(claimed, LocalDateTime.of(2026, 1, 6, 9, 0)); // 2h latency

            List<Object[]> rows = incidentRepository.analyticsTimeToClaimBuckets(
                    "day", LocalDateTime.of(2026, 1, 6, 0, 0),
                    LocalDateTime.of(2026, 1, 7, 0, 0), null);

            assertThat(rows).hasSize(1);
            assertThat(((Number) rows.get(0)[1]).doubleValue()).isEqualTo(2.0);
        }

        @Test
        @DisplayName("totals return exact cohort counts over the window")
        void totals_exactCohortCounts() {
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 10, 0));
            backdateDeclaredAt(persistResolvedIncident(userA, departmentA,
                    LocalDateTime.of(2026, 1, 5, 15, 0)), LocalDateTime.of(2026, 1, 5, 11, 0));
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.NON_RESOLVED),
                    LocalDateTime.of(2026, 1, 5, 12, 0));

            List<Object[]> rows = incidentRepository.analyticsTotals(
                    LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 6, 0, 0), null);

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0)[0]).isEqualTo(3L); // reported
            assertThat(rows.get(0)[1]).isEqualTo(1L); // resolved
            assertThat(rows.get(0)[2]).isEqualTo(1L); // non-resolved
        }

        @Test
        @DisplayName("department volumes rank departments descending")
        void departmentVolumes_rankedDescending() {
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 10, 0));
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 11, 0));
            backdateDeclaredAt(persistIncident(userB, departmentB, IncidentStatus.DECLARED),
                    LocalDateTime.of(2026, 1, 5, 12, 0));

            List<Object[]> rows = incidentRepository.analyticsDepartmentVolumes(
                    LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 6, 0, 0), null);

            assertThat(rows).hasSize(2);
            assertThat(rows.get(0)[0]).isEqualTo(departmentA.getName());
            assertThat(rows.get(0)[1]).isEqualTo(2L);
            assertThat(rows.get(1)[1]).isEqualTo(1L);
        }

        @Test
        @DisplayName("category counts feed the Pareto analysis in descending order")
        void categoryCounts_descendingOrder() {
            backdateDeclaredAt(persistIncidentWithCategory(userA, departmentA, category,
                    IncidentStatus.DECLARED), LocalDateTime.of(2026, 1, 5, 10, 0));
            backdateDeclaredAt(persistIncidentWithCategory(userA, departmentA, category,
                    IncidentStatus.DECLARED), LocalDateTime.of(2026, 1, 5, 11, 0));
            backdateDeclaredAt(persistIncidentWithCategory(userA, departmentA, categoryB,
                    IncidentStatus.DECLARED), LocalDateTime.of(2026, 1, 5, 12, 0));

            List<Object[]> rows = incidentRepository.analyticsCategoryCounts(
                    LocalDateTime.of(2026, 1, 5, 0, 0),
                    LocalDateTime.of(2026, 1, 6, 0, 0), null);

            assertThat(rows).hasSize(2);
            assertThat(rows.get(0)[0]).isEqualTo(category.getName());
            assertThat(rows.get(0)[1]).isEqualTo(2L);
            assertThat(rows.get(1)[1]).isEqualTo(1L);
        }

        @Test
        @DisplayName("heatmap cells expose raw PostgreSQL day-of-week and hour")
        void heatmapCells_dayOfWeekAndHour() {
            LocalDateTime at = LocalDateTime.of(2026, 1, 7, 10, 30); // a Wednesday, 10h30
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED), at);
            backdateDeclaredAt(persistIncident(userA, departmentA, IncidentStatus.DECLARED), at);

            List<Object[]> rows = incidentRepository.analyticsHeatmapCells(
                    LocalDateTime.of(2026, 1, 7, 0, 0),
                    LocalDateTime.of(2026, 1, 8, 0, 0), null);

            assertThat(rows).hasSize(1);
            int expectedDow = at.getDayOfWeek().getValue() % 7; // PG: 0=Sun … 6=Sat
            assertThat(rows.get(0)[0]).isEqualTo(expectedDow);
            assertThat(rows.get(0)[1]).isEqualTo(10);
            assertThat(rows.get(0)[2]).isEqualTo(2L);
        }

        @Test
        @DisplayName("repeat signals flag ≥3 same station+category incidents within 14 days")
        void repeatSignals_flagRecurringPairs() {
            // 3 declarations on the same station+category within 14 days → signal
            for (LocalDateTime at : List.of(
                    LocalDateTime.of(2026, 1, 1, 8, 0),
                    LocalDateTime.of(2026, 1, 5, 8, 0),
                    LocalDateTime.of(2026, 1, 10, 8, 0))) {
                backdateDeclaredAt(persistIncidentWithCategory(userA, departmentA, category,
                        IncidentStatus.DECLARED), at);
            }
            // 2 incidents only on another pair → no signal
            for (LocalDateTime at : List.of(
                    LocalDateTime.of(2026, 1, 2, 8, 0),
                    LocalDateTime.of(2026, 1, 3, 8, 0))) {
                IncidentEntity inc = persistIncidentWithCategory(userA, departmentA, categoryB,
                        IncidentStatus.DECLARED);
                inc.setStation(stationB);
                incidentRepository.save(inc);
                backdateDeclaredAt(inc, at);
            }

            List<Object[]> rows = incidentRepository.analyticsRepeatSignals(
                    LocalDateTime.of(2026, 1, 1, 0, 0),
                    LocalDateTime.of(2026, 2, 1, 0, 0), null);

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0)[0]).isEqualTo(station.getId());
            assertThat(rows.get(0)[1]).isEqualTo(station.getCode());
            assertThat(rows.get(0)[3]).isEqualTo(category.getName());
            assertThat(rows.get(0)[5]).isEqualTo(3L); // incident count
        }

        @Test
        @DisplayName("repeat signals ignore pairs whose 3 incidents span more than 14 days")
        void repeatSignals_ignoreSpreadOutPairs() {
            for (LocalDateTime at : List.of(
                    LocalDateTime.of(2026, 1, 1, 8, 0),
                    LocalDateTime.of(2026, 1, 20, 8, 0),
                    LocalDateTime.of(2026, 2, 5, 8, 0))) {
                backdateDeclaredAt(persistIncidentWithCategory(userA, departmentA, category,
                        IncidentStatus.DECLARED), at);
            }

            List<Object[]> rows = incidentRepository.analyticsRepeatSignals(
                    LocalDateTime.of(2026, 1, 1, 0, 0),
                    LocalDateTime.of(2026, 2, 28, 0, 0), null);

            assertThat(rows).isEmpty();
        }

        @Test
        @DisplayName("workload aggregates throughput per ADMIN evaluator")
        void workload_aggregatesPerAdmin() {
            UserEntity admin = TestEntityFactory.createAdmin();
            admin.setDepartment(departmentA);
            final UserEntity savedAdmin = userRepository.save(admin);

            // 2 RESOLVED incidents (2h + 4h) + 1 NON_RESOLVED, all resolved by admin
            for (int h : List.of(2, 4)) {
                IncidentEntity resolved = persistResolvedIncident(userA, departmentA,
                        LocalDateTime.of(2026, 1, 6, 10 + h, 0));
                resolved.setResolvedBy(admin);
                incidentRepository.save(resolved);
                backdateDeclaredAt(resolved, LocalDateTime.of(2026, 1, 6, 10, 0));
            }
            IncidentEntity nonResolved = persistIncident(userA, departmentA, IncidentStatus.NON_RESOLVED);
            nonResolved.setResolvedBy(admin);
            nonResolved.setResolvedAt(LocalDateTime.of(2026, 1, 6, 16, 0));
            incidentRepository.save(nonResolved);
            backdateDeclaredAt(nonResolved, LocalDateTime.of(2026, 1, 6, 12, 0));

            // 1 claim by admin
            IncidentEntity claimed = persistIncident(userA, departmentA, IncidentStatus.CLAIMED);
            claimed.setClaimedBy(admin);
            claimed.setClaimedAt(LocalDateTime.of(2026, 1, 6, 11, 0));
            incidentRepository.save(claimed);
            backdateDeclaredAt(claimed, LocalDateTime.of(2026, 1, 6, 9, 0));

            List<Object[]> rows = incidentRepository.analyticsWorkload(
                    LocalDateTime.of(2026, 1, 6, 0, 0),
                    LocalDateTime.of(2026, 1, 7, 0, 0), null);

            Object[] adminRow = rows.stream()
                    .filter(r -> ((Number) r[0]).longValue() == savedAdmin.getId())
                    .findFirst()
                    .orElseThrow();
            assertThat(adminRow[3]).isEqualTo(1L);  // claims
            assertThat(adminRow[4]).isEqualTo(2L);  // resolved
            assertThat(adminRow[5]).isEqualTo(1L);  // non-resolved
            assertThat(((Number) adminRow[6]).doubleValue()).isEqualTo(3.0); // avg(2h, 4h)
        }

        //  ── Analytics helpers ─────────────────────────

        private IncidentEntity persistIncidentWithCategory(final UserEntity user,
                                                           final DepartmentEntity department,
                                                           final CategoryEntity cat,
                                                           final IncidentStatus status) {
            IncidentEntity incident = TestEntityFactory.createIncident();
            incident.setUser(user);
            incident.setDepartment(department);
            incident.setStation(station);
            incident.setCategory(cat);
            incident.setStatus(status);
            return incidentRepository.save(incident);
        }

        private IncidentEntity persistResolvedIncident(final UserEntity user,
                                                       final DepartmentEntity department,
                                                       final LocalDateTime resolvedAt) {
            IncidentEntity incident = TestEntityFactory.createIncident();
            incident.setUser(user);
            incident.setDepartment(department);
            incident.setStation(station);
            incident.setCategory(category);
            incident.setStatus(IncidentStatus.RESOLVED);
            incident.setResolvedAt(resolvedAt); // must be set pre-insert (updatable=false)
            incident.setResolutionNote("Fixed in analytics test");
            return incidentRepository.save(incident);
        }

        /** Backdates declared_at (insert-generated) via SQL so bucket tests are deterministic. */
        private void backdateDeclaredAt(final IncidentEntity incident, final LocalDateTime at) {
            jdbcTemplate.update(
                    "UPDATE incidents SET declared_at = ? WHERE id = ?",
                    java.sql.Timestamp.valueOf(at), incident.getId());
        }
    }

    //  PostgreSQL native full-text search (searchByText — tsvector/GIN/ts_rank)
    @Nested
    @DisplayName("searchByText — PostgreSQL full-text search")
    class FullTextSearchTest {

        @Autowired
        private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

        @Test
        @DisplayName("matches words in description (weight A)")
        void matchesWholeWordsInDescription() {
            IncidentEntity match = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Courroie de convoyeur désalignée sur la ligne 2");
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Capteur de température défectueux");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "convoyeur", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).extracting(IncidentEntity::getId)
                    .containsExactly(match.getId());
            assertThat(page.getTotalElements()).isEqualTo(1);
        }

        @Test
        @DisplayName("matches the incident reference (also weight A)")
        void matchesReference() {
            IncidentEntity match = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "some description");
            match.setReference("INC-2026-0042");
            incidentRepository.save(match);

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "INC-2026-0042", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).extracting(IncidentEntity::getId)
                    .containsExactly(match.getId());
        }

        @Test
        @DisplayName("prefix search (term*) matches partial words")
        void prefixSearch() {
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Convoyeur hors service");
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne moteur électrique");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "convoy*", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("phrase search (\"...\") requires adjacent words")
        void phraseSearch() {
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "moteur défaillant sur la presse");
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "moteur en bon état malgré défaillant test");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "\"moteur défaillant\"", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("excluded terms (-term) filter out matching documents")
        void excludedTerms() {
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Courroie convoyeur usée");
            IncidentEntity remaining = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Courroie moteur usée");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "courroie -convoyeur", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).extracting(IncidentEntity::getId)
                    .containsExactly(remaining.getId());
        }

        @Test
        @DisplayName("ts_rank ranks description (weight A) matches above resolution_note (weight B) matches")
        void ranksWeightedMatches() {
            IncidentEntity descriptionMatch = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.RESOLVED, "Panne pompe hydraulique");
            descriptionMatch.setResolutionNote("Aucune note pertinente");
            incidentRepository.save(descriptionMatch);

            IncidentEntity noteOnlyMatch = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.RESOLVED, "Intervention sans lien");
            noteOnlyMatch.setResolutionNote("Panne pompe hydraulique identifiée et corrigée");
            incidentRepository.save(noteOnlyMatch);

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "pompe", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent().get(0).getId()).isEqualTo(descriptionMatch.getId());
        }

        @Test
        @DisplayName("status + department filters compose with the text match")
        void structuredFiltersCompose() {
            IncidentEntity expected = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne moteur");
            persistIncidentWithDescription(userA, departmentB,
                    IncidentStatus.DECLARED, "Panne moteur");
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.RESOLVED, "Panne moteur");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "moteur", "DECLARED", departmentA.getId(), null, null, null,
                    "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).extracting(IncidentEntity::getId)
                    .containsExactly(expected.getId());
        }

        @Test
        @DisplayName("date range composes on the declaredAt field")
        void dateRangeComposesOnDeclaredAt() {
            IncidentEntity old = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne frein");
            jdbcTemplate.update("UPDATE incidents SET declared_at = ? WHERE id = ?",
                    java.sql.Timestamp.valueOf(LocalDateTime.of(2026, 1, 1, 10, 0)), old.getId());
            IncidentEntity fresh = persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne frein");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "frein", null, null, null,
                    LocalDateTime.of(2026, 8, 1, 0, 0), null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).extracting(IncidentEntity::getId)
                    .containsExactly(fresh.getId());
        }

        @Test
        @DisplayName("malformed search syntax degrades gracefully instead of throwing")
        void malformedSyntaxDoesNotThrow() {
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne moteur électrique");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "moteur &&&", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("no match returns an empty page with a correct total (countQuery)")
        void noMatchReturnsEmptyPage() {
            persistIncidentWithDescription(userA, departmentA,
                    IncidentStatus.DECLARED, "Panne moteur");

            Page<IncidentEntity> page = incidentRepository.searchByText(
                    "inexistantxyz", null, null, null, null, null, "declaredAt", Pageable.ofSize(10));

            assertThat(page).isEmpty();
            assertThat(page.getTotalElements()).isZero();
        }

        private IncidentEntity persistIncidentWithDescription(final UserEntity user,
                                                              final DepartmentEntity department,
                                                              final IncidentStatus status,
                                                              final String description) {
            IncidentEntity incident = TestEntityFactory.createIncident();
            incident.setUser(user);
            incident.setDepartment(department);
            incident.setStation(station);
            incident.setCategory(category);
            incident.setStatus(status);
            incident.setDescription(description);
            return incidentRepository.save(incident);
        }
    }

    //  Helper methods
    private IncidentEntity persistIncident(final UserEntity user,
                                           final DepartmentEntity department,
                                           final IncidentStatus status) {
        IncidentEntity incident = TestEntityFactory.createIncident();
        incident.setUser(user);
        incident.setDepartment(department);
        incident.setStation(station);
        incident.setCategory(category);
        incident.setStatus(status);
        return incidentRepository.save(incident);
    }

}
