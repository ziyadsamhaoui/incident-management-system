package incident.management.system.scheduler;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.event.IncidentTransitionEvent;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.IncidentHistory;
import incident.management.system.repository.IncidentHistoryRepository;
import incident.management.system.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Fail-safe scheduled job that automatically closes incidents stuck in
 * {@link IncidentStatus#RESOLVED} for more than 10 minutes.
 * <p>
 * This complements the client-side 10-minute auto-close timer. If the
 * client fails to trigger the close for any reason, this background
 * scheduler ensures incidents are still eventually closed.
 * <p>
 * Runs every 2 minutes to minimise the window between resolution and
 * automatic closure.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IncidentAutoClosureJob {

    private final IncidentRepository incidentRepository;
    private final IncidentHistoryRepository incidentHistoryRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Runs every 120 000 milliseconds (2 minutes).
     * Queries for any incident in RESOLVED status whose resolvedAt
     * timestamp is older than 10 minutes and transitions them to CLOSED.
     * Publishes an {@link IncidentTransitionEvent} for each closure so
     * that the {@code resolvedBy} admin receives a notification.
     */
    @Scheduled(fixedRate = 120_000)
    @Transactional
    public void autoCloseResolvedIncidents() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(10);
        List<IncidentEntity> staleResolved = incidentRepository
                .findByStatusAndResolvedAtBefore(IncidentStatus.RESOLVED, threshold);

        if (staleResolved.isEmpty()) {
            return;
        }

        log.info("Auto-closing {} incident(s) that have been RESOLVED for more than 10 minutes.",
                staleResolved.size());

        for (IncidentEntity incident : staleResolved) {
            IncidentStatus previousStatus = incident.getStatus();
            incident.setStatus(IncidentStatus.CLOSED);
            incident.setClosedAt(LocalDateTime.now());
            incidentRepository.save(incident);

            // Archive the automatic closure in the audit trail
            IncidentHistory history = IncidentHistory.builder()
                    .incident(incident)
                    .previousStatus(previousStatus)
                    .currentStatus(IncidentStatus.CLOSED)
                    .changedAt(LocalDateTime.now())
                    .comment("Auto-closed by system after 10-minute timer.")
                    .build();
            incidentHistoryRepository.save(history);

            // Publish event so the resolvedBy admin gets notified
            eventPublisher.publishEvent(new IncidentTransitionEvent(
                    incident, previousStatus, IncidentStatus.CLOSED, null));

            log.debug("Auto-closed incident: {}", incident.getReference());
        }
    }
}
