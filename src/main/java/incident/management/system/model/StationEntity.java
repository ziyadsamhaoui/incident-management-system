package incident.management.system.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "stations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "production_line_id")
    private ProductionLineEntity productionLine;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private int rowIndex;

    @Column(nullable = false)
    private int lineIndex;

    @Column(nullable = false)
    private boolean isWorking;
}
