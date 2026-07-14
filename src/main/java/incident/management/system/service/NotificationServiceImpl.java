package incident.management.system.service;

import incident.management.system.dto.NotificationResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.NotificationEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.NotificationRepository;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Override
    public void markAsRead(Long notificationId) {
        NotificationEntity notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", notificationId));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getUnreadNotificationsForUser(Long userId, Pageable pageable) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return notificationRepository.findByRecipientAndIsReadFalse(user, pageable)
                .map(this::toResponse);
    }

    private NotificationResponse toResponse(NotificationEntity entity) {
        return new NotificationResponse(
                entity.getId(),
                entity.getIncident() != null ? entity.getIncident().getId() : null,
                entity.getIncident() != null ? entity.getIncident().getReference() : null,
                entity.getMessage(),
                entity.isRead(),
                entity.getType(),
                entity.getCreatedAt()
        );
    }
}
