package incident.management.system.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "admin_department_subscriptions",
       uniqueConstraints = @UniqueConstraint(columnNames = {"admin_id", "department_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminDepartmentSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private UserEntity admin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private DepartmentEntity department;
}
