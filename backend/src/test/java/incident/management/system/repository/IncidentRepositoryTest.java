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

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;


// Integration tests for IncidentRepository, focusing on paginated filters and temporal query used by the 10m auto-closure.
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
            persistIncident(userA, departmentA, IncidentStatus.CLOSED);

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

    //  Temporal query: findByStatusAndResolvedAtBefore
    //  (used by the 10-minute auto-closure scheduler)
    @Nested
    @DisplayName("findByStatusAndResolvedAtBefore")
    class FindByStatusAndResolvedAtBeforeTest {

        private final LocalDateTime now = LocalDateTime.now();
        private final LocalDateTime threshold = now.minusMinutes(10);

        @Test
        @DisplayName("should return RESOLVED incidents where resolvedAt < threshold")
        void returnsResolvedBeforeThreshold() {
            IncidentEntity eligible = persistResolvedIncident(
                    userA, departmentA, threshold.minusSeconds(1));

            List<IncidentEntity> result = incidentRepository
                    .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

            assertThat(result)
                    .hasSize(1)
                    .extracting(IncidentEntity::getId)
                    .containsExactly(eligible.getId());
        }

        @Test
        @DisplayName("should NOT return RESOLVED incidents where resolvedAt >= threshold")
        void excludesResolvedAtOrAfterThreshold() {
            // resolved exactly at threshold
            persistResolvedIncident(userA, departmentA, threshold);

            // resolved after threshold
            persistResolvedIncident(userA, departmentA, threshold.plusMinutes(5));

            List<IncidentEntity> result = incidentRepository
                    .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should NOT return incidents with non-RESOLVED status")
        void excludesNonResolvedStatus() {
            persistIncident(userA, departmentA, IncidentStatus.DECLARED);

            List<IncidentEntity> result = incidentRepository
                    .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should NOT return RESOLVED incidents with null resolvedAt")
        void excludesNullResolvedAt() {
            IncidentEntity incident = TestEntityFactory.createIncident();
            incident.setUser(userA);
            incident.setDepartment(departmentA);
            incident.setStation(station);
            incident.setCategory(category);
            incident.setStatus(IncidentStatus.RESOLVED);
            incident.setResolvedAt(null); // explicitly null
            incidentRepository.save(incident);

            List<IncidentEntity> result = incidentRepository
                    .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should return multiple eligible incidents ordered by resolvedAt")
        void returnsMultipleEligible() {
            persistResolvedIncident(userA, departmentA, threshold.minusMinutes(20));
            persistResolvedIncident(userA, departmentA, threshold.minusMinutes(15));

            List<IncidentEntity> result = incidentRepository
                    .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

            assertThat(result).hasSize(2);
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

    private IncidentEntity persistResolvedIncident(final UserEntity user,
                                                   final DepartmentEntity department,
                                                   final LocalDateTime resolvedAt) {
        IncidentEntity incident = TestEntityFactory.createResolvedIncident(resolvedAt);
        incident.setUser(user);
        incident.setDepartment(department);
        incident.setStation(station);
        incident.setCategory(category);
        return incidentRepository.save(incident);
    }
}
