package incident.management.system.repository;

import incident.management.system.model.UserEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;


class UserRepositoryTest extends BaseRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    //  User soft delete lifecycle
    @Nested
    @DisplayName("Soft-delete lifecycle")
    class SoftDeleteTest {

        @Test
        @DisplayName("should save active user with isActive = true and deletedAt = null")
        void activeUserDefaults() {
            UserEntity user = userRepository.save(TestEntityFactory.createUser());

            Optional<UserEntity> found = userRepository.findById(user.getId());
            assertThat(found).isPresent();
            assertThat(found.get().isActive()).isTrue();
            assertThat(found.get().getDeletedAt()).isNull();
        }

        @Test
        @DisplayName("should persist deactivate() mapping: isActive = false, deletedAt != null")
        void deactivateSetsFlags() {
            UserEntity user = userRepository.save(TestEntityFactory.createUser());

            // Apply user deactivation operation
            user.deactivate();
            userRepository.save(user);

            Optional<UserEntity> found = userRepository.findById(user.getId());
            assertThat(found).isPresent();
            assertThat(found.get().isActive()).isFalse();
            assertThat(found.get().getDeletedAt()).isNotNull();
        }

        @Test
        @DisplayName("should keep active users unaffected when deactivating another user")
        void deactivateIsolation() {
            UserEntity active = userRepository.save(TestEntityFactory.createUser());
            UserEntity toDelete = userRepository.save(TestEntityFactory.createUser());

            toDelete.deactivate();
            userRepository.save(toDelete);

            // Reload the active user which must still be active
            Optional<UserEntity> stillActive = userRepository.findById(active.getId());
            assertThat(stillActive).isPresent();
            assertThat(stillActive.get().isActive()).isTrue();
            assertThat(stillActive.get().getDeletedAt()).isNull();
        }

        @Test
        @DisplayName("should find by email after soft-delete (data remains in table)")
        void findByEmailAfterDeactivation() {
            UserEntity user = userRepository.save(TestEntityFactory.createUser());
            String email = user.getEmail();

            user.deactivate();
            userRepository.save(user);

            // The row still exists which means soft delete never removes db records
            Optional<UserEntity> found = userRepository.findByEmail(email);
            assertThat(found).isPresent();
            assertThat(found.get().isActive()).isFalse();
            assertThat(found.get().getDeletedAt()).isNotNull();
        }

        @Test
        @DisplayName("should find by matricule after soft-delete (data remains in table)")
        void findByMatriculeAfterDeactivation() {
            UserEntity user = userRepository.save(TestEntityFactory.createUser());
            int matricule = user.getMatricule();

            user.deactivate();
            userRepository.save(user);

            Optional<UserEntity> found = userRepository.findByMatricule(matricule);
            assertThat(found).isPresent();
            assertThat(found.get().isActive()).isFalse();
        }
    }

    //  Basic CRUD
    @Nested
    @DisplayName("Basic CRUD operations")
    class CrudTest {

        @Test
        @DisplayName("should save and retrieve a user")
        void saveAndRetrieve() {
            UserEntity user = TestEntityFactory.createUser();
            user.setDepartment(null); // department is optional
            UserEntity saved = userRepository.save(user);

            assertThat(saved.getId()).isNotNull();

            Optional<UserEntity> found = userRepository.findById(saved.getId());
            assertThat(found).isPresent();
            assertThat(found.get().getEmail()).isEqualTo(user.getEmail());
            assertThat(found.get().getMatricule()).isEqualTo(user.getMatricule());
        }

        @Test
        @DisplayName("should return empty when email does not exist")
        void findByEmailNotFound() {
            Optional<UserEntity> result = userRepository.findByEmail("nonexistent@test.local");
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should return empty when matricule does not exist")
        void findByMatriculeNotFound() {
            Optional<UserEntity> result = userRepository.findByMatricule(-1);
            assertThat(result).isEmpty();
        }
    }
}
