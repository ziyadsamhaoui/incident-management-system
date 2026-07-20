package incident.management.system.config;

import incident.management.system.config.JwtService;
import incident.management.system.exception.GlobalExceptionHandler;
import incident.management.system.service.RateLimitingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

// Shared base class for web slice tests.
@ExtendWith(MockitoExtension.class)
public abstract class StandaloneWebMvcTestBase {

    @Mock
    protected JwtService jwtService;

    @Mock
    protected RateLimitingService rateLimitingService;

    //  MockMvc builders
    protected MockMvc mockMvc;

    protected void buildMockMvc(Object... controllers) {
        mockMvc = MockMvcBuilders
                .standaloneSetup(controllers)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    protected void buildMockMvcWithValidation(Object... controllers) {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
                .standaloneSetup(controllers)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }


    @Test
    @DisplayName("Mock infrastructure: JwtService and RateLimitingService are stubbable")
    void mockInfrastructure_works() {
        // Demonstrate JwtService can be stubbed
        when(jwtService.validateToken("demo-token")).thenReturn(true);
        assertThat(jwtService.validateToken("demo-token")).isTrue();
        assertThat(jwtService.validateToken("unknown")).isFalse();

        // Demonstrate RateLimitingService can be stubbed
        when(rateLimitingService.getLimit("/api/test", "GET")).thenReturn(10L);
        assertThat(rateLimitingService.getLimit("/api/test", "GET")).isEqualTo(10L);
    }
}
