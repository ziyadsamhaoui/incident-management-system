package incident.management.system.security;

import incident.management.system.enums.UserRole;
import incident.management.system.model.UserEntity;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;

/**
 * Custom {@link org.springframework.security.core.Authentication} token that
 * carries the multi-channel lane information alongside the credentials and
 * identity fields needed to authenticate each operational lane.
 */
public class MultiChannelAuthenticationToken extends AbstractAuthenticationToken {

    private final String principal;       // matricule (SOUS_CHEF/CHEF_ATELIER) or email (ADMIN)
    private final String credentials;     // password (null for SOUS_CHEF)
    private final UserRole lane;          // the operational channel
    private final String firstName;       // used for SOUS_CHEF / CHEF_ATELIER identity verification
    private final String lastName;        // used for SOUS_CHEF / CHEF_ATELIER identity verification

    private UserEntity authenticatedUser; // populated post-authentication

    /**
     * Pre-authentication constructor — carries the raw request fields.
     * The token is not yet authenticated.
     */
    public MultiChannelAuthenticationToken(String principal, String credentials,
                                           UserRole lane, String firstName, String lastName) {
        super((Collection<? extends GrantedAuthority>) null);
        this.principal = principal;
        this.credentials = credentials;
        this.lane = lane;
        this.firstName = firstName;
        this.lastName = lastName;
        setAuthenticated(false);
    }

    /**
     * Post-authentication constructor — builds an authenticated token with
     * granted authorities from the persistent {@link UserEntity}.
     */
    public MultiChannelAuthenticationToken(UserEntity user) {
        super(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        this.principal = String.valueOf(user.getMatricule());
        this.credentials = null;
        this.lane = user.getRole();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.authenticatedUser = user;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return credentials;
    }

    @Override
    public Object getPrincipal() {
        return principal;
    }

    public UserRole getLane() {
        return lane;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public UserEntity getAuthenticatedUser() {
        return authenticatedUser;
    }
}
