package incident.management.system.dto;

/**
 * Unified multi-channel login request supporting all three operational lanes.
 * <p>
 * <b>Lane 1 — SOUS_CHEF:</b> {@code matricule}, {@code firstName}, {@code lastName}<br>
 * <b>Lane 2 — CHEF_ATELIER:</b> {@code matricule}, {@code firstName}, {@code lastName}, {@code password}<br>
 * <b>Lane 3 — ADMIN:</b> {@code email}, {@code password}
 * <p>
 * All fields are nullable; the authentication provider inspects which combination
 * is present to determine the active lane.
 */
public record LoginRequest(
        String matricule,
        String email,
        String password,
        String firstName,
        String lastName
) {}
