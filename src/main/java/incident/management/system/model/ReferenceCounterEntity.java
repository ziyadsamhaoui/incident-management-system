package incident.management.system.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "reference_counters")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferenceCounterEntity {
    @Id
    @Column(unique = true, nullable = false, length = 32)
    private String dateKey;

    @Column(nullable = false)
    private long lastValue;
}
