package incident.management.system.dto;

import java.util.List;

public record JwtAuthenticationResponse(
        String accessToken,
        String refreshToken,
        String type,
        int matricule,
        List<String> roles
) {
    public JwtAuthenticationResponse(String accessToken, String refreshToken, int matricule, List<String> roles) {
        this(accessToken, refreshToken, "Bearer", matricule, roles);
    }
}
