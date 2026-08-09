package incident.management.system.idempotency;

import incident.management.system.exception.IdempotencyConflictException;
import incident.management.system.exception.MissingIdempotencyKeyException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link IdempotencyAspect}: the atomic {@code SETNX} lock,
 * cached-response replay, in-flight conflict detection and lock release on
 * failure. The distributed behaviour against real Redis is covered by
 * {@code RedisDistributedStateIntegrationTest}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("IdempotencyAspect")
class IdempotencyAspectTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    private IdempotencyAspect aspect;
    private MockHttpServletRequest request;

    /** Simple annotated target whose method is reflected by the mocked signature. */
    static class DemoEndpoint {

        @Idempotent
        public String create(String payload) {
            return "created:" + payload;
        }

        @Idempotent(required = false)
        public String optionalCreate(String payload) {
            return "ok";
        }

        @Idempotent
        public ResponseEntity<String> createEntity(String payload) {
            return ResponseEntity.status(HttpStatus.CREATED).body("entity:" + payload);
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        aspect = new IdempotencyAspect(redisTemplate, JsonMapper.builder().build());

        request = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    private void mockSignatureFor(String methodName) throws Exception {
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getMethod())
                .thenReturn(DemoEndpoint.class.getMethod(methodName, String.class));
    }

    private Idempotent annotationFor(String methodName) throws Exception {
        return DemoEndpoint.class.getMethod(methodName, String.class)
                .getAnnotation(Idempotent.class);
    }

    @Nested
    @DisplayName("Header enforcement")
    class HeaderEnforcement {

        @Test
        @DisplayName("required endpoint without header → MissingIdempotencyKeyException")
        void missingHeader_required_throws() throws Throwable {
            mockSignatureFor("create");

            assertThatThrownBy(() -> aspect.enforceIdempotency(joinPoint, annotationFor("create")))
                    .isInstanceOf(MissingIdempotencyKeyException.class)
                    .hasMessageContaining("X-Idempotency-Key");

            verify(joinPoint, never()).proceed();
        }

        @Test
        @DisplayName("optional endpoint without header proceeds without deduplication")
        void missingHeader_optional_proceeds() throws Throwable {
            mockSignatureFor("optionalCreate");
            when(joinPoint.proceed()).thenReturn("ok");

            Object result = aspect.enforceIdempotency(joinPoint, annotationFor("optionalCreate"));

            assertThat(result).isEqualTo("ok");
            verify(valueOperations, never()).setIfAbsent(anyString(), anyString(), any(Duration.class));
        }
    }

    @Nested
    @DisplayName("Deduplication window")
    class DeduplicationWindow {

        @Test
        @DisplayName("first attempt acquires the lock, executes and caches the response")
        void firstAttempt_executesAndCaches() throws Throwable {
            mockSignatureFor("create");
            request.addHeader("X-Idempotency-Key", "key-1");
            when(valueOperations.setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    any(Duration.class))).thenReturn(true);
            when(joinPoint.proceed()).thenReturn("created:xyz");

            Object result = aspect.enforceIdempotency(joinPoint, annotationFor("create"));

            assertThat(result).isEqualTo("created:xyz");
            verify(valueOperations).set(eq("idempotency:key-1:response"),
                    eq("\"created:xyz\""), any(Duration.class));
        }

        @Test
        @DisplayName("duplicate with a cached response replays it instead of executing")
        void duplicateWithCachedResponse_replays() throws Throwable {
            mockSignatureFor("create");
            request.addHeader("X-Idempotency-Key", "key-1");
            when(valueOperations.setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    any(Duration.class))).thenReturn(false);
            when(valueOperations.get("idempotency:key-1:response")).thenReturn("\"created:xyz\"");

            Object result = aspect.enforceIdempotency(joinPoint, annotationFor("create"));

            assertThat(result).isEqualTo("created:xyz");
            verify(joinPoint, never()).proceed();
        }

        @Test
        @DisplayName("duplicate with the first attempt still in flight → 409 conflict")
        void duplicateInFlight_conflict() throws Throwable {
            mockSignatureFor("create");
            request.addHeader("X-Idempotency-Key", "key-1");
            when(valueOperations.setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    any(Duration.class))).thenReturn(false);
            when(valueOperations.get("idempotency:key-1:response")).thenReturn(null);

            assertThatThrownBy(() -> aspect.enforceIdempotency(joinPoint, annotationFor("create")))
                    .isInstanceOf(IdempotencyConflictException.class)
                    .hasMessageContaining("already being processed");

            verify(joinPoint, never()).proceed();
        }

        @Test
        @DisplayName("a failing attempt releases the lock so the operator can retry")
        void failingAttempt_releasesLock() throws Throwable {
            mockSignatureFor("create");
            request.addHeader("X-Idempotency-Key", "key-1");
            when(valueOperations.setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    any(Duration.class))).thenReturn(true);
            when(joinPoint.proceed()).thenThrow(new IllegalStateException("DB down"));

            assertThatThrownBy(() -> aspect.enforceIdempotency(joinPoint, annotationFor("create")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("DB down");

            verify(redisTemplate).delete(List.of("idempotency:key-1", "idempotency:key-1:response"));
            verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
        }

        @Test
        @DisplayName("ResponseEntity-returning endpoint replays the cached body wrapped in 200 OK")
        void entityReturningMethod_replaysBodyWrappedInOk() throws Throwable {
            mockSignatureFor("createEntity");
            request.addHeader("X-Idempotency-Key", "key-entity");
            when(valueOperations.setIfAbsent(eq("idempotency:key-entity"), eq("IN_PROGRESS"),
                    any(Duration.class))).thenReturn(false);
            when(valueOperations.get("idempotency:key-entity:response"))
                    .thenReturn("\"entity:xyz\"");

            Object result = aspect.enforceIdempotency(joinPoint, annotationFor("createEntity"));

            assertThat(result).isInstanceOf(ResponseEntity.class);
            ResponseEntity<?> entity = (ResponseEntity<?>) result;
            assertThat(entity.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(entity.getBody()).isEqualTo("entity:xyz");
            verify(joinPoint, never()).proceed();
        }

        @Test
        @DisplayName("the lock TTL respects the annotation's ttlSeconds")
        void lockTtl_usesAnnotationValue() throws Throwable {
            mockSignatureFor("create");
            request.addHeader("X-Idempotency-Key", "key-1");
            when(valueOperations.setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    eq(Duration.ofSeconds(30)))).thenReturn(true);
            when(joinPoint.proceed()).thenReturn("created:xyz");

            aspect.enforceIdempotency(joinPoint, annotationFor("create"));

            verify(valueOperations).setIfAbsent(eq("idempotency:key-1"), eq("IN_PROGRESS"),
                    eq(Duration.ofSeconds(30)));
        }
    }
}
