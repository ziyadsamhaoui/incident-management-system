package incident.management.system.web;

import incident.management.system.config.RoleEnforcementFilter;
import incident.management.system.config.StandaloneWebMvcTestBase;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import incident.management.system.controller.AdminController;
import incident.management.system.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private CategoryService categoryService;

    @Mock
    private DepartmentService departmentService;

    @Mock
    private SectionService sectionService;

    @Mock
    private ProductionLineService productionLineService;

    @Mock
    private StationService stationService;

    private AdminController adminController;

    @BeforeEach
    void setUp() {
        adminController = new AdminController(
                categoryService, departmentService, sectionService,
                productionLineService, stationService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    //  @PreAuthorize Annotation Verification
    @Nested
    @DisplayName("@PreAuthorize annotation verification")
    class AnnotationVerification {

        @Test
        @DisplayName("Controller class has @PreAuthorize('hasRole(\\\"ADMIN\\\")')")
        void classLevelAnnotation_presentAndCorrect() {
            PreAuthorize annotation = AdminController.class.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("No public method overrides class-level security")
        void noMethodSpecificOverrides() {
            Method[] methods = AdminController.class.getDeclaredMethods();
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
                    .standaloneSetup(adminController)
                    .addFilters(rbacFilter)
                    .setCustomArgumentResolvers(
                            new PageableHandlerMethodArgumentResolver())
                    .build();
        }

        @Test
        @DisplayName("SOUS_CHEF → POST /api/admin/categories → 403")
        void sousChefCreateCategory_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(post("/api/admin/categories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"cat\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → GET /api/admin/categories → 403")
        void sousChefGetAllCategories_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/categories"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → DELETE /api/admin/categories/1 → 403")
        void sousChefDeleteCategory_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(MockMvcRequestBuilders.delete("/api/admin/categories/1"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → POST /api/admin/departments → 403")
        void chefAtelierCreateDepartment_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(post("/api/admin/departments")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"dept\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → PUT /api/admin/categories/1 → 403")
        void chefAtelierUpdateCategory_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(put("/api/admin/categories/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"cat\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → GET /api/admin/stations → 403")
        void chefAtelierGetAllStations_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/stations"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("ADMIN → GET /api/admin/categories → 200 (allowed)")
        void adminGetAllCategories_returnsOk() throws Exception {
            // PageableHandlerMethodArgumentResolver needed for Pageable parameters
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/categories"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("ADMIN → POST /api/admin/categories → 201 (allowed)")
        void adminCreateCategory_returnsOk() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(post("/api/admin/categories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"cat\"}"))
                    .andExpect(status().isCreated());
        }
    }

    //  Functional endpoint tests
    @Nested
    @DisplayName("Functional endpoint behavior")
    class FunctionalEndpoints {

        @BeforeEach
        void setUpFunctional() {
            buildMockMvcWithValidation(adminController);
        }

        @Test
        @DisplayName("POST /api/admin/categories → 201 Created")
        void createCategory_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/admin/categories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"test-category\"}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("GET /api/admin/categories → 200 OK")
        void getAllCategories_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/categories"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/admin/categories/{id} → 200 OK")
        void getCategoryById_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/categories/1"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PUT /api/admin/categories/{id} → 200 OK")
        void updateCategory_returnsOk() throws Exception {
            mockMvc.perform(put("/api/admin/categories/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"updated\"}"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("DELETE /api/admin/categories/{id} → 204 No Content")
        void deleteCategory_returnsNoContent() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.delete("/api/admin/categories/1"))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("POST /api/admin/departments → 201 Created")
        void createDepartment_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/admin/departments")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"test-dept\"}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("GET /api/admin/sections → 200 OK")
        void getAllSections_returnsOk() throws Exception {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/admin/sections"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("POST /api/admin/production-lines → 201 Created")
        void createProductionLine_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/admin/production-lines")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"test-line\"}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("POST /api/admin/stations → 201 Created")
        void createStation_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/admin/stations")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"code\":\"ST01\",\"rowIndex\":1,\"lineIndex\":2}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("PUT /api/admin/stations/{id} → 200 OK")
        void updateStation_returnsOk() throws Exception {
            mockMvc.perform(put("/api/admin/stations/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"code\":\"ST02\"}"))
                    .andExpect(status().isOk());
        }
    }
}
