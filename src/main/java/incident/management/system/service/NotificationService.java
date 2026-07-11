package incident.management.system.service;

import incident.management.system.dto.NotificationResponse;
import incident.management.system.model.IncidentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NotificationService {

    void notifyStatusChange(IncidentEntity incident, String message);

    void markAsRead(Long notificationId);

    Page<NotificationResponse> getUnreadNotificationsForUser(Long userId, Pageable pageable);
}

//