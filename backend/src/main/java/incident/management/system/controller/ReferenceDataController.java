package incident.management.system.controller;

import incident.management.system.dto.CategoryResponse;
import incident.management.system.dto.DepartmentResponse;
import incident.management.system.dto.ProductionLineResponse;
import incident.management.system.dto.SectionResponse;
import incident.management.system.dto.StationResponse;
import incident.management.system.service.CategoryService;
import incident.management.system.service.DepartmentService;
import incident.management.system.service.ProductionLineService;
import incident.management.system.service.SectionService;
import incident.management.system.service.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only reference data endpoints, accessible to any authenticated role.
 * Used by the declare form, onboarding and admin filter dropdowns —
 * unlike {@code /api/admin/*} these are not ADMIN-gated.
 */
@RestController
@RequestMapping("/api/reference-data")
@RequiredArgsConstructor
public class ReferenceDataController {

    private static final int MAX_REFERENCE_ITEMS = 1000;

    private final CategoryService categoryService;
    private final DepartmentService departmentService;
    private final SectionService sectionService;
    private final ProductionLineService productionLineService;
    private final StationService stationService;

    @GetMapping("/categories")
    public List<CategoryResponse> getCategories() {
        return categoryService.getAllCategories(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/departments")
    public List<DepartmentResponse> getDepartments() {
        return departmentService.getAllDepartments(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/sections")
    public List<SectionResponse> getSections() {
        return sectionService.getAllSections(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/production-lines")
    public List<ProductionLineResponse> getProductionLines() {
        return productionLineService.getAllProductionLines(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/stations")
    public List<StationResponse> getStations() {
        return stationService.getAllStations(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }
}
