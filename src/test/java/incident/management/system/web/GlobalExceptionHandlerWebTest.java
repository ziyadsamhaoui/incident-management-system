package incident.management.system.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.IncidentController;
import incident.management.system.controller.UserController;
import incident.management.system.dto.CreateIncidentRequest;
import incident.management.system.dto.CreateUserRequest;
import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.UserRole;
import incident.management.system.service.IncidentService;
import incident.management.system.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


class GlobalExceptionHandlerWebTest extends StandaloneWebMvcTestBase {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private IncidentService incidentService;

    @Mock
    private UserService userService;

    @BeforeEach
    void setUp() {
        buildMockMvcWithValidation(
                new IncidentController(incidentService),
                new UserController(userService));
    }

    //  CreateIncidentRequest → @Valid failures
    @Nested
    @DisplayName("POST /api/incidents: validation failures")
    class CreateIncidentValidation {

        @Test
        @DisplayName("all null fields → 400 Bad Request with 6 field errors")
        void allNullFields_returns400WithFieldErrors() throws Exception {
            var request = new CreateIncidentRequest(null, null, null, null, null, null);

            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Validation Failure"))
                    .andExpect(jsonPath("$.message").value("One or more fields failed validation. See 'errors' for details."))
                    .andExpect(jsonPath("$.errors.userId").exists())
                    .andExpect(jsonPath("$.errors.departmentId").exists())
                    .andExpect(jsonPath("$.errors.stationId").exists())
                    .andExpect(jsonPath("$.errors.categoryId").exists())
                    .andExpect(jsonPath("$.errors.priority").exists())
                    .andExpect(jsonPath("$.errors.description").exists());
        }

        @Test
        @DisplayName("blank description → 400 with single field error")
        void blankDescription_returns400WithFieldError() throws Exception {
            var request = new CreateIncidentRequest(
                    1L, 1L, 1L, 1L, IncidentPriority.HIGH, "   ");

            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.errors.description").exists());
        }

        @Test
        @DisplayName("empty JSON body → 400")
        void emptyBody_returns400() throws Exception {
            mockMvc.perform(post("/api/incidents")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Validation Failure"));
        }
    }

    //  CreateUserRequest → @Valid failures
    @Nested
    @DisplayName("POST /api/users: validation failures")
    class CreateUserValidation {

        @Test
        @DisplayName("all empty fields → 400 Bad Request with field errors")
        void allEmptyFields_returns400WithFieldErrors() throws Exception {
            var request = new CreateUserRequest("", "", "", 0, null, null);

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Validation Failure"))
                    .andExpect(jsonPath("$.errors.firstName").exists())
                    .andExpect(jsonPath("$.errors.lastName").exists())
                    .andExpect(jsonPath("$.errors.password").exists())
                    .andExpect(jsonPath("$.errors.role").exists());
        }

        @Test
        @DisplayName("blank strings + missing role → 400 with exact error messages")
        void missingRole_returns400WithFieldErrors() throws Exception {
            var request = new CreateUserRequest("", "", "", 0, null, null);

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.firstName").value("must not be blank"))
                    .andExpect(jsonPath("$.errors.lastName").value("must not be blank"))
                    .andExpect(jsonPath("$.errors.password").value("must not be blank"))
                    .andExpect(jsonPath("$.errors.role").value("must not be null"));
        }

        @Test
        @DisplayName("valid payload passes validation and returns 201")
        void validPayload_passesValidation() throws Exception {
            var request = new CreateUserRequest(
                    "John", "Doe", "securePass123", 12345, UserRole.SOUS_CHEF, null);

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());
        }
    }
}
