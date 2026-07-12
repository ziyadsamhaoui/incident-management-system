package incident.management.system.service;

import incident.management.system.dto.CategoryResponse;
import incident.management.system.exception.ResourceNotFoundException;
import incident.management.system.model.CategoryEntity;
import incident.management.system.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class CategoryService {
//
    private final CategoryRepository categoryRepository;

    public CategoryResponse createCategory(String name) {
        CategoryEntity entity = CategoryEntity.builder()
                .name(name)
                .build();
        return toResponse(categoryRepository.save(entity));
    }

    public CategoryResponse getCategoryById(Long id) {
        return categoryRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
    }

    @Transactional(readOnly = true)
    public Page<CategoryResponse> getAllCategories(Pageable pageable) {
        return categoryRepository.findAll(pageable).map(this::toResponse);
    }

    public CategoryResponse updateCategory(Long id, String name) {
        CategoryEntity entity = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        entity.setName(name);
        return toResponse(categoryRepository.save(entity));
    }

    public void deleteCategory(Long id) {
        if (!categoryRepository.existsById(id)) {
            throw new ResourceNotFoundException("Category", "id", id);
        }
        categoryRepository.deleteById(id);
    }

    private CategoryResponse toResponse(CategoryEntity entity) {
        return new CategoryResponse(entity.getId(), entity.getName());
    }
}
