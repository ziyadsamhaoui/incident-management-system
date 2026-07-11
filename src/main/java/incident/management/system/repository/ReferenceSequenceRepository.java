package incident.management.system.repository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
//
@Repository
@RequiredArgsConstructor
public class ReferenceSequenceRepository {

    private final EntityManager entityManager;

    public long getNextValue(String dateKey) {
        Number result = (Number) entityManager.createNativeQuery("""
                INSERT INTO reference_counters (date_key, last_value)
                VALUES (:dateKey, 1)
                ON CONFLICT (date_key)
                DO UPDATE SET last_value = reference_counters.last_value + 1
                RETURNING last_value
                """)
                .setParameter("dateKey", dateKey)
                .getSingleResult();
        return result.longValue();
    }
}
