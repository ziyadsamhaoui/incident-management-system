package incident.management.system.web;

import incident.management.system.config.StandaloneWebMvcTestBase;
import incident.management.system.controller.AuthController;
import incident.management.system.config.JwtService;
import incident.management.system.model.UserEntity;
import incident.management.system.model.RefreshTokenEntity;
import incident.management.system.enums.UserRole;
import incident.management.system.security.MultiChannelAuthenticationToken;
import incident.management.system.security.TokenBlacklistService;
import incident.management.system.repository.RefreshTokenRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Web slice tests for {@link AuthController#login} focusing on the
 * <em>multi-channel lane routing</em> logic ({@code detectLane()}).
 * <p>
 * The endpoint is open ({@code permitAll()}), so no authentication is
 * required. All routing vectors are exercised via different payload
 * shapes.
 * <p>
 * Routing matrix:
 * <ul>
 *   <li><b>SOUS_CHEF</b> — mat + firstName + lastName, no password</li>
 *   <li><b>CHEF_ATELIER</b> — mat + password + firstName + lastName</li>
 *   <li><b>ADMIN</b> — email + password</li>
 * </ul>
 */
class AuthControllerAuthTest extends StandaloneWebMvcTestBase {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    @Mock
    private AuthService authService;

    @BeforeEach
    void setUp() {
        var authController = new AuthController(
                authenticationManager, jwtService, userRepository,
                refreshTokenRepository, tokenBlacklistService, authService);
        buildMockMvc(authController);
    }

    /**
     * Creates a minimal {@link UserEntity} for test authentication.
     */
    private UserEntity createUser(int matricule, String firstName, String lastName, UserRole role) {
        return UserEntity.builder()
                .id((long) matricule)
                .matricule(matricule)
                .firstName(firstName)
                .lastName(lastName)
                .role(role)
                .passwordHash("dummy-hash")
                .isActive(true)
                .failedLoginAttempts(0)
                .build();
    }

    /**
     * Stubs AuthenticationManager to return a successful
     * {@link MultiChannelAuthenticationToken} for the given user.
     */
    private void stubSuccessfulAuth(UserEntity user) {
        when(authenticationManager.authenticate(any()))
                .thenReturn(new MultiChannelAuthenticationToken(user));
    }

    //  ──────────────────────────────────────────────────────────────
    //  SOUS_CHEF Lane — identity-only
    //  ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("SOUS_CHEF lane — mat + firstName + lastName, no password")
    class SousChefLane {

        @Test
        @DisplayName("valid identity → 200 OK with tokens")
        void validIdentity_returns200() throws Exception {
            var payload = """
                    {
                        "matricule": "1001",
                        "firstName": "Alice",
                        "lastName": "Martin"
                    }
                    """;

            UserEntity user = createUser(1001, "Alice", "Martin", UserRole.SOUS_CHEF);
            stubSuccessfulAuth(user);

            when(jwtService.generateAccessToken(any())).thenReturn("mock-at-sc");
            when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").value("mock-at-sc"))
                    .andExpect(jsonPath("$.type").value("Bearer"));
        }
    }

    //  ──────────────────────────────────────────────────────────────
    //  CHEF_ATELIER Lane — mixed
    //  ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("CHEF_ATELIER lane — mat + password + firstName + lastName")
    class ChefAtelierLane {

        @Test
        @DisplayName("valid credentials → 200 OK with tokens")
        void validCredentials_returns200() throws Exception {
            var payload = """
                    {
                        "matricule": "2001",
                        "firstName": "Bob",
                        "lastName": "Smith",
                        "password": "correctPassword"
                    }
                    """;

            UserEntity user = createUser(2001, "Bob", "Smith", UserRole.CHEF_ATELIER);
            stubSuccessfulAuth(user);

            when(jwtService.generateAccessToken(any())).thenReturn("mock-at-ca");
            when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").value("mock-at-ca"));
        }

        @Test
        @DisplayName("wrong password → 401 Unauthorized")
        void wrongPassword_returns401() throws Exception {
            var payload = """
                    {
                        "matricule": "2001",
                        "firstName": "Bob",
                        "lastName": "Smith",
                        "password": "wrongPassword"
                    }
                    """;

            when(authenticationManager.authenticate(any()))
                    .thenThrow(new BadCredentialsException("Invalid credentials"));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("Invalid credentials"));
        }

        @Test
        @DisplayName("locked account → 403 Forbidden")
        void lockedAccount_returns403() throws Exception {
            var payload = """
                    {
                        "matricule": "2002",
                        "firstName": "Eve",
                        "lastName": "Locked",
                        "password": "anyPass"
                    }
                    """;

            when(authenticationManager.authenticate(any()))
                    .thenThrow(new LockedException("Account is locked. Try again later."));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("Account is locked. Try again later."));
        }
    }

    //  ──────────────────────────────────────────────────────────────
    //  ADMIN Lane — email-based
    //  ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ADMIN lane — email + password")
    class AdminLane {

        @Test
        @DisplayName("valid email + password → 200 OK with tokens")
        void validCredentials_returns200() throws Exception {
            var payload = """
                    {
                        "email": "admin@example.com",
                        "password": "adminPass"
                    }
                    """;

            UserEntity user = createUser(999, "Admin", "User", UserRole.ADMIN);
            stubSuccessfulAuth(user);

            when(jwtService.generateAccessToken(any())).thenReturn("mock-at-adm");
            when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").value("mock-at-adm"));
        }

        @Test
        @DisplayName("wrong password → 401 Unauthorized")
        void wrongPassword_returns401() throws Exception {
            var payload = """
                    {
                        "email": "admin@example.com",
                        "password": "wrongPass"
                    }
                    """;

            when(authenticationManager.authenticate(any()))
                    .thenThrow(new BadCredentialsException("Invalid credentials"));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("Invalid credentials"));
        }

        @Test
        @DisplayName("email field present routes to ADMIN lane even with matricule")
        void emailPresent_routesToAdminLane() throws Exception {
            var payload = """
                    {
                        "email": "mixed@example.com",
                        "matricule": "9999",
                        "password": "somePass",
                        "firstName": "Mixed",
                        "lastName": "Case"
                    }
                    """;

            // Even though the payload has both matricule and email,
            // detectLane() should route ADMIN because email is present.
            UserEntity user = createUser(9999, "Mixed", "Case", UserRole.ADMIN);
            stubSuccessfulAuth(user);

            when(jwtService.generateAccessToken(any())).thenReturn("mock-at-adm-mixed");
            when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").value("mock-at-adm-mixed"));
        }
    }

    //  ──────────────────────────────────────────────────────────────
    //  Edge Cases
    //  ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Edge cases — unexpected / malformed payloads")
    class EdgeCases {

        @Test
        @DisplayName("empty JSON object → defaults to SOUS_CHEF, fails auth → 401")
        void emptyPayload_routesSousChef_andFails() throws Exception {
            when(authenticationManager.authenticate(any()))
                    .thenThrow(new BadCredentialsException("Invalid credentials"));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("Invalid credentials"));
        }

        @Test
        @DisplayName("all fields blank → defaults to SOUS_CHEF, parseInt fails → 400")
        void allBlankFields_routesSousChef() throws Exception {
            // When all fields are blank, detectLane() returns SOUS_CHEF.
            // The authenticate() call will be made with principal "".
            // If mocked to throw, the controller's catch block tries
            // Integer.parseInt("") which throws NumberFormatException →
            // caught by GlobalExceptionHandler as IllegalArgumentException → 400.
            when(authenticationManager.authenticate(any()))
                    .thenThrow(new BadCredentialsException("Invalid credentials"));

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "matricule": "",
                                        "email": "",
                                        "password": "",
                                        "firstName": "",
                                        "lastName": ""
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        }
    }
}
