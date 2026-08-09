package incident.management.system.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

/**
 * Per-user UI preferences stored in Redis.
 *
 * <p><b>Language preference</b> — {@code pref:lang:{matricule}} holds the
 * interface language code ({@code FR} or {@code AR}). The value is a plain
 * short string (never a heavyweight serialised object) and the key carries a
 * bounded TTL, so preferences survive restarts and horizontal scaling exactly
 * like the rest of the Redis-backed distributed state — but no key outlives
 * its usefulness (anti-pattern: unlimited TTLs).
 */
@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    public static final String LANG_KEY_PREFIX = "pref:lang:";

    /** Preferences are long-lived but explicitly bounded. */
    private static final Duration LANGUAGE_TTL = Duration.ofDays(365);

    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("FR", "AR");

    private final StringRedisTemplate redisTemplate;

    /**
     * Current UI language for the user, or {@link Optional#empty()} when the
     * preference was never set (client falls back to its local default).
     */
    public Optional<String> getLanguage(int matricule) {
        String value = redisTemplate.opsForValue().get(LANG_KEY_PREFIX + matricule);
        return Optional.ofNullable(value).filter(SUPPORTED_LANGUAGES::contains);
    }

    /**
     * Persist the UI language. Rejects unknown codes with
     * {@link IllegalArgumentException} (surfaced as a 400 by the global
     * exception handler).
     */
    public void setLanguage(int matricule, String language) {
        if (language == null || !SUPPORTED_LANGUAGES.contains(language)) {
            throw new IllegalArgumentException("Language must be one of: FR, AR");
        }
        redisTemplate.opsForValue()
                .set(LANG_KEY_PREFIX + matricule, language, LANGUAGE_TTL);
    }
}
