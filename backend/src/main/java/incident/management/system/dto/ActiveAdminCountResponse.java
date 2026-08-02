package incident.management.system.dto;

/**
 * Lightweight response for {@code GET /api/users/active-admin-count} — feeds
 * the last-active-admin guard on the admin surface.
 */
public record ActiveAdminCountResponse(long activeAdminCount) {}
