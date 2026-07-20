package incident.management.system.web;

import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.UserController;
import incident.management.system.service.UserService;
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

/**
 * Web slice tests for {@link UserController}.
 * <p>
 * The controller is annotated with {@code @PreAuthorize("hasRole('ADMIN')")}
 * at the class level.
 * <p>
 * Testing strategy:
 * <ol>
 *   <li><b>Annotation verification</b> — reflection checks for {@code @PreAuthorize}.</li>
 *   <li><b>RBAC (HTTP 403) tests</b> — standalone MockMvc with
 *       {@link incident.management.system.config.RoleEnforcementFilter}
 *       verifies that non-admin users receive 403.</li>
 *   <li><b>Functional endpoint tests</b> — request/response flow.</li>
 * </ol>
 */
class UserControllerWebTest extends StandaloneWebMvcTestBase {

    @Mock
    private UserService userService;

    private UserController userController;

    @BeforeEach
    void setUp() {
        userController = new UserController(userService);
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
        @DisplayName("Controller class has @PreAuthorize('hasRole(\\\"ADMIN\\\")')")
        void classLevelAnnotation_presentAndCorrect() {
            PreAuthorize annotation = UserController.class.getAnnotation(PreAuthorize.class);
            assertThat(annotation).isNotNull();
            assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
        }

        @Test
        @DisplayName("No public method overrides class-level security")
        void noMethodWeakerThanClassLevel() {
            Method[] methods = UserController.class.getDeclaredMethods();
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

    //  ──────────────────────────────────────────────
    //  RBAC — non-admin → 403
    //  ──────────────────────────────────────────────

    @Nested
    @DisplayName("RBAC — non-admin users receive 403")
    class RbacEnforcement {

        private incident.management.system.config.RoleEnforcementFilter rbacFilter;

        @BeforeEach
        void setUpRbac() {
            rbacFilter = new incident.management.system.config.RoleEnforcementFilter();
            rbacFilter.addRule("/api/users/**", null, "ROLE_ADMIN");

            mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                    .standaloneSetup(userController)
                    .addFilters(rbacFilter)
                    .build();
        }

        @Test
        @DisplayName("SOUS_CHEF → POST /api/users → 403")
        void sousChefCreateUser_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"firstName\":\"A\",\"lastName\":\"B\",\"password\":\"p\",\"matricule\":1,\"role\":\"SOUS_CHEF\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → GET /api/users → 403")
        void sousChefGetAllUsers_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(MockMvcRequestBuilders.get("/api/users"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("SOUS_CHEF → DELETE /api/users/1 → 403")
        void sousChefDeleteUser_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("alice", "pass",
                            List.of(() -> "ROLE_SOUS_CHEF")));

            mockMvc.perform(MockMvcRequestBuilders.delete("/api/users/1"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("CHEF_ATELIER → POST /api/users → 403")
        void chefAtelierCreateUser_returns403() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("bob", "pass",
                            List.of(() -> "ROLE_CHEF_ATELIER")));

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"firstName\":\"A\",\"lastName\":\"B\",\"password\":\"p\",\"matricule\":2,\"role\":\"CHEF_ATELIER\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("ADMIN → POST /api/users → 201 (allowed through filter)")
        void adminCreateUser_returnsOk() throws Exception {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("admin", "pass",
                            List.of(() -> "ROLE_ADMIN")));

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"firstName\":\"A\",\"lastName\":\"B\",\"password\":\"p\",\"matricule\":3,\"role\":\"ADMIN\"}"))
                    .andExpect(status().isCreated());
        }
    }

    //  ──────────────────────────────────────────────
    //  Functional endpoint tests
    //  ──────────────────────────────────────────────

    @Nested
    @DisplayName("Functional endpoint behavior")
    class FunctionalEndpoints {

        @BeforeEach
        void setUpFunctional() {
            SecurityContextHolder.clearContext();
            buildMockMvcWithValidation(userController);
        }

        @Test
        @DisplayName("POST /api/users with valid payload → 201 Created")
        void createUser_validPayload_returnsCreated() throws Exception {
            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"firstName":"Alice","lastName":"Admin","password":"pass123",
                                     "matricule":100,"role":"ADMIN"}"""))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("POST /api/users with blank fields → 400 Bad Request")
        void createUser_invalidPayload_returns400() throws Exception {
            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"firstName":"","lastName":"","password":"",
                                     "matricule":0,"role":null}"""))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("GET /api/users → 200 OK")
        void getAllUsers_returnsOk() throws Exception {
            buildMockMvc(userController);
            mockMvc.perform(MockMvcRequestBuilders.get("/api/users"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /api/users/{id} → 200 OK")
        void getUserById_returnsOk() throws Exception {
            buildMockMvc(userController);
            mockMvc.perform(MockMvcRequestBuilders.get("/api/users/1"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("DELETE /api/users/{id} → 204 No Content")
        void deleteUser_returnsNoContent() throws Exception {
            buildMockMvc(userController);
            mockMvc.perform(MockMvcRequestBuilders.delete("/api/users/1"))
                    .andExpect(status().isNoContent());
        }
    }
}
