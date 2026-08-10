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
                .as("Expected exactly 11 migrations (V1 baseline + V2 refactor + V3 widen date_key + V4 analytics indexes + V5 password-reset hardening + V6 CLOSED removal + V7 terminal indexes + V8 history status normalization + V9 incident attachments + V10 admin media soft-delete + V11 full-text search)")
                .isEqualTo(11);
        assertThat(result.migrations)
                .extracting(m -> m.version)
                .containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11");
    }

    @Test
    void baselineThenIncremental_appliesCorrectly() {
        flyway.migrate();

        MigrationInfo[] applied = flyway.info().applied();
        assertThat(applied)
                .as("Flyway schema_history should have 11 applied migrations")
                .hasSize(11);

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

        assertThat(applied[2].getVersion().toString())
                .as("Third migration should be version 3")
                .isEqualTo("3");
        assertThat(applied[2].getDescription())
                .as("Third migration description")
                .containsIgnoringCase("widen");

        assertThat(applied[3].getVersion().toString())
                .as("Fourth migration should be version 4")
                .isEqualTo("4");
        assertThat(applied[3].getDescription())
                .as("Fourth migration description")
                .containsIgnoringCase("activity");

        assertThat(applied[4].getVersion().toString())
                .as("Fifth migration should be version 5")
                .isEqualTo("5");
        assertThat(applied[4].getDescription())
                .as("Fifth migration description")
                .containsIgnoringCase("password");
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

        // V5-added system audit log (1)
        assertTableExists("audit_logs");
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

        // V4 composite indexes for per-user activity analytics
        assertIndexExists("idx_incidents_resolved_by_resolved_at");
        assertIndexExists("idx_incidents_user_declared_at");

        // V5 password-reset hardening — claim-code columns, partial index and audit log
        assertColumnExists("users", "claim_code_hash");
        assertColumnExists("users", "claim_code_expires_at");
        assertIndexExists("idx_users_claim_code_hash");
        assertColumnExists("audit_logs", "action");
        assertColumnExists("audit_logs", "actor_user_id");
        assertColumnExists("audit_logs", "target_user_id");

        // Core columns on primary tables
        assertColumnExists("users", "matricule");
        assertColumnExists("users", "role");
        assertColumnExists("incidents", "reference");
        assertColumnExists("incidents", "status");

        // V10 admin media management — soft-delete audit stub columns
        assertColumnExists("incident_attachments", "is_deleted");
        assertColumnExists("incident_attachments", "deleted_at");
        assertColumnExists("incident_attachments", "deletion_audit");
        // object_key lost its NOT NULL constraint (NULLed on soft-delete)
        assertColumnNullable("incident_attachments", "object_key");
        assertIndexExists("idx_attachment_admin_list");
        assertIndexExists("idx_attachment_stats");

        // V11 full-text search — self-maintaining tsvector generated column + GIN index
        assertColumnExists("incidents", "search_vector");
        assertIndexExists("idx_incidents_search");
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

    private void assertColumnNullable(String tableName, String columnName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT is_nullable FROM information_schema.columns " +
                     "WHERE table_schema = 'public' AND table_name = '" + tableName + "' " +
                     "AND column_name = '" + columnName + "'")) {
            rs.next();
            assertThat(rs.getString("is_nullable"))
                    .as("Column '%s' on table '%s' should be nullable", columnName, tableName)
                    .isEqualTo("YES");
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify nullable column: " + columnName, e);
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

    private void assertIndexExists(String indexName) {
        try (Connection conn = getConnection();
             var stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT EXISTS (SELECT FROM pg_indexes " +
                     "WHERE schemaname = 'public' AND indexname = '" + indexName + "')")) {
            rs.next();
            assertThat(rs.getBoolean(1))
                    .as("Index '%s' should exist after Flyway migration", indexName)
                    .isTrue();
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify index existence: " + indexName, e);
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
