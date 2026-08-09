package incident.management.system.web;

import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.MeController;
import incident.management.system.service.UserPreferenceService;
import incident.management.system.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web tests for the current-user preference surface
 * ({@code GET/PUT /api/me/preferences/language}) backed by Redis via
 * {@link UserPreferenceService}.
 */
class MeControllerWebTest extends StandaloneWebMvcTestBase {

    private static final int MATRICULE = 1001;

    @Mock
    private UserService userService;

    @Mock
    private UserPreferenceService userPreferenceService;

    private MeController meController;

    @BeforeEach
    void setUp() {
        meController = new MeController(userService, userPreferenceService);
        SecurityContextHolder.clearContext();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(String.valueOf(MATRICULE), "pass",
                        List.of(() -> "ROLE_ADMIN")));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("GET /api/me/preferences/language")
    class GetLanguage {

        @BeforeEach
        void setUpGet() {
            buildMockMvc(meController);
        }

        @Test
        @DisplayName("returns the stored language for the authenticated user")
        void returnsStoredLanguage() throws Exception {
            when(userPreferenceService.getLanguage(MATRICULE)).thenReturn(Optional.of("AR"));

            mockMvc.perform(get("/api/me/preferences/language"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.language").value("AR"));
        }

        @Test
        @DisplayName("returns an empty object when no preference is stored")
        void returnsEmptyWhenUnset() throws Exception {
            when(userPreferenceService.getLanguage(MATRICULE)).thenReturn(Optional.empty());

            mockMvc.perform(get("/api/me/preferences/language"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.language").doesNotExist());
        }
    }

    @Nested
    @DisplayName("PUT /api/me/preferences/language")
    class PutLanguage {

        @BeforeEach
        void setUpPut() {
            buildMockMvc(meController);
        }

        @Test
        @DisplayName("persists the language against the authenticated user's key")
        void persistsLanguage() throws Exception {
            mockMvc.perform(put("/api/me/preferences/language")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"language\":\"AR\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.language").value("AR"));

            verify(userPreferenceService).setLanguage(MATRICULE, "AR");
        }

        @Test
        @DisplayName("invalid language is rejected with 400")
        void rejectsInvalidLanguage() throws Exception {
            org.mockito.Mockito.doThrow(new IllegalArgumentException("Language must be one of: FR, AR"))
                    .when(userPreferenceService).setLanguage(MATRICULE, "ES");

            mockMvc.perform(put("/api/me/preferences/language")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"language\":\"ES\"}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("missing language field is rejected with 400")
        void rejectsMissingLanguage() throws Exception {
            org.mockito.Mockito.doThrow(new IllegalArgumentException("Language must be one of: FR, AR"))
                    .when(userPreferenceService).setLanguage(MATRICULE, null);

            mockMvc.perform(put("/api/me/preferences/language")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }
    }
}
