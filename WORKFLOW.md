# Industrial Incident Management System — End-to-End Operational Workflow

> **Document Title:** Master Operational Workflow & Technical Lifecycle  
> **System:** Incident Management System (Backend API + Frontend Roadmap)  
> **Organization:** ICGLMA  
> **Package:** `incident.management.system`  
> **Version:** Phase 10 (Event-Driven Notification Engine Complete)  
> **Last Updated:** 2026-07-23  

---

## Table of Contents

1. [Strategic Context: The Industrial UX Challenge](#1-strategic-context-the-industrial-ux-challenge)
2. [The Multi-Channel Authentication Gateway](#2-the-multi-channel-authentication-gateway)
   - [A. SOUS_CHEF (Floor Operator Lane)](#a-sous_chef-floor-operator-lane)
   - [B. CHEF_ATELIER (Floor Supervisor Lane)](#b-chef_atelier-floor-supervisor-lane)
   - [C. ADMIN (Corporate Administrator Lane)](#c-admin-corporate-administrator-lane)
   - [D. Token Issuance & Lifecycle](#d-token-issuance--lifecycle-common-to-all-lanes)
   - [E. Multi-Channel Login Request Routing](#e-multi-channel-login-request-routing--authentication-provider)
3. [Core State Machine: Incident Lifecycle (6-Stage)](#3-core-state-machine-incident-lifecycle-end-to-end)
   - [Phase 1: Declaration (DECLARED)](#phase-1-incident-declaration-declared)
   - [Phase 2: Claim (CLAIMED)](#phase-2-claim-incident-claimed)
   - [Phase 3: Work-In-Progress (IN_PROGRESS)](#phase-3-work-in-progress-in_progress)
   - [Phase 4: Evaluation — RESOLVED / NON_RESOLVED](#phase-4-admin-evaluation--resolved-vs-non_resolved)
   - [Phase 5: Auto-Closure (CLOSED)](#phase-5-closure-closed)
   - [State Machine Enforcement Rules](#state-machine-enforcement-rules)
4. [Incident Claim & Lifecycle Trigger Flow](#4-incident-claim--lifecycle-trigger-flow)
5. [Hybrid Password Recovery Flows](#5-hybrid-password-recovery-flows)
6. [Enterprise Security Architecture](#6-enterprise-security-architecture)
7. [Global REST Exception Handling](#7-global-rest-exception-handling)
8. [Notification & Event-Driven Architecture](#8-notification--event-driven-architecture)
9. [Rate Limiting Subsystem](#9-rate-limiting-subsystem-bucket4j-token-bucket)
10. [Complete REST API Surface](#10-complete-rest-api-surface)
11. [Database Versioning Strategy (Flyway)](#11-database-versioning-strategy-flyway)
12. [Test Infrastructure](#12-test-infrastructure)
13. [CI/CD Pipeline & Deployment](#13-cicd-pipeline--deployment)
14. [Data Model & Entity Relationships](#14-data-model--entity-relationships)
15. [Technical Stack](#15-technical-stack--infrastructure)
16. [Frontend Architecture & Workflow Specifications](#16-frontend-architecture--step-by-step-workflow-specifications)

---

## 1. Strategic Context: The Industrial UX Challenge

### 1.1 The Manufacturing Floor Reality

Industrial production environments present a set of operational constraints fundamentally different from a corporate office setting. The Incident Management System was architected from the ground up to address these real-world challenges:

| Challenge | Operational Impact | System Design Response |
|---|---|---|
| **PPE & Physical Constraints** | Operators wear thick gloves, safety goggles, and hearing protection. Typing complex passwords is impractical, error-prone, and a safety hazard. | **Password-less SOUS_CHEF lane**: identity verification via matricule + first/last name only. Zero typing fatigue. |
| **No Corporate Email** | Floor operators and many supervisors do not have company email addresses. Traditional "click the reset link" flows are impossible. | **Manual token generator**: 6-character alphanumeric codes displayed on a supervisor dashboard, copied by the worker. |
| **High-Speed Production Lines** | Every minute of downtime on a critical line can cost thousands of dollars in lost output. Incident declaration must take < 15 seconds. | **Streamlined creation flow**: single `POST /api/incidents` with pre-populated structural metadata (department, station, category) from reference tables. |
| **Shift-Based Work** | Operators change across three shifts. An incident declared at 2:00 AM may need follow-up by a different team in the morning. | **Persistent audit trail**: every state transition is recorded in `incident_history` with timestamps, enabling full traceability across shifts. |
| **Role Separation** | Operators declare; supervisors assign and verify. No operator should be able to close their own ticket. | **Strict state machine** combined with **method-level `@PreAuthorize`** annotations: SOUS_CHEF can only create; CHEF_ATELIER assigns and closes; ADMIN has global oversight. |

### 1.2 Bridging the Gap: Frictionless UX + Enterprise Controls

- **For Floor Operators (SOUS_CHEF):** A frictionless, password-free experience. Authenticate with three simple identifiers (matricule, first name, last name). Declare an incident in seconds.
- **For Supervisors (CHEF_ATELIER):** A balance of convenience and security. Identity verification is paired with a traditional BCrypt-protected password.
- **For Corporate Administrators (ADMIN):** Full enterprise-grade security. Standard email-based authentication, email-driven password recovery, and unrestricted access to dashboards and reference data management.

---

## 2. The Multi-Channel Authentication Gateway

The authentication system implements **three distinct operational lanes** within a single, unified `/api/auth/login` endpoint. A custom `MultiChannelAuthenticationProvider` and `MultiChannelAuthenticationToken` comprise the core of this architecture.

### 2.1 Lane Detection

When a login request arrives at `POST /api/auth/login`, the `AuthController.detectLane()` method examines the presence of fields in the `LoginRequest` DTO:

```java
private UserRole detectLane(LoginRequest request) {
    if (request.email() != null && !request.email().isBlank()) {
        return UserRole.ADMIN;           // Lane 3 — email present = ADMIN
    }
    if (request.password() != null && !request.password().isBlank()) {
        return UserRole.CHEF_ATELIER;    // Lane 2 — password present (no email) = CHEF_ATELIER
    }
    return UserRole.SOUS_CHEF;           // Lane 1 — only identity fields = SOUS_CHEF
}
```

**The `LoginRequest` record** is a flexible, multi-purpose DTO with five nullable `String` fields:

```java
public record LoginRequest(
    String matricule,     // SOUS_CHEF / CHEF_ATELIER identifier
    String email,         // ADMIN identifier
    String password,      // CHEF_ATELIER / ADMIN credential
    String firstName,     // SOUS_CHEF / CHEF_ATELIER identity
    String lastName       // SOUS_CHEF / CHEF_ATELIER identity
) {}
```

### A. SOUS_CHEF (Floor Operator Lane)

**Target Users:** Production line operators, assembly workers, floor technicians

| Field | Type | Required | Description |
|---|---|---|---|
| `matricule` | `String` (parsed to `int`) | ✅ | Employee identification number |
| `firstName` | `String` | ✅ | Must match the database record exactly |
| `lastName` | `String` | ✅ | Must match the database record exactly |

**Backend Validation Flow:**
1. Lane detection → `UserRole.SOUS_CHEF`
2. Build `MultiChannelAuthenticationToken` with `principal`, `credentials=null`, `lane=SOUS_CHEF`
3. `authenticateSousChef()`:
   - Parse matricule, `UserRepository.findByMatricule()` → throws `BadCredentialsException` if not found
   - Check `user.isActive()` → throws if deactivated
   - Check `user.isLocked()` → throws `LockedException`
   - Identity verification: match `firstName` + `lastName` against DB record
   - **Strict role enforcement**: `user.getRole() == UserRole.SOUS_CHEF` — rejects ADMIN or CHEF_ATELIER using this lane
4. Token issuance (common to all lanes)

**Key Design Decision — Password Bypass:** The SOUS_CHEF lane completely bypasses `BCryptPasswordEncoder`. Authentication is identity-only. The strict role check prevents escalation.

### B. CHEF_ATELIER (Floor Supervisor Lane)

**Target Users:** Shift supervisors, team leads, production managers

| Field | Type | Required | Description |
|---|---|---|---|
| `matricule` | `String` (parsed to `int`) | ✅ | Employee identification number |
| `firstName` | `String` | ✅ | Must match the database record exactly |
| `lastName` | `String` | ✅ | Must match the database record exactly |
| `password` | `String` | ✅ | Plaintext password (BCrypt-verified) |

**Backend Validation Flow:**
1. Lane detection → `CHEF_ATELIER`
2. `authenticateChefAtelier()`:
   - Identity verification (firstName + lastName match)
   - **BCrypt verification**: `passwordEncoder.matches(password, user.getPasswordHash())`
3. Token issuance

**Security:** Dual-factor verification (identity + password). Full BCrypt verification.

### C. ADMIN (Corporate Administrator Lane)

**Target Users:** IT administrators, plant managers, corporate operations staff

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `String` | ✅ | Corporate email address |
| `password` | `String` | ✅ | Plaintext password (BCrypt-verified) |

**Backend Validation Flow:**
1. Lane detection → `ADMIN`
2. `authenticateAdmin()`:
   - `UserRepository.findByEmail(email)` → throws if not found
   - Check active & locked
   - **BCrypt verification**: `passwordEncoder.matches(password, user.getPasswordHash())`

### D. Token Issuance & Lifecycle (Common to All Lanes)

After authentication succeeds through any lane:

```
Step 1: Reset failed login attempts (user.resetFailedAttempts())
Step 2: Generate JWT Access Token (12h expiry, HMAC-SHA256)
        ├── subject = matricule (numeric string)
        └── claims.roles = ["ROLE_SOUS_CHEF" | "ROLE_CHEF_ATELIER" | "ROLE_ADMIN"]
Step 3: Persist Refresh Token (opaque UUID, 7-day expiry)
Step 4: Return JwtAuthenticationResponse with accessToken, refreshToken, matricule, roles
```

**Token Refresh (`POST /api/auth/refresh`):** Validates persisted refresh token (not expired, not revoked), checks user active status, issues new access token.

### E. Multi-Channel Login Request Routing

```
Client                    AuthController          MultiChannelAuthProvider    UserRepository
  │  POST /api/auth/login      │                           │                     │
  │───────────────────────────▶│                           │                     │
  │                            │ detectLane() + buildAuthToken()                │
  │                            │ authenticationManager.authenticate(token)      │
  │                            │──────────────────────────▶│                     │
  │                            │  ┌─ SOUS_CHEF:            │                     │
  │                            │  │  findByMatricule()     │────────────────────▶│
  │                            │  │  match identity + role  │◀────────────────────│
  │                            │  ├─ CHEF_ATELIER:          │                     │
  │                            │  │  findByMatricule()     │────────────────────▶│
  │                            │  │  match identity + BCrypt│◀───────────────────│
  │                            │  └─ ADMIN:                │                     │
  │                            │     findByEmail() + BCrypt│────────────────────▶│
  │                            │                           │◀────────────────────│
  │                            │ Generate JWT + Refresh    │                     │
  │◀───────────────────────────│                           │                     │
  │ 200 { accessToken, refreshToken, matricule, roles }   │                     │
```

---

## 3. Core State Machine: Incident Lifecycle (End-to-End)

The incident lifecycle is governed by a **strict, six-stage state machine**. Each transition is validated, timestamped, persisted in the audit trail, and triggers event-driven notifications.

### 3.1 State Machine Overview

```
┌──────────┐
│ DECLARED │ ◄── Initiated by SOUS_CHEF or CHEF_ATELIER
└────┬─────┘
     │ claimIncident() — ADMIN claims
     ▼
┌──────────┐
│ CLAIMED  │ ◄── Admin has acknowledged the incident
└────┬─────┘
     │ progressIncident() — Client auto-triggers on page load
     ▼
┌─────────────┐
│ IN_PROGRESS │ ◄── Investigation underway
└──────┬──────┘
     ┌──┴──┐
     ▼     ▼
┌────────┐ ┌──────────────┐
│RESOLVED│ │NON_RESOLVED  │ ◄── Admin evaluation
└────┬───┘ └──────┬───────┘
     │            │
     └──────┬─────┘
            ▼
┌─────────────────────┐
│       CLOSED        │ ◄── Terminal state (auto-closure after 10 min)
└─────────────────────┘
```

### Phase 1: Incident Declaration (DECLARED)

- **Actor:** SOUS_CHEF or CHEF_ATELIER
- **Endpoint:** `POST /api/incidents` (`@PreAuthorize("hasAnyRole('SOUS_CHEF', 'CHEF_ATELIER')")`)
- **Request Body:** `CreateIncidentRequest` with `userId`, `departmentId`, `stationId`, `categoryId`, `priority`, `description`

**System Actions (`IncidentServiceImpl.createIncident()`):**
1. Validate all foreign key references → `ResourceNotFoundException` (404) if missing
2. Generate unique tracking reference `INC-YYYYMMDD-XXXX` via `IncidentReferenceGenerator` (atomic DB upsert)
3. Build & persist `IncidentEntity` with status `DECLARED`, timestamp `declaredAt`
4. Record initial `IncidentHistory` entry
5. Publish `IncidentTransitionEvent` (→ DECLARED) — triggers notification to department watchers
6. Return `IncidentResponse` (201 Created)

**Response (201 Created):**
```json
{
    "id": 128,
    "reference": "INC-20260714-0001",
    "user": { "id": 42, "firstName": "Ahmed", "lastName": "Ben", "matricule": 12345 },
    "claimedBy": null,
    "resolvedBy": null,
    "department": { "id": 3, "name": "Assembly" },
    "station": { "id": 17, "code": "ASM-L1-S3" },
    "category": { "id": 5, "name": "Mechanical Failure" },
    "priority": "HIGH",
    "status": "DECLARED",
    "description": "Conveyor belt motor #3 overheating.",
    "resolutionNote": null,
    "declaredAt": "2026-07-14T08:23:15",
    "claimedAt": null,
    "inProgressAt": null,
    "resolvedAt": null,
    "closedAt": null
}
```

### Phase 2: Claim Incident (CLAIMED)

- **Actor:** ADMIN
- **Endpoint:** `PUT /api/incidents/{id}/claim` (`@PreAuthorize("hasRole('ADMIN')")`)
- **Precondition:** Incident is in `DECLARED` status

**System Actions:**
1. Validate `DECLARED → CLAIMED` transition
2. Resolve acting admin from `SecurityContextHolder`
3. `incident.setStatus(CLAIMED)`; `setClaimedAt(now)`; `setClaimedBy(currentUser)`
4. Persist `IncidentHistory` with audit-label: `"Claimed by FirstName_LastName_Matricule"`
5. Publish event → notifies department watchers minus the claiming admin
6. Return `IncidentResponse` (200 OK)

### Phase 3: Work-In-Progress (IN_PROGRESS)

- **Actor:** Client-side automated trigger (frontend UI)
- **Endpoint:** `PUT /api/incidents/{id}/progress` (no role restriction — any authenticated)
- **Precondition:** Incident is in `CLAIMED` status

**System Actions:**
1. Validate `CLAIMED → IN_PROGRESS`
2. `setStatus(IN_PROGRESS)`; `setInProgressAt(now)`
3. Record history; publish event (notifications suppressed for IN_PROGRESS)

**Design Decision:** Unrestricted so the frontend can auto-trigger on page load. IN_PROGRESS notifications are suppressed by design.

### Phase 4: Admin Evaluation — RESOLVED vs NON_RESOLVED

- **Actor:** ADMIN
- **Endpoint:** `PUT /api/incidents/{id}/evaluate` (`@PreAuthorize("hasRole('ADMIN')")`)
- **Precondition:** Incident is in `IN_PROGRESS` status

**Request Payload (`EvaluateIncidentRequest`):**
```json
{
    "status": "RESOLVED",
    "note": "Replaced conveyor belt motor #3. Line A operational."
}
```

> **Note:** The `EvaluateIncidentRequest` record uses **`status`** (not `outcome`) and **`note`** (not `resolutionNote`) as field names.

**Validation & Dual-Write Comment Architecture:**
1. Only `IN_PROGRESS` incidents can be evaluated — strict check
2. `NON_RESOLVED` requires a mandatory note → throws `IllegalArgumentException` (400)
3. **Dual-write within single `@Transactional` boundary:**
   - `IncidentEntity.resolutionNote` — active comment on incident (varchar 1000)
   - `IncidentHistory.comment` — mirrored into chronological audit trail
4. Sets `resolvedBy` (evaluating admin) and `resolvedAt`
5. Publishes event → notifies only the `CHEF_ATELIER` of the department

### Phase 5: Closure (CLOSED)

- **Actor:** Backend `IncidentAutoClosureJob` scheduler only
- **Schedule:** `@Scheduled(fixedRate = 120000)` — runs every 2 minutes
- **Precondition:** Incident is in `RESOLVED` status where `resolvedAt > 10 minutes ago`

**Design Decision — Automatic Only:** The manual `PUT /api/incidents/{id}/close` endpoint has been **retired**. Closure happens exclusively via the scheduled job. The `closeIncident()` method has been removed from `IncidentService` interface and `IncidentServiceImpl`.

**Scheduler Behavior:**
```java
@Scheduled(fixedRate = 120_000)
@Transactional
public void autoCloseResolvedIncidents() {
    LocalDateTime threshold = LocalDateTime.now().minusMinutes(10);
    List<IncidentEntity> stale = incidentRepository
            .findByStatusAndResolvedAtBefore(RESOLVED, threshold);
    for (IncidentEntity incident : stale) {
        incident.setStatus(CLOSED);
        incident.setClosedAt(now);
        incidentRepository.save(incident);
        // Archive in audit trail with explicit comment
        recordHistory(incident, RESOLVED, CLOSED,
            "Auto-closed by system after 10-minute timer.");
        // Publish event so the resolvedBy admin gets notified
        eventPublisher.publishEvent(new IncidentTransitionEvent(
                incident, RESOLVED, CLOSED, null));
    }
}
```

### State Machine Enforcement Rules

```java
private static final Map<IncidentStatus, IncidentStatus[]> VALID_TRANSITIONS = Map.of(
    IncidentStatus.DECLARED,       new IncidentStatus[]{IncidentStatus.CLAIMED},
    IncidentStatus.CLAIMED,        new IncidentStatus[]{IncidentStatus.IN_PROGRESS},
    IncidentStatus.IN_PROGRESS,    new IncidentStatus[]{IncidentStatus.RESOLVED, IncidentStatus.NON_RESOLVED},
    IncidentStatus.RESOLVED,       new IncidentStatus[]{IncidentStatus.CLOSED},
    IncidentStatus.NON_RESOLVED,   new IncidentStatus[]{IncidentStatus.CLOSED},
    IncidentStatus.CLOSED,         new IncidentStatus[]{}
);
```

**Hard rules:**
1. `DECLARED` → only `CLAIMED`
2. `CLAIMED` → only `IN_PROGRESS`
3. `IN_PROGRESS` is a **fork state** → `RESOLVED` or `NON_RESOLVED`
4. Both `RESOLVED` and `NON_RESOLVED` converge to `CLOSED`
5. `CLOSED` is **terminal** — no transitions out
6. Same-state transitions are silently allowed (idempotent)

### Complete Status Transition Table

| Current Status | Allowed Next | Action | Fields Set | Method |
|---|---|---|---|---|
| `DECLARED` | `CLAIMED` | Admin claims | `claimedAt`, `claimedBy` | `claimIncident()` |
| `CLAIMED` | `IN_PROGRESS` | Client auto-triggers | `inProgressAt` | `progressIncident()` |
| `IN_PROGRESS` | `RESOLVED`, `NON_RESOLVED` | Admin evaluation | `resolvedAt`, `resolutionNote`, `resolvedBy` | `evaluateIncident()` |
| `RESOLVED` | `CLOSED` | Scheduler auto-close | `closedAt` | `IncidentAutoClosureJob` |
| `NON_RESOLVED` | `CLOSED` | Scheduler auto-close | `closedAt` | `IncidentAutoClosureJob` |
| `CLOSED` | _none_ | Terminal — locked | — | blocked by validation |

---

## 4. Incident Claim & Lifecycle Trigger Flow

- `PUT /api/incidents/{id}/claim` — `@PreAuthorize("hasRole('ADMIN')")` — sets `claimedBy`, `claimedAt`
- `PUT /api/incidents/{id}/progress` — any authenticated — sets `inProgressAt`
- `PUT /api/incidents/{id}/evaluate` — `@PreAuthorize("hasRole('ADMIN')")` — sets `resolvedAt`, `resolutionNote`, `resolvedBy`

**Automated progression:** When the admin views the incident on the frontend, `progressIncident()` fires automatically.

---

## 5. Hybrid Password Recovery Flows

### Track A: Manual Token Loop (Floor Staff)

- **Endpoint:** `POST /api/auth/password-reset/request-manual`
- **Input:** `{ "matricule": 54321 }`
- **Flow:** Find user by matricule → invalidate existing tokens → generate 6-char alphanumeric code (`SecureRandom`, excludes 0/O, 1/I) → persist with 15-minute expiry → return token in JSON
- **Response:** `{ "message": "Manual password reset token generated.", "token": "XK7M9P", "expiresInMinutes": 15 }`

### Track B: Corporate Email Loop (Admin)

- **Endpoint:** `POST /api/auth/password-reset/request-email`
- **Input:** `{ "email": "admin@icglma.ma" }`
- **Flow:** Find user by email → generate UUID token → 10-minute expiry → async email dispatcher stub (logs reset URL)
- **Response:** `{ "message": "If the email address is registered, a password reset link has been sent.", "token": "f47ac10b-...", "expiresInMinutes": 10 }`

### Track C: Unified Confirmation Endpoint

- **Endpoint:** `POST /api/auth/password-reset/confirm`
- **Input:** `{ "token": "XK7M9P", "newPassword": "NewS3cur3P@ss!" }`
- **Flow:** Lookup token → validate expiry + `used` flag → BCrypt-encode new password → update user, reset failed attempts → atomically invalidate token

### Comparison

| Aspect | Track A (Manual) | Track B (Email) |
|---|---|---|
| **Target Role** | CHEF_ATELIER & floor staff | ADMIN |
| **Identifier** | Matricule | Email |
| **Token Format** | 6-char alphanumeric (`SecureRandom`) | UUID (128-bit) |
| **Expiry** | 15 minutes | 10 minutes |
| **Delivery** | Returned in API response | Async email stub |
| **Confusable Chars** | Excluded (0/O, 1/I) | N/A |

---

## 6. Enterprise Security Architecture

### Authentication & Authorization Chain

```
HTTP Request
    │
    ▼
┌─ CORS Filter ─────────────────────────────────────┐
│ Origins: localhost:3000/4200/8080                  │
│ Methods: GET, POST, PUT, DELETE, OPTIONS           │
│ Headers: *, Credentials: true                      │
└──────────────────┬────────────────────────────────┘
                   ▼
┌─ SecurityFilterChain ──────────────────────────────┐
│ CSRF: DISABLED, Session: STATELESS                  │
│ Permit: /api/auth/**, /actuator/**                  │
│ Authenticated: /api/**                              │
└──────────────────┬────────────────────────────────┘
                   ▼
┌─ JwtAuthenticationFilter (OncePerRequestFilter) ──┐
│ 1. Extract Authorization: Bearer <token>            │
│ 2. Check TokenBlacklistService (401 if blacklisted) │
│ 3. jwtService.validateToken()                      │
│ 4. Load UserDetails → SecurityContextHolder         │
└──────────────────┬────────────────────────────────┘
                   ▼
┌─ RateLimitingFilter (OncePerRequestFilter) ────────┐
│ 1. Resolve client key (IP or principal)             │
│ 2. Bucket4j token bucket check                      │
│ 3. 429 + Retry-After if exhausted                   │
└──────────────────┬────────────────────────────────┘
                   ▼
┌─ @EnableMethodSecurity ────────────────────────────┐
│ @PreAuthorize("hasAnyRole('SOUS_CHEF',...)"):       │
│   → POST /api/incidents                             │
│ @PreAuthorize("hasRole('ADMIN')"):                  │
│   → claim, evaluate, /api/users/**, /api/admin/**   │
│ No annotation (authenticated):                      │
│   → progress, GET /api/incidents, /api/dashboard/** │
└────────────────────────────────────────────────────┘
```

### Account Lockout Policy

| Property | Value |
|---|---|
| **Max failed attempts** | 5 |
| **Lockout duration** | 15 minutes |
| **Auto-unlock** | Yes — after 15 minutes |
| **Reset trigger** | Successful login OR password reset |

`UserEntity.isLocked()` checks `failedLoginAttempts >= 5` AND `lockoutEnd.isAfter(now)`. Failed attempt tracking occurs in `AuthController.login()` by matricule or email lookup.

### CORS Configuration

```java
configuration.setAllowedOrigins(List.of(
    "http://localhost:3000",   // React dev server
    "http://localhost:4200",   // Angular dev server
    "http://localhost:8080"    // Direct access
));
configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
configuration.setAllowedHeaders(List.of("*"));
configuration.setAllowCredentials(true);
```

### Token Blacklisting & Logout

- **Logout:** `POST /api/auth/logout` extracts Bearer token, adds to in-memory `ConcurrentHashMap<String, Long>` blacklist
- **Validation:** `JwtAuthenticationFilter` checks blacklist on every request → immediate 401 if blacklisted
- **Cleanup:** `ScheduledExecutorService` runs every 5 minutes evicting expired entries
- **⚠️ Known limitation:** In-memory only, lost on restart. Plan Redis-backed replacement for production multi-instance deployments.

---

## 7. Global REST Exception Handling

Every exception is intercepted by `GlobalExceptionHandler` (`@RestControllerAdvice`) and transformed into `ErrorResponse`:

```json
{
    "timestamp": "2026-07-14T08:23:15",
    "status": 404,
    "error": "Not Found",
    "message": "Incident not found with id: '128'",
    "errors": null
}
```

### Exception → HTTP Status Mapping

| Exception | Status | Example |
|---|---|---|
| `ResourceNotFoundException` | **404** | `"Incident not found with id: '128'"` |
| `InvalidStatusTransitionException` | **400** | `"Invalid status transition from CLOSED to IN_PROGRESS"` |
| `MethodArgumentNotValidException` | **400** | Field-level `errors` map |
| `IllegalArgumentException` | **400** | `"Invalid or expired reset token"` |
| `RateLimitExceededException` | **429** | Includes `Retry-After` header |
| `Exception` (catch-all) | **500** | Safe generic message + server-side stack trace |

---

## 8. Notification & Event-Driven Architecture

### A. Event-Driven Decoupling

The notification system is fully decoupled. `IncidentServiceImpl` publishes `IncidentTransitionEvent` via Spring's `ApplicationEventPublisher` — it no longer calls `NotificationService` directly.

**`IncidentTransitionEvent`:**
```java
public record IncidentTransitionEvent(
        IncidentEntity incident,
        IncidentStatus previousStatus,
        IncidentStatus newStatus,
        Long actorUserId    // null when triggered by scheduler
) {}
```

**`IncidentNotificationListener`:**
- `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` — fires only after the incident state change commits
- Runs in its own `@Transactional(propagation = REQUIRES_NEW)` context for lazy-association safety
- Delegates recipient resolution to `IncidentRecipientResolver`
- Creates one `NotificationEntity` row per resolved recipient

### B. Admin Department Subscriptions & Auditing

**`AdminDepartmentSubscription`** — many-to-many join entity:
```java
@Entity
@Table(name = "admin_department_subscriptions",
       uniqueConstraints = @UniqueConstraint(columnNames = {"admin_id", "department_id"}))
public class AdminDepartmentSubscription {
    Long id;
    @ManyToOne UserEntity admin;
    @ManyToOne DepartmentEntity department;
}
```

**Subscription API (all ADMIN-only, via `UserController`):**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users/{userId}/subscriptions/{departmentId}` | Subscribe ADMIN to department |
| `DELETE` | `/api/users/{userId}/subscriptions/{departmentId}` | Unsubscribe |
| `GET` | `/api/users/{userId}/subscriptions` | List subscribed departments |

**Department Watchers** = `CHEF_ATELIER` of the incident's department + all subscribed `ADMIN` users.

**Audit Fields on `IncidentEntity`:**

| Field | Type | Set When |
|---|---|---|
| `claimedBy` | `@ManyToOne → UserEntity` (LAZY) | `claimIncident()` |
| `resolvedBy` | `@ManyToOne → UserEntity` (LAZY) | `evaluateIncident()` |

**`UserEntity.getAuditLabel()`** returns `"FirstName_LastName_Matricule"` for traceability in `IncidentHistory.comment`.

### C. Complete Notification Matrix

| Transition | Recipients | Rationale |
|---|---|---|
| **→ DECLARED** | Department Watchers (CHEF_ATELIER + subscribed ADMINs) | Both roles need visibility |
| **DECLARED → CLAIMED** | Watchers _excluding claiming Admin_ | Claiming admin already knows |
| **CLAIMED → IN_PROGRESS** | _None_ | Auto-triggered; no operational info |
| **IN_PROGRESS → RESOLVED / NON_RESOLVED** | CHEF_ATELIER only | Evaluating admin knows; other ADMINs excluded |
| **RESOLVED/NON_RESOLVED → CLOSED** | _resolvedBy Admin_ only | Admin excluded from RESOLVED notification |

> **Important:** `SOUS_CHEF` users are fully omitted from all notification routing rules.

### D. Notification Stream

- `GET /api/notifications?userId=X` — Paginated unread notifications
- `PUT /api/notifications/{id}/read` — Mark as read
- Notifications persisted as `NotificationEntity` with type `"STATUS_CHANGE"`

---

## 9. Rate Limiting Subsystem (Bucket4j Token Bucket)

### Components

| Component | File | Role |
|---|---|---|
| `RateLimitExceededException` | `exception/` | Custom exception with `retryAfterSeconds` |
| `RateLimitingService` | `service/` | Manages `ConcurrentHashMap<String, Bucket>` |
| `RateLimitingFilter` | `security/` | `OncePerRequestFilter` after JWT filter |
| `GlobalExceptionHandler` | `exception/` | Safety net for propagated exceptions |

### Rate Limit Rules

| Rule | Endpoints | Limit | Key |
|---|---|---|---|
| **Auth** | `POST /api/auth/**` | 5/min/client IP | Client IP |
| **Incident Create** | `POST /api/incidents` | 10/min/client | Principal (matricule) or IP |

### Response Headers
- `X-Rate-Limit-Limit` — Maximum requests allowed
- `X-Rate-Limit-Remaining` — Remaining requests in window
- `X-Rate-Limit-Reset` — Epoch timestamp of bucket reset
- `Retry-After` — Seconds to wait (on 429)

**Eviction:** Stale buckets evicted after 5 minutes via `ScheduledExecutorService`.

---

## 10. Complete REST API Surface

### Authentication Endpoints (`/api/auth`)

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Multi-channel login |
| `POST` | `/api/auth/refresh` | Public | Refresh access token |
| `POST` | `/api/auth/logout` | Authenticated | Blacklist JWT |
| `POST` | `/api/auth/password-reset/request-manual` | Public | 6-char manual reset token |
| `POST` | `/api/auth/password-reset/request-email` | Public | UUID email reset token |
| `POST` | `/api/auth/password-reset/confirm` | Public | Unified confirmation |

**Rate-limited:** 5 req/min/client IP.

### Incident Endpoints (`/api/incidents`)

| Method | Path | Restriction | Description |
|---|---|---|---|
| `POST` | `/api/incidents` | SOUS_CHEF, CHEF_ATELIER | Declare new incident |
| `GET` | `/api/incidents` | Any authenticated | Paginated list (filters) |
| `GET` | `/api/incidents/{id}` | Any authenticated | Get by ID |
| `PUT` | `/api/incidents/{id}/claim` | ADMIN | DECLARED → CLAIMED |
| `PUT` | `/api/incidents/{id}/progress` | Any authenticated | CLAIMED → IN_PROGRESS |
| `PUT` | `/api/incidents/{id}/evaluate` | ADMIN | IN_PROGRESS → RESOLVED/NON_RESOLVED |

> **Note:** `PUT /api/incidents/{id}/close` has been **retired** — closure via scheduler only.

### User Management Endpoints (`/api/users`)

All **ADMIN-only** (`@PreAuthorize("hasRole('ADMIN')")` on controller class).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Create user |
| `GET` | `/api/users` | Paginated list |
| `GET` | `/api/users/{id}` | Get by ID |
| `GET` | `/api/users/matricule/{matricule}` | Get by matricule |
| `PUT` | `/api/users/{id}` | Partial update |
| `DELETE` | `/api/users/{id}` | **Soft delete** (deactivate) |
| `POST` | `/api/users/{userId}/subscriptions/{departmentId}` | Subscribe to department |
| `DELETE` | `/api/users/{userId}/subscriptions/{departmentId}` | Unsubscribe |
| `GET` | `/api/users/{userId}/subscriptions` | List subscriptions |

### Admin Reference Data Endpoints (`/api/admin`)

All **ADMIN-only**. CRUD for: categories, departments, sections, production-lines, stations.

### Notification Endpoints (`/api/notifications`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications?userId=X` | Paginated unread notifications |
| `PUT` | `/api/notifications/{id}/read` | Mark as read |

### Dashboard Endpoints (`/api/dashboard`)

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/dashboard/statistics/by-status` | `Map<String, Long>` (counts by status) |
| `GET` | `/api/dashboard/statistics/by-priority` | `Map<String, Long>` (counts by priority) |
| `GET` | `/api/dashboard/statistics/by-department` | `Map<String, Long>` (counts by department) |
| `GET` | `/api/dashboard/recent-activities` | `List<Map<String, Object>>` (last 20) |

---

## 11. Database Versioning Strategy (Flyway)

Flyway is fully configured and actively managing database schema changes.

### Configuration

```properties
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0
spring.flyway.validate-on-migrate=true
```

### Migration Inventory

| Migration | Description |
|---|---|
| **V1** `V1__baseline_schema.sql` | Core schema baseline: categories, departments, sections, production_lines, stations, users, incidents (with `assigned_to_id`/`assigned_at` legacy), incident_history, notifications, reference_counters, refresh_tokens, password_reset_tokens |
| **V2** `V2__refactor_and_audit_schema.sql` | Renames `assigned_to_id` → `claimed_by_id`, `assigned_at` → `claimed_at`; adds `resolution_note` (varchar 1000), `resolved_by_id`; creates `admin_department_subscriptions` |
| **V3** `V3__widen_reference_counter_date_key.sql` | Widens `date_key` from `VARCHAR(8)` to `VARCHAR(32)` for unit test compatibility |

> **Note:** `spring.jpa.hibernate.ddl-auto=update` remains alongside Flyway. A future phase should migrate to pure Flyway-managed DDL (Roadmap B4).

---

## 12. Test Infrastructure

### Testing Stack

| Category | Tool / Framework | Details |
|---|---|---|
| **Unit Tests** | JUnit 5 + Mockito | Service-layer tests with mocked repositories |
| **Web Slice Tests** | `@WebMvcTest` | Controller tests (StandaloneWebMvcTestBase) |
| **Repository Tests** | `@DataJpaTest` + Testcontainers | Real PostgreSQL (BaseRepositoryIntegrationTest) |
| **Flyway** | Flyway API + Testcontainers | Validates all 3 migrations apply cleanly |
| **Security Tests** | `@WebMvcTest` + custom context | JWT filter, multi-channel auth, rate limiter |
| **State Machine** | JUnit 5 parameterized | Every valid/invalid transition path |
| **Load Testing** | k6 | Rate-limit threshold (`src/test/k6/rate-limit-test.js`) |

### Key Patterns

- **Singleton Testcontainers**: `BaseRepositoryIntegrationTest` with shared `PostgreSQLContainer`
- **StandaloneWebMvcTestBase**: Base class providing mocked `AuthenticationManager`, mocked `MultiChannelAuthenticationProvider`, and helper methods for role-specific authenticated requests
- **FlywayMigrationTest**: Standalone Flyway against fresh PostgreSQL container, validates all migrations
- **State Machine Tests** (`IncidentServiceImplTest`): Covers all 6 valid transitions, invalid transitions, idempotent same-state, auto-closure behavior, event publication, mandatory note enforcement

---

## 13. CI/CD Pipeline & Deployment

### GitHub Actions (`.github/workflows/ci-cd.yml`)

**Trigger:** Push or PR targeting `main`.

**Job 1 — Build & Test (`build-and-test`):**
- PostgreSQL 17 Docker sidecar
- JDK 17 (Temurin) + Maven cache
- `./mvnw clean verify -B -V` (Build + PMD + integration tests)
- Artifact uploads: test-reports, failsafe-reports, pmd.xml

**Job 2 — Deploy to Railway (`deploy`):**
- Conditional: push to `main` only
- `needs: build-and-test`
- `railway/railway-action@v3` with `RAILWAY_TOKEN` secret

**Concurrency:** Cancels in-progress runs for same branch.

---

## 14. Data Model & Entity Relationships

### Entity Inventory

| Entity | Table | Key Relationships |
|---|---|---|
| `UserEntity` | `users` | `@ManyToOne → DepartmentEntity` |
| `IncidentEntity` | `incidents` | `@ManyToOne → User, Department, Station, Category`; `claimedBy`, `resolvedBy` |
| `IncidentHistory` | `incident_history` | `@ManyToOne → IncidentEntity` |
| `NotificationEntity` | `notifications` | `@ManyToOne → IncidentEntity, UserEntity` (recipient) |
| `AdminDepartmentSubscription` | `admin_department_subscriptions` | `@ManyToOne → UserEntity` (admin), `DepartmentEntity` |
| `CategoryEntity` | `categories` | Standalone |
| `DepartmentEntity` | `departments` | Standalone |
| `SectionEntity` | `sections` | Standalone |
| `ProductionLineEntity` | `production_lines` | `@ManyToOne → SectionEntity` |
| `StationEntity` | `stations` | `@ManyToOne → ProductionLineEntity` |
| `ReferenceCounterEntity` | `reference_counters` | Infrastructure |
| `PasswordResetToken` | `password_reset_tokens` | Infrastructure |
| `RefreshTokenEntity` | `refresh_tokens` | Infrastructure |

### DTO Mapping Note

The `IncidentResponse` record exposes `claimedBy` data under the field name `assignedTo` (legacy naming from pre-refactor DTO). `IncidentResponse.assignedTo == entity.claimedBy`. A future rename is tracked for alignment.

### Enum Values

| Enum | Values |
|---|---|
| `IncidentStatus` | `DECLARED, CLAIMED, IN_PROGRESS, RESOLVED, NON_RESOLVED, CLOSED` |
| `IncidentPriority` | `LOW, MEDIUM, HIGH, CRITICAL` |
| `UserRole` | `ADMIN, CHEF_ATELIER, SOUS_CHEF` |

---

## 15. Technical Stack & Infrastructure

| Layer | Technology | Version / Detail |
|---|---|---|
| **Runtime** | Java | 17 (LTS) |
| **Framework** | Spring Boot | 3.x |
| **Data Access** | Spring Data JPA / Hibernate | 6.x |
| **Database** | PostgreSQL | 17 (Docker Compose) |
| **Migrations** | Flyway | V1–V3 applied |
| **Security** | Spring Security 6.x | Stateless sessions |
| **JWT** | JJWT | 0.12.5, access+refresh token |
| **Rate Limiting** | Bucket4j | `bucket4j-core:8.7.0` |
| **Scheduling** | Spring `@EnableScheduling` | Auto-closure job |
| **Exception Handling** | `@RestControllerAdvice` | `GlobalExceptionHandler` |
| **Validation** | Jakarta Validation | `spring-boot-starter-validation` |
| **Utilities** | Lombok | 1.18.x |
| **Build** | Maven Wrapper | `mvnw` |
| **Container** | Docker Compose | `postgres:17` |
| **CI/CD** | GitHub Actions | Build + test → Railway deploy |

---

## 16. Frontend Architecture & Step-by-Step Workflow Specifications

This section defines the complete frontend engineering roadmap. The frontend is a modern single-page application communicating with the backend REST API.

### Architecture Overview

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js (React) + TypeScript | SSR-capable SPA |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **State** | React Query + Zustand | Server cache + client state |
| **HTTP** | Axios + interceptors | JWT attachment, 429 backoff |
| **Forms** | React Hook Form + Zod | Declarative DTO validation |
| **UI Kit** | shadcn/ui (Radix) | Accessible components |
| **Auth** | NextAuth.js or custom JWT | Token lifecycle |

### Phase 1: Project Bootstrap, Design System & Multi-Channel Auth

**Goal:** Establish project scaffolding, design system, and Unified Login interface.

**Tasks:**

1. **Project Initialization**
   - Initialize Next.js project with TypeScript, Tailwind CSS, `app/` router
   - Configure ESLint, Prettier, Tailwind class sorting
   - Set up environment variables (`NEXT_PUBLIC_API_URL`, etc.)

2. **Design System Foundation**
   - Install shadcn/ui (or Radix-based library)
   - Define design tokens: ICGLMA brand palette, typography, spacing, breakpoints
   - Build base components: Button, Input, Card, Badge, Select, Table, Modal, Toast
   - Create shared layout shell (Sidebar + Header + Main Content)

3. **API Client Infrastructure**
   - Axios instance with base URL from env
   - **Request interceptor**: Attach `Authorization: Bearer <accessToken>`
   - **Response interceptor**: On 401 → attempt refresh; on failure → redirect to login
   - **429 handler**: Parse `Retry-After`, countdown toast, exponential backoff
   - React Query `QueryClient` with default stale/retry settings

4. **State Management**
   - Zustand stores for auth state (user, token, role)
   - React Query hooks for API data
   - Typed API service modules per domain

5. **Unified Login Page (`/login`)**
   - SOUS_CHEF: matricule + first name + last name (no password)
   - CHEF_ATELIER: matricule + first/last name + password
   - ADMIN: email + password (classic)
   - Lane detection via role selector on frontend
   - On success: store JWT + refresh, redirect to dashboard
   - On 401: error message; on 423 (locked): lockout countdown
   - Loading states, validation feedback

6. **Route Protection & Role Navigation**
   - `AuthGuard` component wrapping protected routes
   - Role-based menu:
     - SOUS_CHEF: Declare Incident, My Incidents
     - CHEF_ATELIER: + Evaluation Dashboard
     - ADMIN: + User Management, Admin Settings, Subscriptions

### Phase 2: Core Incident Management & Real-Time Lifecycle UI

**Goal:** Incident creation, feed/board views, admin evaluation modals.

**Tasks:**

1. **Incident Declaration Form**
   - Fields matching `CreateIncidentRequest`: department, station (cascading), category, priority, description
   - Zod schema mirroring Jakarta validation
   - Cascading dropdowns: department filters stations
   - Success/error toasts

2. **Incident Feed & Board Views**
   - **List View**: Sortable, paginated table (Reference, Status badge, Priority badge, Department, Claimed By)
   - **Board View**: Kanban columns per status with draggable cards
   - Filters: status, department, priority, date range
   - Search: reference or description keyword

3. **Admin Evaluation Modal**
   - Triggered on `IN_PROGRESS` incidents
   - Radio: `RESOLVED` or `NON_RESOLVED`
   - Conditional textarea for note — **mandatory** for `NON_RESOLVED`
   - Client-side check mirrors backend `IllegalArgumentException`
   - Confirmation dialog; optimistic UI update

### Phase 3: Administrative Control, Subscriptions & Audit Trails

**Goal:** Admin management interfaces.

**Tasks:**

1. **User Management (ADMIN only)**
   - Paginated table: ID, Name, Matricule, Role, Department, Active status
   - Create/Edit forms matching DTOs
   - Soft delete with confirmation; activate/deactivate toggle

2. **Department Subscription Management**
   - Show current subscriptions per ADMIN
   - Add/Remove via checkboxes

3. **Reference Data CRUD (ADMIN only)**
   - Categories, Departments, Sections, Production Lines, Stations
   - Hierarchical cascading for stations

4. **Audit Trail Viewer**
   - Timeline per incident: each status transition
   - Format: `Previous → Current`, timestamp, comment (`FirstName_LastName_Matricule`)
   - Resolution note display for RESOLVED/NON_RESOLVED

5. **Notification Stream UI**
   - Bell icon with unread count in header
   - Dropdown with recent notifications
   - Mark as read; dedicated notifications page

### Phase 4: Security Hardening, Rate Limit Handling & E2E Testing

**Goal:** Token lifecycle, rate limit UX, comprehensive testing.

**Tasks:**

1. **Token Expiration & Refresh**
   - Axios interceptor: 401 → POST /api/auth/refresh → retry
   - On refresh failure: clear auth, redirect to login
   - Logout: POST /api/auth/logout → clear local state
   - Proactive refresh before expiry

2. **Account Lockout UX**
   - 423 response: show lockout countdown from `lockoutEnd`
   - Disable form during lockout

3. **Rate Limit (429) Visual Handling**
   - Parse `Retry-After` → countdown toast
   - Disable submit during cooldown
   - Show `X-Rate-Limit-Remaining` when < 3

4. **Dashboard Page**
   - Statistics cards (by status/priority/department)
   - Recent activity feed (last 20)
   - Auto-refresh configurable

5. **Responsive & Accessible Design**
   - Mobile layout for tablets/wall-mounted screens
   - Keyboard nav, ARIA labels, high-contrast support

6. **E2E Testing (Playwright/Cypress)**
   - Auth flows (all 3 lanes, refresh, logout, password reset)
   - Incident lifecycle (create → claim → progress → evaluate → close)
   - Admin CRUD workflows
   - Rate limit behavior
   - Responsive breakpoints

---

> **Document generated for operational reference.** This document describes the system as implemented through Phase 10 (Event-Driven Notification Engine). For upcoming features and roadmap items, see `PROJECT_STATUS.md`.
