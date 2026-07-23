package incident.management.system.security;

import incident.management.system.enums.UserRole;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;


@Component
@RequiredArgsConstructor
@Slf4j
public class MultiChannelAuthenticationProvider implements AuthenticationProvider {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        MultiChannelAuthenticationToken token = (MultiChannelAuthenticationToken) authentication;

        return switch (token.getLane()) {
            case SOUS_CHEF -> authenticateSousChef(token);
            case CHEF_ATELIER -> authenticateChefAtelier(token);
            case ADMIN -> authenticateAdmin(token);
        };
    }

    // SOUS_CHEF (Matricule only, No password)

    private Authentication authenticateSousChef(MultiChannelAuthenticationToken token) {
        int matricule = parseMatricule((String) token.getPrincipal());
        UserEntity user = findActiveUserByMatricule(matricule);

        // Identity text verification
        if (!matchesIdentity(user, token.getFirstName(), token.getLastName())) {
            log.warn("SOUS_CHEF identity mismatch for matricule: {}", matricule);
            throw new BadCredentialsException("Invalid credentials");
        }

        // Strict role enforcement
        if (user.getRole() != UserRole.SOUS_CHEF) {
            log.warn("Role mismatch for SOUS_CHEF lane, user {} has role {}", matricule, user.getRole());
            throw new BadCredentialsException("Invalid credentials");
        }

        log.info("SOUS_CHEF authenticated via identity match — matricule: {}", matricule);
        return new MultiChannelAuthenticationToken(user);
    }

    // CHEF_ATELIER (Matricule + Password)

    private Authentication authenticateChefAtelier(MultiChannelAuthenticationToken token) {
        int matricule = parseMatricule((String) token.getPrincipal());
        UserEntity user = findActiveUserByMatricule(matricule);

        // Identity text verification
        if (!matchesIdentity(user, token.getFirstName(), token.getLastName())) {
            log.warn("CHEF_ATELIER identity mismatch for matricule: {}", matricule);
            throw new BadCredentialsException("Invalid credentials");
        }

        // BCrypt password verification
        String rawPassword = (String) token.getCredentials();
        if (rawPassword == null || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            log.warn("CHEF_ATELIER password mismatch for matricule: {}", matricule);
            throw new BadCredentialsException("Invalid credentials");
        }

        log.info("CHEF_ATELIER authenticated — matricule: {}", matricule);
        return new MultiChannelAuthenticationToken(user);
    }

    // ADMIN (Email + Password Mode)

    private Authentication authenticateAdmin(MultiChannelAuthenticationToken token) {
        String email = (String) token.getPrincipal();
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    log.warn("ADMIN login — no user found for email: {}", email);
                    return new BadCredentialsException("Invalid credentials");
                });

        checkActive(user);
        checkLocked(user);

        // BCrypt password verification
        String rawPassword = (String) token.getCredentials();
        if (rawPassword == null || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            log.warn("ADMIN password mismatch for email: {}", email);
            throw new BadCredentialsException("Invalid credentials");
        }

        log.info("ADMIN authenticated — email: {}", email);
        return new MultiChannelAuthenticationToken(user);
    }

    //  Helpers

    private int parseMatricule(String principal) {
        try {
            return Integer.parseInt(principal);
        } catch (NumberFormatException e) {
            throw new BadCredentialsException("Invalid matricule format");
        }
    }

    private UserEntity findActiveUserByMatricule(int matricule) {
        UserEntity user = userRepository.findByMatricule(matricule)
                .orElseThrow(() -> {
                    log.warn("No user found for matricule: {}", matricule);
                    return new BadCredentialsException("Invalid credentials");
                });
        checkActive(user);
        checkLocked(user);
        return user;
    }

    private void checkActive(UserEntity user) {
        if (!user.isActive()) {
            throw new BadCredentialsException("Account is deactivated");
        }
    }

    private void checkLocked(UserEntity user) {
        if (user.isLocked()) {
            log.warn("Locked account login attempt for matricule: {}", user.getMatricule());
            throw new LockedException("Account is locked due to too many failed login attempts. Try again later.");
        }
    }

    private boolean matchesIdentity(UserEntity user, String firstName, String lastName) {
        return user.getFirstName().equals(firstName) && user.getLastName().equals(lastName);
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return MultiChannelAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
