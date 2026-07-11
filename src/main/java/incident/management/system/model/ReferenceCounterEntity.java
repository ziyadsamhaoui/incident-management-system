package incident.management.system.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "reference_counters")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferenceCounterEntity {
    @Id
    @Column(unique = true, nullable = false, length = 8)
    private String dateKey;

    @Column(nullable = false)
    private long lastValue;
}
