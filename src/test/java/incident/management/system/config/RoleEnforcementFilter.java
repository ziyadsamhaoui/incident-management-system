package incident.management.system.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.AntPathMatcher;
import org.springframework.util.PathMatcher;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;


// Lightweight servlet that enforces URL-to-role mappings for MockMvc tests, Returns 403 FORBIDDEN if no role
public class RoleEnforcementFilter implements Filter {

    private static final PathMatcher pathMatcher = new AntPathMatcher();
    private final Map<Rule, String[]> rules = new LinkedHashMap<>();

    public void addRule(String pattern, String method, String... roles) {
        rules.put(new Rule(pattern, method != null ? method.toUpperCase() : null), roles);
    }

    // Visible for testing
    Map<Rule, String[]> getRules() {
        return rules;
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain filterChain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        String requestPath = request.getRequestURI();
        String requestMethod = request.getMethod().toUpperCase();

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        boolean ruleMatched = false;

        // Check each rule in registration order
        for (Map.Entry<Rule, String[]> entry : rules.entrySet()) {
            Rule rule = entry.getKey();

            if (!rule.matches(requestPath, requestMethod)) {
                continue;
            }

            ruleMatched = true;

            // No valid authentication, pass through
            if (authentication == null || !authentication.isAuthenticated()
                    || "anonymousUser".equals(authentication.getPrincipal())) {
                break;
            }

            // Check if the user has at least one of the required roles
            String[] requiredRoles = entry.getValue();
            boolean hasRole = false;

            roleCheck:
            for (GrantedAuthority authority : authentication.getAuthorities()) {
                String authorityStr = authority.getAuthority();
                for (String requiredRole : requiredRoles) {
                    if (authorityStr.equals(requiredRole)) {
                        hasRole = true;
                        break roleCheck;
                    }
                }
            }

            if (!hasRole) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN,
                        "Access Denied: required role not found");
                return;
            }

            // Role matched, allow and stop checking further rules
            break;
        }

        filterChain.doFilter(request, response);
    }

    //  Internal rule holder
    public record Rule(String pattern, String method) {
        public boolean matches(String path, String httpMethod) {
            if (!pathMatcher.match(pattern, path)) {
                return false;
            }
            return method == null || method.equals(httpMethod);
        }
    }
}
