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

/**
 * Resolves the set of recipients who should receive a notification for a given
 * incident status transition, per the business rules defined in the
 * notification design.
 * <p>
 * The only things that vary per transition are:
 * <ul>
 *   <li>Which subset of the "department watchers" pool is included</li>
 *   <li>Who, if anyone, is excluded from that pool</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class IncidentRecipientResolver {

    private final UserRepository userRepository;
    private final AdminDepartmentSubscriptionRepository subscriptionRepository;

    // Returns the list of users who should receive a notification.
    public List<UserEntity> resolveRecipients(IncidentEntity incident,
                                              IncidentStatus newStatus,
                                              UserEntity actor) {
        // No notifications
        if (newStatus == IncidentStatus.IN_PROGRESS) {
            return Collections.emptyList();
        }

        // Auto-closure (RESOLVED → CLOSED via scheduler)
        // Only notify the admin who resolved the incident
        if (newStatus == IncidentStatus.CLOSED && actor == null) {
            UserEntity resolvedBy = incident.getResolvedBy();
            if (resolvedBy != null) {
                return List.of(resolvedBy);
            }
            return Collections.emptyList();
        }

        // RESOLVED / NON_RESOLVED (IN_PROGRESS → RESOLVED/NON_RESOLVED):
        // only the CHEF_ATELIER of the department
        if (newStatus == IncidentStatus.RESOLVED || newStatus == IncidentStatus.NON_RESOLVED) {
            return findChefAtelier(incident);
        }

        // DECLARED (→ DECLARED): all department watchers, declarant as well
        if (newStatus == IncidentStatus.DECLARED) {
            return getDepartmentWatchers(incident);
        }

        // CLAIMED (DECLARED → CLAIMED): department watchers minus claiming admin
        // CLOSED manually (RESOLVED → CLOSED): department watchers
        // (Note: manual close endpoint is being retired, but the rule is defined here for completeness)
        List<UserEntity> watchers = getDepartmentWatchers(incident);

        if (actor != null) {
            watchers.removeIf(u -> u.getId().equals(actor.getId()));
        }

        return watchers;
    }

    /**
     * Returns all "department watchers" for the given incident:
     * <ul>
     *   <li>The {@code CHEF_ATELIER} belonging to the incident's department</li>
     *   <li>All {@code ADMIN}s subscribed to the incident's department</li>
     * </ul>
     */
    public List<UserEntity> getDepartmentWatchers(IncidentEntity incident) {
        if (incident.getDepartment() == null) {
            return Collections.emptyList();
        }

        // Use a LinkedHashSet to deduplicate in the rare case that a user
        // could appear in both the CHEF_ATELIER and ADMIN subscriber lists
        Set<UserEntity> watchers = new LinkedHashSet<>();

        // CHEF_ATELIER of the department
        watchers.addAll(findChefAtelier(incident));

        // ADMINS subscribed to the department
        List<AdminDepartmentSubscription> subscriptions =
                subscriptionRepository.findByDepartment(incident.getDepartment());
        for (AdminDepartmentSubscription sub : subscriptions) {
            watchers.add(sub.getAdmin());
        }

        return new ArrayList<>(watchers);
    }

    /**
     * Finds the {@code CHEF_ATELIER} user(s) belonging to the incident's
     * department. Returns an empty list if the department has no chef assigned.
     */
    private List<UserEntity> findChefAtelier(IncidentEntity incident) {
        if (incident.getDepartment() == null) {
            return Collections.emptyList();
        }
        List<UserEntity> chefs = userRepository.findByDepartmentAndRole(
                incident.getDepartment(), UserRole.CHEF_ATELIER);
        return chefs != null ? chefs : Collections.emptyList();
    }
}
