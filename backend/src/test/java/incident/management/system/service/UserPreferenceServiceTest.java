package incident.management.system.service;

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

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the Redis-backed {@link UserPreferenceService}. The language
 * preference is a plain short string under {@code pref:lang:{matricule}} with
 * a bounded TTL — never an unlimited-TTL key.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("UserPreferenceService (Redis-backed)")
class UserPreferenceServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private UserPreferenceService service;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new UserPreferenceService(redisTemplate);
    }

    @Nested
    @DisplayName("Reading the language preference")
    class Reading {

        @Test
        @DisplayName("returns the stored language for the user's key")
        void getLanguage_returnsStoredValue() {
            when(valueOperations.get("pref:lang:1001")).thenReturn("AR");

            assertThat(service.getLanguage(1001)).contains("AR");
        }

        @Test
        @DisplayName("returns empty when the preference was never set")
        void getLanguage_emptyWhenUnset() {
            when(valueOperations.get("pref:lang:1001")).thenReturn(null);

            assertThat(service.getLanguage(1001)).isEmpty();
        }

        @Test
        @DisplayName("ignores corrupt values that are not a supported language")
        void getLanguage_filtersUnsupportedValues() {
            when(valueOperations.get("pref:lang:1001")).thenReturn("ES");

            assertThat(service.getLanguage(1001)).isEmpty();
        }
    }

    @Nested
    @DisplayName("Writing the language preference")
    class Writing {

        @Test
        @DisplayName("persists a supported language with a bounded TTL")
        void setLanguage_storesWithBoundedTtl() {
            service.setLanguage(1001, "AR");

            verify(valueOperations).set(
                    eq("pref:lang:1001"), eq("AR"), eq(Duration.ofDays(365)));
        }

        @Test
        @DisplayName("rejects unsupported languages")
        void setLanguage_rejectsUnsupported() {
            assertThatThrownBy(() -> service.setLanguage(1001, "ES"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.setLanguage(1001, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("Isolation between users")
    class Isolation {

        @Test
        @DisplayName("each matricule has its own key")
        void languagePerUser_isolated() {
            service.setLanguage(1001, "AR");
            service.setLanguage(1002, "FR");

            verify(valueOperations).set(eq("pref:lang:1001"), eq("AR"), eq(Duration.ofDays(365)));
            verify(valueOperations).set(eq("pref:lang:1002"), eq("FR"), eq(Duration.ofDays(365)));

            // The two keys never collide — reading one user must not see the other.
            when(valueOperations.get("pref:lang:1001")).thenReturn("AR");
            when(valueOperations.get("pref:lang:1002")).thenReturn("FR");
            assertThat(service.getLanguage(1001)).contains("AR");
            assertThat(service.getLanguage(1002)).contains("FR");
        }
    }
}
