package incident.management.system.security;

import tools.jackson.databind.ObjectMapper;
import incident.management.system.dto.ErrorResponse;
import incident.management.system.exception.RateLimitExceededException;
import incident.management.system.service.RateLimitingService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;


@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimitingService rateLimitingService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        String httpMethod = request.getMethod();

        // Only enforce rate limits on configured endpoints
        if (!isRateLimitedEndpoint(requestPath, httpMethod)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Determine client identity
        String clientKey = resolveClientKey(request);

        try {
            // Consume a token throws, RateLimitExceededException if limit is reached
            rateLimitingService.consume(clientKey, requestPath, httpMethod);

            // Add rate-limit response headers
            addRateLimitHeaders(response, requestPath, httpMethod, clientKey);

            filterChain.doFilter(request, response);

        } catch (RateLimitExceededException e) {
            log.warn("Rate limit hit for client '{}' on {} {}",
                    clientKey, httpMethod, requestPath);

            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(e.getRetryAfterSeconds()));
            response.setHeader("X-Rate-Limit-Limit",
                    String.valueOf(rateLimitingService.getLimit(requestPath, httpMethod)));
            response.setHeader("X-Rate-Limit-Remaining", "0");
            response.setHeader("X-Rate-Limit-Reset",
                    String.valueOf(Instant.now().getEpochSecond() + e.getRetryAfterSeconds()));

            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");

            ErrorResponse errorBody = ErrorResponse.of(
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    "Too Many Requests",
                    e.getMessage());

            objectMapper.writeValue(response.getWriter(), errorBody);
        }
    }


    //  Helpers methods

    private boolean isRateLimitedEndpoint(String requestPath, String httpMethod) {
        return RateLimitingService.resolveRule(requestPath, httpMethod) != null;
    }

    private String resolveClientKey(HttpServletRequest request) {
        String requestPath = request.getRequestURI();
        String httpMethod = request.getMethod();

        // For authenticated users on incident endpoints, use the user principal
        if ("POST".equalsIgnoreCase(httpMethod)
                && (requestPath.equals("/api/incidents")
                || requestPath.equals("/api/incidents/"))) {

            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()
                    && !"anonymousUser".equals(authentication.getPrincipal())) {
                String principal = authentication.getName(); // matricule
                log.debug("Using authenticated principal '{}' as rate-limit key", principal);
                return "user:" + principal;
            }
        }

        // Fall back to client IP
        return "ip:" + resolveClientIp(request);
    }

    // Extract client IP address from request headers
    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            // Take the leftmost IP (original client)
            return xForwardedFor.split(",")[0].trim();
        }

        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "unknown";
    }

    // Add rate-limit metadata to response headers
    private void addRateLimitHeaders(HttpServletResponse response,
                                     String requestPath,
                                     String httpMethod,
                                     String clientKey) {
        long limit = rateLimitingService.getLimit(requestPath, httpMethod);
        long remaining = rateLimitingService.getRemainingTokens(clientKey, requestPath, httpMethod);

        if (limit >= 0) {
            response.setHeader("X-Rate-Limit-Limit", String.valueOf(limit));
        }
        if (remaining >= 0) {
            response.setHeader("X-Rate-Limit-Remaining", String.valueOf(remaining));
        }
    }
}
