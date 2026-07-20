package incident.management.system.listener;

import incident.management.system.event.IncidentTransitionEvent;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.NotificationEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.NotificationRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.service.IncidentRecipientResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;


// Listens for IncidentTransitionEvent events published after incident status transitions
// Creates notification rows for each resolved recipient.
@Component
@RequiredArgsConstructor
@Slf4j
public class IncidentNotificationListener {

    private final IncidentRecipientResolver recipientResolver;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final IncidentRepository incidentRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional
    public void onIncidentTransition(IncidentTransitionEvent event) {
        // Reload the incident within this transaction so lazy associations are available
        IncidentEntity incident = incidentRepository.findById(event.incident().getId()).orElse(null);
        if (incident == null) {
            log.warn("Incident {} not found for notification processing, skipping..",
                    event.incident().getId());
            return;
        }

        String transitionLabel = event.previousStatus() + " → " + event.newStatus();
        log.debug("Processing notification for incident {} ({})",
                incident.getReference(), transitionLabel);

        // Resolve the actor (may be null for scheduler-triggered transitions)
        UserEntity actor = null;
        if (event.actorUserId() != null) {
            actor = userRepository.findById(event.actorUserId()).orElse(null);
        }

        // Resolve recipients per transition rules
        List<UserEntity> recipients = recipientResolver.resolveRecipients(
                incident, event.newStatus(), actor);

        if (recipients.isEmpty()) {
            log.debug("No recipients for incident {} ({}) — skipping notification",
                    incident.getReference(), transitionLabel);
            return;
        }

        // Build the notification message (reuse the already-resolved actor)
        String message = buildMessage(event, incident, actor);

        // Persist one notification row per recipient
        for (UserEntity recipient : recipients) {
            NotificationEntity notification = NotificationEntity.builder()
                    .incident(incident)
                    .recipient(recipient)
                    .message(message)
                    .isRead(false)
                    .type("STATUS_CHANGE")
                    .build();
            notificationRepository.save(notification);
        }

        log.info("Created {} notification(s) for incident {} ({})",
                recipients.size(), incident.getReference(), transitionLabel);
    }


    // Builds a human-readable notification message for the transition using the audit-label format (FirstName_LastName_Matricule) when an actor is involved.
    private String buildMessage(IncidentTransitionEvent event, IncidentEntity incident, UserEntity actor) {
        String actorPart;
        if (actor != null) {
            actorPart = " by " + actor.getAuditLabel();
        } else {
            actorPart = " automatically by the system";
        }

        return String.format(
                "Incident %s transitioned from %s to %s%s.",
                incident.getReference(),
                event.previousStatus(),
                event.newStatus(),
                actorPart
        );
    }
}
