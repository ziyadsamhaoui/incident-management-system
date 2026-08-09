package incident.management.system.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3.0 specification generation (springdoc-openapi).
 * <p>
 * Everything exposed here is generated from {@code @Tag}/{@code @Operation}/
 * {@code @ApiResponse}/{@code @Schema} annotations on controllers and DTOs —
 * there is deliberately NO hand-maintained YAML/JSON spec file, so the
 * documentation can never silently drift from the code.
 * <ul>
 *   <li>Interactive UI: {@code /swagger-ui/index.html}</li>
 *   <li>Raw JSON spec: {@code /v3/api-docs}</li>
 * </ul>
 */
@Configuration
public class OpenApiConfig {

    /** Name of the global HTTP Bearer security scheme (JWT). */
    public static final String JWT_SECURITY_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI incidentManagementOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Incident Management System API")
                        .version("1.0.0")
                        .description(
                                "Enterprise REST API for incident workflows, department routing, user security, "
                                        + "and local media attachments."))
                // Global JWT requirement: every operation is protected by default so
                // developers/QA can authenticate once in Swagger UI via "Authorize".
                // Truly public endpoints (login, claim, password reset, ...) opt out
                // with @SecurityRequirements() so they render as unauthenticated.
                .addSecurityItem(new SecurityRequirement().addList(JWT_SECURITY_SCHEME))
                .components(new Components().addSecuritySchemes(JWT_SECURITY_SCHEME,
                        new SecurityScheme()
                                .name(JWT_SECURITY_SCHEME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Access token issued by POST /api/auth/login "
                                        + "or POST /api/auth/claim.")));
    }
}
