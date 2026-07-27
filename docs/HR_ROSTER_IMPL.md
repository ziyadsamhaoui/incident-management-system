# AGENT SUMMARY — HR Roster Import Guide

> **Document Title:** HR Roster Import Guide  \
> **System:** Incident Management System (Backend API)  \
> **Organization:** ICGLMA  \
> **Java Package:** `incident.management.system`  \
> **Version:** Phase 11 (Dev Seeding & Import Tooling)  \
> **Last Updated:** 2026-07-27  \
> **Workspace:** All docs are strictly inside `/docs/`.

---

## Table of Contents

1. [Core Roster Rules](#1-core-roster-rules)
2. [Roster File Format Specification](#2-roster-file-format-specification)
3. [Roster Import Workflow](#3-roster-import-workflow)
4. [CSV Import Implementation Plan](#4-csv-import-implementation-plan)
5. [Admin Promotion Workflow](#5-admin-promotion-workflow)
6. [Bootstrapping Dev Environment](#6-bootstrapping-dev-environment)
7. [Idempotency & Error Handling](#7-idempotency--error-handling)
8. [Testing the Import](#8-testing-the-import)
9. [Appendix: Sample Roster Files](#9-appendix-sample-roster-files)

---

## 1. Core Roster Rules

The HR roster import is governed by strict identity-only rules that enforce the system's **zero self-registration** model:

| Rule | Description |
|---|---|
| **No Role Column** | The HR roster CSV contains **only identity columns**: `matricule`, `firstName`, `lastName`. There is NO role column. |
| **Default Role = `SOUS_CHEF`** | Every row imported from the roster automatically receives `role = SOUS_CHEF` (the lowest privilege). |
| **Null Password** | All imported rows have `passwordHash = NULL`. SOUS_CHEF users authenticate passwordlessly (identity-only via matricule + firstName + lastName match). |
| **ADMIN Never Imported** | ADMIN accounts are **never** created via roster imports. They are seeded in dev or created manually by existing admins via `POST /api/users`. |
| **Promotions Are Separate** | Role promotions (`SOUS_CHEF` → `CHEF_ATELIER`) are separate administrative actions applied to existing records via `PUT /api/users/{id}/promote`. |

---

## 2. Roster File Format Specification

### 2.1 CSV Format (Primary)

The primary format is **UTF-8 encoded CSV** with a header row. No BOM.

```
matricule,firstName,lastName
1001,Omar,Bennis
1002,Youssef,El Idrissi
1003,Fatima,Zahra
```

**Column Specification:**

| Column | Type | Required | Constraints |
|---|---|---|---|
| `matricule` | Integer (as string) | ✅ | Must be unique across the system; will be rejected if duplicate exists |
| `firstName` | String (max 255) | ✅ | Trimmed of leading/trailing whitespace; stored as-is (case preserved) |
| `lastName` | String (max 255) | ✅ | Trimmed of leading/trailing whitespace; stored as-is (case preserved) |

**Rejected Rows:** A row is silently skipped (not rolled back) if:
- `matricule` is missing, blank, or non-numeric
- `firstName` is missing or blank
- `lastName` is missing or blank
- `matricule` already exists in the `users` table

### 2.2 XLSX Format (Future)

An XLSX-based import can be introduced later using Apache POI (`poi-ooxml`). The sheet should contain the same three columns as the CSV, with the first row being the header.

---

## 3. Roster Import Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                     HR Roster Import Flow                     │
└──────────────────────────────────────────────────────────────┘

HR Department                    Backend API                       Database
     │  Upload CSV/XLSX               │                               │
     │ ──────────────────────────────▶│                               │
     │                                │                               │
     │                          ┌─────┴──────┐                        │
     │                          │   Parse     │                        │
     │                          │  Headers    │                        │
     │                          └─────┬──────┘                        │
     │                                │ Valid?                        │
     │                          ┌─────┴──────┐                        │
     │                          │  Validate   │                        │
     │                          │  Each Row   │                        │
     │                          └─────┬──────┘                        │
     │                                │                               │
     │                          ┌─────┴──────┐                        │
     │                          │  For each   │────────matricule──────▶│
     │                          │  valid row  │◀──exists?───(yes/no)──│
     │                          └─────┬──────┘                        │
     │                                │ Skip if exists                │
     │                                │ (idempotent)                  │
     │                          ┌─────┴──────┐                        │
     │                          │ Insert as   │──────────────────────▶│
     │                          │ SOUS_CHEF   │  INSERT INTO users    │
     │                          │ passwordHash│  (matricule, fn, ln,  │
     │                          │ = NULL      │   role='SOUS_CHEF',   │
     │                          │             │   passwordHash=NULL)  │
     │                          └─────┬──────┘                        │
     │                                │                               │
     │◀───────────────────────────────│                               │
     │ 201 Created                    │                               │
     │ { created: N, skipped: M }    │                               │
```

---

## 4. CSV Import Implementation Plan

### 4.1 Endpoint

**`POST /api/admin/users/import/csv`** — ADMIN-only (`@PreAuthorize("hasRole('ADMIN')")`)

### 4.2 Request

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | `MultipartFile` | UTF-8 CSV file with header row |

### 4.3 Response (201 Created)

```json
{
    "created": 42,
    "skipped": 3,
    "totalRows": 45,
    "errors": [
        "Row 7: Duplicate matricule '1001' (skipped)",
        "Row 12: Empty firstName (skipped)",
        "Row 23: Non-numeric matricule 'ABC' (skipped)"
    ]
}
```

### 4.4 Controller Skeleton (`AdminController.java`)

Extend the existing `AdminController` with:

```java
@PostMapping("/users/import/csv")
public ResponseEntity<RosterImportResponse> importRosterCsv(
        @RequestParam("file") MultipartFile file) {

    RosterImportResponse response = userService.importRosterFromCsv(file);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```

### 4.5 Service Logic (`UserServiceImpl.java`)

Add a new method:

```java
@Override
@Transactional
public RosterImportResponse importRosterFromCsv(MultipartFile file) {
    List<String> errors = new ArrayList<>();
    int created = 0;
    int skipped = 0;
    int totalRows = 0;

    try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
        String header = reader.readLine(); // skip header
        // Validate header contains expected columns
        String line;
        int rowNum = 1; // header is row 1
        while ((line = reader.readLine()) != null) {
            rowNum++;
            totalRows++;
            String[] parts = line.split(",", -1);
            // Trim and validate
            // ...
            // Check matricule uniqueness
            // Insert as SOUS_CHEF with passwordHash = null
        }
    } catch (IOException e) {
        throw new RuntimeException("Failed to read CSV file", e);
    }

    return new RosterImportResponse(created, skipped, totalRows, errors);
}
```

### 4.6 RosterImportResponse DTO

```java
public record RosterImportResponse(
    int created,
    int skipped,
    int totalRows,
    List<String> errors
) {}
```

### 4.7 Dependencies (pom.xml)

If not already present, add:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

Spring Boot's web starter already includes the necessary multipart support. No additional CSV parsing library is required — standard Java `BufferedReader` and `String.split()` are sufficient for a three-column CSV.

---

## 5. Admin Promotion Workflow

Promotions (`SOUS_CHEF` → `CHEF_ATELIER`) are executed post-import via the existing endpoint:

### `PUT /api/users/{id}/promote`

**Restriction:** `ADMIN` only (`@PreAuthorize("hasRole('ADMIN')")`)

**Backend Behavior:**

```java
public UserResponse promoteToChefAtelier(Long id) {
    UserEntity user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

    if (user.getRole() != UserRole.SOUS_CHEF) {
        throw new IllegalArgumentException(
                "Seuls les utilisateurs avec le rôle SOUS_CHEF peuvent être promus Chef d'atelier.");
    }

    user.setRole(UserRole.CHEF_ATELIER);
    user.setPasswordHash(null);  // Signal unclaimed account

    UserEntity saved = userRepository.save(user);
    log.info("User {} (matricule: {}) promoted from SOUS_CHEF to CHEF_ATELIER. Account needs claiming.",
            saved.getId(), saved.getMatricule());

    return toResponse(saved);
}
```

**Key Behaviors:**
1. Only `SOUS_CHEF` can be promoted — throws `IllegalArgumentException` (400) otherwise
2. Sets `passwordHash = null` — the promoted user must claim their account before logging in
3. The claim flow is handled by `POST /api/auth/claim` (see [WORKFLOW.md §16](WORKFLOW.md))

---

## 6. Bootstrapping Dev Environment

The dev environment is pre-seeded with an ADMIN account via `DevSeedConfig.java`:

```java
@Configuration
@Profile("dev")
public class DevSeedConfig {

    @Bean
    CommandLineRunner seedDevAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Idempotent: checks by matricule (0) and email (admin@dev.local)
            if (userRepository.existsByMatricule(0)) {
                log.info("[DEV SEED] Admin account already exists — skipping.");
                return;
            }

            UserEntity admin = UserEntity.builder()
                    .firstName("Admin")
                    .lastName("System")
                    .email("admin@dev.local")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .matricule(0)
                    .role(UserRole.ADMIN)
                    .isActive(true)
                    .build();

            userRepository.save(admin);

            System.out.println("[DEV SEED] Admin Account Created -> Login: admin@dev.local | Password: admin123");
        };
    }
}
```

### 6.1 Activating Dev Profile

**Method 1 — Application properties:**

```properties
# application-dev.properties or in application.properties:
spring.profiles.active=dev
```

**Method 2 — Environment variable:**

```bash
SPRING_PROFILES_ACTIVE=dev
```

**Method 3 — JVM argument:**

```bash
java -Dspring.profiles.active=dev -jar target/incident-management-system-0.0.1-SNAPSHOT.jar
```

**Method 4 — IntelliJ IDEA Run Configuration:**

Add `--spring.profiles.active=dev` to the "Program arguments" field in your run configuration.

### 6.2 Roster Seeding in Dev (Optional)

For local testing, a `data/roster-dev.csv` file can be placed in `src/main/resources/` and loaded by a separate `@Profile("dev")` bean:

```java
@Bean
CommandLineRunner seedDevRoster(UserRepository userRepository) {
    return args -> {
        if (userRepository.count() > 1) return; // Admin already seeded, skip if more exist
        // Parse data/roster-dev.csv and insert rows as SOUS_CHEF
    };
}
```

---

## 7. Idempotency & Error Handling

### 7.1 Idempotency Strategy

| Component | Strategy |
|---|---|
| **Dev Admin Seed** | Check `matricule = 0` and/or `email = admin@dev.local` before insert |
| **Roster CSV Import** | For each row, check `userRepository.existsByMatricule(matricule)`. Skip if exists, continue processing remaining rows. Never fails the entire batch for a single duplicate. |
| **Roster Re-upload** | Safe to re-upload. Existing rows are silently skipped. |

### 7.2 Error Handling Matrix

| Scenario | HTTP Status | Error Code | Handling |
|---|---|---|---|
| File is empty | 400 | `EMPTY_FILE` | Reject immediately |
| Invalid/missing header | 400 | `INVALID_HEADER` | Reject immediately |
| Row-level validation failure | 201 (partial) | N/A | Skipped row reported in `errors` array |
| Duplicate matricule | 201 (partial) | N/A | Skipped with message |
| File too large | 413 | `PAYLOAD_TOO_LARGE` | Spring's `spring.servlet.multipart.max-file-size` |
| Non-CSV content type | 415 | `UNSUPPORTED_MEDIA_TYPE` | Reject immediately |

### 7.3 Transactional Behavior

The import method should be annotated with `@Transactional(propagation = Propagation.REQUIRES_NEW)` so that successfully imported rows are persisted even if later rows fail. Alternatively, use a manual save-and-flush approach:

```java
for (String[] row : parsedRows) {
    try {
        if (userRepository.existsByMatricule(matricule)) {
            skipped++;
            errors.add("Row " + rowNum + ": Duplicate matricule '" + matricule + "' (skipped)");
            continue;
        }
        UserEntity user = UserEntity.builder()...build();
        userRepository.saveAndFlush(user);
        created++;
    } catch (Exception e) {
        skipped++;
        errors.add("Row " + rowNum + ": " + e.getMessage());
    }
}
```

---

## 8. Testing the Import

### 8.1 Unit Test (Service Layer)

```java
@Test
void importRoster_shouldCreateUsersAsSousChef() {
    String csv = "matricule,firstName,lastName\n1001,Omar,Bennis\n1002,Youssef,El Idrissi";
    MultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

    RosterImportResponse response = userService.importRosterFromCsv(file);

    assertThat(response.created()).isEqualTo(2);
    assertThat(response.skipped()).isEqualTo(0);

    // Verify roles
    UserEntity omar = userRepository.findByMatricule(1001).orElseThrow();
    assertThat(omar.getRole()).isEqualTo(UserRole.SOUS_CHEF);
    assertThat(omar.getPasswordHash()).isNull();
}
```

### 8.2 Integration Test (Web Layer)

```java
@Test
void importRoster_viaHttp_shouldReturn201() throws Exception {
    String csv = "matricule,firstName,lastName\n1001,Omar,Bennis";
    MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

    mockMvc.perform(multipart("/api/admin/users/import/csv").file(file).with(adminAuth()))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.created").value(1));
}
```

### 8.3 Manual Testing with cURL

```bash
curl -X POST http://localhost:8080/api/admin/users/import/csv \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -F "file=@roster-dev.csv"
```

---

## 9. Appendix: Sample Roster Files

### 9.1 `roster-dev.csv` (Minimal)

```csv
matricule,firstName,lastName
1001,Omar,Bennis
1002,Youssef,El Idrissi
1003,Fatima,Zahra
1004,Hassan,Ouazzani
1005,Latifa,Benali
```

### 9.2 `roster-dev-with-errors.csv` (For Testing Error Handling)

```csv
matricule,firstName,lastName
1001,Omar,Bennis
1002,,El Idrissi
ABC,Fatima,Zahra
1001,Hassan,Ouazzani  (duplicate)
1005,Latifa,
```

Expected result: `created: 2, skipped: 3, totalRows: 5`

---

## Quick Reference

| Action | Endpoint | Method | Role |
|---|---|---|---|
| CSV Roster Import | `/api/admin/users/import/csv` | POST | ADMIN |
| Promote to CHEF_ATELIER | `/api/users/{id}/promote` | PUT | ADMIN |
| Claim Account | `/api/auth/claim` | POST | Public (unclaimed users) |
| Login | `/api/auth/login` | POST | Public |
| Dev Admin Seed | Auto on startup (`dev` profile) | — | `@Profile("dev")` |
