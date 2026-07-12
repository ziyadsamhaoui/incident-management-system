package incident.management.system.service;

import incident.management.system.dto.ProductionLineResponse;
import incident.management.system.dto.SectionResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.ProductionLineEntity;
import incident.management.system.model.SectionEntity;
import incident.management.system.repository.ProductionLineRepository;
import incident.management.system.repository.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Service
@RequiredArgsConstructor
@Transactional
public class ProductionLineService {
//
    private final ProductionLineRepository productionLineRepository;
    private final SectionRepository sectionRepository;

    public ProductionLineResponse createProductionLine(String name, Long sectionId) {
        SectionEntity section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Section", "id", sectionId));
        ProductionLineEntity entity = ProductionLineEntity.builder()
                .name(name)
                .section(section)
                .build();
        return toResponse(productionLineRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public ProductionLineResponse getProductionLineById(Long id) {
        return productionLineRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionLine", "id", id));
    }

    @Transactional(readOnly = true)
    public Page<ProductionLineResponse> getAllProductionLines(Pageable pageable) {
        return productionLineRepository.findAll(pageable).map(this::toResponse);
    }

    public ProductionLineResponse updateProductionLine(Long id, String name, Long sectionId) {
        ProductionLineEntity entity = productionLineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionLine", "id", id));
        if (name != null) {
            entity.setName(name);
        }
        if (sectionId != null) {
            SectionEntity section = sectionRepository.findById(sectionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Section", "id", sectionId));
            entity.setSection(section);
        }
        return toResponse(productionLineRepository.save(entity));
    }

    public void deleteProductionLine(Long id) {
        if (!productionLineRepository.existsById(id)) {
            throw new ResourceNotFoundException("ProductionLine", "id", id);
        }
        productionLineRepository.deleteById(id);
    }

    private ProductionLineResponse toResponse(ProductionLineEntity entity) {
        SectionResponse sectionResponse = entity.getSection() != null
                ? new SectionResponse(entity.getSection().getId(), entity.getSection().getName())
                : null;
        return new ProductionLineResponse(entity.getId(), entity.getName(), sectionResponse);
    }
}
