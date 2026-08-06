package incident.management.system.controller;

import incident.management.system.dto.AdminMediaResponse;
import incident.management.system.dto.AdminMediaStatsResponse;
import incident.management.system.dto.MediaBulkDeleteRequest;
import incident.management.system.dto.MediaBulkDeleteResult;
import incident.management.system.enums.AttachmentType;
import incident.management.system.service.AdminMediaService;
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
public class AdminMediaController {

    private final AdminMediaService adminMediaService;

    /** Paginated media inventory — search by incident reference, department, type, date range, size/date sort. */
    @GetMapping
    public ResponseEntity<Page<AdminMediaResponse>> listMedia(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) AttachmentType fileType,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
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
    public ResponseEntity<AdminMediaStatsResponse> stats() {
        return ResponseEntity.ok(adminMediaService.stats());
    }

    /** Delete a single file: physical disk removal + DB audit stub. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMedia(@PathVariable Long id) {
        adminMediaService.deleteMedia(id);
        return ResponseEntity.noContent().build();
    }

    /** Bulk delete: physical disk removal + audit stubs, returns exact freed bytes. */
    @PostMapping("/bulk-delete")
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
