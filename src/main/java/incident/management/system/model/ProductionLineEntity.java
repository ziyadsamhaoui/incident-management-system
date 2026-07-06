package incident.management.system.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "production_lines")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductionLineEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "section_id")
    private SectionEntity section;

    @Column(nullable = false)
    private String name;
}
