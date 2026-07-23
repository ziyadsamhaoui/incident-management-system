package incident.management.system.repository;

import incident.management.system.enums.IncidentPriority;
import incident.management.system.enums.IncidentStatus;
import incident.management.system.enums.UserRole;
import incident.management.system.model.CategoryEntity;
import incident.management.system.model.DepartmentEntity;
import incident.management.system.model.IncidentEntity;
import incident.management.system.model.ProductionLineEntity;
import incident.management.system.model.SectionEntity;
import incident.management.system.model.StationEntity;
import incident.management.system.model.UserEntity;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;


// Reusable factory to generate test entity instances with valid properties
public final class TestEntityFactory {

    private static final AtomicLong counter = new AtomicLong(0);

    private TestEntityFactory() {
        // utility class
    }

    // Department
    public static DepartmentEntity createDepartment() {
        long n = counter.incrementAndGet();
        return DepartmentEntity.builder()
                .name("Department_" + n)
                .build();
    }

    // Section
    public static SectionEntity createSection() {
        long n = counter.incrementAndGet();
        return SectionEntity.builder()
                .name("Section_" + n)
                .build();
    }

    // ProductionLine
    public static ProductionLineEntity createProductionLine(final SectionEntity section) {
        long n = counter.incrementAndGet();
        return ProductionLineEntity.builder()
                .section(section)
                .name("ProductionLine_" + n)
                .build();
    }

    // Station
    public static StationEntity createStation(final ProductionLineEntity line) {
        long n = counter.incrementAndGet();
        return StationEntity.builder()
                .productionLine(line)
                .code("STN_" + n)
                .rowIndex(1)
                .lineIndex(1)
                .isWorking(true)
                .build();
    }

    // Category
    public static CategoryEntity createCategory() {
        long n = counter.incrementAndGet();
        return CategoryEntity.builder()
                .name("Category_" + n)
                .build();
    }

    // Creates a default user with userRole = SOUS_CHEF.
    public static UserEntity createUser() {
        long n = counter.incrementAndGet();
        return UserEntity.builder()
                .firstName("First_" + n)
                .lastName("Last_" + n)
                .email("user_" + n + "@test.local")
                .passwordHash("{bcrypt}$2a$10$dummyHashiDontUseInProduction")
                .matricule((int) (1_000 + n))
                .isActive(true)
                .role(UserRole.SOUS_CHEF)
                .failedLoginAttempts(0)
                .build();
    }

    // Creates a default user with userRole = ADMIN.
    public static UserEntity createAdmin() {
        long n = counter.incrementAndGet();
        return UserEntity.builder()
                .firstName("Admin_" + n)
                .lastName("User_" + n)
                .email("admin_" + n + "@test.local")
                .passwordHash("{bcrypt}$2a$10$dummyHashiDontUseInProduction")
                .matricule((int) (9_000 + n))
                .isActive(true)
                .role(UserRole.ADMIN)
                .failedLoginAttempts(0)
                .build();
    }

    // Creates a default incident with status = DECLARED & priority = MEDIUM.
    public static IncidentEntity createIncident() {
        long n = counter.incrementAndGet();
        return IncidentEntity.builder()
                .reference("INC" + String.format("%012d", n))
                .priority(IncidentPriority.MEDIUM)
                .status(IncidentStatus.DECLARED)
                .description("Test incident description #" + n)
                .build();
    }

    // Creates a resolved incident with status = RESOLVED to test auto-closure.
    public static IncidentEntity createResolvedIncident(final LocalDateTime resolvedAt) {
        long n = counter.incrementAndGet();
        return IncidentEntity.builder()
                .reference("RES" + String.format("%012d", n))
                .priority(IncidentPriority.MEDIUM)
                .status(IncidentStatus.RESOLVED)
                .description("Resolved test incident #" + n)
                .resolvedAt(resolvedAt)
                .resolutionNote("Fixed during test")
                .build();
    }
}
