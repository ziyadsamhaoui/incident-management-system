package incident.management.system.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;


// Unit test to verify URL matching and role enforcement logic.
@ExtendWith(MockitoExtension.class)
class RoleEnforcementFilterTest {

    private RoleEnforcementFilter filter;

    @Mock
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new RoleEnforcementFilter();
        SecurityContextHolder.clearContext();
    }

    //  Rule matching
    @Test
    @DisplayName("Rule matches pattern with ** wildcard")
    void ruleMatchesWildcard() {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");
        assertThat(filter.getRules()).hasSize(1);

        RoleEnforcementFilter.Rule rule = filter.getRules().keySet().iterator().next();
        assertThat(rule.matches("/api/admin/categories", "GET")).isTrue();
        assertThat(rule.matches("/api/admin/categories/1", "GET")).isTrue();
        assertThat(rule.matches("/api/admin/departments", "POST")).isTrue();
    }

    @Test
    @DisplayName("Rule does not match different path")
    void ruleDoesNotMatchDifferentPath() {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");
        RoleEnforcementFilter.Rule rule = filter.getRules().keySet().iterator().next();

        assertThat(rule.matches("/api/users", "GET")).isFalse();
        assertThat(rule.matches("/api/auth/login", "POST")).isFalse();
    }

    @Test
    @DisplayName("Rule matches specific HTTP method only")
    void ruleMatchesSpecificMethod() {
        filter.addRule("/api/incidents", "POST", "ROLE_SOUS_CHEF", "ROLE_CHEF_ATELIER");
        RoleEnforcementFilter.Rule rule = filter.getRules().keySet().iterator().next();

        assertThat(rule.matches("/api/incidents", "POST")).isTrue();
        assertThat(rule.matches("/api/incidents", "GET")).isFalse();
    }

    //  Role enforcement
    @Test
    @DisplayName("User with correct role passes through filter")
    void correctRole_passesThrough() throws Exception {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin", "pass", List.of(() -> "ROLE_ADMIN")));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/categories");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getStatus()).isNotEqualTo(403);
    }

    @Test
    @DisplayName("User with wrong role receives 403")
    void wrongRole_returns403() throws Exception {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "souschef", "pass", List.of(() -> "ROLE_SOUS_CHEF")));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/categories");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, never()).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    @DisplayName("Unauthenticated request passes through (no 403)")
    void unauthenticated_passesThrough() throws Exception {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/categories");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // No authentication set in SecurityContextHolder
        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("No matching rule passes through")
    void noMatchingRule_passesThrough() throws Exception {
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");

        // No auth needed because the path doesn't match
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/public/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Multiple rules, first matching rule wins")
    void multipleRules_firstMatchWins() throws Exception {
        filter.addRule("/api/public/**", null, "ROLE_PUBLIC");
        filter.addRule("/api/admin/**", null, "ROLE_ADMIN");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "user", "pass", List.of(() -> "ROLE_ADMIN")));

        // Request to admin endpoint which should match second rule and pass
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/categories");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }
}
