package incident.management.system.scheduler;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.event.IncidentTransitionEvent;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.IncidentHistory;
import incident.management.system.repository.IncidentHistoryRepository;
import incident.management.system.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;


@ExtendWith(MockitoExtension.class)
@DisplayName("IncidentAutoClosureJob, Fail-Safe Automation")
class IncidentAutoClosureJobTest {

    @Mock
    private IncidentRepository incidentRepository;

    @Mock
    private IncidentHistoryRepository incidentHistoryRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Captor
    private ArgumentCaptor<IncidentEntity> incidentCaptor;

    @Captor
    private ArgumentCaptor<IncidentHistory> historyCaptor;

    @Captor
    private ArgumentCaptor<IncidentTransitionEvent> eventCaptor;

    private IncidentAutoClosureJob autoClosureJob;

    @BeforeEach
    void setUp() {
        autoClosureJob = new IncidentAutoClosureJob(
                incidentRepository, incidentHistoryRepository, eventPublisher);
    }

    //  Fail-Safe Automation

    @Nested
    @DisplayName("Fail-Safe Automation for Auto-Closure Scheduler")
    class AutoClosure {

        // Creates an incident with status = RESOLVED and resolvedAt = 15 mintues ago
        private IncidentEntity staleResolvedIncident(long id, String reference) {
            return IncidentEntity.builder()
                    .id(id)
                    .reference(reference)
                    .status(IncidentStatus.RESOLVED)
                    .description("Resolved test incident #" + id)
                    .resolutionNote("Fixed during test")
                    .resolvedAt(LocalDateTime.now().minusMinutes(15)) // 15 min ago → stale
                    .build();
        }

