package incident.management.system.service;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.UserActivityResponse;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.model.AuditLogEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.AdminDepartmentSubscriptionRepository;
import incident.management.system.repository.AuditLogRepository;
import incident.management.system.repository.DepartmentRepository;
import incident.management.system.repository.IncidentRepository;
import incident.management.system.repository.PasswordResetTokenRepository;
import incident.management.system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Danger-zone role transitions and hard safety guards in isolation (no Spring context, no database)
@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl: Role Transitions & Safety Guards")
class UserServiceImplTest {

    //  Mocks
    @Mock private UserRepository userRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private IncidentRepository incidentRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AdminDepartmentSubscriptionRepository subscriptionRepository;

    //  System under test
    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl(
                userRepository, departmentRepository, incidentRepository,
                passwordResetTokenRepository, auditLogRepository,
                passwordEncoder, subscriptionRepository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserEntity user(long id, UserRole role, boolean active, String passwordHash) {
        return UserEntity.builder()
                .id(id)
                .firstName("First_" + id)
                .lastName("Last_" + id)
                .matricule((int) (1000 + id))
                .isActive(active)
                .role(role)
                .passwordHash(passwordHash)
                .build();
    }

    private void authenticateAs(long matricule) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        String.valueOf(matricule), "pass",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    //  ========================================================================
    //  demoteToSousChef — Rétrograder en Opérateur
    //  ========================================================================

    @Nested
    @DisplayName("demoteToSousChef (CHEF_ATELIER → SOUS_CHEF)")
    class DemoteTest {

        @Test
        @DisplayName("claimed CHEF_ATELIER → SOUS_CHEF with reset password and cleared department")
        void demotesClaimedChefAtelier() {
            UserEntity chef = user(1L, UserRole.CHEF_ATELIER, true, "{bcrypt}$2a$10$claimed");
            when(userRepository.findById(1L)).thenReturn(Optional.of(chef));
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.demoteToSousChef(1L);

            assertThat(response.role()).isEqualTo(UserRole.SOUS_CHEF);
            assertThat(response.claimed()).isFalse();
            assertThat(response.department()).isNull();
            // The saved entity carries the unclaimed sentinel
            assertThat(chef.getPasswordHash()).isEmpty();
        }

        @Test
        @DisplayName("rejects demotion of a non-CHEF_ATELIER account")
        void rejectsNonChefAtelier() {
            when(userRepository.findById(2L))
                    .thenReturn(Optional.of(user(2L, UserRole.SOUS_CHEF, true, "{bcrypt}hash")));

            assertThatThrownBy(() -> userService.demoteToSousChef(2L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Chef d'atelier");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("rejects demotion of an ADMIN")
        void rejectsAdmin() {
            when(userRepository.findById(3L))
                    .thenReturn(Optional.of(user(3L, UserRole.ADMIN, true, "{bcrypt}hash")));

            assertThatThrownBy(() -> userService.demoteToSousChef(3L))
                    .isInstanceOf(IllegalArgumentException.class);

            verify(userRepository, never()).save(any());
        }
    }

    //  ========================================================================
    //  cancelPromotion — Annuler la promotion
    //  ========================================================================

    @Nested
    @DisplayName("cancelPromotion (unclaimed CHEF_ATELIER → SOUS_CHEF)")
    class CancelPromotionTest {

        @Test
        @DisplayName("unclaimed CHEF_ATELIER → SOUS_CHEF, clears tokens, reactivates")
        void cancelsPendingPromotion() {
            UserEntity chef = user(4L, UserRole.CHEF_ATELIER, true, ""); // unclaimed sentinel
            when(userRepository.findById(4L)).thenReturn(Optional.of(chef));
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.cancelPromotion(4L);

            assertThat(response.role()).isEqualTo(UserRole.SOUS_CHEF);
            assertThat(response.isActive()).isTrue();
            verify(passwordResetTokenRepository).deleteByUserIdAndUsedFalse(4L);
        }

        @Test
        @DisplayName("rejects cancellation of an already-claimed CHEF_ATELIER")
        void rejectsClaimedChefAtelier() {
            UserEntity chef = user(5L, UserRole.CHEF_ATELIER, true, "{bcrypt}claimed");
            when(userRepository.findById(5L)).thenReturn(Optional.of(chef));

            assertThatThrownBy(() -> userService.cancelPromotion(5L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("attente de réclamation");

            verify(userRepository, never()).save(any());
            verify(passwordResetTokenRepository, never()).deleteByUserIdAndUsedFalse(any());
        }

        @Test
        @DisplayName("rejects cancellation for a non-CHEF_ATELIER")
        void rejectsNonChefAtelier() {
            when(userRepository.findById(6L))
                    .thenReturn(Optional.of(user(6L, UserRole.SOUS_CHEF, true, "")));

            assertThatThrownBy(() -> userService.cancelPromotion(6L))
                    .isInstanceOf(IllegalArgumentException.class);

            verify(userRepository, never()).save(any());
        }
    }

    //  ========================================================================
    //  Hard guards — deactivateUser
    //  ========================================================================

    @Nested
    @DisplayName("deactivateUser hard safety guards")
    class DeactivateGuardsTest {

        @Test
        @DisplayName("self-deactivation is blocked for the currently logged-in admin")
        void blocksSelfDeactivation() {
            authenticateAs(9000);
            when(userRepository.findByMatricule(9000))
                    .thenReturn(Optional.of(user(9L, UserRole.ADMIN, true, "{bcrypt}h")));
            when(userRepository.findById(9L))
                    .thenReturn(Optional.of(user(9L, UserRole.ADMIN, true, "{bcrypt}h")));

            assertThatThrownBy(() -> userService.deactivateUser(9L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("votre propre compte");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("deactivating the last active admin is blocked")
        void blocksLastActiveAdmin() {
            UserEntity admin = user(10L, UserRole.ADMIN, true, "{bcrypt}h");
            when(userRepository.findById(10L)).thenReturn(Optional.of(admin));
            when(userRepository.countByRoleAndIsActive(UserRole.ADMIN, true)).thenReturn(1L);

            assertThatThrownBy(() -> userService.deactivateUser(10L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("dernier administrateur actif");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("an active admin CAN be deactivated when other active admins exist")
        void allowsDeactivationWhenOtherAdminsExist() {
            UserEntity admin = user(11L, UserRole.ADMIN, true, "{bcrypt}h");
            when(userRepository.findById(11L)).thenReturn(Optional.of(admin));
            when(userRepository.countByRoleAndIsActive(UserRole.ADMIN, true)).thenReturn(2L);
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.deactivateUser(11L);

            assertThat(response.isActive()).isFalse();
        }

        @Test
        @DisplayName("SOUS_CHEF deactivation follows the normal soft-delete path")
        void deactivatesSousChef() {
            UserEntity sousChef = user(12L, UserRole.SOUS_CHEF, true, "{bcrypt}h");
            when(userRepository.findById(12L)).thenReturn(Optional.of(sousChef));
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.deactivateUser(12L);

            assertThat(response.isActive()).isFalse();
            assertThat(sousChef.getDeletedAt()).isNotNull();
        }
    }

    //  ========================================================================
    //  getUserActivity — extended analytics payload
    //  ========================================================================

    @Nested
    @DisplayName("getUserActivity extended analytics")
    class ActivityTest {

        @Test
        @DisplayName("aggregates counts, averages and day buckets into the response")
        void aggregatesAllMetrics() {
            UserEntity user = user(20L, UserRole.SOUS_CHEF, true, "{bcrypt}h");
            when(userRepository.findById(20L)).thenReturn(Optional.of(user));
            when(incidentRepository.countByUser(user)).thenReturn(5L);
            when(incidentRepository.countByUserAndStatusIn(user, List.of(
                    IncidentStatus.DECLARED, IncidentStatus.CLAIMED, IncidentStatus.IN_PROGRESS)))
                    .thenReturn(2L);
            when(incidentRepository.countByResolvedBy(user)).thenReturn(3L);
            when(incidentRepository.countByUserAndStatusIn(
                    user, List.of(IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED)))
                    .thenReturn(1L);
            when(incidentRepository.countByClaimedBy(user)).thenReturn(4L);
            when(incidentRepository.avgTimeToClaimMinutes(20L)).thenReturn(30.5);
            when(incidentRepository.avgMttrMinutes(20L)).thenReturn(120.0);
            when(incidentRepository.countDeclaredByDay(20L))
                    .thenReturn(List.<Object[]>of(new Object[]{"2026-08-01", 2L}));
            when(incidentRepository.countResolvedByDay(20L)).thenReturn(List.of());

            UserActivityResponse response = userService.getUserActivity(20L);

            assertThat(response.declaredCount()).isEqualTo(5L);
            assertThat(response.openCount()).isEqualTo(2L);
            assertThat(response.resolvedCount()).isEqualTo(3L);
            assertThat(response.terminalCount()).isEqualTo(1L);
            assertThat(response.claimedCount()).isEqualTo(4L);
            assertThat(response.avgTimeToClaimMinutes()).isEqualTo(30.5);
            assertThat(response.avgMttrMinutes()).isEqualTo(120.0);
            assertThat(response.declaredByDay()).hasSize(1);
            assertThat(response.declaredByDay().get(0).date()).isEqualTo("2026-08-01");
            assertThat(response.declaredByDay().get(0).count()).isEqualTo(2L);
            assertThat(response.resolvedByDay()).isEmpty();
        }

        @Test
        @DisplayName("null averages are normalized to zero")
        void nullAveragesBecomeZero() {
            UserEntity user = user(21L, UserRole.ADMIN, true, "{bcrypt}h");
            when(userRepository.findById(21L)).thenReturn(Optional.of(user));
            when(incidentRepository.avgTimeToClaimMinutes(21L)).thenReturn(null);
            when(incidentRepository.avgMttrMinutes(21L)).thenReturn(null);
            when(incidentRepository.countDeclaredByDay(21L)).thenReturn(List.of());
            when(incidentRepository.countResolvedByDay(21L)).thenReturn(List.of());

            UserActivityResponse response = userService.getUserActivity(21L);

            assertThat(response.avgTimeToClaimMinutes()).isZero();
            assertThat(response.avgMttrMinutes()).isZero();
        }
    }

    //  ========================================================================
    //  createUser — ADMIN email requirement & canonicalization
    //  ========================================================================

    @Nested
    @DisplayName("createUser — email handling")
    class CreateUserTest {

        @Test
        @DisplayName("ADMIN without email → rejected (email is the admin login identifier)")
        void adminWithoutEmail_rejected() {
            var request = new CreateUserRequest(
                    "Admin", "New", "securePass123", 5001, UserRole.ADMIN, null, null);

            assertThatThrownBy(() -> userService.createUser(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("email est requis");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("ADMIN with email → email canonicalized (trim + lowercase) and persisted")
        void adminWithEmail_canonicalized() {
            var request = new CreateUserRequest(
                    "Admin", "New", "securePass123", 5002,
                    UserRole.ADMIN, null, "  New.Admin@ICGLMA.MA ");
            when(passwordEncoder.encode("securePass123")).thenReturn("encoded");
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.createUser(request);

            assertThat(response.email()).isEqualTo("new.admin@icglma.ma");
            assertThat(response.role()).isEqualTo(UserRole.ADMIN);
            assertThat(response.claimed()).isTrue();

            ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getEmail()).isEqualTo("new.admin@icglma.ma");
            assertThat(captor.getValue().getPasswordHash()).isEqualTo("encoded");
        }

        @Test
        @DisplayName("duplicate admin email → rejected with a friendly message")
        void duplicateEmail_rejected() {
            var request = new CreateUserRequest(
                    "Admin", "Dup", "securePass123", 5004,
                    UserRole.ADMIN, null, "boss@icglma.ma");
            when(userRepository.existsByEmailIgnoreCase("boss@icglma.ma")).thenReturn(true);

            assertThatThrownBy(() -> userService.createUser(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("email existe déjà");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("SOUS_CHEF without email → created with null email")
        void nonAdminWithoutEmail_ok() {
            var request = new CreateUserRequest(
                    "Op", "Floor", "securePass123", 5003, UserRole.SOUS_CHEF, null, null);
            when(passwordEncoder.encode("securePass123")).thenReturn("encoded");
            when(userRepository.save(any(UserEntity.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            var response = userService.createUser(request);

            assertThat(response.email()).isNull();
            assertThat(response.role()).isEqualTo(UserRole.SOUS_CHEF);
        }
    }

    //  ========================================================================
    //  Misc
    //  ========================================================================

    @Test
    @DisplayName("countActiveAdmins delegates to the repository")
    void countActiveAdminsDelegates() {
        when(userRepository.countByRoleAndIsActive(UserRole.ADMIN, true)).thenReturn(2L);
        assertThat(userService.countActiveAdmins()).isEqualTo(2L);
    }

    @Test
    @DisplayName("getUserAuditLogs resolves the actor name and returns newest-first entries")
    void getUserAuditLogsResolvesActors() {
        UserEntity target = user(40L, UserRole.SOUS_CHEF, true, "");
        UserEntity actor = user(41L, UserRole.ADMIN, true, "{bcrypt}h");
        AuditLogEntity entry = AuditLogEntity.builder()
                .id(1L)
                .action("GENERATE_RESET_CODE")
                .actorUserId(actor.getId())
                .targetUserId(target.getId())
                .details("Reset code for First_40_Last_40_1040")
                .build();

        when(userRepository.findById(40L)).thenReturn(Optional.of(target));
        when(auditLogRepository.findTop50ByTargetUserIdOrderByCreatedAtDesc(40L))
                .thenReturn(List.of(entry));
        when(userRepository.findAllById(List.of(41L))).thenReturn(List.of(actor));

        var logs = userService.getUserAuditLogs(40L);

        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).action()).isEqualTo("GENERATE_RESET_CODE");
        assertThat(logs.get(0).actorName()).isEqualTo("First_41 Last_41");
    }

    @Test
    @DisplayName("getUserAuditLogs leaves actorName null when the actor no longer exists")
    void getUserAuditLogsHandlesDeletedActor() {
        UserEntity target = user(42L, UserRole.SOUS_CHEF, true, "");
        AuditLogEntity entry = AuditLogEntity.builder()
                .id(2L)
                .action("GENERATE_RESET_CODE")
                .actorUserId(999L)
                .targetUserId(target.getId())
                .details("Reset code")
                .build();

        when(userRepository.findById(42L)).thenReturn(Optional.of(target));
        when(auditLogRepository.findTop50ByTargetUserIdOrderByCreatedAtDesc(42L))
                .thenReturn(List.of(entry));
        when(userRepository.findAllById(List.of(999L))).thenReturn(List.of());

        var logs = userService.getUserAuditLogs(42L);

        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).actorName()).isNull();
    }

    @Test
    @DisplayName("toResponse derives claimed from the password sentinel")
    void claimedDerivedFromPasswordSentinel() {
        // Unclaimed sentinel ("") → claimed=false
        UserEntity unclaimed = user(30L, UserRole.CHEF_ATELIER, true, "");
        when(userRepository.findById(30L)).thenReturn(Optional.of(unclaimed));

        assertThat(userService.getUserById(30L).claimed())
                .as("empty passwordHash → not claimed")
                .isFalse();
    }

    @Test
    @DisplayName("claimed=true when a password is set")
    void claimedTrueWhenPasswordSet() {
        UserEntity claimed = user(31L, UserRole.CHEF_ATELIER, true, "{bcrypt}x");
        when(userRepository.findById(31L)).thenReturn(Optional.of(claimed));

        assertThat(userService.getUserById(31L).claimed())
                .as("bcrypt password → claimed")
                .isTrue();
    }
}
