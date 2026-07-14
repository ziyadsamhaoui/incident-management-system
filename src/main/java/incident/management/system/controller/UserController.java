package incident.management.system.controller;

import incident.management.system.dto.CreateUserRequest;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.UpdateUserRequest;
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
import org.springframework.web.bind.annotation.*;

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

    //  ========================================================================
    //  Admin Department Subscriptions
    //  ========================================================================

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
