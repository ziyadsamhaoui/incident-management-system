package incident.management.system.repository;

import incident.management.system.enums.IncidentStatus;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentRepository
        extends JpaRepository<IncidentEntity, Long>, JpaSpecificationExecutor<IncidentEntity> {

    Page<IncidentEntity> findByStatus(IncidentStatus status, Pageable pageable);

    Page<IncidentEntity> findByUser(UserEntity user, Pageable pageable);

    Page<IncidentEntity> findByDepartment(DepartmentEntity department, Pageable pageable);

    Optional<IncidentEntity> findByReference(String reference);

    //  ========================================================================
    //  Per-user activity analytics (GET /api/users/{id}/activity)
    //  All metrics are computed on demand — no denormalized counters.
    //  ========================================================================

    long countByUser(UserEntity user);

    long countByClaimedBy(UserEntity claimedBy);

    long countByResolvedBy(UserEntity resolvedBy);

    /** Number of the user's incidents currently in an open (non-terminal) state. */
    long countByUserAndStatusIn(UserEntity user, Collection<IncidentStatus> statuses);

    /**
     * Average time-to-claim (minutes) for incidents claimed by the user —
     * {@code AVG(claimed_at - declared_at)} over the user's claimed incidents.
     */
    @Query(value = """
            SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (claimed_at - declared_at)) / 60.0), 0)
            FROM incidents
            WHERE claimed_by_id = :userId
              AND claimed_at IS NOT NULL AND declared_at IS NOT NULL
            """, nativeQuery = true)
    Double avgTimeToClaimMinutes(@Param("userId") Long userId);

    /**
     * Average MTTR (minutes) for incidents resolved by the user —
     * {@code AVG(resolved_at - declared_at)} over the user's resolved incidents.
     */
    @Query(value = """
            SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - declared_at)) / 60.0), 0)
            FROM incidents
            WHERE resolved_by_id = :userId
              AND resolved_at IS NOT NULL AND declared_at IS NOT NULL
            """, nativeQuery = true)
    Double avgMttrMinutes(@Param("userId") Long userId);

    /**
     * Incidents declared by the user, bucketed per calendar day (UTC date of
     * the {@code declared_at} timestamp). Returns {@code [date, count]} rows
     * ordered chronologically.
     */
    @Query(value = """
            SELECT TO_CHAR(declared_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
            FROM incidents
            WHERE user_id = :userId
            GROUP BY declared_at::date
            ORDER BY day
            """, nativeQuery = true)
    List<Object[]> countDeclaredByDay(@Param("userId") Long userId);

    /**
     * Incidents resolved by the user, bucketed per calendar day (UTC date of
     * the {@code resolved_at} timestamp). Returns {@code [date, count]} rows
     * ordered chronologically.
     */
    @Query(value = """
            SELECT TO_CHAR(resolved_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
            FROM incidents
            WHERE resolved_by_id = :userId AND resolved_at IS NOT NULL
            GROUP BY resolved_at::date
            ORDER BY day
            """, nativeQuery = true)
    List<Object[]> countResolvedByDay(@Param("userId") Long userId);
}
