package incident.management.system.repository;

import incident.management.system.model.ProductionLineEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductionLineRepository extends JpaRepository<ProductionLineEntity, Long> {
}//
