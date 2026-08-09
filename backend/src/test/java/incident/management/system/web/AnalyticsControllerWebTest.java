package incident.management.system.web;

import incident.management.system.config.RoleEnforcementFilter;
import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.AnalyticsController;
import incident.management.system.dto.analytics.HeatmapResponse;
import incident.management.system.dto.analytics.ParetoResponse;
import incident.management.system.dto.analytics.RepeatSignalResponse;
import incident.management.system.dto.analytics.VolumeSpeedResponse;
import incident.management.system.dto.analytics.WorkloadEntry;
import incident.management.system.service.AnalyticsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AnalyticsControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private AnalyticsService analyticsService;

    private AnalyticsController analyticsController;

    @BeforeEach
    void setUp() {
        analyticsController = new AnalyticsController(analyticsService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    //  @PreAuthorize Annotation Verification — only the workload endpoint is ADMIN-scoped
    @Nested
    @DisplayName("@PreAuthorize annotation verification")
    class AnnotationVerification {

        @Test
        @DisplayName("GET /workload is annotated with @PreAuthorize(\"hasRole('ADMIN')\")")
        void workloadMethod_hasAdminGuard() throws Exception {
            Method method = AnalyticsController.class.getMethod("getWorkload",
                    java.time.LocalDate.class, java.time.LocalDate.class, Long.class);
            PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("volume-speed / pareto / heatmap / repeat-signals are not ADMIN-restricted at method level")
        void openEndpoints_haveNoPreAuthorize() throws Exception {
            assertThat(AnalyticsController.class
                    .getMethod("getVolumeSpeed", java.time.LocalDate.class,
                            java.time.LocalDate.class, Long.class, boolean.class)
                    .getAnnotation(PreAuthorize.class)).isNull();
            assertThat(AnalyticsController.class
                    .getMethod("getPareto", java.time.LocalDate.class,
                            java.time.LocalDate.class, Long.class)
                    .getAnnotation(PreAuthorize.class)).isNull();
            assertThat(AnalyticsController.class
                    .getMethod("getHeatmap", java.time.LocalDate.class,
                            java.time.LocalDate.class, Long.class)
                    .getAnnotation(PreAuthorize.class)).isNull();
            assertThat(AnalyticsController.class
                    .getMethod("getRepeatSignals", java.time.LocalDate.class,
                            java.time.LocalDate.class, Long.class)
                    .getAnnotation(PreAuthorize.class)).isNull();
        }
    }

    //  RBAC — non-ADMIN → 403 on the workload surface
    @Nested
    @DisplayName("RBAC enforcement on /api/analytics/workload")
    class RbacEnforcement {

        @BeforeEach
        void setUpRbac() {
            RoleEnforcementFilter rbacFilter = new RoleEnforcementFilter();
            rbacFilter.addRule("/api/analytics/workload", null, "ROLE_ADMIN");

            mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                    .standaloneSetup(analyticsController)
                    .addFilters(rbacFilter)
                    .build();
        }

        @Test
        @DisplayName("SOUS_CHEF → GET /api/analytics/workload → 403")
        void sousChefWorkload_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(get("/api/analytics/workload"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → GET /api/analytics/workload → 403")
        void chefAtelierWorkload_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(get("/api/analytics/workload"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("ADMIN → GET /api/analytics/workload → 200")
        void adminWorkload_returnsOk() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(get("/api/analytics/workload"))
                    .andExpect(status().isOk());
        }
    }

    //  Functional endpoint behavior (service mocked)
    @Nested
    @DisplayName("Functional endpoint behavior")
    class FunctionalEndpoints {

        @BeforeEach
        void setUpFunctional() {
            buildMockMvc(analyticsController);
        }

        @Test
        @DisplayName("GET /api/analytics/volume-speed → 200 OK")
        void volumeSpeed_returnsOk() throws Exception {
            when(analyticsService.getVolumeSpeed(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class),
                    anyBoolean()))
                    .thenReturn(new VolumeSpeedResponse(
                            List.of(), null, null, List.of()));

            mockMvc.perform(get("/api/analytics/volume-speed")
                            .param("startDate", "2026-01-01")
                            .param("endDate", "2026-01-30")
                            .param("compare", "true"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/analytics/pareto → 200 OK")
        void pareto_returnsOk() throws Exception {
            when(analyticsService.getPareto(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class)))
                    .thenReturn(new ParetoResponse(List.of(), 0L, null));

            mockMvc.perform(get("/api/analytics/pareto")
                            .param("startDate", "2026-01-01")
                            .param("endDate", "2026-01-30"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/analytics/heatmap → 200 OK")
        void heatmap_returnsOk() throws Exception {
            when(analyticsService.getHeatmap(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class)))
                    .thenReturn(new HeatmapResponse(List.of(), 0L));

            mockMvc.perform(get("/api/analytics/heatmap")
                            .param("startDate", "2026-01-01")
                            .param("endDate", "2026-01-30"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/analytics/repeat-signals → 200 OK")
        void repeatSignals_returnsOk() throws Exception {
            when(analyticsService.getRepeatSignals(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class)))
                    .thenReturn(new RepeatSignalResponse(List.of()));

            mockMvc.perform(get("/api/analytics/repeat-signals")
                            .param("startDate", "2026-01-01")
                            .param("endDate", "2026-01-30"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/analytics/workload → 200 OK")
        void workload_returnsOk() throws Exception {
            when(analyticsService.getWorkload(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class)))
                    .thenReturn(List.of(new WorkloadEntry(1L, "A", "B", 0L, 0L, 0L, 0L, null)));

            mockMvc.perform(get("/api/analytics/workload")
                            .param("startDate", "2026-01-01")
                            .param("endDate", "2026-01-30"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/analytics/volume-speed without params → 200 OK (relative defaults)")
        void volumeSpeed_withoutParams_returnsOk() throws Exception {
            when(analyticsService.getVolumeSpeed(
                    any(java.time.LocalDate.class),
                    any(java.time.LocalDate.class),
                    nullable(Long.class),
                    anyBoolean()))
                    .thenReturn(new VolumeSpeedResponse(
                            List.of(), null, null, List.of()));

            mockMvc.perform(get("/api/analytics/volume-speed"))
                    .andExpect(status().isOk());
        }
    }
}
