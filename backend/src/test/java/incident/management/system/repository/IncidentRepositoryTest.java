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
