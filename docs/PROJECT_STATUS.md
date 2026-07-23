# Incident Management System — Project Status & Architecture Documentation

> **Prepared for:** MGSI Framework — Management & Gouvernance des Systèmes d'Information  
> **Project:** Incident Management System (Backend API + Frontend Roadmap)  
> **Organization:** ICGLMA  
> **Java Package:** `incident.management.system`  
> **Status:** Backend Phases 1–10 Complete — Frontend Phase 1 Ready to Begin  
> **Last Updated:** 2026-07-23  

---

## Table of Contents

1. [Project Overview & Architectural Blueprint](#1-project-overview--architectural-blueprint)
2. [Completed Work — Phase by Phase](#2-completed-work--phase-by-phase)
   - [Phase 1: Core Domain Entities & Relational Schema](#phase-1-core-domain-entities--relational-schema-mapping)
   - [Phase 2: Data Access & Enterprise Service Layers](#phase-2-data-access--enterprise-service-layers)
   - [Phase 3: REST API Web Layer](#phase-3-rest-api-web-layer--interface-exposure)
   - [Phase 4: Security & Authentication](#phase-4-security--authentication-enforcement)
   - [Phase 5: Method-Level RBAC & Password Reset](#phase-5-method-level-rbac--password-reset)
   - [Phase 6: Enterprise Security Hardening](#phase-6-enterprise-security-hardening)
   - [Phase 7: Multi-Channel Authentication](#phase-7-multi-channel-authentication--hybrid-password-reset)
   - [Phase 8: Global Exception Handler & Rate Limiting](#phase-8-global-rest-exception-handler--rate-limiting)
   - [Phase 9: Incident Lifecycle Revision & Auto-Closure](#phase-9-incident-lifecycle-revision--fail-safe-automation)
   - [Phase 10: Event-Driven Notification Engine](#phase-10-decoupled-event-driven-notification-engine)
3. [Frontend Roadmap Tracking Checklist](#3-frontend-roadmap-tracking-checklist)
   - [Phase 1: Bootstrap, Design System & Multi-Channel Auth](#phase-1-frontend-project-bootstrap-design-system--multi-channel-auth)
   - [Phase 2: Core Incident Management & Lifecycle UI](#phase-2-frontend-core-incident-management--real-time-lifecycle-ui)
   - [Phase 3: Administrative Control, Subscriptions & Audit](#phase-3-frontend-administrative-control-department-subscriptions--audit-trails)
   - [Phase 4: Security Hardening, Rate Limits & E2E Tests](#phase-4-frontend-security-hardening-rate-limit-handling--end-to-end-testing)
4. [Backend Roadmap — Remaining Items](#4-backend-roadmap--remaining-items)
5. [Known Issues / Technical Debt](#5-known-issues--technical-debt)
6. [Inventory of Artifacts](#6-inventory-of-artifacts)

---

## 1. Project Overview & Architectural Blueprint

### 1.1 Executive Summary

The Incident Management System is a production-grade backend REST API designed to streamline the lifecycle of industrial incident tracking across manufacturing departments, production lines, and workstations. The system enables users to declare incidents, track their progression through a rigid state machine, receive automated notifications on status changes, and access analytical dashboards for operational oversight.

The architecture follows a strict **layered hexagonal pattern** — Entities → Repositories → DTOs → Services → Controllers — ensuring complete separation of concerns and testability at every level.

**Key Milestones Achieved:**
- **Phase 6**: API secured end-to-end with stateless JWT + enterprise hardening
- **Phase 7**: Three distinct authentication lanes (SOUS_CHEF bypass, CHEF_ATELIER mixed, ADMIN classic)
- **Phase 8**: Global exception handler + Bucket4j rate limiting (5/min auth, 10/min incident creation)
- **Phase 9**: 6-stage incident lifecycle with auto-closure scheduler (10-minute timer)
- **Phase 10**: Fully decoupled event-driven notification engine with admin department subscriptions

### 1.2 Technology Stack

| Layer | Technology | Version / Detail |
|---|---|---|
| **Runtime** | Java | 17 (LTS) |
| **Framework** | Spring Boot | 3.x |
| **Data Access** | Spring Data JPA / Hibernate | 6.x |
| **Database** | PostgreSQL | 17 (via Docker Compose) |
| **Migrations** | Flyway | ✅ Active (V1–V3 applied) |
| **Security** | Spring Security 6.x | Stateless sessions |
| **Auth** | JWT (JJWT 0.12.5) + Multi-Channel Provider | 3-lane custom AuthenticationProvider |
| **Rate Limiting** | Bucket4j (token bucket) | `bucket4j-core:8.7.0` |
| **Scheduling** | Spring `@EnableScheduling` | Auto-closure job (2-min interval) |
| **Exception Handling** | `@RestControllerAdvice` | `GlobalExceptionHandler` |
| **Validation** | Jakarta Validation | `spring-boot-starter-validation` |
| **Utilities** | Lombok | 1.18.x |
| **Build** | Maven Wrapper | `mvnw` |
| **Container** | Docker Compose | `postgres:17` |
| **CI/CD** | GitHub Actions | Build + verify → Railway deploy |
| **Monitoring** | Spring Boot Actuator | Dependency present |

### 1.3 Local Development

```yaml
# compose.yaml
services:
  postgres:
    image: 'postgres:17'
    environment:
      POSTGRES_DB: icglma_local
      POSTGRES_USER: icglma
      POSTGRES_PASSWORD: ICGLMA@2025
    ports:
      - "5432:5432"
```

```properties
# application.properties (key settings)
spring.jpa.hibernate.ddl-auto=update
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
jwt.secret=FB9FCv0LjVkA3AThUeYi7VtcYnXikna3LRcl52vAXbp
jwt.expiration-ms=43200000       # 12 hours
jwt.refresh-expiration-ms=604800000  # 7 days
```

### 1.4 Architecture Notes

- **Single-repository monolith** with strict namespace isolation (`incident.management.system.*`)
- Layered for future bounded-context extraction (e.g., `NotificationService` can become a separate service)
- Flyway + Hibernate `ddl-auto=update` dual setup — future phase should migrate to pure Flyway DDL

---

## 2. Completed Work — Phase by Phase

### Phase 1: Core Domain Entities & Relational Schema Mapping

**13 JPA entities** modeled with full relational fidelity.

#### UserEntity (`users`)

| Field | Type | Constraints |
|---|---|---|
| `id` | `Long` (IDENTITY) | PK |
| `firstName` | `String` | NOT NULL |
| `lastName` | `String` | NOT NULL |
| `email` | `String` | UNIQUE (nullable) |
| `passwordHash` | `String` | NOT NULL |
| `matricule` | `int` | NOT NULL, UNIQUE |
| `isActive` | `boolean` | NOT NULL |
| `role` | `UserRole` (ENUM) | NOT NULL |
| `department` | `@ManyToOne → DepartmentEntity` | FK |
| `createdAt` | `LocalDateTime` | `@CreationTimestamp` |
| `deletedAt` | `LocalDateTime` | Nullable (soft-delete) |
| `failedLoginAttempts` | `int` | Default 0 |
| `lockoutEnd` | `LocalDateTime` | Nullable |

Methods: `deactivate()`, `isLocked()`, `incrementFailedAttempts()`, `resetFailedAttempts()`, `getAuditLabel()`.

#### IncidentEntity (`incidents`)

| Field | Type | Notes |
|---|---|---|
| `id` | `Long` (IDENTITY) | PK |
| `reference` | `String` | UNIQUE, e.g. `INC-20260707-0001` |
| `user` | `@ManyToOne → UserEntity` | Declarant |
| `claimedBy` | `@ManyToOne → UserEntity` (LAZY) | ADMIN who claimed (renamed from `assignedTo` in V2) |
| `resolvedBy` | `@ManyToOne → UserEntity` (LAZY) | ADMIN who evaluated |
| `department` | `@ManyToOne → DepartmentEntity` | FK |
| `station` | `@ManyToOne → StationEntity` | FK |
| `category` | `@ManyToOne → CategoryEntity` | FK |
| `priority` | `IncidentPriority` (ENUM) | LOW, MEDIUM, HIGH, CRITICAL |
| `status` | `IncidentStatus` (ENUM) | 6-stage lifecycle |
| `description` | `String` (2000) | Nullable |
| `resolutionNote` | `String` (1000) | Nullable; mandatory for NON_RESOLVED |
| `declaredAt` | `LocalDateTime` | `@CreationTimestamp` |
| `claimedAt` | `LocalDateTime` | Set on DECLARED → CLAIMED |
| `inProgressAt` | `LocalDateTime` | Set on CLAIMED → IN_PROGRESS |
| `resolvedAt` | `LocalDateTime` | Set on evaluation; reference for auto-closure |
| `closedAt` | `LocalDateTime` | Set on auto-closure |

#### IncidentHistory (`incident_history`)

| Field | Type | Notes |
|---|---|---|
| `id` | `Long` (IDENTITY) | PK |
| `incident` | `@ManyToOne → IncidentEntity` | FK, NOT NULL |
| `previousStatus` | `IncidentStatus` | NOT NULL |
| `currentStatus` | `IncidentStatus` | Nullable |
| `changedAt` | `LocalDateTime` | Nullable |
| `comment` | `String` | Mirrors `resolutionNote` on evaluation transitions |

#### NotificationEntity (`notifications`)

| Field | Type | Notes |
|---|---|---|
| `id` | `Long` (IDENTITY) | PK |
| `incident` | `@ManyToOne → IncidentEntity` | FK |
| `recipient` | `@ManyToOne → UserEntity` | FK (`user_id`) |
| `message` | `String` | NOT NULL |
| `isRead` | `boolean` | Default false |
| `type` | `String` | e.g. "STATUS_CHANGE" |
| `createdAt` | `LocalDateTime` | `@CreationTimestamp` |

#### Structural Reference Entities

| Entity | Table | Key Field(s) | Relationship |
|---|---|---|---|
| `CategoryEntity` | `categories` | `name` | — |
| `DepartmentEntity` | `departments` | `name` | — |
| `SectionEntity` | `sections` | `name` | — |
| `ProductionLineEntity` | `production_lines` | `name`, `section` | `@ManyToOne → SectionEntity` |
| `StationEntity` | `stations` | `code`, `rowIndex`, `lineIndex`, `isWorking` | `@ManyToOne → ProductionLineEntity` |

#### Infrastructure Entities

| Entity | Table | Purpose |
|---|---|---|
| `ReferenceCounterEntity` | `reference_counters` | Atomic DB upsert for reference ID generation |
| `PasswordResetToken` | `password_reset_tokens` | Stores reset tokens (6-char or UUID) |
| `RefreshTokenEntity` | `refresh_tokens` | Persistent refresh tokens for JWT rotation |
| `AdminDepartmentSubscription` | `admin_department_subscriptions` | Many-to-many ADMIN → department subscriptions |

#### Enum Definitions

| Enum | Values | Location |
|---|---|---|
| `IncidentStatus` | `DECLARED, CLAIMED, IN_PROGRESS, RESOLVED, NON_RESOLVED, CLOSED` | `enums/IncidentStatus.java` |
| `IncidentPriority` | `LOW, MEDIUM, HIGH, CRITICAL` | `enums/IncidentPriority.java` |
| `UserRole` | `ADMIN, CHEF_ATELIER, SOUS_CHEF` | `enums/UserRole.java` |

### Phase 2: Data Access & Enterprise Service Layers

#### Repositories

**8 JPA repositories** in `incident.management.system.repository`:

| Repository | Entity | Custom Queries |
|---|---|---|
| `UserRepository` | `UserEntity` | `findByMatricule`, `findByEmail`, `findByDepartmentAndRole` |
| `IncidentRepository` | `IncidentEntity` | `findByStatus`, `findByUser`, `findByDepartment`, `findByReference`, `findByStatusAndResolvedAtBefore` |
| `CategoryRepository` | `CategoryEntity` | — |
| `DepartmentRepository` | `DepartmentEntity` | — |
| `SectionRepository` | `SectionEntity` | — |
| `ProductionLineRepository` | `ProductionLineEntity` | — |
| `StationRepository` | `StationEntity` | — |
| `NotificationRepository` | `NotificationEntity` | `findByRecipientAndIsReadFalse` |

**Additional repositories:**
- `ReferenceCounterRepository` — atomic DB upsert for reference generation
- `IncidentHistoryRepository` — audit trail persistence
- `PasswordResetTokenRepository` — `findByToken`, `findByUserIdAndUsedFalse`
- `RefreshTokenRepository` — `findByToken`, `findByUserIdAndRevokedFalse`
- `AdminDepartmentSubscriptionRepository` — subscription management

#### Service Layer

**`UserService` + `UserServiceImpl`:**
- `createUser()` — BCrypt hashes password, sets `isActive = true`, links department
- `updateUser()` — Partial update (non-null fields only)
- `getUserById()` / `getUserByMatricule()` — Single retrieval or `ResourceNotFoundException`
- `getAllUsers()` — Paginated
- `deleteUser()` — **Soft delete**: calls `user.deactivate()` (sets `isActive=false`, `deletedAt=now`)
- `subscribeToDepartment()` / `unsubscribeFromDepartment()` / `getSubscribedDepartments()`

**`IncidentService` + `IncidentServiceImpl`** (6-stage lifecycle):
- `createIncident()` → DECLARED (SOUS_CHEF/CHEF_ATELIER)
- `claimIncident()` → DECLARED → CLAIMED (ADMIN)
- `progressIncident()` → CLAIMED → IN_PROGRESS (any authenticated)
- `evaluateIncident()` → IN_PROGRESS → RESOLVED/NON_RESOLVED (ADMIN)
- `getIncidentById()`, `getIncidentByReference()`, `getAllIncidents()`, `getIncidentsByUser/Department/Status()`
- State machine validation via `Map<IncidentStatus, IncidentStatus[]>` with `validateTransition()`
- Event publishing via `ApplicationEventPublisher`

**`IncidentAutoClosureJob`** (Phase 9):
- `@Scheduled(fixedRate = 120000)` — runs every 2 minutes
- Closes RESOLVED incidents older than 10 minutes
- Persists `IncidentHistory` with comment `"Auto-closed by system after 10-minute timer."`
- Publishes `IncidentTransitionEvent` for notification

**`NotificationService` + `NotificationServiceImpl`** (Phase 10 cleanup):
- `markAsRead()` — Sets `isRead = true`
- `getUnreadNotificationsForUser()` — Paginated unread notifications
- `notifyStatusChange()` — **Removed** in Phase 10 (replaced by event-driven listener)

**Reference Master Data Services:**

| Service | Entity | Key Methods |
|---|---|---|
| `CategoryService` | `CategoryEntity` | CRUD |
| `DepartmentService` | `DepartmentEntity` | CRUD |
| `SectionService` | `SectionEntity` | CRUD |
| `ProductionLineService` | `ProductionLineEntity` | CRUD with `sectionId` |
| `StationService` | `StationEntity` | CRUD with `productionLineId` |

**Security Services:**
- `JwtService` — Token generation, validation, claims extraction (JJWT)
- `CustomUserDetailsService` — Loads user by matricule
- `TokenBlacklistService` — In-memory `ConcurrentHashMap` blacklist with 5-minute eviction
- `AuthService` — Hybrid password reset lifecycle (manual + email tracks)
- `RateLimitingService` — Bucket4j token bucket management

### Phase 3: REST API Web Layer & Interface Exposure

#### IncidentController (`/api/incidents`)

| Method | Path | Restriction | Description |
|---|---|---|---|
| `POST` | `/api/incidents` | SOUS_CHEF, CHEF_ATELIER | Create |
| `GET` | `/api/incidents` | Any authenticated | List (filterable) |
| `GET` | `/api/incidents/{id}` | Any authenticated | Get by ID |
| `PUT` | `/api/incidents/{id}/claim` | ADMIN | CLAIM |
| `PUT` | `/api/incidents/{id}/progress` | Any authenticated | PROGRESS |
| `PUT` | `/api/incidents/{id}/evaluate` | ADMIN | EVALUATE |

> **Retired:** `PUT /api/incidents/{id}/close` (manual close) — Phase 9

#### UserController (`/api/users`) — ADMIN only

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Create |
| `GET` | `/api/users` | List |
| `GET` | `/api/users/{id}` | Get by ID |
| `GET` | `/api/users/matricule/{matricule}` | Get by matricule |
| `PUT` | `/api/users/{id}` | Partial update |
| `DELETE` | `/api/users/{id}` | Soft delete |
| `POST` | `/api/users/{userId}/subscriptions/{departmentId}` | Subscribe |
| `DELETE` | `/api/users/{userId}/subscriptions/{departmentId}` | Unsubscribe |
| `GET` | `/api/users/{userId}/subscriptions` | List subscriptions |

#### AdminController (`/api/admin`) — ADMIN only

CRUD for: categories, departments, sections, production-lines, stations.

#### NotificationController (`/api/notifications`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications?userId=X` | Paginated unread |
| `PUT` | `/api/notifications/{id}/read` | Mark read |

#### DashboardController (`/api/dashboard`)

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/dashboard/statistics/by-status` | Counts per status (all 6 guaranteed) |
| `GET` | `/api/dashboard/statistics/by-priority` | Counts per priority |
| `GET` | `/api/dashboard/statistics/by-department` | Counts per department |
| `GET` | `/api/dashboard/recent-activities` | Last 20 incidents |

#### AuthController (`/api/auth`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Multi-channel login |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Blacklist JWT |
| `POST` | `/api/auth/password-reset/request-manual` | 6-char manual token |
| `POST` | `/api/auth/password-reset/request-email` | UUID email token |
| `POST` | `/api/auth/password-reset/confirm` | Unified confirmation |

### Phase 4: Security & Authentication Enforcement

- Spring Security 6.x filter chain: `SessionCreationPolicy.STATELESS`, CSRF disabled
- `SecurityFilterChain` — permits `/api/auth/**` and `/actuator/**`, authenticates all `/api/**`
- `BCryptPasswordEncoder` bean for password hashing
- `AuthenticationManager` exposed via explicit `ProviderManager`
- `JwtService` — token generation, validation, claims extraction (JJWT 0.12.5)
- `JwtAuthenticationFilter` (extends `OncePerRequestFilter`) — intercepts Bearer tokens
- `CustomUserDetailsService` — loads by matricule
- `@EnableMethodSecurity` for `@PreAuthorize`

### Phase 5: Method-Level RBAC & Password Reset

- `@PreAuthorize("hasRole('ADMIN')")` on `AdminController` and `UserController` (class-level)
- `@PreAuthorize("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER')")` on `POST /api/incidents`
- `@PreAuthorize("hasRole('ADMIN')")` on `claimIncident()` and `evaluateIncident()`
- `PasswordResetToken` entity + repository (initial implementation)

### Phase 6: Enterprise Security Hardening

- CORS configuration: origins `localhost:3000`, `4200`, `8080`
- Dual-token login: JWT access (12h) + persisted refresh token (UUID, 7 days)
- `RefreshTokenEntity` + `POST /api/auth/refresh`
- `TokenBlacklistService` — in-memory `ConcurrentHashMap` with 5-minute eviction
- `POST /api/auth/logout` — blacklists Bearer token
- Account lockout: 5 failed attempts = 15-minute lockout (`failedLoginAttempts`, `lockoutEnd`)

### Phase 7: Multi-Channel Authentication & Hybrid Password Reset

- **`MultiChannelAuthenticationToken`** — custom `AbstractAuthenticationToken` carrying lane, principal, credentials, identity fields
- **`MultiChannelAuthenticationProvider`** — 3-lane `AuthenticationProvider`:
  - SOUS_CHEF: identity-only (matricule + first/last name), strict role enforcement
  - CHEF_ATELIER: identity + BCrypt password
  - ADMIN: email + BCrypt password
- **`LoginRequest`** — refactored to 5 nullable `String` fields
- **`SecurityConfig`** — `ProviderManager` with custom `AuthenticationProvider`
- **`AuthService`** — dual-track password reset:
  - Track A: 6-char manual token (`SecureRandom`, 15 min expiry)
  - Track B: UUID email token (10 min expiry, async stub)
  - Track C: unified confirmation endpoint

### Phase 8: Global REST Exception Handler & Rate Limiting

- **`ErrorResponse`** — unified error contract with timestamp, status, error, message, errors map
- **`GlobalExceptionHandler`** — `@RestControllerAdvice` mapping:
  - `ResourceNotFoundException` → 404
  - `InvalidStatusTransitionException` → 400
  - `MethodArgumentNotValidException` → 400 (with field-level errors)
  - `IllegalArgumentException` → 400
  - `RateLimitExceededException` → 429 (+ `Retry-After` header)
  - `Exception` (catch-all) → 500 (safe generic message)
- **Bucket4j Rate Limiting:**
  - `RateLimitExceededException` — custom exception
  - `RateLimitingService` — `ConcurrentHashMap<String, Bucket>`, eviction after 5 min
  - `RateLimitingFilter` — `OncePerRequestFilter` after JWT filter
  - Rules: Auth = 5/min/IP, Incident Create = 10/min/principal
  - Headers: `X-Rate-Limit-*`, `Retry-After`

### Phase 9: Incident Lifecycle Revision & Fail-Safe Automation

- **6-stage lifecycle** replaces the previous 5-stage (`DECLARED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`):
  - `DECLARED → CLAIMED` (renamed from ASSIGNED) — ADMIN claims
  - `CLAIMED → IN_PROGRESS` — client auto-triggers
  - `IN_PROGRESS → RESOLVED` or `NON_RESOLVED` — admin evaluation (fork state)
  - `RESOLVED/NON_RESOLVED → CLOSED` — auto-closure (10-min timer)
- **Dual-write comment architecture**: evaluation note mirrored to `IncidentEntity.resolutionNote` + `IncidentHistory.comment`
- **`IncidentAutoClosureJob`** — `@Scheduled(fixedRate = 120000)`, closes RESOLVED incidents after 10 minutes
- **Column renames** via Flyway V2: `assigned_to_id → claimed_by_id`, `assigned_at → claimed_at`
- **Fields added**: `resolutionNote` (varchar 1000), `claimedBy`, `resolvedBy`
- **`EvaluateIncidentRequest`** — new DTO with `status` and `note` fields
- **DTO note**: `IncidentResponse.assignedTo` field name is legacy — maps to `entity.claimedBy`

### Phase 10: Decoupled Event-Driven Notification Engine

**Architecture rework — from synchronous to event-driven:**

- **`IncidentTransitionEvent`** — domain event record published on every status transition
- **`IncidentRecipientResolver`** — encapsulates all recipient-routing logic (`resolveRecipients()`)
- **`IncidentNotificationListener`** — `@TransactionalEventListener(phase = AFTER_COMMIT)`:
  - Reloads incident in new `@Transactional(propagation = REQUIRES_NEW)` context
  - Computes recipients per transition rules
  - Creates `NotificationEntity` rows
- **Notification matrix implemented:**
  - → DECLARED: all department watchers
  - DECLARED → CLAIMED: watchers minus claiming admin
  - CLAIMED → IN_PROGRESS: none (silent)
  - IN_PROGRESS → RESOLVED/NON_RESOLVED: CHEF_ATELIER only
  - RESOLVED → CLOSED (auto): resolvedBy admin only
- **AdminDepartmentSubscription** — many-to-many join entity with unique constraint
- **Department Watchers** = CHEF_ATELIER of department + subscribed ADMINs
- **`resolvedBy` auditing** — tracks who performed evaluation (exposed in `IncidentResponse`)
- **`claimedBy` auditing** — tracks who claimed (now properly persisted)
- **`UserEntity.getAuditLabel()`** — `"FirstName_LastName_Matricule"` format for audit history
- **Manual close retired** — `PUT /api/incidents/{id}/close` removed; `closeIncident()` removed from interface/implementation
- **`NotificationService.notifyStatusChange()` removed** — all notification creation via event listener

---

## 3. Frontend Roadmap Tracking Checklist

### Phase 1 (Frontend): Project Bootstrap, Design System & Multi-Channel Auth

**Status:** ⬜ NOT STARTED

| # | Task | Description | Status |
|---|---|---|---|
| F1.1 | Project Initialization | Next.js + TypeScript + Tailwind + ESLint | ⬜ |
| F1.2 | Design System | shadcn/ui integration, tokens, base components, layout shell | ⬜ |
| F1.3 | API Client | Axios instance, interceptors (JWT, 429, 401/refresh), React Query | ⬜ |
| F1.4 | State Management | Zustand stores, typed API service modules | ⬜ |
| F1.5 | Login Page | 3-lane Unified Login (SOUS_CHEF/CHEF_ATELIER/ADMIN) | ⬜ |
| F1.6 | Route Protection | AuthGuard, role-based navigation menu | ⬜ |

### Phase 2 (Frontend): Core Incident Management & Real-Time Lifecycle UI

**Status:** ⬜ NOT STARTED

| # | Task | Description | Status |
|---|---|---|---|
| F2.1 | Declaration Form | CreateIncidentRequest form with Zod validation, cascading dropdowns | ⬜ |
| F2.2 | List & Board Views | Paginated table + Kanban board per status with drag/drop | ⬜ |
| F2.3 | Evaluation Modal | RESOLVED/NON_RESOLVED outcome, mandatory note enforcement | ⬜ |

### Phase 3 (Frontend): Administrative Control, Department Subscriptions & Audit Trails

**Status:** ⬜ NOT STARTED

| # | Task | Description | Status |
|---|---|---|---|
| F3.1 | User Management | CRUD table, create/edit forms, soft delete, activate/deactivate | ⬜ |
| F3.2 | Department Subscriptions | Subscribe/unsubscribe admins to departments | ⬜ |
| F3.3 | Reference Data CRUD | Categories, Departments, Sections, Lines, Stations | ⬜ |
| F3.4 | Audit Trail Viewer | Timeline view per incident with audit-label format | ⬜ |
| F3.5 | Notification Stream | Bell icon, dropdown, mark-as-read, dedicated page | ⬜ |

### Phase 4 (Frontend): Security Hardening, Rate Limit Handling & End-to-End Testing

**Status:** ⬜ NOT STARTED

| # | Task | Description | Status |
|---|---|---|---|
| F4.1 | Token Refresh | Axios 401→refresh interceptor, proactive refresh | ⬜ |
| F4.2 | Lockout UX | Countdown timer, disabled form | ⬜ |
| F4.3 | 429 Handling | Retry-After countdown, toast, disabled submit | ⬜ |
| F4.4 | Dashboard | Statistics charts, recent activities, auto-refresh | ⬜ |
| F4.5 | Responsive/Accessible | Mobile layout, ARIA, high-contrast | ⬜ |
| F4.6 | E2E Tests | Playwright/Cypress for all major flows | ⬜ |

---

## 4. Backend Roadmap — Remaining Items

### Phase B: Testing, Migrations & CI/CD (COMPLETED)

| # | Task | Status |
|---|---|---|
| B1 | Testcontainers Integration Tests | ✅ Complete |
| B2 | MockMvc Controller Tests | ✅ Complete |
| B3 | State Machine Unit Tests | ✅ Complete |
| B4 | Flyway Migration Setup | ✅ Complete (V1–V3 applied) |
| B5 | CI/CD Pipeline | ✅ Complete (GitHub Actions + Railway) |
| — | Security Tests (JWT, auth provider, rate limiter) | ✅ Complete |
| — | Load Testing (k6) | ✅ Complete |

### Phase C: Operational Monitoring (Open)

| # | Task | Description | Effort |
|---|---|---|---|
| C1 | Actuator Tuning | Expose health, metrics, info endpoints | 0.5 day |
| C2 | Structured Logging | Logback + JSON layout + MDC (traceId, userId) | 1 day |
| C3 | Prometheus Metrics | Custom MeterBinder for incident/notification counters | 1 day |

### Phase D: Feature Enhancements (Open)

| # | Task | Description | Effort |
|---|---|---|---|
| D1 | WebSocket Real-Time | STOMP push for live dashboard updates | 2–3 days |
| D2 | OpenAPI/Swagger | springdoc-openapi for auto-generated docs | 1–2 days |
| D3 | Email Integration | Replace stub with Spring Mail + Thymeleaf | 1–2 days |
| D4 | Redis Token Blacklist | Replace in-memory blacklist (survive restarts) | 1–2 days |
| D5 | Incident Search | Full-text search on description | 1 day |
| D6 | Audit Trail Endpoint | `GET /api/incidents/{id}/history` | 0.5 day |
| D7 | Flyway-only DDL | Remove `ddl-auto=update`, pure Flyway managed | 1 day |

---

## 5. Known Issues / Technical Debt

| Issue | Severity | Details |
|---|---|---|
| **`IncidentResponse.assignedTo` field name** | Low | DTO field named `assignedTo` but maps to `entity.getClaimedBy()`. Cosmetic — rename tracked for alignment |
| **Token blacklist is in-memory** | Medium | Lost on restart. Should use Redis for multi-instance (Roadmap D4) |
| **`ddl-auto=update` + Flyway dual setup** | Low | Flyway handles migrations; Hibernate ddl-auto handles drift. Consolidate to pure Flyway (Roadmap D7) |
| **Email dispatcher is a stub** | Medium | `dispatchPasswordResetEmailAsync()` logs to console. Needs Spring Mail integration (Roadmap D3) |
| **No OpenAPI documentation** | Medium | No auto-generated API docs. Plan springdoc-openapi (Roadmap D2) |
| **Rate limiter is in-memory** | Medium | Buckets lost on restart. For multi-instance, use Redis-backed Bucket4j |

---

## 6. Inventory of Artifacts

### Source Files (`src/main/java/incident/management/system/`)

#### Configuration & Entry Point

| # | File | Role |
|---|---|---|
| 1 | `IncidentManagementSystemApplication.java` | `@SpringBootApplication`, `@EnableScheduling` |

#### Enums (`enums/`)

| # | File | Values |
|---|---|---|
| 2 | `IncidentStatus.java` | `DECLARED, CLAIMED, IN_PROGRESS, RESOLVED, NON_RESOLVED, CLOSED` |
| 3 | `IncidentPriority.java` | `LOW, MEDIUM, HIGH, CRITICAL` |
| 4 | `UserRole.java` | `ADMIN, CHEF_ATELIER, SOUS_CHEF` |

#### Models (`model/`)

| # | File | Table |
|---|---|---|
| 5 | `UserEntity.java` | `users` |
| 6 | `IncidentEntity.java` | `incidents` |
| 7 | `IncidentHistory.java` | `incident_history` |
| 8 | `NotificationEntity.java` | `notifications` |
| 9 | `AdminDepartmentSubscription.java` | `admin_department_subscriptions` |
| 10 | `CategoryEntity.java` | `categories` |
| 11 | `DepartmentEntity.java` | `departments` |
| 12 | `SectionEntity.java` | `sections` |
| 13 | `ProductionLineEntity.java` | `production_lines` |
| 14 | `StationEntity.java` | `stations` |
| 15 | `ReferenceCounterEntity.java` | `reference_counters` |
| 16 | `PasswordResetToken.java` | `password_reset_tokens` |
| 17 | `RefreshTokenEntity.java` | `refresh_tokens` |

#### Repositories (`repository/`)

| # | File | Entity |
|---|---|---|
| 18 | `UserRepository.java` | `UserEntity` |
| 19 | `IncidentRepository.java` | `IncidentEntity` |
| 20 | `IncidentHistoryRepository.java` | `IncidentHistory` |
| 21 | `NotificationRepository.java` | `NotificationEntity` |
| 22 | `AdminDepartmentSubscriptionRepository.java` | `AdminDepartmentSubscription` |
| 23 | `CategoryRepository.java` | `CategoryEntity` |
| 24 | `DepartmentRepository.java` | `DepartmentEntity` |
| 25 | `SectionRepository.java` | `SectionEntity` |
| 26 | `ProductionLineRepository.java` | `ProductionLineEntity` |
| 27 | `StationRepository.java` | `StationEntity` |
| 28 | `ReferenceSequenceRepository.java` | `ReferenceCounterEntity` |
| 29 | `PasswordResetTokenRepository.java` | `PasswordResetToken` |
| 30 | `RefreshTokenRepository.java` | `RefreshTokenEntity` |

#### DTOs (`dto/`)

| # | File | Type |
|---|---|---|
| 31 | `CreateIncidentRequest.java` | Request |
| 32 | `EvaluateIncidentRequest.java` | Request (fields: `status`, `note`) |
| 33 | `UpdateIncidentStatusRequest.java` | Request (superseded) |
| 34 | `CreateUserRequest.java` | Request |
| 35 | `UpdateUserRequest.java` | Request |
| 36 | `LoginRequest.java` | Request (5 nullable String fields) |
| 37 | `PasswordResetRequest.java` | Request |
| 38 | `PasswordResetConfirmRequest.java` | Request |
| 39 | `IncidentResponse.java` | Response (field `assignedTo` maps to `entity.claimedBy`) |
| 40 | `UserResponse.java` | Response |
| 41 | `NotificationResponse.java` | Response |
| 42 | `JwtAuthenticationResponse.java` | Response |
| 43 | `ErrorResponse.java` | Response (standardized error contract) |
| 44 | `UserSummaryResponse.java` | Embedded reference |
| 45 | `DepartmentResponse.java` | Embedded reference |
| 46 | `CategoryResponse.java` | Embedded reference |
| 47 | `SectionResponse.java` | Embedded reference |
| 48 | `ProductionLineResponse.java` | Embedded reference |
| 49 | `StationResponse.java` | Embedded reference |

#### Exceptions (`exception/`)

| # | File | HTTP Status |
|---|---|---|
| 50 | `ResourceNotFoundException.java` | 404 |
| 51 | `InvalidStatusTransitionException.java` | 400 |
| 52 | `RateLimitExceededException.java` | 429 |
| 53 | `GlobalExceptionHandler.java` | `@RestControllerAdvice` |

#### Services (`service/`)

| # | File | Type |
|---|---|---|
| 54 | `UserService.java` / `UserServiceImpl.java` | Interface + Impl |
| 55 | `IncidentService.java` / `IncidentServiceImpl.java` | Interface + Impl |
| 56 | `NotificationService.java` / `NotificationServiceImpl.java` | Interface + Impl |
| 57 | `CategoryService.java` | Concrete |
| 58 | `DepartmentService.java` | Concrete |
| 59 | `SectionService.java` | Concrete |
| 60 | `ProductionLineService.java` | Concrete |
| 61 | `StationService.java` | Concrete |
| 62 | `AuthService.java` | Concrete |
| 63 | `JwtService.java` | Component |
| 64 | `CustomUserDetailsService.java` | Impl (`UserDetailsService`) |
| 65 | `TokenBlacklistService.java` | Concrete |
| 66 | `RateLimitingService.java` | Concrete |
| 67 | `IncidentRecipientResolver.java` | Component |
| 68 | `IncidentReferenceGenerator.java` | Component |

#### Events & Listeners

| # | File | Role |
|---|---|---|
| 69 | `event/IncidentTransitionEvent.java` | Domain event record |
| 70 | `listener/IncidentNotificationListener.java` | `@TransactionalEventListener` |

#### Scheduled Jobs

| # | File | Role |
|---|---|---|
| 71 | `scheduler/IncidentAutoClosureJob.java` | `@Scheduled` auto-closure |

#### Security (`security/`)

| # | File | Role |
|---|---|---|
| 72 | `JwtAuthenticationFilter.java` | `OncePerRequestFilter` (Bearer validation) |
| 73 | `RateLimitingFilter.java` | `OncePerRequestFilter` (Bucket4j) |
| 74 | `MultiChannelAuthenticationToken.java` | Custom `AbstractAuthenticationToken` |
| 75 | `MultiChannelAuthenticationProvider.java` | 3-lane `AuthenticationProvider` |

#### Config (`config/`)

| # | File | Role |
|---|---|---|
| 76 | `SecurityConfig.java` | SecurityFilterChain, CORS, ProviderManager |
| 77 | `PasswordEncoderConfig.java` | BCryptPasswordEncoder bean |

### SQL Migrations

| # | File | Description |
|---|---|---|
| 78 | `db/migration/V1__baseline_schema.sql` | Core schema baseline |
| 79 | `db/migration/V2__refactor_and_audit_schema.sql` | Lifecycle refactor (column renames, additions) |
| 80 | `db/migration/V3__widen_reference_counter_date_key.sql` | Widen date_key to VARCHAR(32) |

### Test Files (`src/test/java/incident/management/system/`)

| # | File | Type |
|---|---|---|
| 81 | `config/RoleEnforcementFilter.java` | Test helper |
| 82 | `config/RoleEnforcementFilterTest.java` | Test |
| 83 | `config/StandaloneWebMvcTestBase.java` | Base test class |
| 84 | `IncidentManagementSystemApplicationTests.java` | Smoke test |
| 85 | `model/UserEntityLockoutTest.java` | Unit test |
| 86 | `repository/BaseRepositoryIntegrationTest.java` | Base integration test |
| 87 | `repository/FlywayMigrationTest.java` | Flyway migration validation |
| 88 | `repository/IncidentRepositoryTest.java` | Repository test |
| 89 | `repository/ReferenceSequenceRepositoryTest.java` | Repository test |
| 90 | `repository/TestEntityFactory.java` | Test data factory |
| 91 | `repository/UserRepositoryTest.java` | Repository test |
| 92 | `scheduler/IncidentAutoClosureJobTest.java` | Scheduler test |
| 93 | `security/MultiChannelAuthenticationProviderTest.java` | Security test |
| 94 | `security/TokenBlacklistServiceTest.java` | Security test |
| 95 | `service/IncidentServiceImplTest.java` | State machine unit tests |
| 96 | `service/RateLimitingServiceTest.java` | Rate limit test |
| 97 | `web/AdminControllerWebTest.java` | Web test |
| 98 | `web/AuthControllerAuthTest.java` | Web test |
| 99 | `web/GlobalExceptionHandlerWebTest.java` | Web test |
| 100 | `web/IncidentControllerWebTest.java` | Web test |
| 101 | `web/UserControllerWebTest.java` | Web test |

### Load Testing

| # | File | Description |
|---|---|---|
| 102 | `test/k6/rate-limit-test.js` | k6 load test for rate limiting |

### CI/CD

| # | File | Description |
|---|---|---|
| 103 | `.github/workflows/ci-cd.yml` | GitHub Actions (build + test → Railway deploy) |
| 104 | `compose.yaml` | Docker Compose (PostgreSQL 17) |
| 105 | `pom.xml` | Maven project descriptor |
| 106 | `application.properties` | Spring Boot configuration |

---

> **Document generated for project tracking.** This document reflects the system as implemented through Backend Phase 10. Frontend development begins with Phase 1. See `WORKFLOW.md` for detailed architectural and workflow specifications.
