package incident.management.system.controller;

import incident.management.system.dto.CategoryResponse;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.GenerateResetCodeResponse;
import incident.management.system.dto.ProductionLineResponse;
import incident.management.system.dto.SectionResponse;
import incident.management.system.dto.StationResponse;
import incident.management.system.service.AuthService;
import incident.management.system.service.CategoryService;
import incident.management.system.service.DepartmentService;
import incident.management.system.service.ProductionLineService;
import incident.management.system.service.SectionService;
import incident.management.system.service.StationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
@Tag(name = "Admin - Reference Data",
        description = "ADMIN-only reference-data management (categories, departments, sections, production "
                + "lines, stations) plus the supervisor-mediated password-reset code issuance. Every "
                + "operation requires the ADMIN role — non-admins receive 403.")
public class AdminController {

    private final AuthService authService;
    private final CategoryService categoryService;
    private final DepartmentService departmentService;
    private final SectionService sectionService;
    private final ProductionLineService productionLineService;
    private final StationService stationService;

    //  Deletion safety guard — reference data linked to incidents (or other
    //  entities) cannot be deleted. Exposed as a friendly 409 so the frontend
    //  can render an actionable warning instead of a generic 500.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleReferenceDataDeletionGuard(DataIntegrityViolationException ex) {
        log.warn("Reference data deletion blocked by FK constraint: {}", ex.getMessage());
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("status", HttpStatus.CONFLICT.value());
        body.put("message", "Impossible de supprimer : cet élément est référencé par des données existantes (incidents ou sous-entités).");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    //  Supervisor-mediated reset-code generation (authentication hardening)

