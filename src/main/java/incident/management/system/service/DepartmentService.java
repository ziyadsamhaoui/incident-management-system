package incident.management.system.service;

import incident.management.system.dto.DepartmentResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class DepartmentService {
//
    private final DepartmentRepository departmentRepository;

    public DepartmentResponse createDepartment(String name) {
        DepartmentEntity entity = DepartmentEntity.builder()
                .name(name)
                .build();
        return toResponse(departmentRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public DepartmentResponse getDepartmentById(Long id) {
        return departmentRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", id));
    }

    @Transactional(readOnly = true)
    public Page<DepartmentResponse> getAllDepartments(Pageable pageable) {
        return departmentRepository.findAll(pageable).map(this::toResponse);
    }

    public DepartmentResponse updateDepartment(Long id, String name) {
        DepartmentEntity entity = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", id));
        entity.setName(name);
        return toResponse(departmentRepository.save(entity));
    }

    public void deleteDepartment(Long id) {
        if (!departmentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Department", "id", id);
        }
        departmentRepository.deleteById(id);
    }

    private DepartmentResponse toResponse(DepartmentEntity entity) {
        return new DepartmentResponse(entity.getId(), entity.getName());
    }
}
