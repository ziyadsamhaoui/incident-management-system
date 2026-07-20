package incident.management.system.service;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.model.AdminDepartmentSubscription;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.AdminDepartmentSubscriptionRepository;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;


// Resolves the set of recipients who should receive a notification for a given incident status transition.
@Component
@RequiredArgsConstructor
public class IncidentRecipientResolver {

    private final UserRepository userRepository;
    private final AdminDepartmentSubscriptionRepository subscriptionRepository;

    // Returns the list of users who should receive a notification.
    public List<UserEntity> resolveRecipients(IncidentEntity incident,
                                              IncidentStatus newStatus,
                                              UserEntity actor) {
        // No notifications for incidents in progress
        if (newStatus == IncidentStatus.IN_PROGRESS) {
            return Collections.emptyList();
        }

        // RESOLVED → CLOSED via 10m auto-closure scheduler
        // Notify the admin who resolved the incident only.
        if (newStatus == IncidentStatus.CLOSED && actor == null) {
            UserEntity resolvedBy = incident.getResolvedBy();
            if (resolvedBy != null) {
                return List.of(resolvedBy);
            }
            return Collections.emptyList();
        }

        // IN_PROGRESS → RESOLVED/NON_RESOLVED:
        // Notify CHEF_ATELIER of the department only.
        if (newStatus == IncidentStatus.RESOLVED || newStatus == IncidentStatus.NON_RESOLVED) {
            return findChefAtelier(incident);
        }

        // → DECLARED
        // Notify all department watchers, including the user who declared the incident.
        if (newStatus == IncidentStatus.DECLARED) {
            return getDepartmentWatchers(incident);
        }

        // DECLARED → CLAIMED
        // Notify all department watchers, except the admin who claimed the incident
        List<UserEntity> watchers = getDepartmentWatchers(incident);

        if (actor != null) {
            watchers.removeIf(u -> u.getId().equals(actor.getId()));
        }

        return watchers;
    }

    // Returns the list of users who should receive a notification for a declared incident in a department.
    public List<UserEntity> getDepartmentWatchers(IncidentEntity incident) {
        if (incident.getDepartment() == null) {
            return Collections.emptyList();
        }

        // Use a LinkedHashSet to deduplicate if a user is both a CHEF_ATELIER and an ADMIN.
        Set<UserEntity> watchers = new LinkedHashSet<>();

        // CHEF_ATELIER of the department
        watchers.addAll(findChefAtelier(incident));

        // ADMIN subscribed to the department
        List<AdminDepartmentSubscription> subscriptions =
                subscriptionRepository.findByDepartment(incident.getDepartment());
        for (AdminDepartmentSubscription sub : subscriptions) {
            watchers.add(sub.getAdmin());
        }

        return new ArrayList<>(watchers);
    }

    // Finds the CHEF_ATELIER of a department.
    private List<UserEntity> findChefAtelier(IncidentEntity incident) {
        if (incident.getDepartment() == null) {
            return Collections.emptyList();
        }
        List<UserEntity> chefs = userRepository.findByDepartmentAndRole(
                incident.getDepartment(), UserRole.CHEF_ATELIER);
        return chefs != null ? chefs : Collections.emptyList();
    }
}