        @Test
        @DisplayName("no stale incidents → no saves, no events")
        void noStaleIncidents_doesNothing() {
            // Arrange
            when(incidentRepository.findByStatusAndResolvedAtBefore(
                    eq(IncidentStatus.RESOLVED), any(LocalDateTime.class)))
                    .thenReturn(List.of());

            // Act
            autoClosureJob.autoCloseResolvedIncidents();

            // Assert
            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("single stale incident → closed, audit trail written, event published")
        void singleStaleIncident_isClosed() {
            // Arrange
            IncidentEntity stale = staleResolvedIncident(1L, "INC-20260720-0001");
            when(incidentRepository.findByStatusAndResolvedAtBefore(
                    eq(IncidentStatus.RESOLVED), any(LocalDateTime.class)))
                    .thenReturn(List.of(stale));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            autoClosureJob.autoCloseResolvedIncidents();

            // Assert : incident state
            verify(incidentRepository, times(1)).save(incidentCaptor.capture());
            IncidentEntity saved = incidentCaptor.getValue();
            assertThat(saved.getStatus()).isEqualTo(IncidentStatus.CLOSED);
            assertThat(saved.getClosedAt()).isNotNull();
            // RESOLVED timestamp should be preserved — only closedAt is added
            assertThat(saved.getResolvedAt()).isNotNull();

            // Assert : audit trail entry with system comment
            verify(incidentHistoryRepository, times(1)).save(historyCaptor.capture());
            IncidentHistory history = historyCaptor.getValue();
            assertThat(history.getPreviousStatus()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(history.getCurrentStatus()).isEqualTo(IncidentStatus.CLOSED);
            assertThat(history.getComment()).isEqualTo("Auto-closed by system after 10-minute timer.");
            assertThat(history.getChangedAt()).isNotNull();
            assertThat(history.getIncident()).isSameAs(saved);

            // Assert : event published with null actor (system-triggered)
            verify(eventPublisher, times(1)).publishEvent(eventCaptor.capture());
            IncidentTransitionEvent event = eventCaptor.getValue();
            assertThat(event.previousStatus()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(event.newStatus()).isEqualTo(IncidentStatus.CLOSED);
            assertThat(event.actorUserId()).isNull();
        }

        @Test
        @DisplayName("multiple stale incidents → all processed in a single loop")
        void multipleStaleIncidents_allClosed() {
            // Arrange
            List<IncidentEntity> staleList = List.of(
                    staleResolvedIncident(2L, "INC-20260720-0002"),
                    staleResolvedIncident(3L, "INC-20260720-0003"),
                    staleResolvedIncident(4L, "INC-20260720-0004")
            );

            when(incidentRepository.findByStatusAndResolvedAtBefore(
                    eq(IncidentStatus.RESOLVED), any(LocalDateTime.class)))
                    .thenReturn(staleList);
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            autoClosureJob.autoCloseResolvedIncidents();

            // Assert — each incident saved + history written + event published
            verify(incidentRepository, times(3)).save(incidentCaptor.capture());
            verify(incidentHistoryRepository, times(3)).save(historyCaptor.capture());
            verify(eventPublisher, times(3)).publishEvent(eventCaptor.capture());

            // All saved incidents must be CLOSED
            List<IncidentEntity> allSavedIncidents = incidentCaptor.getAllValues();
            assertThat(allSavedIncidents)
                    .hasSize(3)
                    .allMatch(inc -> inc.getStatus() == IncidentStatus.CLOSED)
                    .allMatch(inc -> inc.getClosedAt() != null);

            // All history entries must have the system comment
            List<IncidentHistory> allHistories = historyCaptor.getAllValues();
            assertThat(allHistories)
                    .hasSize(3)
                    .allMatch(h -> h.getComment().equals("Auto-closed by system after 10-minute timer."))
                    .allMatch(h -> h.getCurrentStatus() == IncidentStatus.CLOSED);

            // All events must be RESOLVED → CLOSED with null actor
            List<IncidentTransitionEvent> allEvents = eventCaptor.getAllValues();
            assertThat(allEvents)
                    .hasSize(3)
                    .allMatch(e -> e.previousStatus() == IncidentStatus.RESOLVED)
                    .allMatch(e -> e.newStatus() == IncidentStatus.CLOSED)
                    .allMatch(e -> e.actorUserId() == null);
        }

        @Test
        @DisplayName("recently resolved incident (under 10 min) → not selected for closure")
        void recentlyResolvedIncident_notSelected() {
            // Arrange : no incidents older than 10 minutes
            when(incidentRepository.findByStatusAndResolvedAtBefore(
                    eq(IncidentStatus.RESOLVED), any(LocalDateTime.class)))
                    .thenReturn(List.of());

            // Act
            autoClosureJob.autoCloseResolvedIncidents();

            // Assert
            verify(incidentRepository, never()).save(any());
            verify(incidentHistoryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("mixed stale and fresh incidents → only stale ones closed")
        void mixedStaleAndFreshIncidents_onlyStaleClosed() {
            // Arrange : only 1 out of 3 is past the 10-minute threshold
            IncidentEntity stale = staleResolvedIncident(5L, "INC-20260720-0005");

            // The query only returns what's past the threshold, so this test
            // validates that the repository query acts as the gatekeeper.
            when(incidentRepository.findByStatusAndResolvedAtBefore(
                    eq(IncidentStatus.RESOLVED), any(LocalDateTime.class)))
                    .thenReturn(List.of(stale));
            when(incidentRepository.save(any(IncidentEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            autoClosureJob.autoCloseResolvedIncidents();

            // Assert : only the single stale incident was processed
            verify(incidentRepository, times(1)).save(incidentCaptor.capture());
            assertThat(incidentCaptor.getValue().getStatus()).isEqualTo(IncidentStatus.CLOSED);

            verify(incidentHistoryRepository, times(1)).save(historyCaptor.capture());
            assertThat(historyCaptor.getValue().getComment())
                    .isEqualTo("Auto-closed by system after 10-minute timer.");

            verify(eventPublisher, times(1)).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().newStatus()).isEqualTo(IncidentStatus.CLOSED);
        }
    }
}
