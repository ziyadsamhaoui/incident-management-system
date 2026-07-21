package incident.management.system.model;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.IncidentPriority;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "incidents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String reference;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private DepartmentEntity department;

    @ManyToOne
    @JoinColumn(name = "station_id")
    private StationEntity station;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private CategoryEntity category;

    @Column(nullable = false)
    private IncidentPriority priority;

    @Column(nullable = false)
    private IncidentStatus status;

    @Column(length = 2000)
    private String description;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime declaredAt;

    @Column(updatable = false)
    private LocalDateTime claimedAt;

    @Column(updatable = false)
    private LocalDateTime inProgressAt;

    @Column(updatable = false)
    private LocalDateTime resolvedAt;

    @Column(updatable = false)
    private LocalDateTime closedAt;

    @Column(length = 1000)
    private String resolutionNote;

    // user type = ADMIN who claimed the incident
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "claimed_by_id")
    private UserEntity claimedBy;

    // user type = ADMIN who resolved the incident
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_id")
    private UserEntity resolvedBy;

}
