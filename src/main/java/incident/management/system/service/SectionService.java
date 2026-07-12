package incident.management.system.service;

import incident.management.system.dto.SectionResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.SectionEntity;
import incident.management.system.repository.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class SectionService {
//
    private final SectionRepository sectionRepository;

    public SectionResponse createSection(String name) {
        SectionEntity entity = SectionEntity.builder()
                .name(name)
                .build();
        return toResponse(sectionRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public SectionResponse getSectionById(Long id) {
        return sectionRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Section", "id", id));
    }

    @Transactional(readOnly = true)
    public Page<SectionResponse> getAllSections(Pageable pageable) {
        return sectionRepository.findAll(pageable).map(this::toResponse);
    }

    public SectionResponse updateSection(Long id, String name) {
        SectionEntity entity = sectionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Section", "id", id));
        entity.setName(name);
        return toResponse(sectionRepository.save(entity));
    }

    public void deleteSection(Long id) {
        if (!sectionRepository.existsById(id)) {
            throw new ResourceNotFoundException("Section", "id", id);
        }
        sectionRepository.deleteById(id);
    }

    private SectionResponse toResponse(SectionEntity entity) {
        return new SectionResponse(entity.getId(), entity.getName());
    }
}
