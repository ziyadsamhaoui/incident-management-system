package incident.management.system.web;

import incident.management.system.config.RoleEnforcementFilter;
import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.IncidentController;
import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.EvaluateIncidentRequest;
import incident.management.system.service.IncidentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Web slice tests for {@link IncidentController}.
 * <p>
 * Covers annotation verification for method-level {@code @PreAuthorize},
 * RBAC (HTTP 403) enforcement via {@link RoleEnforcementFilter},
 * and functional validation tests.
 */
class IncidentControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private IncidentService incidentService;

    private IncidentController incidentController;

    @BeforeEach
    void setUp() {
        incidentController = new IncidentController(incidentService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    //  ──────────────────────────────────────────────
    //  @PreAuthorize Annotation Verification
    //  ──────────────────────────────────────────────

    @Nested
    @DisplayName("@PreAuthorize annotation verification")
    class AnnotationVerification {

        @Test
        @DisplayName("createIncident() has @PreAuthorize('hasAnyRole(\\\"SOUS_CHEF\\\", \\\"CHEF_ATELIER\\\")')")
        void createIncident_hasCorrectAnnotation() throws Exception {
            Method method = IncidentController.class.getMethod("createIncident", CreateIncidentRequest.class);
            PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER')");
        }

        @Test
        @DisplayName("claimIncident() has @PreAuthorize('hasRole(\\\"ADMIN\\\")')")
        void claimIncident_hasCorrectAnnotation() throws Exception {
            Method method = IncidentController.class.getMethod("claimIncident", Long.class);
            PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("evaluateIncident() has @PreAuthorize('hasRole(\\\"ADMIN\\\")')")
        void evaluateIncident_hasCorrectAnnotation() throws Exception {
            Method method = IncidentController.class.getMethod(
                    "evaluateIncident", Long.class, EvaluateIncidentRequest.class);
            PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("getIncidents(), getIncidentById(), progressIncident() have no @PreAuthorize")
        void listAndGetEndpoints_haveNoAnnotation() throws Exception {
            Method listMethod = IncidentController.class.getMethod("getIncidents",
                    String.class, Long.class, Long.class, Pageable.class);
            Method getMethod = IncidentController.class.getMethod("getIncidentById", Long.class);
            Method progressMethod = IncidentController.class.getMethod("progressIncident", Long.class);

            assertThat(listMethod.getAnnotation(PreAuthorize.class)).isNull();
            assertThat(getMethod.getAnnotation(PreAuthorize.class)).isNull();
            assertThat(progressMethod.getAnnotation(PreAuthorize.class)).isNull();
        }
    }

    //  ──────────────────────────────────────────────
    //  RBAC — role enforcement (403)
    //  ──────────────────────────────────────────────

    @Nested
    @DisplayName("RBAC — role enforcement (403)")
    class RbacEnforcement {

        @BeforeEach
        void setUpRbac() {
            RoleEnforcementFilter rbacFilter = new RoleEnforcementFilter();
            rbacFilter.addRule("/api/incidents", "POST", "ROLE_SOUS_CHEF", "ROLE_CHEF_ATELIER");
            rbacFilter.addRule("/api/incidents/*/claim", "PUT", "ROLE_ADMIN");
            rbacFilter.addRule("/api/incidents/*/evaluate", "PUT", "ROLE_ADMIN");

            mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                    .standaloneSetup(incidentController)
                    .addFilters(rbacFilter)
                    .build();
        }

        @Test
        @DisplayName("ADMIN → POST /api/incidents → 403 (not allowed)")
        void adminCreateIncident_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → POST /api/incidents → 400 (allowed, but empty body)")
        void sousChefCreateIncident_passesRbac() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("CHEF_ATELIER → POST /api/incidents → 400 (allowed, but empty body)")
        void chefAtelierCreateIncident_passesRbac() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("SOUS_CHEF → PUT /api/incidents/1/claim → 403 (ADMIN only)")
        void sousChefClaimIncident_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(MockMvcRequestBuilders.put("/api/incidents/1/claim"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("ADMIN → PUT /api/incidents/1/claim → 200 (allowed)")
        void adminClaimIncident_returnsOk() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(MockMvcRequestBuilders.put("/api/incidents/1/claim"))
                    .andExpect(status().isOk());
        }
    }

    //  ──────────────────────────────────────────────
    //  Functional validation tests
    //  ──────────────────────────────────────────────

    @Nested
    @DisplayName("Functional endpoint tests")
    class FunctionalValidation {

        @BeforeEach
        void setUpWithValidation() {
            buildMockMvcWithValidation(incidentController);
        }

        @Test
        @DisplayName("POST /api/incidents with valid payload → 201 Created")
        void createIncident_validPayload_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"userId":1,"departmentId":1,"stationId":1,
                                     "categoryId":1,"priority":"HIGH",
                                     "description":"Test incident description"}"""))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("POST /api/incidents with null fields → 400 with field errors")
        void createIncident_nullFields_returns400() throws Exception {
            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Validation Failure"))
                    .andExpect(jsonPath("$.errors.userId").exists())
                    .andExpect(jsonPath("$.errors.description").exists());
        }

        @Test
        @DisplayName("GET /api/incidents → 200 OK")
        void getIncidents_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/incidents"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/incidents/{id} → 200 OK")
        void getIncidentById_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/incidents/1"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PUT /api/incidents/{id}/progress → 200 OK")
        void progressIncident_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.put("/api/incidents/1/progress"))
                    .andExpect(status().isOk());
        }
    }
}
