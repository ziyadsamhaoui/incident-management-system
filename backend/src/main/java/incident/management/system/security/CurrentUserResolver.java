package incident.management.system.security;

import incident.management.system.model.UserEntity;
import incident.management.system.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Resolves the currently authenticated {@link UserEntity} from the
 * {@link SecurityContextHolder}.
 * <p>
 * The authenticated principal is the user's matricule as a string (see
 * {@code MultiChannelAuthenticationToken}), so it is parsed back to an int and
 * looked up via {@link UserRepository#findByMatricule(int)}.
 */
public final class CurrentUserResolver {

    private CurrentUserResolver() {
        // utility class
    }

    /**
     * @return the authenticated user, or {@code null} when no authentication is
     *         available (e.g. scheduler-triggered flows) or the principal is
     *         not a valid matricule.
     */
    public static UserEntity resolve(UserRepository userRepository) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String principal = authentication.getName(); // matricule as string
        try {
            int matricule = Integer.parseInt(principal);
            return userRepository.findByMatricule(matricule).orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
