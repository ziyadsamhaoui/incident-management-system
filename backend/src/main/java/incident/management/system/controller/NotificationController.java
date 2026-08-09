package incident.management.system.controller;

import incident.management.system.dto.NotificationResponse;
import incident.management.system.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications",
        description = "In-app notification inbox (unread feed, full history, mark-as-read). Requires a "
                + "valid JWT; userId query params reference the authenticated user.")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "Get unread notifications",
            description = "Paginated unread notifications for the given userId.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated unread notifications (Page<NotificationResponse>)"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public ResponseEntity<Page<NotificationResponse>> getNotifications(
            @Parameter(description = "Target user id")
            @RequestParam Long userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(notificationService.getUnreadNotificationsForUser(userId, pageable));
    }

    @GetMapping("/all")
    @Operation(summary = "Get full notification history",
            description = "Paginated full history (read + unread) for the given userId, newest first.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated notifications (Page<NotificationResponse>)"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public ResponseEntity<Page<NotificationResponse>> getAllNotifications(
            @Parameter(description = "Target user id")
            @RequestParam Long userId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(notificationService.getAllNotificationsForUser(userId, pageable));
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Notification marked as read"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT"),
            @ApiResponse(responseCode = "404", description = "Notification not found")
    })
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }
}
