package incident.management.system.web;

import incident.management.system.config.RoleEnforcementFilter;
import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.AdminMediaController;
import incident.management.system.dto.AdminMediaResponse;
import incident.management.system.dto.AdminMediaStatsResponse;
import incident.management.system.dto.MediaBulkDeleteResult;
import incident.management.system.dto.UserSummaryResponse;
import incident.management.system.enums.AttachmentType;
import incident.management.system.service.AdminMediaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web-slice tests for the ADMIN-only media management surface
 * ({@code /api/admin/media}): RBAC, listing, stats, single + bulk deletion.
 */
class AdminMediaControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private AdminMediaService adminMediaService;

    private AdminMediaController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminMediaController(adminMediaService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private AdminMediaResponse mediaResponse(Long id) {
        return new AdminMediaResponse(
                id, 7L, "INC-TEST-7", "Mécanique", "Sécurité",
                AttachmentType.IMAGE, "image/jpeg", 2048L, "photo.jpg",
                "/api/incidents/7/attachments/" + id + "?token=t",
                new UserSummaryResponse(1L, "Jane", "Doe", 1001),
                LocalDateTime.now().minusDays(1), 89);
    }

    //  @PreAuthorize Annotation Verification
    @Nested
    @DisplayName("@PreAuthorize annotation verification")
    class AnnotationVerification {

        @Test
        @DisplayName("Controller class has @PreAuthorize('hasRole(\\\"ADMIN\\\")')")
        void classLevelAnnotation_presentAndCorrect() {
            PreAuthorize annotation = AdminMediaController.class.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("No public method overrides class-level security")
        void noMethodSpecificOverrides() {
            Method[] methods = AdminMediaController.class.getDeclaredMethods();
            for (Method method : methods) {
                if (method.isAnnotationPresent(PreAuthorize.class)) {
                    PreAuthorize ann = method.getAnnotation(PreAuthorize.class);
                    assertThat(ann.value())
                            .as("Method %s @PreAuthorize", method.getName())
                            .isEqualTo("hasRole('ADMIN')");
                }
            }
        }
    }

    //  non-ADMIN → 403 FORBIDDEN
    @Nested
    @DisplayName("non-ADMIN users receive 403 FORBIDDEN")
    class RbacEnforcement {

        @BeforeEach
        void setUpRbac() {
            RoleEnforcementFilter rbacFilter = new RoleEnforcementFilter();
            rbacFilter.addRule("/api/admin/**", null, "ROLE_ADMIN");

            mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                    .standaloneSetup(controller)
                    .addFilters(rbacFilter)
                    .build();
        }

        @Test
        @DisplayName("SOUS_CHEF → GET /api/admin/media → 403")
        void sousChefGetMedia_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));
            mockMvc.perform(get("/api/admin/media"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → GET /api/admin/media/stats → 403")
        void chefAtelierGetStats_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));
            mockMvc.perform(get("/api/admin/media/stats"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → DELETE /api/admin/media/1 → 403")
        void chefAtelierDelete_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));
            mockMvc.perform(delete("/api/admin/media/1"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → POST /api/admin/media/bulk-delete → 403")
        void sousChefBulkDelete_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));
            mockMvc.perform(post("/api/admin/media/bulk-delete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[1,2]}"))
                    .andExpect(status().isForbidden());
        }
    }

    //  Functional endpoints
    @Nested
    @DisplayName("Functional endpoint behavior (ADMIN)")
    class FunctionalEndpoints {

        @BeforeEach
        void setUpFunctional() {
            buildMockMvcWithValidation(controller);
        }

        @Test
        @DisplayName("GET /api/admin/media → 200 with paginated items")
        void listMedia_returnsPage() throws Exception {
            when(adminMediaService.listMedia(any(), any(), any(), any(), any(), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of(mediaResponse(5L)),
                            PageRequest.of(0, 24, Sort.by(Sort.Direction.DESC, "uploadedAt")), 1));

            mockMvc.perform(get("/api/admin/media"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].id").value(5))
                    .andExpect(jsonPath("$.content[0].incidentReference").value("INC-TEST-7"))
                    .andExpect(jsonPath("$.content[0].fileType").value("IMAGE"))
                    .andExpect(jsonPath("$.content[0].retentionDaysRemaining").value(89));
        }

        @Test
        @DisplayName("GET /api/admin/media?fileType=AUDIO → 400 (voice clips excluded)")
        void listMedia_audioType_returns400() throws Exception {
            mockMvc.perform(get("/api/admin/media").param("fileType", "AUDIO"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/admin/media/stats → 200 with storage summary")
        void stats_returnsMetrics() throws Exception {
            when(adminMediaService.stats()).thenReturn(new AdminMediaStatsResponse(
                    true, "/data/incident-media", 3_000L, 1_000L, 2_000L,
                    2L, 1L, 3L, 90_000L, 100_000L));

            mockMvc.perform(get("/api/admin/media/stats"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.storedBytes").value(3000))
                    .andExpect(jsonPath("$.photoBytes").value(1000))
                    .andExpect(jsonPath("$.videoBytes").value(2000))
                    .andExpect(jsonPath("$.totalCount").value(3))
                    .andExpect(jsonPath("$.usableBytes").value(90000));
        }

        @Test
        @DisplayName("DELETE /api/admin/media/{id} → 204 No Content")
        void deleteMedia_returnsNoContent() throws Exception {
            doNothing().when(adminMediaService).deleteMedia(5L);

            mockMvc.perform(delete("/api/admin/media/5"))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("POST /api/admin/media/bulk-delete → 200 with freed bytes")
        void bulkDelete_returnsResult() throws Exception {
            when(adminMediaService.bulkDelete(List.of(1L, 2L)))
                    .thenReturn(new MediaBulkDeleteResult(2, 400L, List.of()));

            mockMvc.perform(post("/api/admin/media/bulk-delete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[1,2]}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deletedCount").value(2))
                    .andExpect(jsonPath("$.freedBytes").value(400));
        }

        @Test
        @DisplayName("POST /api/admin/media/bulk-delete with empty ids → 400")
        void bulkDelete_emptyIds_returns400() throws Exception {
            mockMvc.perform(post("/api/admin/media/bulk-delete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[]}"))
                    .andExpect(status().isBadRequest());
        }
    }
}
