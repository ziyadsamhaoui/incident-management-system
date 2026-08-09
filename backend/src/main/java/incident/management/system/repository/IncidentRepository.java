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

import java.time.LocalDateTime;
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

    //  ========================================================================
    //  Analytics & Quality Engineering page (GET /api/analytics/**)
    //  All aggregation happens at the database layer with DATE_TRUNC time
    //  bucketing + SQL window functions — never raw datasets in the client.
    //  ========================================================================

    /**
     * Cohort volume buckets: incidents declared in the window, grouped by
     * {@code DATE_TRUNC(granularity)} of {@code declared_at}. Each bucket
     * exposes the total plus the terminal-outcome split (RESOLVED /
     * NON_RESOLVED) of that cohort. Returns {@code [label, reported, resolved,
     * nonResolved]} rows ordered chronologically.
     */
    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC(:granularity, declared_at), 'YYYY-MM-DD') AS label,
                   COUNT(*) AS reported,
                   COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
                   COUNT(*) FILTER (WHERE status = 'NON_RESOLVED') AS non_resolved
            FROM incidents
            WHERE declared_at >= :start AND declared_at < :end
              AND (:departmentId IS NULL OR department_id = :departmentId)
            GROUP BY label
            ORDER BY label
            """, nativeQuery = true)
    List<Object[]> analyticsVolumeBuckets(@Param("granularity") String granularity,
                                          @Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end,
                                          @Param("departmentId") Long departmentId);

    /**
     * Mean-time-to-resolution trend: incidents RESOLVED in the window, bucketed
     * by {@code DATE_TRUNC(granularity)} of {@code resolved_at}. Returns
     * {@code [label, avgHours]} rows ordered chronologically.
     */
    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC(:granularity, resolved_at), 'YYYY-MM-DD') AS label,
                   AVG(EXTRACT(EPOCH FROM (resolved_at - declared_at)) / 3600.0) AS avg_hours
            FROM incidents
            WHERE resolved_at >= :start AND resolved_at < :end
              AND status = 'RESOLVED'
              AND (:departmentId IS NULL OR department_id = :departmentId)
            GROUP BY label
            ORDER BY label
            """, nativeQuery = true)
    List<Object[]> analyticsMttrBuckets(@Param("granularity") String granularity,
                                        @Param("start") LocalDateTime start,
                                        @Param("end") LocalDateTime end,
                                        @Param("departmentId") Long departmentId);

    /**
     * Time-to-claim trend: incidents CLAIMED in the window, bucketed by
     * {@code DATE_TRUNC(granularity)} of {@code claimed_at}. Returns
     * {@code [label, avgHours]} rows ordered chronologically.
     */
    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC(:granularity, claimed_at), 'YYYY-MM-DD') AS label,
                   AVG(EXTRACT(EPOCH FROM (claimed_at - declared_at)) / 3600.0) AS avg_hours
            FROM incidents
            WHERE claimed_at >= :start AND claimed_at < :end
              AND (:departmentId IS NULL OR department_id = :departmentId)
            GROUP BY label
            ORDER BY label
            """, nativeQuery = true)
    List<Object[]> analyticsTimeToClaimBuckets(@Param("granularity") String granularity,
                                               @Param("start") LocalDateTime start,
                                               @Param("end") LocalDateTime end,
                                               @Param("departmentId") Long departmentId);

    /**
     * Exact cohort totals over the window (by {@code declared_at}):
     * {@code [reported, resolved, nonResolved]}.
     */
    @Query(value = """
            SELECT COUNT(*) AS reported,
                   COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
                   COUNT(*) FILTER (WHERE status = 'NON_RESOLVED') AS non_resolved
            FROM incidents
            WHERE declared_at >= :start AND declared_at < :end
              AND (:departmentId IS NULL OR department_id = :departmentId)
            """, nativeQuery = true)
    List<Object[]> analyticsTotals(@Param("start") LocalDateTime start,
                                   @Param("end") LocalDateTime end,
                                   @Param("departmentId") Long departmentId);

    /**
     * Overall mean resolution duration (hours) over incidents RESOLVED in the
     * window. Returns {@code [avgHours]} or an empty list when nothing matches.
     */
    @Query(value = """
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - declared_at)) / 3600.0) AS avg_hours
            FROM incidents
            WHERE resolved_at >= :start AND resolved_at < :end
              AND status = 'RESOLVED'
              AND (:departmentId IS NULL OR department_id = :departmentId)
            """, nativeQuery = true)
    List<Object[]> analyticsAvgMttrHours(@Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end,
                                         @Param("departmentId") Long departmentId);

    /**
     * Overall mean time-to-claim (hours) over incidents CLAIMED in the window.
     * Returns {@code [avgHours]} or an empty list when nothing matches.
     */
    @Query(value = """
            SELECT AVG(EXTRACT(EPOCH FROM (claimed_at - declared_at)) / 3600.0) AS avg_hours
            FROM incidents
            WHERE claimed_at >= :start AND claimed_at < :end
              AND (:departmentId IS NULL OR department_id = :departmentId)
            """, nativeQuery = true)
    List<Object[]> analyticsAvgTimeToClaimHours(@Param("start") LocalDateTime start,
                                                @Param("end") LocalDateTime end,
                                                @Param("departmentId") Long departmentId);

    /**
     * Incident volume ranked by department (descending) for the window.
     * Returns {@code [departmentName, count]} rows.
     */
    @Query(value = """
            SELECT COALESCE(d.name, 'Unassigned') AS name, COUNT(*) AS cnt
            FROM incidents i
            LEFT JOIN departments d ON d.id = i.department_id
            WHERE i.declared_at >= :start AND i.declared_at < :end
              AND (:departmentId IS NULL OR i.department_id = :departmentId)
            GROUP BY COALESCE(d.name, 'Unassigned')
            ORDER BY cnt DESC
            """, nativeQuery = true)
    List<Object[]> analyticsDepartmentVolumes(@Param("start") LocalDateTime start,
                                              @Param("end") LocalDateTime end,
                                              @Param("departmentId") Long departmentId);

    /**
     * Pareto source data: incident counts grouped by category, descending.
     * Returns {@code [categoryName, count]} rows.
     */
    @Query(value = """
            SELECT COALESCE(c.name, 'Non catégorisé') AS name, COUNT(*) AS cnt
            FROM incidents i
            LEFT JOIN categories c ON c.id = i.category_id
            WHERE i.declared_at >= :start AND i.declared_at < :end
              AND (:departmentId IS NULL OR i.department_id = :departmentId)
            GROUP BY COALESCE(c.name, 'Non catégorisé')
            ORDER BY cnt DESC
            """, nativeQuery = true)
    List<Object[]> analyticsCategoryCounts(@Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end,
                                           @Param("departmentId") Long departmentId);

    /**
     * Shift heatmap source: incident density per (day of week, hour of day)
     * over declarations in the window. Returns {@code [dow, hour, count]} rows,
     * where {@code dow} follows PostgreSQL semantics (0 = Sunday … 6 = Saturday).
     */
    @Query(value = """
            SELECT EXTRACT(DOW FROM declared_at)::int AS dow,
                   EXTRACT(HOUR FROM declared_at)::int AS hour,
                   COUNT(*) AS cnt
            FROM incidents
            WHERE declared_at >= :start AND declared_at < :end
              AND (:departmentId IS NULL OR department_id = :departmentId)
            GROUP BY dow, hour
            """, nativeQuery = true)
    List<Object[]> analyticsHeatmapCells(@Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end,
                                         @Param("departmentId") Long departmentId);

    /**
     * Repeat-incident signal detector (SQL windowing): a station+category pair
     * is flagged when ≥ 3 incidents are declared within any 14-day window
     * ({@code LAG(2)}-based sliding-window check). Returns one row per
     * qualifying pair: {@code [stationId, stationCode, categoryId, categoryName,
     * departmentName, incidentCount, firstOccurrence, lastOccurrence,
     * latestReference]}.
     */
    @Query(value = """
            WITH filtered AS (
                SELECT i.id, i.reference, i.station_id, i.category_id, i.declared_at,
                       s.code AS station_code,
                       c.name AS category_name,
                       d.name AS department_name
                FROM incidents i
                LEFT JOIN stations s ON s.id = i.station_id
                LEFT JOIN categories c ON c.id = i.category_id
                LEFT JOIN departments d ON d.id = i.department_id
                WHERE i.station_id IS NOT NULL
                  AND i.category_id IS NOT NULL
                  AND i.declared_at >= :start AND i.declared_at < :end
                  AND (:departmentId IS NULL OR i.department_id = :departmentId)
            ),
            ranked AS (
                SELECT f.*,
                       LAG(f.declared_at, 2) OVER (
                           PARTITION BY f.station_id, f.category_id
                           ORDER BY f.declared_at
                       ) AS third_prior
                FROM filtered f
            ),
            -- station+category pairs that contain >= 3 incidents within any 14-day window
            flagged AS (
                SELECT DISTINCT station_id, category_id
                FROM ranked
                WHERE third_prior IS NOT NULL
                  AND declared_at - third_prior <= INTERVAL '14 days'
            ),
            -- full-group statistics over every incident of the flagged pair (not just
            -- the qualifying subset) so first/last occurrence span the whole cluster
            stats AS (
                SELECT f.station_id, f.category_id,
                       COUNT(*) AS incident_count,
                       MIN(f.declared_at) AS first_occurrence,
                       MAX(f.declared_at) AS last_occurrence
                FROM filtered f
                GROUP BY f.station_id, f.category_id
            )
            SELECT fl.station_id,
                   (SELECT MIN(f2.station_code) FROM filtered f2 WHERE f2.station_id = fl.station_id) AS station_code,
                   fl.category_id,
                   (SELECT MIN(f2.category_name) FROM filtered f2 WHERE f2.category_id = fl.category_id) AS category_name,
                   (SELECT MIN(f2.department_name) FROM filtered f2 WHERE f2.station_id = fl.station_id) AS department_name,
                   st.incident_count,
                   st.first_occurrence,
                   st.last_occurrence,
                   (SELECT f2.reference FROM filtered f2
                     WHERE f2.station_id = fl.station_id AND f2.category_id = fl.category_id
                     ORDER BY f2.declared_at DESC, f2.id DESC
                     LIMIT 1) AS latest_reference,
                   (SELECT f2.id FROM filtered f2
                     WHERE f2.station_id = fl.station_id AND f2.category_id = fl.category_id
                     ORDER BY f2.declared_at DESC, f2.id DESC
                     LIMIT 1) AS latest_incident_id
            FROM flagged fl
            JOIN stats st
              ON st.station_id = fl.station_id AND st.category_id = fl.category_id
            ORDER BY st.incident_count DESC, st.last_occurrence DESC
            """, nativeQuery = true)
    List<Object[]> analyticsRepeatSignals(@Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end,
                                          @Param("departmentId") Long departmentId);

    /**
     * ADMIN-scoped team workload: per evaluator (ADMIN role) aggregate
     * throughput — claims, RESOLVED / NON_RESOLVED evaluations and mean
     * resolution hours — over the window. Returns {@code [userId, firstName,
     * lastName, claimedCount, resolvedCount, nonResolvedCount, avgHours]} rows
     * ordered by last name (neutral, non-competitive ordering).
     */
    @Query(value = """
            SELECT u.id, u.first_name, u.last_name,
                   COALESCE(cc.claimed_count, 0) AS claimed_count,
                   COALESCE(rc.resolved_count, 0) AS resolved_count,
                   COALESCE(rc.non_resolved_count, 0) AS non_resolved_count,
                   COALESCE(rc.avg_resolution_hours, 0) AS avg_resolution_hours
            FROM users u
            LEFT JOIN (
                SELECT claimed_by_id, COUNT(*) AS claimed_count
                FROM incidents
                WHERE claimed_by_id IS NOT NULL
                  AND claimed_at >= :start AND claimed_at < :end
                  AND (:departmentId IS NULL OR department_id = :departmentId)
                GROUP BY claimed_by_id
            ) cc ON cc.claimed_by_id = u.id
            LEFT JOIN (
                SELECT resolved_by_id,
                       COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_count,
                       COUNT(*) FILTER (WHERE status = 'NON_RESOLVED') AS non_resolved_count,
                       AVG(EXTRACT(EPOCH FROM (resolved_at - declared_at)) / 3600.0)
                           FILTER (WHERE status = 'RESOLVED') AS avg_resolution_hours
                FROM incidents
                WHERE resolved_by_id IS NOT NULL
                  AND resolved_at >= :start AND resolved_at < :end
                  AND (:departmentId IS NULL OR department_id = :departmentId)
                GROUP BY resolved_by_id
            ) rc ON rc.resolved_by_id = u.id
            WHERE u.role = 'ADMIN' AND u.is_active = TRUE AND u.deleted_at IS NULL
            ORDER BY u.last_name, u.first_name
            """, nativeQuery = true)
    List<Object[]> analyticsWorkload(@Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end,
                                     @Param("departmentId") Long departmentId);
}
