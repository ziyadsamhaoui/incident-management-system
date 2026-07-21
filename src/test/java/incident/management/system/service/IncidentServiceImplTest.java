package incident.management.system.service;

import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.event.IncidentTransitionEvent;
import incident.management.system.exception.InvalidStatusTransitionException;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.IncidentHistory;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.CategoryRepository;
import incident.management.system.repository.DepartmentRepository;
import incident.management.system.repository.IncidentHistoryRepository;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.StationRepository;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;


// Validate the state machine transitions and business logic in isolation (no Spring context, no database)
@ExtendWith(MockitoExtension.class)
@DisplayName("IncidentServiceImpl: Core State Machine & Business Logic")
class IncidentServiceImplTest {

    //  Mocks
    @Mock
    private IncidentRepository incidentRepository;

    @Mock
    private IncidentHistoryRepository incidentHistoryRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private IncidentReferenceGenerator referenceGenerator;

    @Captor
    private ArgumentCaptor<IncidentEntity> incidentCaptor;

    @Captor
    private ArgumentCaptor<IncidentHistory> historyCaptor;

    @Captor
    private ArgumentCaptor<IncidentTransitionEvent> eventCaptor;

    //  System under test
    private IncidentServiceImpl incidentService;

    @BeforeEach
    void setUp() {
        incidentService = new IncidentServiceImpl(
                incidentRepository, incidentHistoryRepository, userRepository,
                departmentRepository, stationRepository, categoryRepository,
                eventPublisher, referenceGenerator
        );
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    //  Valid Transition Matrix
    @Nested
    @DisplayName("Valid Transition Matrix")
    class ValidTransitions {

        // Builds a minimal test incident with the given status and no timestamp overrides.
        private IncidentEntity incidentWithStatus(long id, IncidentStatus status) {
            return IncidentEntity.builder()
                    .id(id)
                    .reference("INC-20260720-" + String.format("%04d", id))
                    .status(status)
                    .description("Test incident")
                    .build();
        }

        @Test
        @DisplayName("DECLARED → CLAIMED: status, claimedAt, claimedBy updated; audit + event published")
        void claimIncident_validTransition() {
            // Arrange
            IncidentEntity incident = incidentWithStatus(1L, IncidentStatus.DECLARED);
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            var response = incidentService.claimIncident(1L);

            // Assert — incident state mutation
            assertThat(response.status()).isEqualTo(IncidentStatus.CLAIMED);
            assertThat(response.claimedAt()).isNotNull();
            assertThat(response.assignedTo()).isNull(); // getCurrentUser() returns null

            // Assert: dual-write = repository save + history save
            verify(incidentRepository).save(incidentCaptor.capture());
            IncidentEntity saved = incidentCaptor.getValue();
            assertThat(saved.getStatus()).isEqualTo(IncidentStatus.CLAIMED);
            assertThat(saved.getClaimedAt()).isNotNull();

            verify(incidentHistoryRepository).save(historyCaptor.capture());
            IncidentHistory history = historyCaptor.getValue();
            assertThat(history.getPreviousStatus()).isEqualTo(IncidentStatus.DECLARED);
            assertThat(history.getCurrentStatus()).isEqualTo(IncidentStatus.CLAIMED);
            assertThat(history.getComment()).isEqualTo("Claimed by system");
            assertThat(history.getChangedAt()).isNotNull();

            // Assert: event published
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            IncidentTransitionEvent event = eventCaptor.getValue();
            assertThat(event.previousStatus()).isEqualTo(IncidentStatus.DECLARED);
            assertThat(event.newStatus()).isEqualTo(IncidentStatus.CLAIMED);
            assertThat(event.actorUserId()).isNull();
        }

        @Test
        @DisplayName("CLAIMED → IN_PROGRESS: status, inProgressAt updated; audit + event published")
        void progressIncident_validTransition() {
            // Arrange
            IncidentEntity incident = incidentWithStatus(2L, IncidentStatus.CLAIMED);
            when(incidentRepository.findById(2L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            var response = incidentService.progressIncident(2L);

            // Assert: incident state mutation
            assertThat(response.status()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(response.inProgressAt()).isNotNull();

            // Assert: dual-write
            verify(incidentRepository).save(incidentCaptor.capture());
            assertThat(incidentCaptor.getValue().getStatus()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(incidentCaptor.getValue().getInProgressAt()).isNotNull();

            verify(incidentHistoryRepository).save(historyCaptor.capture());
            assertThat(historyCaptor.getValue().getPreviousStatus()).isEqualTo(IncidentStatus.CLAIMED);
            assertThat(historyCaptor.getValue().getCurrentStatus()).isEqualTo(IncidentStatus.IN_PROGRESS);

            // Assert: event published (actorUserId = null since getCurrentUser() = null)
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().newStatus()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(eventCaptor.getValue().actorUserId()).isNull();
        }

        @ParameterizedTest(name = "IN_PROGRESS → {0}: valid evaluation outcome")
        @ValueSource(strings = {"RESOLVED", "NON_RESOLVED"})
        @DisplayName("IN_PROGRESS → RESOLVED / NON_RESOLVED: both outcomes valid")
        void evaluateIncident_validOutcomes(String outcomeName) {
            // Arrange
            IncidentStatus targetStatus = IncidentStatus.valueOf(outcomeName);
            IncidentEntity incident = incidentWithStatus(3L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(3L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            String note = outcomeName.equals("NON_RESOLVED") ? "Root cause identified, will retry." : null;
            EvaluateIncidentRequest request = new EvaluateIncidentRequest(targetStatus, note);

            // Act
            var response = incidentService.evaluateIncident(3L, request);

            // Assert: incident state mutation
            assertThat(response.status()).isEqualTo(targetStatus);
            assertThat(response.resolvedAt()).isNotNull();
            assertThat(response.resolutionNote()).isEqualTo(note);

            // Assert: dual-write: incident saved
            verify(incidentRepository).save(incidentCaptor.capture());
            IncidentEntity saved = incidentCaptor.getValue();
            assertThat(saved.getStatus()).isEqualTo(targetStatus);
            assertThat(saved.getResolvedAt()).isNotNull();
            assertThat(saved.getResolutionNote()).isEqualTo(note);

            // Assert: dual-write = history saved with mirror comment
            verify(incidentHistoryRepository).save(historyCaptor.capture());
            IncidentHistory history = historyCaptor.getValue();
            assertThat(history.getPreviousStatus()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(history.getCurrentStatus()).isEqualTo(targetStatus);
            // Since getCurrentUser() = null, the comment should be just the resolutionNote (or "()" if null)
            if (note != null) {
                assertThat(history.getComment()).contains(note);
            }

            // Assert: event published
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().newStatus()).isEqualTo(targetStatus);
        }

        @Test
        @DisplayName("DECLARED → CLAIMED with authenticated admin includes audit label in comment")
        void claimIncident_withAuthenticatedAdmin_includesAuditLabel() {
            // Arrange
            UserEntity admin = UserEntity.builder()
                    .id(10L)
                    .matricule(9001)
                    .firstName("Jane")
                    .lastName("Admin")
                    .role(UserRole.ADMIN)
                    .build();

            when(userRepository.findByMatricule(9001)).thenReturn(Optional.of(admin));

            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            "9001", "pass",
                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                    ));

            IncidentEntity incident = incidentWithStatus(5L, IncidentStatus.DECLARED);
            when(incidentRepository.findById(5L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            incidentService.claimIncident(5L);

            // Assert: audit comment includes the admin's audit label
            verify(incidentHistoryRepository).save(historyCaptor.capture());
            IncidentHistory history = historyCaptor.getValue();
            assertThat(history.getComment()).isEqualTo("Claimed by " + admin.getAuditLabel());

            // Assert: event published with actorUserId
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().actorUserId()).isEqualTo(10L);
        }
    }

    //  Invalid Transition Protection & Edge Cases
    @Nested
    @DisplayName("Invalid Transition Protection & Edge Cases")
    class InvalidTransitions {

        private IncidentEntity incidentWithStatus(long id, IncidentStatus status) {
            return IncidentEntity.builder()
                    .id(id)
                    .reference("INC-20260720-" + String.format("%04d", id))
                    .status(status)
                    .description("Test incident")
                    .build();
        }

        //  claimIncident: wrong source states

        @ParameterizedTest(name = "claimIncident from {0} → throws InvalidStatusTransitionException")
        @CsvSource({
                "IN_PROGRESS",
                "RESOLVED",
                "NON_RESOLVED",
                "CLOSED"
        })
        @DisplayName("claimIncident rejects invalid source states")
        void claimIncident_fromWrongState_throwsException(IncidentStatus currentStatus) {
            IncidentEntity incident = incidentWithStatus(10L, currentStatus);
            when(incidentRepository.findById(10L)).thenReturn(Optional.of(incident));

            assertThatThrownBy(() -> incidentService.claimIncident(10L))
                    .isInstanceOf(InvalidStatusTransitionException.class)
                    .hasMessageContaining(currentStatus.name())
                    .hasMessageContaining(IncidentStatus.CLAIMED.name());

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        //  progressIncident: wrong source states

        @ParameterizedTest(name = "progressIncident from {0} → throws InvalidStatusTransitionException")
        @CsvSource({
                "DECLARED",
                "RESOLVED",
                "NON_RESOLVED",
                "CLOSED"
        })
        @DisplayName("progressIncident rejects invalid source states")
        void progressIncident_fromWrongState_throwsException(IncidentStatus currentStatus) {
            IncidentEntity incident = incidentWithStatus(20L, currentStatus);
            when(incidentRepository.findById(20L)).thenReturn(Optional.of(incident));

            assertThatThrownBy(() -> incidentService.progressIncident(20L))
                    .isInstanceOf(InvalidStatusTransitionException.class)
                    .hasMessageContaining(currentStatus.name())
                    .hasMessageContaining(IncidentStatus.IN_PROGRESS.name());

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        //  evaluateIncident: wrong source states

        @ParameterizedTest(name = "evaluateIncident({0}) from {1} → throws InvalidStatusTransitionException")
        @CsvSource({
                "RESOLVED,    DECLARED",
                "RESOLVED,    CLAIMED",
                "RESOLVED,    NON_RESOLVED",
                "RESOLVED,    CLOSED",
                "NON_RESOLVED, DECLARED",
                "NON_RESOLVED, CLAIMED",
                "NON_RESOLVED, RESOLVED",
                "NON_RESOLVED, CLOSED"
        })
        @DisplayName("evaluateIncident rejects invalid source states for both outcomes")
        void evaluateIncident_fromWrongState_throwsException(
                IncidentStatus targetStatus, IncidentStatus currentStatus) {

            IncidentEntity incident = incidentWithStatus(30L, currentStatus);
            when(incidentRepository.findById(30L)).thenReturn(Optional.of(incident));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(targetStatus, "Some note");

            assertThatThrownBy(() -> incidentService.evaluateIncident(30L, request))
                    .isInstanceOf(InvalidStatusTransitionException.class)
                    .hasMessageContaining(currentStatus.name())
                    .hasMessageContaining(targetStatus.name());

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        //  CLOSED state = no transitions allowed
        @ParameterizedTest(name = "cannot transition CLOSED → {0}")
        @ValueSource(strings = {"DECLARED", "CLAIMED", "IN_PROGRESS", "RESOLVED", "NON_RESOLVED", "CLOSED"})
        @DisplayName("CLOSED (terminal) rejects any outbound transition via all methods")
        void closedState_rejectsAllTransitions(String targetName) {
            IncidentStatus target = IncidentStatus.valueOf(targetName);
            IncidentEntity incident = incidentWithStatus(40L, IncidentStatus.CLOSED);
            when(incidentRepository.findById(40L)).thenReturn(Optional.of(incident));

            // All three methods should reject CLOSED as a source
            assertThatThrownBy(() -> incidentService.claimIncident(40L))
                    .isInstanceOf(InvalidStatusTransitionException.class);

            assertThatThrownBy(() -> incidentService.progressIncident(40L))
                    .isInstanceOf(InvalidStatusTransitionException.class);

            // For evaluate, CLOSED → anything is invalid
            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    target.equals(IncidentStatus.CLOSED) ? IncidentStatus.RESOLVED : target,
                    "Note");
            assertThatThrownBy(() -> incidentService.evaluateIncident(40L, request))
                    .isInstanceOf(InvalidStatusTransitionException.class);

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("disallowed CLOSED-as-target via evaluateIncident throws exception")
        void evaluateIncident_toClosed_throwsException() {
            IncidentEntity incident = incidentWithStatus(50L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(50L)).thenReturn(Optional.of(incident));

            // CLOSED is not a valid outcome from IN_PROGRESS
            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.CLOSED, "Attempted direct close");

            assertThatThrownBy(() -> incidentService.evaluateIncident(50L, request))
                    .isInstanceOf(InvalidStatusTransitionException.class)
                    .hasMessageContaining("IN_PROGRESS")
                    .hasMessageContaining("CLOSED");

            verify(incidentRepository, never()).save(any());
        }

        //  Lifecycle integrity: full path must succeed

        @Test
        @DisplayName("full lifecycle: DECLARED → CLAIMED → IN_PROGRESS → RESOLVED succeeds step-by-step")
        void fullLifecycle_resolvedPath_succeeds() {
            // Simulate the entire valid lifecycle end-to-end
            IncidentEntity incident = incidentWithStatus(60L, IncidentStatus.DECLARED);
            when(incidentRepository.findById(60L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Step 1: DECLARED → CLAIMED
            var claimed = incidentService.claimIncident(60L);
            assertThat(claimed.status()).isEqualTo(IncidentStatus.CLAIMED);

            incident.setStatus(IncidentStatus.CLAIMED);

            // Step 2: CLAIMED → IN_PROGRESS
            when(incidentRepository.findById(60L)).thenReturn(Optional.of(incident));
            var inProgress = incidentService.progressIncident(60L);
            assertThat(inProgress.status()).isEqualTo(IncidentStatus.IN_PROGRESS);

            incident.setStatus(IncidentStatus.IN_PROGRESS);

            // Step 3: IN_PROGRESS → RESOLVED
            when(incidentRepository.findById(60L)).thenReturn(Optional.of(incident));
            EvaluateIncidentRequest evalRequest = new EvaluateIncidentRequest(
                    IncidentStatus.RESOLVED, "All checks passed.");
            var resolved = incidentService.evaluateIncident(60L, evalRequest);
            assertThat(resolved.status()).isEqualTo(IncidentStatus.RESOLVED);
        }
    }

    // Dual-Write & Validation Constraints
    @Nested
    @DisplayName("evaluateIncident: Dual-Write & Validation Constraints")
    class EvaluateIncidentConstraints {

        private IncidentEntity incidentWithStatus(long id, IncidentStatus status) {
            return IncidentEntity.builder()
                    .id(id)
                    .reference("INC-20260720-" + String.format("%04d", id))
                    .status(status)
                    .description("Test incident")
                    .build();
        }

        @Test
        @DisplayName("NON_RESOLVED without note → throws IllegalArgumentException")
        void nonResolvedWithoutNote_throwsException() {
            // Arrange
            IncidentEntity incident = incidentWithStatus(100L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(100L)).thenReturn(Optional.of(incident));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.NON_RESOLVED, null);

            // Act & Assert
            assertThatThrownBy(() -> incidentService.evaluateIncident(100L, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("explanatory note")
                    .hasMessageContaining("non-resolved");

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("NON_RESOLVED with blank note → throws IllegalArgumentException")
        void nonResolvedWithBlankNote_throwsException() {
            IncidentEntity incident = incidentWithStatus(101L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(101L)).thenReturn(Optional.of(incident));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.NON_RESOLVED, "   ");

            assertThatThrownBy(() -> incidentService.evaluateIncident(101L, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("explanatory note");

            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("RESOLVED without note → succeeds (note is optional)")
        void resolvedWithoutNote_succeeds() {
            IncidentEntity incident = incidentWithStatus(102L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(102L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.RESOLVED, null);

            var response = incidentService.evaluateIncident(102L, request);

            assertThat(response.status()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(response.resolutionNote()).isNull();

            // Dual-write should still save both
            verify(incidentRepository).save(any(IncidentEntity.class));
            verify(incidentHistoryRepository).save(any(IncidentHistory.class));
        }

        @Test
        @DisplayName("successful evaluation triggers dual-write: incident saved + history appended")
        void successfulEvaluation_triggersDualWrite() {
            // Arrange
            String note = "Replaced faulty TAKT on DEVANT_1.";
            IncidentEntity incident = incidentWithStatus(200L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(200L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.RESOLVED, note);

            // Act
            incidentService.evaluateIncident(200L, request);

            // Assert: Dual-write: exactly one incident save and one history save
            verify(incidentRepository, times(1)).save(incidentCaptor.capture());
            verify(incidentHistoryRepository, times(1)).save(historyCaptor.capture());

            // Incident record: status + resolutionNote updated
            IncidentEntity savedIncident = incidentCaptor.getValue();
            assertThat(savedIncident.getStatus()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(savedIncident.getResolutionNote()).isEqualTo(note);
            assertThat(savedIncident.getResolvedAt()).isNotNull();

            // History record: mirrors the note in the comment
            IncidentHistory savedHistory = historyCaptor.getValue();
            assertThat(savedHistory.getPreviousStatus()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(savedHistory.getCurrentStatus()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(savedHistory.getComment()).contains(note);

            // Event published exactly once
            verify(eventPublisher, times(1)).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().newStatus()).isEqualTo(IncidentStatus.RESOLVED);
        }

        @Test
        @DisplayName("successful NON_RESOLVED evaluation with note preserves full comment")
        void nonResolvedEvaluation_preservesFullComment() {
            // Arrange
            String note = "Intermittent issue, could not reproduce — will monitor.";
            UserEntity admin = UserEntity.builder()
                    .id(20L)
                    .matricule(9002)
                    .firstName("Bob")
                    .lastName("Tech")
                    .role(UserRole.ADMIN)
                    .build();

            when(userRepository.findByMatricule(9002)).thenReturn(Optional.of(admin));

            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            "9002", "pass",
                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                    ));

            IncidentEntity incident = incidentWithStatus(201L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(201L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.NON_RESOLVED, note);

            // Act
            incidentService.evaluateIncident(201L, request);

            // Assert: verify the comment structure
            verify(incidentHistoryRepository).save(historyCaptor.capture());
            IncidentHistory history = historyCaptor.getValue();
            assertThat(history.getComment())
                    .isEqualTo(note + " (Evaluated by " + admin.getAuditLabel() + ")");
        }

        @Test
        @DisplayName("evaluateIncident with authenticated actor publishes event with actorUserId")
        void evaluateIncident_withAdmin_publishesEventWithActorId() {
            // Arrange
            UserEntity admin = UserEntity.builder()
                    .id(30L)
                    .matricule(9003)
                    .firstName("Carol")
                    .lastName("Evaluator")
                    .role(UserRole.ADMIN)
                    .build();

            when(userRepository.findByMatricule(9003)).thenReturn(Optional.of(admin));

            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            "9003", "pass",
                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                    ));

            IncidentEntity incident = incidentWithStatus(202L, IncidentStatus.IN_PROGRESS);
            when(incidentRepository.findById(202L)).thenReturn(Optional.of(incident));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            EvaluateIncidentRequest request = new EvaluateIncidentRequest(
                    IncidentStatus.RESOLVED, "Fixed the alignment issue.");

            // Act
            incidentService.evaluateIncident(202L, request);

            // Assert
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            IncidentTransitionEvent event = eventCaptor.getValue();
            assertThat(event.actorUserId()).isEqualTo(30L);
        }
    }
}
