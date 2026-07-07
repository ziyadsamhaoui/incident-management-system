package incident.management.system.model;

import incident.management.system.enums.IncidentStatus;
import lombok.*;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "incident_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "incident_id", nullable = false)
    private IncidentEntity incident;

    @Column(nullable = false)
    private IncidentStatus previousStatus;

    @Column
    private IncidentStatus currentStatus;

    @Column
    private LocalDateTime changedAt;

    @Column
    private String comment;
}
