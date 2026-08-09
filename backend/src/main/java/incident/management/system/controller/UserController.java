package incident.management.system.controller;

import incident.management.system.dto.ActiveAdminCountResponse;
import incident.management.system.dto.AuditLogResponse;
import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
import incident.management.system.dto.UserActivityResponse;
import incident.management.system.dto.UserResponse;
import incident.management.system.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Admin - Users",
        description = "ADMIN-only user administration: creation, promotion/demotion, activation/deactivation, "
                + "department subscriptions, per-user activity analytics and audit trails. Every operation "
                + "requires the ADMIN role — non-admins receive 403.")
public class UserController {

    private final UserService userService;

    @PostMapping
    @Operation(summary = "Create a user",
            description = "Creates a user (ADMIN, CHEF_ATELIER or SOUS_CHEF). ADMIN accounts require a "
                    + "unique, valid email (login identifier); the other roles authenticate by matricule. "
                    + "Duplicates (matricule or email) are rejected.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "User created",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation failure (missing name/password, invalid email)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "409", description = "Duplicate matricule or email")
    })
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "List users",
            description = "Paginated user directory with roles, activation state, department and claim status.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated users (Page<UserResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<UserResponse>> getAllUsers(@PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User detail",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping({"/matricule/{matricule}"})
    @Operation(summary = "Get a user by matricule")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User detail",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> getUserByMatricule(@PathVariable int matricule) {
        return ResponseEntity.ok(userService.getUserByMatricule(matricule));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user",
            description = "Updates firstName/lastName, role and/or department assignment. Only the fields "
                    + "present in the payload are changed.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User updated",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation failure"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "User deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/promote")
    @Operation(summary = "Promote a user to CHEF_ATELIER",
            description = "Promotes a SOUS_CHEF to CHEF_ATELIER. The promoted account has no password until "
                    + "it is claimed via POST /api/auth/claim (rendered as 'En attente').")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User promoted",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "400", description = "Role not promotable"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> promoteToChefAtelier(@PathVariable Long id) {
        UserResponse response = userService.promoteToChefAtelier(id);
        return ResponseEntity.ok(response);
    }

    /**
     * On-demand activity analytics for the user (declared / claimed / resolved
     * counts + per-day buckets). Metrics are computed via SQL at request time.
     */
    @GetMapping("/{id}/activity")
    @Operation(summary = "Get per-user activity analytics",
            description = "On-demand activity metrics computed at request time via SQL COUNT/AVG: declared, "
                    + "open, resolved, terminal and claimed counts, average time-to-claim and MTTR in "
                    + "minutes, plus per-day declaration/resolution buckets.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Activity analytics",
                    content = @Content(schema = @Schema(implementation = UserActivityResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserActivityResponse> getUserActivity(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserActivity(id));
    }

    /**
     * Recent audit entries targeting this user ("piste d'audit"), newest
     * first — e.g. "Code de réinitialisation généré par [admin] le [date]".
     */
    @GetMapping("/{id}/audit-logs")
    @Operation(summary = "Get audit log entries for a user",
            description = "Recent audit entries targeting this user (e.g. 'Code de réinitialisation généré "
                    + "par [admin]'), newest first. The actor name is resolved server-side.")
    @ApiResponses({
            // Array schema is derived from the List<AuditLogResponse> return type.
            @ApiResponse(responseCode = "200", description = "Audit entries (AuditLogResponse[])"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<List<AuditLogResponse>> getUserAuditLogs(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserAuditLogs(id));
    }

    @PutMapping("/{id}/deactivate")
    @Operation(summary = "Deactivate a user",
            description = "Deactivates the account — the user can no longer authenticate (login answers 403).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User deactivated",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> deactivateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.deactivateUser(id));
    }

    @PutMapping("/{id}/activate")
    @Operation(summary = "Reactivate a user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User reactivated",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> activateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.activateUser(id));
    }

    /**
     * Danger zone — reverts a CHEF_ATELIER to SOUS_CHEF, resets the password
     * (unclaimed sentinel) and clears the department assignment.
     */
    @PutMapping("/{id}/demote")
    @Operation(summary = "Demote a user to SOUS_CHEF (danger zone)",
            description = "Danger zone: reverts a CHEF_ATELIER to SOUS_CHEF, resets the password to the "
                    + "unclaimed sentinel and clears the department assignment.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User demoted",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "400", description = "Role not demotable"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> demoteToSousChef(@PathVariable Long id) {
        return ResponseEntity.ok(userService.demoteToSousChef(id));
    }

    /**
     * Danger zone — cancels a pending promotion for an unclaimed CHEF_ATELIER:
     * reverts the role, clears pending password-reset tokens, reactivates.
     */
    @PutMapping("/{id}/cancel-promotion")
    @Operation(summary = "Cancel a pending promotion (danger zone)",
            description = "Danger zone: cancels a pending promotion for an unclaimed CHEF_ATELIER — reverts "
                    + "the role, clears pending password-reset tokens and reactivates the account.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Promotion cancelled",
                    content = @Content(schema = @Schema(implementation = UserResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserResponse> cancelPromotion(@PathVariable Long id) {
        return ResponseEntity.ok(userService.cancelPromotion(id));
    }

    /**
     * Active ADMIN count — feeds the last-active-admin guard on the UI.
     * Static path segment so it never collides with {@code /{id}}.
     */
    @GetMapping("/active-admin-count")
    @Operation(summary = "Count active ADMIN accounts",
            description = "Number of active ADMIN accounts — feeds the last-active-admin guard on the UI. "
                    + "Static path segment so it never collides with /{id}.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Active admin count",
                    content = @Content(schema = @Schema(implementation = ActiveAdminCountResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<ActiveAdminCountResponse> getActiveAdminCount() {
        return ResponseEntity.ok(
                new ActiveAdminCountResponse(userService.countActiveAdmins()));
    }

    //  Admin Department Subscriptions

    @PostMapping("/{userId}/subscriptions/{departmentId}")
    @Operation(summary = "Subscribe an admin to a department",
            description = "Subscribes the admin to a department so they receive its incident notifications.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Subscription created"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User or department not found")
    })
    public ResponseEntity<Void> subscribeToDepartment(
            @PathVariable Long userId,
            @PathVariable Long departmentId) {
        userService.subscribeToDepartment(userId, departmentId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{userId}/subscriptions/{departmentId}")
    @Operation(summary = "Unsubscribe an admin from a department")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Subscription removed"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User or department not found")
    })
    public ResponseEntity<Void> unsubscribeFromDepartment(
            @PathVariable Long userId,
            @PathVariable Long departmentId) {
        userService.unsubscribeFromDepartment(userId, departmentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/subscriptions")
    @Operation(summary = "List an admin's department subscriptions")
    @ApiResponses({
            // Array schema is derived from the List<DepartmentResponse> return type.
            @ApiResponse(responseCode = "200", description = "Subscribed departments (DepartmentResponse[])"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<List<DepartmentResponse>> getSubscribedDepartments(
            @PathVariable Long userId) {
        return ResponseEntity.ok(userService.getSubscribedDepartments(userId));
    }
}