    /**
     * Generates a 6-character, single-use reset code for a CHEF_ATELIER or
     * SOUS_CHEF account — for in-person handoff to the employee. Only the
     * SHA-256 hash of the code is persisted (15-minute TTL); the plaintext
     * is returned once in the response body. Requires ADMIN (class-level
     * {@code @PreAuthorize} + explicit guard here).
     */
    @PostMapping("/users/{id}/generate-reset-code")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Generate a supervisor password-reset code",
            description = "Issues a secure 6-character, single-use reset code (unambiguous alphabet, "
                    + "SecureRandom) for in-person handoff to a CHEF_ATELIER or SOUS_CHEF employee. Only "
                    + "the SHA-256 hash is persisted with a 15-minute TTL; the plaintext is returned exactly "
                    + "once. Generating a new code invalidates any previous one and writes a GENERATE_RESET_CODE "
                    + "audit entry. ADMIN targets are rejected.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reset code issued",
                    content = @Content(schema = @Schema(implementation = GenerateResetCodeResponse.class))),
            @ApiResponse(responseCode = "400", description = "Target not eligible (ADMIN or inactive account)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<GenerateResetCodeResponse> generateResetCode(@PathVariable Long id) {
        return ResponseEntity.ok(authService.generateAdminResetCode(id));
    }

    //  Categories

    @PostMapping("/categories")
    @Operation(summary = "Create a category",
            description = "Creates a reference-data category from a simple {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Category created",
                    content = @Content(schema = @Schema(implementation = CategoryResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<CategoryResponse> createCategory(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoryService.createCategory(body.get("name")));
    }

    @GetMapping("/categories")
    @Operation(summary = "List categories",
            description = "Paginated categories for the reference-data management surface.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated categories (Page<CategoryResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<CategoryResponse>> getAllCategories(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(categoryService.getAllCategories(pageable));
    }

    @GetMapping("/categories/{id}")
    @Operation(summary = "Get a category by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Category detail",
                    content = @Content(schema = @Schema(implementation = CategoryResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Category not found")
    })
    public ResponseEntity<CategoryResponse> getCategoryById(@PathVariable Long id) {
        return ResponseEntity.ok(categoryService.getCategoryById(id));
    }

    @PutMapping("/categories/{id}")
    @Operation(summary = "Update a category",
            description = "Renames a category from a {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Category updated",
                    content = @Content(schema = @Schema(implementation = CategoryResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Category not found")
    })
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(categoryService.updateCategory(id, body.get("name")));
    }

    @DeleteMapping("/categories/{id}")
    @Operation(summary = "Delete a category",
            description = "Deletes a category. Deletion is refused with 409 when the category is referenced "
                    + "by incidents or child reference data.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Category deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Category not found"),
            @ApiResponse(responseCode = "409", description = "Category referenced by existing data — deletion blocked")
    })
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    //  Departments

    @PostMapping("/departments")
    @Operation(summary = "Create a department",
            description = "Creates a reference-data department from a {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Department created",
                    content = @Content(schema = @Schema(implementation = DepartmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<DepartmentResponse> createDepartment(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(departmentService.createDepartment(body.get("name")));
    }

    @GetMapping("/departments")
    @Operation(summary = "List departments")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated departments (Page<DepartmentResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<DepartmentResponse>> getAllDepartments(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(departmentService.getAllDepartments(pageable));
    }

    @GetMapping("/departments/{id}")
    @Operation(summary = "Get a department by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Department detail",
                    content = @Content(schema = @Schema(implementation = DepartmentResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Department not found")
    })
    public ResponseEntity<DepartmentResponse> getDepartmentById(@PathVariable Long id) {
        return ResponseEntity.ok(departmentService.getDepartmentById(id));
    }

    @PutMapping("/departments/{id}")
    @Operation(summary = "Update a department",
            description = "Renames a department from a {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Department updated",
                    content = @Content(schema = @Schema(implementation = DepartmentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Department not found")
    })
    public ResponseEntity<DepartmentResponse> updateDepartment(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(departmentService.updateDepartment(id, body.get("name")));
    }

    @DeleteMapping("/departments/{id}")
    @Operation(summary = "Delete a department",
            description = "Deletes a department. Deletion is refused with 409 when the department is "
                    + "referenced by incidents or child reference data.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Department deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Department not found"),
            @ApiResponse(responseCode = "409", description = "Department referenced by existing data — deletion blocked")
    })
    public ResponseEntity<Void> deleteDepartment(@PathVariable Long id) {
        departmentService.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    //  Sections

    @PostMapping("/sections")
    @Operation(summary = "Create a section",
            description = "Creates a reference-data section from a {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Section created",
                    content = @Content(schema = @Schema(implementation = SectionResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<SectionResponse> createSection(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sectionService.createSection(body.get("name")));
    }

    @GetMapping("/sections")
    @Operation(summary = "List sections")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated sections (Page<SectionResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<SectionResponse>> getAllSections(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(sectionService.getAllSections(pageable));
    }

    @GetMapping("/sections/{id}")
    @Operation(summary = "Get a section by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Section detail",
                    content = @Content(schema = @Schema(implementation = SectionResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Section not found")
    })
    public ResponseEntity<SectionResponse> getSectionById(@PathVariable Long id) {
        return ResponseEntity.ok(sectionService.getSectionById(id));
    }

    @PutMapping("/sections/{id}")
    @Operation(summary = "Update a section",
            description = "Renames a section from a {\"name\": \"...\"} payload.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Section updated",
                    content = @Content(schema = @Schema(implementation = SectionResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing or duplicate name"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Section not found")
    })
    public ResponseEntity<SectionResponse> updateSection(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(sectionService.updateSection(id, body.get("name")));
    }

    @DeleteMapping("/sections/{id}")
    @Operation(summary = "Delete a section",
            description = "Deletes a section. Deletion is refused with 409 when the section is referenced "
                    + "by production lines or other data.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Section not found"),
            @ApiResponse(responseCode = "409", description = "Section referenced by existing data — deletion blocked")
    })
    public ResponseEntity<Void> deleteSection(@PathVariable Long id) {
        sectionService.deleteSection(id);
        return ResponseEntity.noContent().build();
    }

    //  Production Lines

    @PostMapping("/production-lines")
    @Operation(summary = "Create a production line",
            description = "Creates a production line under a section: {\"name\": \"...\", \"sectionId\": 1}.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Production line created",
                    content = @Content(schema = @Schema(implementation = ProductionLineResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing name or unknown sectionId"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<ProductionLineResponse> createProductionLine(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        Long sectionId = body.get("sectionId") != null ? Long.valueOf(body.get("sectionId").toString()) : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productionLineService.createProductionLine(name, sectionId));
    }

    @GetMapping("/production-lines")
    @Operation(summary = "List production lines")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated production lines (Page<ProductionLineResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<ProductionLineResponse>> getAllProductionLines(
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(productionLineService.getAllProductionLines(pageable));
    }

    @GetMapping("/production-lines/{id}")
    @Operation(summary = "Get a production line by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Production line detail",
                    content = @Content(schema = @Schema(implementation = ProductionLineResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Production line not found")
    })
    public ResponseEntity<ProductionLineResponse> getProductionLineById(@PathVariable Long id) {
        return ResponseEntity.ok(productionLineService.getProductionLineById(id));
    }

    @PutMapping("/production-lines/{id}")
    @Operation(summary = "Update a production line",
            description = "Updates the name and/or section of a production line: {\"name\": \"...\", \"sectionId\": 1}.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Production line updated",
                    content = @Content(schema = @Schema(implementation = ProductionLineResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing name or unknown sectionId"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Production line not found")
    })
    public ResponseEntity<ProductionLineResponse> updateProductionLine(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        Long sectionId = body.get("sectionId") != null ? Long.valueOf(body.get("sectionId").toString()) : null;
        return ResponseEntity.ok(productionLineService.updateProductionLine(id, name, sectionId));
    }

    @DeleteMapping("/production-lines/{id}")
    @Operation(summary = "Delete a production line",
            description = "Deletes a production line. Deletion is refused with 409 when stations reference it.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Production line deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Production line not found"),
            @ApiResponse(responseCode = "409", description = "Production line referenced by existing data — deletion blocked")
    })
    public ResponseEntity<Void> deleteProductionLine(@PathVariable Long id) {
        productionLineService.deleteProductionLine(id);
        return ResponseEntity.noContent().build();
    }

    //  Stations

    @PostMapping("/stations")
    @Operation(summary = "Create a station",
            description = "Creates a station: {\"code\": \"STN_12\", \"rowIndex\": 0, \"lineIndex\": 1, "
                    + "\"isWorking\": true, \"productionLineId\": 3}. rowIndex/lineIndex default to 0, "
                    + "isWorking defaults to true.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Station created",
                    content = @Content(schema = @Schema(implementation = StationResponse.class))),
            @ApiResponse(responseCode = "400", description = "Missing code or unknown productionLineId"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<StationResponse> createStation(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        int rowIndex = body.get("rowIndex") != null ? ((Number) body.get("rowIndex")).intValue() : 0;
        int lineIndex = body.get("lineIndex") != null ? ((Number) body.get("lineIndex")).intValue() : 0;
        boolean isWorking = body.get("isWorking") == null || Boolean.TRUE.equals(body.get("isWorking"));
        Long productionLineId = body.get("productionLineId") != null
                ? Long.valueOf(body.get("productionLineId").toString()) : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stationService.createStation(code, rowIndex, lineIndex, isWorking, productionLineId));
    }

    @GetMapping("/stations")
    @Operation(summary = "List stations")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Paginated stations (Page<StationResponse>)"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required")
    })
    public ResponseEntity<Page<StationResponse>> getAllStations(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(stationService.getAllStations(pageable));
    }

    @GetMapping("/stations/{id}")
    @Operation(summary = "Get a station by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Station detail",
                    content = @Content(schema = @Schema(implementation = StationResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Station not found")
    })
    public ResponseEntity<StationResponse> getStationById(@PathVariable Long id) {
        return ResponseEntity.ok(stationService.getStationById(id));
    }

    @PutMapping("/stations/{id}")
    @Operation(summary = "Update a station",
            description = "Updates station fields; any omitted field keeps its current value.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Station updated",
                    content = @Content(schema = @Schema(implementation = StationResponse.class))),
            @ApiResponse(responseCode = "400", description = "Unknown productionLineId"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Station not found")
    })
    public ResponseEntity<StationResponse> updateStation(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        Integer rowIndex = body.get("rowIndex") != null ? ((Number) body.get("rowIndex")).intValue() : null;
        Integer lineIndex = body.get("lineIndex") != null ? ((Number) body.get("lineIndex")).intValue() : null;
        Boolean isWorking = body.containsKey("isWorking") ? Boolean.TRUE.equals(body.get("isWorking")) : null;
        Long productionLineId = body.get("productionLineId") != null
                ? Long.valueOf(body.get("productionLineId").toString()) : null;
        return ResponseEntity.ok(stationService.updateStation(id, code, rowIndex, lineIndex, isWorking, productionLineId));
    }

    @DeleteMapping("/stations/{id}")
    @Operation(summary = "Delete a station",
            description = "Deletes a station. Deletion is refused with 409 when the station is referenced "
                    + "by incidents.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Station deleted"),
            @ApiResponse(responseCode = "403", description = "ADMIN role required"),
            @ApiResponse(responseCode = "404", description = "Station not found"),
            @ApiResponse(responseCode = "409", description = "Station referenced by existing data — deletion blocked")
    })
    public ResponseEntity<Void> deleteStation(@PathVariable Long id) {
        stationService.deleteStation(id);
        return ResponseEntity.noContent().build();
    }
}
