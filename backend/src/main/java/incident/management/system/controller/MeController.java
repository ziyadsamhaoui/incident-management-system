package incident.management.system.controller;

import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserResponse;
import incident.management.system.service.UserPreferenceService;
import incident.management.system.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Current-user session context endpoints.
 * <ul>
 *   <li>{@code GET /api/me} — the authenticated user's profile (used for
 *       subscriptions, notifications and "my incidents" queries).</li>
 *   <li>{@code PATCH /api/users/me/department} — assign or change the current
 *       user's department (changeable anytime, e.g. from Settings).</li>
 *   <li>{@code GET/PUT /api/me/preferences/language} — the UI language
 *       preference, persisted in Redis ({@code pref:lang:{matricule}}) so it
 *       survives reloads and follows the user across instances.</li>
 * </ul>
 * The authenticated principal is identified by its matricule (see
 * {@code MultiChannelAuthenticationToken}).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {

    private final UserService userService;
    private final UserPreferenceService userPreferenceService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        return ResponseEntity.ok(userService.getUserByMatricule(resolveMatricule()));
    }

    @PatchMapping("/users/me/department")
    public ResponseEntity<UserResponse> setMyDepartment(@RequestBody Map<String, Long> body) {
        Long departmentId = body.get("departmentId");
        if (departmentId == null) {
            throw new IllegalArgumentException("departmentId is required");
        }
        int matricule = resolveMatricule();
        UserResponse me = userService.getUserByMatricule(matricule);
        UserResponse updated = userService.updateUser(
                me.id(),
                new UpdateUserRequest(null, null, null, departmentId));
        return ResponseEntity.ok(updated);
    }

    /**
     * Current UI language preference. The body is {@code {"language": "FR"}}
     * or {@code {"language": "AR"}}, or an empty object when never set — the
     * client decides the fallback (its local default).
     */
    @GetMapping("/me/preferences/language")
    public ResponseEntity<Map<String, String>> getLanguagePreference() {
        Map<String, String> body = new HashMap<>();
        userPreferenceService.getLanguage(resolveMatricule())
                .ifPresent(lang -> body.put("language", lang));
        return ResponseEntity.ok(body);
    }

    /**
     * Persist the UI language preference in Redis (bounded TTL — see
     * {@link UserPreferenceService}).
     */
    @PutMapping("/me/preferences/language")
    public ResponseEntity<Map<String, String>> setLanguagePreference(
            @RequestBody Map<String, String> body) {
        String language = body.get("language");
        userPreferenceService.setLanguage(resolveMatricule(), language);
        Map<String, String> response = new HashMap<>();
        response.put("language", language);
        return ResponseEntity.ok(response);
    }

    private int resolveMatricule() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String principal = auth != null ? auth.getName() : null;
        if (principal == null) {
            throw new IllegalArgumentException("Not authenticated");
        }
        try {
            return Integer.parseInt(principal);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Not authenticated");
        }
    }
}
