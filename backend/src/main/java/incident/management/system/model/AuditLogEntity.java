package incident.management.system.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * System audit log — records administrative security actions (e.g.
 * {@code GENERATE_RESET_CODE}) with the acting admin and the target user.
 */
@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Machine-readable action name, e.g. {@code GENERATE_RESET_CODE}. */
    @Column(nullable = false, length = 64)
    private String action;

    /** The authenticated admin who performed the action ({@code performedByAdminId}). */
    @Column(name = "actor_user_id")
    private Long actorUserId;

    /** The user the action targets. */
    @Column(name = "target_user_id")
    private Long targetUserId;

    @Column(length = 500)
    private String details;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
