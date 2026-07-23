package incident.management.system.security;

import incident.management.system.model.UserEntity;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String matricule) throws UsernameNotFoundException {
        int matriculeInt;
        try {
            matriculeInt = Integer.parseInt(matricule);
        } catch (NumberFormatException e) {
            throw new UsernameNotFoundException("Invalid matricule format: " + matricule);
        }

        UserEntity userEntity = userRepository.findByMatricule(matriculeInt)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with matricule: " + matriculeInt));

        if (!userEntity.isActive()) {
            throw new UsernameNotFoundException("User account is deactivated: " + matriculeInt);
        }

        if (userEntity.isLocked()) {
            throw new LockedException(
                    "Account is locked due to too many failed login attempts. Try again later.");
        }

        List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + userEntity.getRole().name()));

        return User.builder()
                .username(String.valueOf(userEntity.getMatricule()))
                .password(userEntity.getPasswordHash())
                .disabled(false)
                .accountLocked(userEntity.isLocked())
                .authorities(authorities)
                .build();
    }
}
