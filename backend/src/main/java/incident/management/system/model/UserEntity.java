package incident.management.system.model;

import incident.management.system.enums.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private boolean isActive;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime deletedAt;

    @Column(nullable = false, unique = true)
    private int matricule;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private DepartmentEntity department;

    @Column(nullable = false)
    @Builder.Default
    private int failedLoginAttempts = 0;

    @Column
    private LocalDateTime lockoutEnd;

    public void deactivate() {
        this.isActive = false;
        this.deletedAt = LocalDateTime.now();
    }

    // Check if the user is locked out.
    public boolean isLocked() {
        return lockoutEnd != null && LocalDateTime.now().isBefore(lockoutEnd);
    }

    // Increment the failed login attempts and set a lockout if necessary.
    public void incrementFailedAttempts() {
        if (lockoutEnd != null && LocalDateTime.now().isAfter(lockoutEnd)) {
            this.failedLoginAttempts = 0;
            this.lockoutEnd = null;
        }
        this.failedLoginAttempts++;
        if (this.failedLoginAttempts >= 5) {
            this.lockoutEnd = LocalDateTime.now().plusMinutes(15);
        }
    }

    // Reset the failed login attempts and unlock the account after a successful login.
    public void resetFailedAttempts() {
        this.failedLoginAttempts = 0;
        this.lockoutEnd = null;
    }

    /**
     * Returns an audit-label string that unambiguously identifies this user
     * in log output and {@link IncidentHistory} comments.
     * <p>
     * Format: {@code FirstName_LastName_Matricule}
     */
    public String getAuditLabel() {
        return firstName + "_" + lastName + "_" + matricule;
    }
}
