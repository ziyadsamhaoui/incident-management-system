package incident.management.system.config;

import incident.management.system.enums.UserRole;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Dev-only seeder that creates a bootstrap ADMIN account and loads dummy
 * roster users on first startup.
 * <p>
 * <b>Profile gate:</b> {@code @Profile("dev")} guarantees this class is never
 * loaded in staging or production environments.
 * <p>
 * <b>Idempotency:</b> Every insert is guarded by an existence check so seeds
 * run safely across restarts.
 */
@Configuration
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DevSeedConfig {

    /** Dev admin login identifier — also used as the idempotency key. */
    static final String DEV_ADMIN_EMAIL = "admin@dev.local";
    static final String DEV_ADMIN_PASSWORD = "admin123";
    static final int    DEV_ADMIN_MATRICULE = 0;

    private static final String ROSTER_CSV_PATH = "data/roster-dev.csv";

    private static final String[] EXPECTED_ROSTER_HEADERS = {"matricule", "firstName", "lastName"};

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    @Order(1)
    CommandLineRunner seedDevAdmin() {
        return args -> {
            // Idempotency check — skip if already seeded
            if (userRepository.existsByMatricule(DEV_ADMIN_MATRICULE)
                    || userRepository.findByEmail(DEV_ADMIN_EMAIL).isPresent()) {
                log.info("[DEV SEED] Admin account already exists — skipping seed.");
                return;
            }

            UserEntity admin = UserEntity.builder()
                    .firstName("Admin")
                    .lastName("System")
                    .email(DEV_ADMIN_EMAIL)
                    .passwordHash(passwordEncoder.encode(DEV_ADMIN_PASSWORD))
                    .matricule(DEV_ADMIN_MATRICULE)
                    .role(UserRole.ADMIN)
                    .isActive(true)
                    .build();

            userRepository.save(admin);

            System.out.println("[DEV SEED] Admin Account Created -> Login: admin@dev.local | Password: admin123");
        };
    }

    @Bean
    @Order(2)
    CommandLineRunner seedDevRoster() {
        return args -> {
            ClassPathResource resource = new ClassPathResource(ROSTER_CSV_PATH);
            if (!resource.exists()) {
                log.warn("[DEV SEED] Roster CSV not found at {} — skipping roster seed.", ROSTER_CSV_PATH);
                return;
            }

            int created = 0;
            int skipped = 0;
            int totalRows = 0;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

                String header = reader.readLine();
                if (header == null) {
                    log.warn("[DEV SEED] Roster CSV is empty — skipping.");
                    return;
                }

                // Validate header
                String[] headerColumns = header.split(",", -1);
                if (headerColumns.length < 3
                        || !headerColumns[0].trim().equalsIgnoreCase(EXPECTED_ROSTER_HEADERS[0])
                        || !headerColumns[1].trim().equalsIgnoreCase(EXPECTED_ROSTER_HEADERS[1])
                        || !headerColumns[2].trim().equalsIgnoreCase(EXPECTED_ROSTER_HEADERS[2])) {
                    log.warn("[DEV SEED] Roster CSV has unexpected header '{}' — expected 'matricule,firstName,lastName'. Skipping.",
                            header);
                    return;
                }

                String line;
                while ((line = reader.readLine()) != null) {
                    totalRows++;
                    String[] parts = line.split(",", -1);

                    if (parts.length < 3) {
                        skipped++;
                        log.debug("[DEV SEED] Roster row {}: insufficient columns, skipped.", totalRows);
                        continue;
                    }

                    String matriculeStr = parts[0].trim();
                    String firstName = parts[1].trim();
                    String lastName = parts[2].trim();

                    // Validate required fields
                    if (matriculeStr.isEmpty() || firstName.isEmpty() || lastName.isEmpty()) {
                        skipped++;
                        log.debug("[DEV SEED] Roster row {}: blank field(s), skipped.", totalRows);
                        continue;
                    }

                    int matricule;
                    try {
                        matricule = Integer.parseInt(matriculeStr);
                    } catch (NumberFormatException e) {
                        skipped++;
                        log.debug("[DEV SEED] Roster row {}: non-numeric matricule '{}', skipped.",
                                totalRows, matriculeStr);
                        continue;
                    }

                    // Idempotency — skip if matricule already exists
                    if (userRepository.existsByMatricule(matricule)) {
                        skipped++;
                        log.debug("[DEV SEED] Roster row {}: matricule {} already exists, skipped.",
                                totalRows, matricule);
                        continue;
                    }

                    UserEntity user = UserEntity.builder()
                            .firstName(firstName)
                            .lastName(lastName)
                            .matricule(matricule)
                            .role(UserRole.SOUS_CHEF)
                            .passwordHash("")   // empty = unclaimed; satisfies DB NOT NULL
                            .isActive(true)
                            .build();

                    userRepository.save(user);
                    created++;
                }
            }

            if (totalRows > 0) {
                log.info("[DEV SEED] Roster imported: {} created, {} skipped (out of {} rows).",
                        created, skipped, totalRows);
            }
        };
    }
}
