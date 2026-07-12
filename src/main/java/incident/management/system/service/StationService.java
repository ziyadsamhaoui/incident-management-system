package incident.management.system.service;

import incident.management.system.dto.StationResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.ProductionLineEntity;
import incident.management.system.model.StationEntity;
import incident.management.system.repository.ProductionLineRepository;
import incident.management.system.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class StationService {
//
    private final StationRepository stationRepository;
    private final ProductionLineRepository productionLineRepository;

    public StationResponse createStation(String code, int rowIndex, int lineIndex, boolean isWorking, Long productionLineId) {
        ProductionLineEntity productionLine = productionLineRepository.findById(productionLineId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionLine", "id", productionLineId));
        StationEntity entity = StationEntity.builder()
                .code(code)
                .rowIndex(rowIndex)
                .lineIndex(lineIndex)
                .isWorking(isWorking)
                .productionLine(productionLine)
                .build();
        return toResponse(stationRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public StationResponse getStationById(Long id) {
        return stationRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Station", "id", id));
    }

    @Transactional(readOnly = true)
    public Page<StationResponse> getAllStations(Pageable pageable) {
        return stationRepository.findAll(pageable).map(this::toResponse);
    }

    public StationResponse updateStation(Long id, String code, Integer rowIndex, Integer lineIndex, Boolean isWorking, Long productionLineId) {
        StationEntity entity = stationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station", "id", id));
        if (code != null) {
            entity.setCode(code);
        }
        if (rowIndex != null) {
            entity.setRowIndex(rowIndex);
        }
        if (lineIndex != null) {
            entity.setLineIndex(lineIndex);
        }
        if (isWorking != null) {
            entity.setWorking(isWorking);
        }
        if (productionLineId != null) {
            ProductionLineEntity productionLine = productionLineRepository.findById(productionLineId)
                    .orElseThrow(() -> new ResourceNotFoundException("ProductionLine", "id", productionLineId));
            entity.setProductionLine(productionLine);
        }
        return toResponse(stationRepository.save(entity));
    }

    public void deleteStation(Long id) {
        if (!stationRepository.existsById(id)) {
            throw new ResourceNotFoundException("Station", "id", id);
        }
        stationRepository.deleteById(id);
    }

    private StationResponse toResponse(StationEntity entity) {
        return new StationResponse(
                entity.getId(),
                entity.getCode(),
                entity.getRowIndex(),
                entity.getLineIndex(),
                entity.isWorking(),
                entity.getProductionLine() != null ? entity.getProductionLine().getId() : null
        );
    }
}
