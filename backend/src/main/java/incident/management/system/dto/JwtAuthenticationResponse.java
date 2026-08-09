package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Successful authentication payload: JWT access token, refresh token, and the "
        + "authenticated user's matricule + granted roles.")
public record JwtAuthenticationResponse(
        @Schema(description = "Short-lived JWT access token (12h) — send as `Authorization: Bearer <token>`",
                example = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMDI0Iiwicm9sZSI6IkFETUlOIn0.abc123")
        String accessToken,
        @Schema(description = "Opaque 7-day refresh token, exchanged via POST /api/auth/refresh",
                example = "9f2c3d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f")
        String refreshToken,
        @Schema(description = "Token type — always `Bearer`", example = "Bearer")
        String type,
        @Schema(description = "Authenticated user matricule", example = "1024")
        int matricule,
        @Schema(description = "Granted authorities, e.g. [\"ROLE_ADMIN\"]", example = "[\"ROLE_ADMIN\"]")
        List<String> roles
) {
    public JwtAuthenticationResponse(String accessToken, String refreshToken, int matricule, List<String> roles) {
        this(accessToken, refreshToken, "Bearer", matricule, roles);
    }
}
