package incident.management.system.controller;

import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserResponse;
import incident.management.system.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Current-user session context endpoints.
 * <ul>
 *   <li>{@code GET /api/me} — the authenticated user's profile (used for
 *       subscriptions, notifications and "my incidents" queries).</li>
 *   <li>{@code PATCH /api/users/me/department} — assign or change the current
 *       user's department (changeable anytime, e.g. from Settings).</li>
 * </ul>
 * The authenticated principal is identified by its matricule (see
 * {@code MultiChannelAuthenticationToken}).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {

    private final UserService userService;

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
