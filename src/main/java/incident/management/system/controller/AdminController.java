package incident.management.system.controller;

import incident.management.system.dto.*;
import incident.management.system.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final CategoryService categoryService;
    private final DepartmentService departmentService;
    private final SectionService sectionService;
    private final ProductionLineService productionLineService;
    private final StationService stationService;

    // ──────────────────────────────────────────────
    //  Categories
    // ──────────────────────────────────────────────

    @PostMapping("/categories")
    public ResponseEntity<CategoryResponse> createCategory(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoryService.createCategory(body.get("name")));
    }

    @GetMapping("/categories")
    public ResponseEntity<Page<CategoryResponse>> getAllCategories(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(categoryService.getAllCategories(pageable));
    }

    @GetMapping("/categories/{id}")
    public ResponseEntity<CategoryResponse> getCategoryById(@PathVariable Long id) {
        return ResponseEntity.ok(categoryService.getCategoryById(id));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(categoryService.updateCategory(id, body.get("name")));
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────────────────────────
    //  Departments
    // ──────────────────────────────────────────────

    @PostMapping("/departments")
    public ResponseEntity<DepartmentResponse> createDepartment(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(departmentService.createDepartment(body.get("name")));
    }

    @GetMapping("/departments")
    public ResponseEntity<Page<DepartmentResponse>> getAllDepartments(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(departmentService.getAllDepartments(pageable));
    }

    @GetMapping("/departments/{id}")
    public ResponseEntity<DepartmentResponse> getDepartmentById(@PathVariable Long id) {
        return ResponseEntity.ok(departmentService.getDepartmentById(id));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<DepartmentResponse> updateDepartment(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(departmentService.updateDepartment(id, body.get("name")));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Long id) {
        departmentService.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────────────────────────
    //  Sections
    // ──────────────────────────────────────────────

    @PostMapping("/sections")
    public ResponseEntity<SectionResponse> createSection(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sectionService.createSection(body.get("name")));
    }

    @GetMapping("/sections")
    public ResponseEntity<Page<SectionResponse>> getAllSections(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(sectionService.getAllSections(pageable));
    }

    @GetMapping("/sections/{id}")
    public ResponseEntity<SectionResponse> getSectionById(@PathVariable Long id) {
        return ResponseEntity.ok(sectionService.getSectionById(id));
    }

    @PutMapping("/sections/{id}")
    public ResponseEntity<SectionResponse> updateSection(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(sectionService.updateSection(id, body.get("name")));
    }

    @DeleteMapping("/sections/{id}")
    public ResponseEntity<Void> deleteSection(@PathVariable Long id) {
        sectionService.deleteSection(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────────────────────────
    //  Production Lines
    // ──────────────────────────────────────────────

    @PostMapping("/production-lines")
    public ResponseEntity<ProductionLineResponse> createProductionLine(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        Long sectionId = body.get("sectionId") != null ? Long.valueOf(body.get("sectionId").toString()) : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productionLineService.createProductionLine(name, sectionId));
    }

    @GetMapping("/production-lines")
    public ResponseEntity<Page<ProductionLineResponse>> getAllProductionLines(
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(productionLineService.getAllProductionLines(pageable));
    }

    @GetMapping("/production-lines/{id}")
    public ResponseEntity<ProductionLineResponse> getProductionLineById(@PathVariable Long id) {
        return ResponseEntity.ok(productionLineService.getProductionLineById(id));
    }

    @PutMapping("/production-lines/{id}")
    public ResponseEntity<ProductionLineResponse> updateProductionLine(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        Long sectionId = body.get("sectionId") != null ? Long.valueOf(body.get("sectionId").toString()) : null;
        return ResponseEntity.ok(productionLineService.updateProductionLine(id, name, sectionId));
    }

    @DeleteMapping("/production-lines/{id}")
    public ResponseEntity<Void> deleteProductionLine(@PathVariable Long id) {
        productionLineService.deleteProductionLine(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────────────────────────
    //  Stations
    // ──────────────────────────────────────────────

    @PostMapping("/stations")
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
    public ResponseEntity<Page<StationResponse>> getAllStations(@PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(stationService.getAllStations(pageable));
    }

    @GetMapping("/stations/{id}")
    public ResponseEntity<StationResponse> getStationById(@PathVariable Long id) {
        return ResponseEntity.ok(stationService.getStationById(id));
    }

    @PutMapping("/stations/{id}")
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
    public ResponseEntity<Void> deleteStation(@PathVariable Long id) {
        stationService.deleteStation(id);
        return ResponseEntity.noContent().build();
    }
}
