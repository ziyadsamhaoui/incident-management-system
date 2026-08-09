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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Reference Data",
        description = "Read-only reference data for any authenticated role (declare form, onboarding, filter "
                + "dropdowns). Write operations live under Admin - Reference Data.")
public class ReferenceDataController {

    private static final int MAX_REFERENCE_ITEMS = 1000;

    private final CategoryService categoryService;
    private final DepartmentService departmentService;
    private final SectionService sectionService;
    private final ProductionLineService productionLineService;
    private final StationService stationService;

    @GetMapping("/categories")
    @Operation(summary = "List categories",
            description = "All categories (up to 1000) for dropdowns — any authenticated role.")
    @ApiResponses({
            // Array schema is derived from the List<CategoryResponse> return type.
            @ApiResponse(responseCode = "200", description = "Categories (CategoryResponse[])"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public List<CategoryResponse> getCategories() {
        return categoryService.getAllCategories(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/departments")
    @Operation(summary = "List departments",
            description = "All departments (up to 1000) for dropdowns — any authenticated role.")
    @ApiResponses({
            // Array schema is derived from the List<DepartmentResponse> return type.
            @ApiResponse(responseCode = "200", description = "Departments (DepartmentResponse[])"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public List<DepartmentResponse> getDepartments() {
        return departmentService.getAllDepartments(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/sections")
    @Operation(summary = "List sections",
            description = "All sections (up to 1000) for dropdowns — any authenticated role.")
    @ApiResponses({
            // Array schema is derived from the List<SectionResponse> return type.
            @ApiResponse(responseCode = "200", description = "Sections (SectionResponse[])"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public List<SectionResponse> getSections() {
        return sectionService.getAllSections(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/production-lines")
    @Operation(summary = "List production lines",
            description = "All production lines (up to 1000) for dropdowns — any authenticated role.")
    @ApiResponses({
            // Array schema is derived from the List<ProductionLineResponse> return type.
            @ApiResponse(responseCode = "200", description = "Production lines (ProductionLineResponse[])"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public List<ProductionLineResponse> getProductionLines() {
        return productionLineService.getAllProductionLines(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }

    @GetMapping("/stations")
    @Operation(summary = "List stations",
            description = "All stations (up to 1000) for dropdowns — any authenticated role.")
    @ApiResponses({
            // Array schema is derived from the List<StationResponse> return type.
            @ApiResponse(responseCode = "200", description = "Stations (StationResponse[])"),
            @ApiResponse(responseCode = "403", description = "Missing or invalid JWT")
    })
    public List<StationResponse> getStations() {
        return stationService.getAllStations(PageRequest.of(0, MAX_REFERENCE_ITEMS)).getContent();
    }
}
