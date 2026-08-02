package incident.management.system.controller;

import incident.management.system.dto.ActiveAdminCountResponse;
import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserActivityResponse;
import incident.management.system.dto.UserResponse;
import incident.management.system.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<UserResponse>> getAllUsers(@PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping({"/matricule/{matricule}"})
    public ResponseEntity<UserResponse> getUserByMatricule(@PathVariable int matricule) {
        return ResponseEntity.ok(userService.getUserByMatricule(matricule));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/promote")
    public ResponseEntity<UserResponse> promoteToChefAtelier(@PathVariable Long id) {
        UserResponse response = userService.promoteToChefAtelier(id);
        return ResponseEntity.ok(response);
    }

    /**
     * On-demand activity analytics for the user (declared / claimed / resolved
     * counts + per-day buckets). Metrics are computed via SQL at request time.
     */
    @GetMapping("/{id}/activity")
    public ResponseEntity<UserActivityResponse> getUserActivity(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserActivity(id));
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<UserResponse> deactivateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.deactivateUser(id));
    }

    @PutMapping("/{id}/activate")
    public ResponseEntity<UserResponse> activateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.activateUser(id));
    }

    /**
     * Danger zone — reverts a CHEF_ATELIER to SOUS_CHEF, resets the password
     * (unclaimed sentinel) and clears the department assignment.
     */
    @PutMapping("/{id}/demote")
    public ResponseEntity<UserResponse> demoteToSousChef(@PathVariable Long id) {
        return ResponseEntity.ok(userService.demoteToSousChef(id));
    }

    /**
     * Danger zone — cancels a pending promotion for an unclaimed CHEF_ATELIER:
     * reverts the role, clears pending password-reset tokens, reactivates.
     */
    @PutMapping("/{id}/cancel-promotion")
    public ResponseEntity<UserResponse> cancelPromotion(@PathVariable Long id) {
        return ResponseEntity.ok(userService.cancelPromotion(id));
    }

    /**
     * Active ADMIN count — feeds the last-active-admin guard on the UI.
     * Static path segment so it never collides with {@code /{id}}.
     */
    @GetMapping("/active-admin-count")
    public ResponseEntity<ActiveAdminCountResponse> getActiveAdminCount() {
        return ResponseEntity.ok(
                new ActiveAdminCountResponse(userService.countActiveAdmins()));
    }

    //  Admin Department Subscriptions

    @PostMapping("/{userId}/subscriptions/{departmentId}")
    public ResponseEntity<Void> subscribeToDepartment(
            @PathVariable Long userId,
            @PathVariable Long departmentId) {
        userService.subscribeToDepartment(userId, departmentId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{userId}/subscriptions/{departmentId}")
    public ResponseEntity<Void> unsubscribeFromDepartment(
            @PathVariable Long userId,
            @PathVariable Long departmentId) {
        userService.unsubscribeFromDepartment(userId, departmentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/subscriptions")
    public ResponseEntity<List<DepartmentResponse>> getSubscribedDepartments(
            @PathVariable Long userId) {
        return ResponseEntity.ok(userService.getSubscribedDepartments(userId));
    }
}
