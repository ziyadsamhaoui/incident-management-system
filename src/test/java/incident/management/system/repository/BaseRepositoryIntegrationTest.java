package incident.management.system.repository;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

// Abstract class for repository integration tests
//
// Singleton Container Pattern: The PostgreSQL container is started exactly once
// in a static initializer, NOT via @Container.  This avoids the stale-port
// problem that occurs when @Container stops/recreates containers between
// test classes while Spring caches the ApplicationContext (and therefore
// @DynamicPropertySource is evaluated only once per context lifetime).
//
// With manual static lifecycle:
//   - The container lives for the entire test suite execution.
//   - HikariCP always resolves the live mapped port.
//   - Ryuk (Testcontainers' sidecar) cleans up the container when the JVM exits.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
public abstract class BaseRepositoryIntegrationTest {

    private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    static {
        try {
            postgres.start();
        } catch (Exception e) {
            throw new RuntimeException("Failed to start PostgreSQL Testcontainer", e);
        }
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
