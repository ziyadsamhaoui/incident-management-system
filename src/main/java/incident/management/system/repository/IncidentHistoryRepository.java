package incident.management.system.repository;

import incident.management.system.model.IncidentHistory;
import incident.management.system.model.IncidentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentHistoryRepository extends JpaRepository<IncidentHistory, Long> {

    List<IncidentHistory> findByIncidentOrderByChangedAtAsc(IncidentEntity incident);
}
