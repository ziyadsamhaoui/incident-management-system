package incident.management.system.service;

import incident.management.system.enums.UserRole;
import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import org.springframework.http.HttpStatus;

/**
 * Single source of truth for the media-pipeline access rules, shared by
 * {@link IncidentAttachmentService} (upload / list) and
 * {@link incident.management.system.config.MediaFileResourceResolver}
 * (byte serving) so the two enforcement points can never drift.
 * <p>
 * Rules mirror the incident-list scoping: ADMIN everything; CHEF_ATELIER
 * department-scoped; SOUS_CHEF own declared incidents. Deactivated accounts
 * are rejected regardless of role (a deactivated user with an unexpired JWT
 * must not keep fetching media).
 */
public final class MediaAccessPolicy {

    private MediaAccessPolicy() {
    }

    public static void assertCanAccess(IncidentEntity incident, UserEntity user) {
        if (user == null) {
            throw new AttachmentPolicyException(HttpStatus.UNAUTHORIZED, "Authentification requise.");
        }
        if (!user.isActive()) {
            throw new AttachmentPolicyException(HttpStatus.FORBIDDEN,
                    "Compte désactivé — accès aux médias refusé.");
        }
        if (user.getRole() == UserRole.ADMIN) {
            return;
        }
        if (user.getRole() == UserRole.CHEF_ATELIER) {
            boolean sameDepartment = incident.getDepartment() != null
                    && user.getDepartment() != null
                    && incident.getDepartment().getId().equals(user.getDepartment().getId());
            if (!sameDepartment) {
                throw new AttachmentPolicyException(HttpStatus.FORBIDDEN,
                        "Accès refusé — incident hors de votre département.");
            }
            return;
        }
        boolean own = incident.getUser() != null
                && incident.getUser().getId().equals(user.getId());
        if (!own) {
            throw new AttachmentPolicyException(HttpStatus.FORBIDDEN,
                    "Accès refusé — vous ne pouvez consulter que vos propres incidents.");
        }
    }
}
