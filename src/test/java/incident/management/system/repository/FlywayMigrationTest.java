package incident.management.system.repository;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class FlywayMigrationTest {

    @Container
    static PostgreSQLContainer<?> flywayPostgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("flyway_test")
            .withUsername("test")
            .withPassword("test");

    private Flyway flyway;

    @BeforeEach
    void setUp() {
        flyway = Flyway.configure()
                .dataSource(
                        flywayPostgres.getJdbcUrl(),
                        flywayPostgres.getUsername(),
                        flywayPostgres.getPassword()
                )
                .locations("classpath:db/migration")
                .load();
    }

    @Test
    void fullMigration_executesSuccessfully() {
        MigrateResult result = flyway.migrate();

        assertThat(result.success)
                .as("Flyway migrate() should report success = true")
                .isTrue();
        assertThat(result.migrationsExecuted)
                .as("Expected exactly 2 migrations (V1 baseline + V2 refactor)")
                .isEqualTo(2);
        assertThat(result.migrations)
                .extracting(m -> m.version)
                .containsExactly("1", "2");
    }

    @Test
    void baselineThenIncremental_appliesCorrectly() {
        flyway.migrate();

        MigrationInfo[] applied = flyway.info().applied();
        assertThat(applied)
                .as("Flyway schema_history should have 2 applied migrations")
                .hasSize(2);

        assertThat(applied[0].getVersion().toString())
                .as("First migration should be version 1")
                .isEqualTo("1");
        assertThat(applied[0].getDescription())
                .as("First migration description")
                .containsIgnoringCase("baseline");

        assertThat(applied[1].getVersion().toString())
                .as("Second migration should be version 2")
                .isEqualTo("2");
        assertThat(applied[1].getDescription())
                .as("Second migration description")
                .containsIgnoringCase("refactor");
    }

    @Test
    void schemaIsUpToDate_noPendingMigrations() {
        flyway.migrate();

        MigrationInfo[] pending = flyway.info().pending();

        assertThat(pending)
                .as("All migrations should be applied — no pending migrations should remain")
                .isEmpty();
    }

    @Test
    void flywayHistoryTableIsCreated() {
        flyway.migrate();

        assertTableExists("flyway_schema_history");
    }

    @Test
    void allExpectedTablesAreCreated() {
        flyway.migrate();

        // Core domain tables (9)
        assertTableExists("categories");
        assertTableExists("departments");
        assertTableExists("sections");
        assertTableExists("production_lines");
        assertTableExists("stations");
        assertTableExists("users");
        assertTableExists("incidents");
        assertTableExists("incident_history");
        assertTableExists("notifications");

        // Infrastructure tables (3)
        assertTableExists("reference_counters");
        assertTableExists("refresh_tokens");
        assertTableExists("password_reset_tokens");

        // V2-added junction table (1)
        assertTableExists("admin_department_subscriptions");
    }

    @Test
    void schemaDrift_notDetected_afterFullMigration() {
        flyway.migrate();

        // V2 columns should exist on incidents
        assertColumnExists("incidents", "claimed_by_id");
        assertColumnExists("incidents", "claimed_at");
        assertColumnExists("incidents", "resolution_note");
        assertColumnExists("incidents", "resolved_by_id");

        // V1 original columns should have been renamed away
        assertColumnNotExists("incidents", "assigned_to_id");
        assertColumnNotExists("incidents", "assigned_at");

        // Junction table columns
        assertColumnExists("admin_department_subscriptions", "admin_id");
        assertColumnExists("admin_department_subscriptions", "department_id");

        // Core columns on primary tables
        assertColumnExists("users", "matricule");
        assertColumnExists("users", "role");
        assertColumnExists("incidents", "reference");
        assertColumnExists("incidents", "status");
    }

    @Test
    void columnConstraints_areCorrect() {
        flyway.migrate();

        // NOT NULL constraints on key columns
        assertColumnNotNull("users", "first_name");
        assertColumnNotNull("users", "last_name");
        assertColumnNotNull("users", "password_hash");
        assertColumnNotNull("users", "matricule");
        assertColumnNotNull("users", "role");
        assertColumnNotNull("incidents", "reference");
        assertColumnNotNull("incidents", "priority");
        assertColumnNotNull("incidents", "status");

        // UNIQUE constraints
        assertColumnUnique("users", "matricule");
        assertColumnUnique("incidents", "reference");
        assertColumnUnique("refresh_tokens", "token");
        assertColumnUnique("password_reset_tokens", "token");
    }

    // Helper methods

    private void assertTableExists(String tableName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT EXISTS (SELECT FROM information_schema.tables " +
                     "WHERE table_schema = 'public' AND table_name = '" + tableName + "')")) {
            rs.next();
            assertThat(rs.getBoolean(1))
                    .as("Table '%s' should exist after Flyway migration", tableName)
                    .isTrue();
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify table existence: " + tableName, e);
        }
    }

    private void assertColumnExists(String tableName, String columnName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT EXISTS (SELECT FROM information_schema.columns " +
                     "WHERE table_schema = 'public' AND table_name = '" + tableName + "' " +
                     "AND column_name = '" + columnName + "')")) {
            rs.next();
            assertThat(rs.getBoolean(1))
                    .as("Column '%s' on table '%s' should exist", columnName, tableName)
                    .isTrue();
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify column existence: " + columnName, e);
        }
    }

    private void assertColumnNotExists(String tableName, String columnName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT EXISTS (SELECT FROM information_schema.columns " +
                     "WHERE table_schema = 'public' AND table_name = '" + tableName + "' " +
                     "AND column_name = '" + columnName + "')")) {
            rs.next();
            assertThat(rs.getBoolean(1))
                    .as("Column '%s' on table '%s' should NOT exist after V2 rename", columnName, tableName)
                    .isFalse();
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify column absence: " + columnName, e);
        }
    }

    private void assertColumnNotNull(String tableName, String columnName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT is_nullable FROM information_schema.columns " +
                     "WHERE table_schema = 'public' AND table_name = '" + tableName + "' " +
                     "AND column_name = '" + columnName + "'")) {
            rs.next();
            assertThat(rs.getString("is_nullable"))
                    .as("Column '%s' on table '%s' should be NOT NULL", columnName, tableName)
                    .isEqualTo("NO");
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify NOT NULL: " + columnName, e);
        }
    }

    private void assertColumnUnique(String tableName, String columnName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT COUNT(*) > 0 AS has_unique FROM information_schema.table_constraints tc " +
                     "JOIN information_schema.constraint_column_usage ccu " +
                     "ON tc.constraint_name = ccu.constraint_name " +
                     "WHERE tc.table_schema = 'public' " +
                     "AND tc.table_name = '" + tableName + "' " +
                     "AND ccu.column_name = '" + columnName + "' " +
                     "AND tc.constraint_type = 'UNIQUE'")) {
            rs.next();
            assertThat(rs.getBoolean("has_unique"))
                    .as("Column '%s' on table '%s' should have a UNIQUE constraint", columnName, tableName)
                    .isTrue();
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify UNIQUE constraint: " + columnName, e);
        }
    }

    private Connection getConnection() throws Exception {
        return DriverManager.getConnection(
                flywayPostgres.getJdbcUrl(),
                flywayPostgres.getUsername(),
                flywayPostgres.getPassword()
        );
    }
}
