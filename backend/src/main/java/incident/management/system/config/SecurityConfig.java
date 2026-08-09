package incident.management.system.config;

import incident.management.system.security.CustomUserDetailsService;
import incident.management.system.security.JwtAuthenticationFilter;
import incident.management.system.security.MultiChannelAuthenticationProvider;
import incident.management.system.security.RateLimitingFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatchers;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final MultiChannelAuthenticationProvider multiChannelAuthenticationProvider;
    private final RateLimitingFilter rateLimitingFilter;

    /**
     * Browser origins allowed to call the API (CORS). Comma-separated,
     * overridable at deploy time via {@code CORS_ALLOWED_ORIGINS} (relaxed
     * binding) — e.g. {@code https://app.example.com} in production.
     * Never set to {@code *}: credentials are enabled, and browsers reject a
     * wildcard origin together with {@code Access-Control-Allow-Credentials}.
     */
    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:4200,http://localhost:8080}")
    private List<String> allowedOrigins;

    /**
     * Swagger UI / OpenAPI docs exposure toggle. Mirrors the springdoc property
     * ({@code springdoc.swagger-ui.enabled}) so the security layer exposes the
     * documentation anonymously ONLY in environments where the flag is on
     * (dev/staging). When disabled the docs paths require an authenticated
     * session instead of being anonymously reachable — set
     * {@code SPRINGDOC_API_DOCS_ENABLED=false} as well to stop serving the raw
     * spec entirely in production.
     */
    @Value("${springdoc.swagger-ui.enabled:false}")
    private boolean swaggerUiEnabled;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth
                            .requestMatchers("/api/auth/**").permitAll()
                            .requestMatchers("/actuator/**").permitAll()
                            .requestMatchers("/ws/**").permitAll();
                    // Swagger UI + raw OpenAPI spec — anonymous ONLY while
                    // springdoc.swagger-ui.enabled=true (dev/staging); otherwise
                    // an authenticated session is required.
                    if (swaggerUiEnabled) {
                        auth.requestMatchers(swaggerDocsMatcher()).permitAll();
                    } else {
                        auth.requestMatchers(swaggerDocsMatcher()).authenticated();
                    }
                    auth
                            .requestMatchers(HttpMethod.GET, "/api/dashboard/**").authenticated()
                            // Media bytes served by ResourceHttpRequestHandler — authorization is
                            // enforced INSIDE the resolver (signed read token OR JWT session with
                            // department/ownership scoping), because <img>/<video> tags cannot send
                            // an Authorization header. Never permit other /api/** paths.
                            .requestMatchers(HttpMethod.GET, "/api/incidents/*/attachments/*").permitAll()
                            .requestMatchers("/api/**").authenticated()
                            .anyRequest().permitAll();
                })
                .userDetailsService(customUserDetailsService)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitingFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Matches the Swagger UI assets and the raw OpenAPI JSON — the rule applied
     * to these paths depends on {@link #swaggerUiEnabled}.
     */
    private RequestMatcher swaggerDocsMatcher() {
        return RequestMatchers.anyOf(
                PathPatternRequestMatcher.pathPattern("/swagger-ui/**"),
                PathPatternRequestMatcher.pathPattern("/swagger-ui.html"),
                PathPatternRequestMatcher.pathPattern("/v3/api-docs/**"));
    }

    // This bean is necessary for the authentication manager to work with the custom authentication provider
    @Bean
    public AuthenticationManager authenticationManager() {
        return new ProviderManager(multiChannelAuthenticationProvider);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}