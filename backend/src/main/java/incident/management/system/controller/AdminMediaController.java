package incident.management.system.controller;

import incident.management.system.dto.AdminMediaResponse;
import incident.management.system.dto.AdminMediaStatsResponse;
import incident.management.system.dto.MediaBulkDeleteRequest;
import incident.management.system.dto.MediaBulkDeleteResult;
import incident.management.system.enums.AttachmentType;
import incident.management.system.service.AdminMediaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Media Administration & Quota Management surface — ADMIN only.
 * <p>
 * Scope is strictly {@code IMAGE} + {@code VIDEO}: voice clips ({@code AUDIO})
 * are never queried or listed here (they stay reachable only on incident detail
 * pages). Deletions remove the physical file from disk and soft-delete the DB
 * row into an audit stub — see {@link AdminMediaService}.
 */
@RestController
@RequestMapping("/api/admin/media")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "Admin - Media Attachments",
        description = "ADMIN-only media inventory, storage metrics and deletion surface. Scope is strictly "
                + "IMAGE + VIDEO — AUDIO voice clips are excluded (400 when requested, skipped on delete). "
                + "Deletions physically remove the file from disk and soft-delete the DB row into an audit stub.")
public class AdminMediaController {

    private final AdminMediaService adminMediaService;

    /** Paginated media inventory — search by incident reference, department, type, date range, size/date sort. */
    @GetMapping
    @Operation(summary = "List media inventory",
            description = "Paginated media inventory (IMAGE/VIDEO only). Filters: `search` (case-insensitive "
                    + "on the incident reference), `departmentId`, `fileType` (IMAGE or VIDEO — AUDIO is "
                    + "rejected with 400), inclusive `startDate`/`endDate` on uploadedAt, and `sort` tokens "
                    + "newest (default) / oldest / largest. Every item carries a fresh signed read URL and "
                    + "the retention countdown for terminal incidents.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated media inventory (Page<AdminMediaResponse>)"),
            @ApiResponse(responseCode = "400", description = "fileType=AUDIO is not allowed on this surface"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<AdminMediaResponse>> listMedia(
            @Parameter(description = "Case-insensitive search over the incident reference")
            @RequestParam(required = false) String search,
            @Parameter(description = "Filter by department id")
            @RequestParam(required = false) Long departmentId,
            @Parameter(description = "Media type filter — IMAGE or VIDEO (AUDIO rejected)")
            @RequestParam(required = false) AttachmentType fileType,
            @Parameter(description = "Inclusive lower uploadedAt bound (ISO yyyy-MM-dd)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Inclusive upper uploadedAt bound (ISO yyyy-MM-dd)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Sort token: newest (default), oldest or largest")
            @RequestParam(defaultValue = "newest") String sort,
            @PageableDefault(size = 24) Pageable pageable) {
        if (fileType == AttachmentType.AUDIO) {
            throw new IllegalArgumentException(
                    "Les clips vocaux (AUDIO) sont exclus de la gestion média administrative.");
        }
        Page<AdminMediaResponse> page = adminMediaService.listMedia(
                search, departmentId, fileType, startDate, endDate,
                PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), mapSort(sort)));
        return ResponseEntity.ok(page);
    }

    /** Storage summary — DB-tracked bytes by type + real host disk headroom. */
    @GetMapping("/stats")
    @Operation(summary = "Get storage summary",
            description = "Storage summary strip payload: DB-tracked bytes (total + per-type) and counts over "
                    + "non-deleted rows, plus real host disk headroom from the filesystem backing "
                    + "app.media.storage-path.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Storage summary",
                    content = @Content(schema = @Schema(implementation = AdminMediaStatsResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<AdminMediaStatsResponse> stats() {
        return ResponseEntity.ok(adminMediaService.stats());
    }

    /** Delete a single file: physical disk removal + DB audit stub. */
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a media file",
            description = "Deletes one attachment: the physical file is removed from disk and the DB row is "
                    + "soft-deleted into an immutable audit stub. AUDIO ids are rejected with 400.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Media deleted"),
            @ApiResponse(responseCode = "400", description = "AUDIO ids are not deletable on this surface"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Media not found")
    })
    public ResponseEntity<Void> deleteMedia(@PathVariable Long id) {
        adminMediaService.deleteMedia(id);
        return ResponseEntity.noContent().build();
    }

    /** Bulk delete: physical disk removal + audit stubs, returns exact freed bytes. */
    @PostMapping("/bulk-delete")
    @Operation(summary = "Bulk-delete media files",
            description = "Deletes the given attachment ids (BIGSERIAL), physically removing files and "
                    + "soft-deleting rows into audit stubs. Unknown/already-deleted ids are reported in "
                    + "skippedIds without failing the batch; AUDIO ids are skipped. Returns the exact freed "
                    + "bytes so the UI can show an 'espace libéré' summary.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Bulk deletion result",
                    content = @Content(schema = @Schema(implementation = MediaBulkDeleteResult.class))),
            @ApiResponse(responseCode = "400", description = "Empty id list"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<MediaBulkDeleteResult> bulkDelete(
            @Valid @RequestBody MediaBulkDeleteRequest request) {
        return ResponseEntity.ok(adminMediaService.bulkDelete(request.ids()));
    }

    /** Maps the UI's sort tokens to Spring Data sorts (critical: largest-first). */
    private Sort mapSort(String sort) {
        return switch (sort == null ? "newest" : sort) {
            case "oldest" -> Sort.by(Sort.Direction.ASC, "uploadedAt");
            case "largest" -> Sort.by(Sort.Direction.DESC, "fileSizeBytes");
            default -> Sort.by(Sort.Direction.DESC, "uploadedAt");
        };
    }
}
