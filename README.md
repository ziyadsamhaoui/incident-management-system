# ICGLMA — Incident Management System

Full-stack industrial incident management platform: floor operators declare incidents in seconds from shared kiosk terminals, supervisors track the active workload, and administrators claim, evaluate, and administer the system end to end.

![CI](https://img.shields.io/badge/CI-passing-brightgreen)
![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.0-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)
![Redis](https://img.shields.io/badge/Redis-7-dc382d)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

**Quick links:** [Architecture](#4-architecture--repository-structure) · [Quick Start](#7-quick-start--local-runbook) · [API Reference](#9-api--route-reference) · [Tech Stack](#5-tech-stack-matrix) · [Engineering Highlights](#8-technical-deep-dive--engineering-highlights)

---

## 1. Hero & Badges

**One line:** A JWT-secured, event-driven incident lifecycle (declare → claim → in-progress → resolved/non-resolved) with passwordless operator authentication, Redis-backed rate limiting and idempotency, native PostgreSQL full-text search, self-hosted media, and an FR/AR analytics frontend.

> [!NOTE]
> The system is designed for a factory floor where operators wear gloves, have no corporate email, and share terminals. Every architectural decision — passwordless auth, manual reset codes, 15-second declarations, photo-first forms — follows from those constraints, not from convention.

## 2. Project Overview & Problem Statement

**The problem.** On the production site, operators signaled incidents orally, waiting for a supervisor to walk by. Declarations were slow, untracked, and left no record. No one could measure how long incidents took to resolve, and nothing stopped the same failure from recurring silently.

**The solution.** A two-tier web application that replaces oral reporting with a structured, auditable process:

- **Operators** declare incidents in under 15 seconds (no password: `matricule` + first/last name), attach photos/videos/voice notes, and see only their own declarations.
- **Chefs d'atelier** see the system-wide active list, resolved Logs archive, and departmental notifications.
- **Admins** own the lifecycle: claim, progress, evaluate (resolved / non-resolved), plus user management, reference data, media administration, and analytics.

**Core philosophy.** *The person who declares an incident cannot be the one who closes it.* A five-state state machine plus method-level `@PreAuthorize` rules enforce this. Every transition writes an audit row (`incident_history`), publishes a notification event, and refreshes the dashboard cache.

## 3. Core Capabilities & Feature Breakdown

### 3.1 Authentication & Identity (multi-channel)

| Capability | Detail |
|---|---|
| Lane detection | One `POST /api/auth/login` infers the role from submitted fields (email → ADMIN, password → CHEF_ATELIER, otherwise → SOUS_CHEF) and dispatches to the matching `AuthenticationProvider`. |
| Passwordless operator login | `SOUS_CHEF` verifies `matricule` + trimmed, case-insensitive first/last name. No password stored or requested. |
| Supervisor login | `CHEF_ATELIER` = identity + BCrypt. Unclaimed accounts (empty `password_hash` sentinel) return `403 ACCOUNT_UNCLAIMED`. |
| Admin login | `ADMIN` = email (case-insensitive lookup) + BCrypt. |
| Account claim | Public registration removed. Accounts come from the HR roster (role `SOUS_CHEF`); promotion to `CHEF_ATELIER` is an ADMIN-only action; claiming requires an identity match (`POST /api/auth/claim`). Prevents role self-assignment. |
| Session lifecycle | 12 h access JWT (HMAC-SHA256, `sub=matricule`, `roles` claim) + opaque persisted refresh token (7 d, no rotation). |
| Lockout | 5 failed attempts → 15 min lock (`423` + `lockoutEnd`). Cleared on success or password reset. |
| Logout revocation | Access JWT blacklisted in Redis keyed by `jti`, TTL = remaining validity. Fail-closed: token-bearing requests rejected if Redis is unreachable. |
| Password reset (3 tracks) | Manual 6-char code (identity-verified, 3/15 min rate limit) · email UUID link (Gmail SMTP, neutral 200 anti-enumeration) · confirm endpoint accepting tokens or admin-issued SHA-256 hashed codes (15 min TTL, single use). |

### 3.2 Incident Lifecycle (state machine)

- **5 states:** `DECLARED → CLAIMED → IN_PROGRESS → RESOLVED | NON_RESOLVED`. Terminal states have empty transition sets; same-state transitions are idempotent no-ops; anything else → `400 InvalidStatusTransitionException`.
- **Role gates:** claim and evaluate are ADMIN-only. Progress is client-triggered by any authenticated user.
- **Atomic references:** `INC-{yyyyMMdd}-{seq:04d}` generated via a DB upsert on `reference_counters` (Casablanca timezone).
- **Audit trail:** one `incident_history` row per transition with actor, timestamp, and comment. Evaluation notes are dual-written to `resolution_note` and the history comment.
- **Idempotent declaration:** `POST /api/incidents` requires `X-Idempotency-Key`. The `IdempotencyAspect` does an atomic Redis `SETNX`, replays the cached JSON response for retries, and returns `409` for in-flight duplicates. No in-memory fallback.
- **Aging detection:** `GET /api/incidents/stale` lists `CLAIMED`/`IN_PROGRESS` incidents older than 2 h.

### 3.3 Notifications (event-driven)

- Transitions publish `IncidentTransitionEvent`, consumed by a `@TransactionalEventListener(phase = AFTER_COMMIT)` with `REQUIRES_NEW` — notifications only fire if the write commits, and lazy associations are reloaded safely in a fresh transaction.
- Recipient matrix (`IncidentRecipientResolver`): declaration → department watchers (CHEF_ATELIER + subscribed admins); claim → watchers minus claiming admin; progress → silent; terminal → department CHEF_ATELIER only. **SOUS_CHEF is always excluded.**
- UI: admin bell dropdown with unread counter + mobile bottom-sheet, paginated history, mark-as-read.

### 3.4 Media Attachments (self-hosted)

- Uploads stream to local disk via `MultipartFile.transferTo()` (never `getBytes()`); layout `{storagePath}/{incidentId}/{uuid}.{ext}`; PostgreSQL stores metadata only.
- **Guardrails:** 5 attachments/incident · image/audio ≤ 5 Mo · video ≤ 25 Mo · MIME allow-list + 16-byte magic-byte sniff (spoofed extension → `400` + file deleted) · terminal incidents are read-only · role-scoped access (`MediaAccessPolicy`).
- **Serving:** `ResourceHttpRequestHandler` with HTTP Range/206 for video scrubbing; auth via JWT session or 15-min HMAC-signed read token (browser `<img>`/`<video>` can't send headers).
- **Retention:** daily 03:15 job hard-deletes files + rows for terminal incidents older than `MEDIA_RETENTION_DAYS` (default 90). Admin media surface supports search, storage stats, single/bulk delete with audit stubs.

### 3.5 Search & Filtering

- Generated `tsvector` column (`setweight` A = reference + description, B = resolution note) + GIN index (V11).
- `websearch_to_tsquery` + `ts_rank DESC`: phrases (`"moteur défaillant"`), exclusions (`courroie -convoyeur`), prefixes (`convoy*`). `'simple'` dictionary handles mixed FR/AR.
- Structured filters (status group, department, user, date window on `declaredAt`/`resolvedAt`, sort) compose inside the same query. Replaces the old `LIKE '%term%'` sequential scans.

### 3.6 Analytics & Dashboard

- **Volume/speed:** dense day/week/month buckets, cohort resolved/non-resolved, `mttrHours`, `timeToClaimHours`, period-over-period deltas, ranked departments.
- **Pareto 80/20:** server-side cumulative % + insight sentence.
- **Shift heatmap:** sparse `[dayOfWeek, hour, count]` grid.
- **Repeat signals:** SQL `LAG(2)` windowing — ≥ 3 incidents on the same station+category within 14 days, deep-linked to the latest incident.
- **Team workload:** ADMIN-only non-competitive aggregates.
- **Dashboard:** by-status (5), by-priority (4), by-department, recent activities, admin-activity heatmap (12 months). Cached in Redis (90 s) with `@EvictDashboardCaches` on every mutation.
- **Exports:** CSV/PDF reports (`lib/report.ts`, jsPDF + autotable, SheetJS).

### 3.7 Reference Data & Administration

- Full CRUD on categories, departments, sections, production-lines (FK-guarded `409`), stations — ADMIN only; read-only endpoints for all authenticated roles.
- User management: create, promote/demote, activate/deactivate, cancel-promotion, per-user activity + audit logs, last-active-admin guard, admin-issued reset codes (`GENERATE_RESET_CODE` audit row).
- Department subscriptions: admins opt into per-department notification streams.

## 4. Architecture & Repository Structure

```text
.
├── .github/workflows/          # CI/CD: build-and-test (JDK 17, Postgres 17 sidecar) + disabled Railway deploy
├── backend/                    # Spring Boot 4.1.0 REST API (Java 17)
│   ├── pom.xml                 # Maven build, PMD at verify, Testcontainers, JJWT, Bucket4j
│   ├── Dockerfile              # Multi-stage: maven:3.9.11-temurin-17 → temurin:17-jre (uid 1001)
│   ├── mvnw                    # Maven wrapper (pinned 3.9.16)
│   └── src/
│       ├── main/java/incident/management/system/
│       │   ├── controller/     # REST endpoints (admin, auth, analytics, dashboard, incidents, media, notifications, reference-data, users)
│       │   ├── service/        # Business logic: state machine, analytics, media, notifications
│       │   ├── repository/     # Spring Data JPA + native FTS query
│       │   ├── model/ dto/     # Entities + request/response records
│       │   ├── security/       # MultiChannelAuthenticationProvider, JWT filter, RateLimitingFilter, TokenBlacklistService
│       │   ├── config/         # Security, Redis, OpenAPI, media serving, dev seeder
│       │   ├── event/ listener/# IncidentTransitionEvent + @TransactionalEventListener notifications
│       │   ├── idempotency/    # @Idempotent AOP aspect (Redis SETNX + response replay)
│       │   └── job/            # MediaRetentionJob (cron 03:15)
│       ├── main/resources/
│       │   ├── application.properties  # All env-configurable settings
│       │   ├── db/migration/           # Flyway V1–V11
│       │   └── data/                   # Dev roster CSV
│       └── test/               # JUnit 5 + Mockito + Testcontainers + k6 load test
├── frontend/                   # Next.js 14 App Router (TypeScript, Tailwind)
│   ├── package.json            # Zustand, TanStack Query, Axios, RHF+Zod, Recharts, jsPDF/xlsx
│   ├── next.config.js          # output: 'standalone', NEXT_PUBLIC_API_URL
│   ├── Dockerfile              # Multi-stage node:20-alpine (standalone server, uid 1001)
│   └── src/ (via app/, components/, lib/, services/, store/, types/)
│       ├── app/                # Route groups per role: sous-chef/, chef-atelier/, (admin)/
│       ├── components/         # Role surfaces + shared ui/ primitives
│       ├── lib/                # api-client (401 refresh queue / 429 backoff), i18n FR/AR, schemas, exports
│       ├── services/           # Typed per-domain API clients
│       └── store/              # Zustand auth store (persisted)
├── docs/                       # PROJECT_STATUS.md, WORKFLOW.md, DEPLOYMENT.md, AGENT_SUMMARY.md
└── compose.yaml                # Local stack: postgres:17, redis:7-alpine, backend, frontend
```

**Separation of concerns.** The backend owns all business rules — state transitions, authorization, notifications, media policy, rate limits. The frontend is a thin client: it renders role-specific surfaces, caches server state with TanStack Query, and delegates enforcement to the API. Two deliberate seams:

- **Schema ownership:** `ddl-auto=validate` + pure Flyway. No Hibernate `update`, so schema drift between environments is a boot failure, not a surprise.
- **Distributed state in Redis:** JWT revocation, rate-limit buckets, dashboard/analytics caches, idempotency locks, and per-user language preference all live in Redis — surviving restarts and staying consistent across instances.

## 5. Tech Stack Matrix

| Layer | Technology / Library | Version | Purpose / Rationale |
|---|---|---|---|
| Backend runtime | Java (Temurin) | 17 (LTS) | Stable LTS, ubiquitous in enterprise IS |
| Backend framework | Spring Boot | 4.1.0 | Modular starters, transactional + security support |
| Security | Spring Security 6 | — | Stateless JWT chain, `@EnableMethodSecurity`, `@PreAuthorize` everywhere |
| Data access | Spring Data JPA / Hibernate | — | Typed repositories, `ddl-auto=validate` |
| Database | PostgreSQL | 17 | Relational core + native tsvector/GIN full-text search |
| Migrations | Flyway | (Boot-managed) | Versioned V1–V11 migrations, `baseline-on-migrate` |
| Distributed state | Redis (Lettuce) + commons-pool2 | 7 | JWT blacklist, rate limits, caches, idempotency, language pref |
| Rate limiting | Bucket4j (`bucket4j-core` + `bucket4j-redis`) | 8.7.0 | Token-bucket distributed via Redis `ProxyManager` |
| JWT | JJWT | 0.12.5 | Access/refresh token creation + verification |
| API docs | springdoc-openapi | 3.1.0 | Auto-generated OpenAPI 3.0 + Swagger UI |
| Mail | Spring Mail → Gmail SMTP | — | Transactional password-reset emails (STARTTLS 587) |
| AOP | spring-boot-starter-aspectj | — | Powers `@Idempotent` aspect |
| Scheduling | `@EnableScheduling` | — | Media retention job (cron `0 15 3 * * *`) |
| Monitoring | actuator + micrometer-registry-prometheus | — | Health/metrics endpoints (`/actuator/**`) |
| Tests | JUnit 5, Mockito, spring-security-test, Testcontainers, k6 | 1.20.1 (TC) | Unit, `@WebMvcTest`, `@DataJpaTest`, FlywayMigrationTest, Redis integration, load test |
| Static analysis | maven-pmd-plugin | 3.26.0 | bestpractices/design/errorprone/performance at `verify` |
| Frontend framework | Next.js (App Router) | 14.2.15 | SSR + `output: 'standalone'` |
| Frontend language | TypeScript | 5.6.3 | Typed client; `tsc --noEmit` clean |
| Styling | Tailwind CSS + tailwindcss-animate | 3.4.14 | Utility-first, theme-aware |
| UI primitives | Radix UI (dialog, dropdown, select, toast, tooltip…) | 1.x/2.x | Accessible, unstyled primitives |
| Client state | Zustand (persisted) + TanStack Query | 5.0.1 / 5.59.0 | Auth store + server-state caching |
| HTTP | Axios | 1.7.7 | Interceptors: Bearer injection, 401 refresh queue, 429 Retry-After |
| Forms | React Hook Form + Zod + @hookform/resolvers | 7.53.1 / 3.23.8 | Schema-validated forms |
| Charts | Recharts | 3.10.1 | Analytics volume/Pareto/heatmap/MTTR |
| Exports | jsPDF (+ autotable), SheetJS | 4.2.1 / 0.18.5 | PDF + Excel/CSV report export |
| Media | browser-image-compression | 2.0.2 | Client-side re-encode before upload |
| Motion/theme | Framer Motion, next-themes | 12.42.2 / 0.3.0 | Animations + app theme |
| Icons | lucide-react | 0.451.0 | Category/UI icon map |
| Orchestration | Docker Compose | — | postgres + redis + backend + frontend with healthchecks |
| CI/CD | GitHub Actions | — | JDK 17, Postgres 17 sidecar, `mvnw clean verify`, artifact upload |

## 6. Prerequisites & Environment Configuration

**Runtime requirements:**

- JDK **17** (Temurin) and Maven 3.9+ (or use `backend/mvnw`)
- Node.js **20** (Dockerfile base image) — frontend
- Docker + Docker Compose (PostgreSQL 17, Redis 7, or run them natively)

**Full stack via Docker Compose** (`compose.yaml`) — one command, no local installs:

```bash
docker compose up -d --build
# frontend → http://localhost:3000   backend → http://localhost:8080
```

> [!IMPORTANT]
> The backend image runs as UID **1001** and the media volume mounts at `/data/incident-media`. On a host bind mount, `chown 1001:1001` the directory or uploads answer `503`. See `docs/AGENT_SUMMARY.md`.

### Environment variables

Backend (`backend/src/main/resources/application.properties` — all Spring relaxed-binding env vars):

| Variable | Default | Required | Notes |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/icglma_local` | Yes (prod) | JDBC URL |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | `icglma` / `ICGLMA@2025` | Yes (prod) | **Rotate in production** |
| `SPRING_REDIS_HOST` / `SPRING_REDIS_PORT` | `localhost` / `6379` | Yes (prod) | Redis endpoint |
| `SPRING_REDIS_PASSWORD` | empty | No | Set if Redis requires auth |
| `JWT_SECRET` | committed dev secret | **Yes (prod)** | HMAC key for access tokens. Generate `openssl rand -base64 48`. |
| `APP_FRONTEND_URL` | `http://localhost:3000` | Yes (prod) | Builds password-reset email links — must be the public URL |
| `CORS_ALLOWED_ORIGINS` | — | No | Comma-separated; never `*` (credentials are enabled) |
| `MEDIA_STORAGE_PATH` | `${java.io.tmpdir}/icglma-incident-media` | **Yes (prod)** | Must live **outside** the deploy directory |
| `MEDIA_SIGNING_SECRET` | dev-only fallback (logged as warning) | **Yes (prod)** | HMAC for signed media read URLs. `openssl rand -hex 32`. |
| `MEDIA_RETENTION_DAYS` | `90` | No | Purge terminal-incident media older than N days |
| `MEDIA_READ_TOKEN_TTL_MINUTES` | `15` | No | Signed media URL lifetime (min 1) |
| `MULTIPART_MAX_FILE_SIZE` | `30MB` | No | Per-file cap (covers 25 Mo video + overhead) |
| `MULTIPART_MAX_REQUEST_SIZE` | `35MB` | No | Per-request cap |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | committed Gmail app password | **Yes (prod)** | Gmail SMTP app password, not login password |
| `MAIL_FROM` | `MAIL_USERNAME` | No | From address |
| `CACHE_DEFAULT_TTL_SECONDS` | `90` | No | Dashboard cache TTL |
| `CACHE_ANALYTICS_TTL_SECONDS` | `120` | No | Analytics cache TTL |
| `IDEMPOTENCY_TTL_SECONDS` | `30` | No | `X-Idempotency-Key` lock window |
| `SPRINGDOC_API_DOCS_ENABLED` / `SPRINGDOC_SWAGGER_UI_ENABLED` | `true` | No | Disable in production to gate docs |

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

> [!WARNING]
> `NEXT_PUBLIC_*` variables are **inlined into the client bundle at build time**. They must be the URL the *browser* can reach (the public origin in production), and changing them requires a rebuild, not a restart.

## 7. Quick Start & Local Runbook

### 7.1 Clone & install dependencies

```bash
git clone <repo-url> incident-management-system
cd incident-management-system

# Backend (Maven wrapper — no global Maven needed)
cd backend
./mvnw -B -ntp dependency:go-offline
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 7.2 Database setup & migrations

Flyway applies migrations V1–V11 automatically at backend startup — no manual DDL:

```bash
# Option A — Docker for the data layer only
docker compose up -d postgres redis

# Option B — native PostgreSQL 17 + Redis 7
createdb -U icglma icglma_local   # match SPRING_DATASOURCE_* / SPRING_REDIS_*
```

> [!NOTE]
> `ddl-auto=validate` fails the boot if the schema doesn't match the entities. Always migrate, never hand-edit the schema.

### 7.3 Launch the dev servers

```bash
# Terminal 1 — backend (dev profile seeds an admin + roster from data/ListeICGL.csv)
cd backend
./mvnw spring-boot:run
# Swagger UI: http://localhost:8080/swagger-ui/index.html
# Dev admin:    admin@dev.local / admin123

# Terminal 2 — frontend
cd frontend
npm run dev
# → http://localhost:3000
```

### 7.4 Run tests & linting

```bash
# Backend — full verify (unit + integration + PMD). Requires Docker for Testcontainers.
cd backend
./mvnw clean verify -B -V

# Load test (k6) — rate-limit thresholds
k6 run src/test/k6/rate-limit-test.js

# Frontend — typecheck + lint
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

### 7.5 Docker images

```bash
# Backend (tests skipped in image build — they run in CI)
docker build -t icglma-backend ./backend

# Frontend (standalone output; NEXT_PUBLIC_API_URL baked at build time)
docker build -t icglma-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 ./frontend
```

## 8. Technical Deep-Dive / Engineering Highlights

### 8.1 Distributed idempotency with response replay

`POST /api/incidents` requires `X-Idempotency-Key` because flaky factory Wi-Fi caused double-taps to create duplicate incidents. `IdempotencyAspect` (AOP, `@Around` on `@Idempotent`):

1. Atomic `SETNX idempotency:{key}` with a 30 s TTL — the lock acquisition itself is race-free.
2. Lock taken → first attempt proceeds; response body is cached under `idempotency:{key}:response`.
3. Lock already present → replay the cached JSON (`ResponseEntity` envelope rebuilt as `200 OK`, since the client only distinguishes success), or `409` while the first attempt is still in flight.
4. Failure → lock deleted so a retry with the same key succeeds.

Anti-patterns explicitly avoided: no unlimited keys (every entry has a TTL), no in-memory fallback (Redis down = request errors rather than silently skipping dedup). *This is the opposite failure mode of the rate limiter, deliberately.*

### 8.2 Fail-open vs fail-closed: one Redis, two policies

Redis outage handling is chosen per component by its security value, not uniformly:

- **JWT blacklist (fail-closed):** if Redis is unreachable, token-bearing requests are rejected. Losing a revocation check is a security boundary breach.
- **Rate limiting (fail-open):** on Redis outage, enforcement is skipped with a throttled warning. A rate limiter protects availability, so it degrades toward availability.

Both are implemented as distinct classes (`TokenBlacklistService`, `RedisRateLimitBucketProvider`) so the policies can't drift.

### 8.3 Transactional notifications (`AFTER_COMMIT` + `REQUIRES_NEW`)

Status transitions publish `IncidentTransitionEvent` inside the service transaction. `IncidentNotificationListener` consumes it with `@TransactionalEventListener(phase = AFTER_COMMIT)` and `@Transactional(REQUIRES_NEW)`. Why:

1. **Correctness** — a notification for a rolled-back save would be a ghost; `AFTER_COMMIT` guarantees the write actually happened.
2. **Lazy-loading safety** — after the original transaction closes, lazy associations are unreadable, so the listener reloads the incident in its own transaction.
3. **Decoupling** — the state machine no longer calls `NotificationService` synchronously; future listeners (WebSocket push, audit feeds) subscribe without touching the mutation path.

### 8.4 Native PostgreSQL full-text search vs `LIKE`

The original search used `LIKE '%term%'` — sequential scans, no ranking. Replaced (V11) by a generated column:

```sql
search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', reference), 'A') ||
  setweight(to_tsvector('simple', description), 'A') ||
  setweight(to_tsvector('simple', resolution_note), 'B')
) STORED
```

plus a GIN index. Queries use `websearch_to_tsquery` (user-friendly syntax: phrases, `-exclusion`, `prefix*`) ranked by `ts_rank DESC`, and compose with the structured filter predicates in one SQL statement. The `'simple'` dictionary (tokenize + lowercase, no stemming) is deliberate: it handles mixed French/Arabic content where a stemmer would mangle matches. Elasticsearch was rejected as disproportionate infrastructure for a single-table search.

## 9. API / Route Reference

Base URL: `http://localhost:8080/api`. Bearer token required unless noted. Full interactive spec at `/swagger-ui/index.html` (OpenAPI 3.0).

### Auth (public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Multi-channel login (lane auto-detected) |
| `POST` | `/auth/refresh` | — | Exchange refresh token for new access token |
| `POST` | `/auth/logout` | Bearer | Revoke access token (Redis blacklist) |
| `POST` | `/auth/claim` | — | Claim a promoted `CHEF_ATELIER` account (sets password) |
| `GET` | `/auth/check-matricule` | — | Boolean `{exists, eligibleToClaim}` — zero PII |
| `POST` | `/auth/password-reset/request-manual` | — | Identity-verified 6-char code (CHEF_ATELIER) |
| `POST` | `/auth/password-reset/request-email` | — | Email link (ADMIN), neutral 200 |
| `POST` | `/auth/password-reset/confirm` | — | Redeem token/code, set new password |

### Incidents

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/incidents` | Bearer | Filtered/paginated list (`status`, `search`, `departmentId`, `userId`, `startDate`/`endDate`, `sort`) |
| `POST` | `/incidents` | Bearer | Declare (`X-Idempotency-Key` required; roles SOUS_CHEF/CHEF_ATELIER/ADMIN) |
| `GET` | `/incidents/{id}` | Bearer | Detail |
| `GET` | `/incidents/stale` | Bearer | Active incidents > 2 h |
| `GET` | `/incidents/{id}/history` | Bearer | Audit trail of transitions |
| `PUT` | `/incidents/{id}/claim` | ADMIN | `DECLARED → CLAIMED` |
| `PUT` | `/incidents/{id}/progress` | Bearer | `CLAIMED → IN_PROGRESS` |
| `PUT` | `/incidents/{id}/evaluate` | ADMIN | `IN_PROGRESS → RESOLVED | NON_RESOLVED` (note mandatory for non-resolved) |

### Attachments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/incidents/{id}/attachments` | Bearer | Upload (multipart; `file` + optional `fileType`) |
| `GET` | `/incidents/{id}/attachments` | Bearer | Gallery listing (fresh signed read URLs) |
| `GET` | `/incidents/{id}/attachments/{attId}?token=…` | Signed token or Bearer | Stream bytes (Range/206) |
| `GET` | `/incidents/attachments/storage-status` | ADMIN | DB bytes + host disk headroom |

### Analytics & Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/analytics/volume-speed` | Bearer | Volume, MTTR, time-to-claim, deltas, ranked departments |
| `GET` | `/analytics/pareto` | Bearer | 80/20 categories + cumulative % |
| `GET` | `/analytics/heatmap` | Bearer | `[dayOfWeek, hour, count]` sparse grid |
| `GET` | `/analytics/repeat-signals` | Bearer | Recurring incidents (≥ 3 same station+category / 14 d) |
| `GET` | `/analytics/workload` | ADMIN | Team aggregates |
| `GET` | `/dashboard/statistics/by-status` | Bearer | 5-status breakdown |
| `GET` | `/dashboard/statistics/by-priority` | Bearer | 4-priority breakdown |
| `GET` | `/dashboard/statistics/by-department` | Bearer | Department totals |
| `GET` | `/dashboard/recent-activities` · `/activity` · `/admin-activity` | Bearer/ADMIN | Activity feeds |

### Users & Administration

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET`/`POST` | `/users` | ADMIN | List / create users |
| `GET`/`PUT`/`DELETE` | `/users/{id}` | ADMIN | Get / update / soft-delete |
| `GET` | `/users/matricule/{matricule}` | ADMIN | Lookup by matricule |
| `PUT` | `/users/{id}/promote` · `/demote` | ADMIN | Role changes (promote → `CHEF_ATELIER` unclaimed) |
| `PUT` | `/users/{id}/activate` · `/deactivate` | ADMIN | Account state |
| `PUT` | `/users/{id}/cancel-promotion` | ADMIN | Clear pending claim |
| `GET` | `/users/{id}/activity` · `/audit-logs` | ADMIN | Per-user stats + audit trail |
| `GET` | `/users/active-admin-count` | ADMIN | Last-admin guard |
| `POST` | `/admin/users/{id}/generate-reset-code` | ADMIN | 6-char hashed reset code (15 min TTL) |
| `GET`/`POST`/`DELETE` | `/users/{userId}/subscriptions[/{departmentId}]` | ADMIN | Department notification subscriptions |
| CRUD | `/admin/categories` `/departments` `/sections` `/production-lines` `/stations` | ADMIN | Reference data (FK-guarded `409`) |
| `GET`/`DELETE`/`POST` | `/admin/media` `/admin/media/stats` `/admin/media/{id}` `/admin/media/bulk-delete` | ADMIN | Media inventory, stats, deletion |
| `GET`/`PUT` | `/me` `/me/preferences/language` | Bearer | Current user + language preference |
| `PATCH` | `/users/me/department` | Bearer | One-shot department onboarding |
| `GET`/`PUT` | `/notifications` `/notifications/all` `/notifications/{id}/read` | Bearer | Notification stream |
| `GET` | `/reference-data/categories|departments|sections|production-lines|stations` | Bearer | Read-only reference lookups |

## 10. License & Acknowledgments

**License:** proprietary. No open-source license file is included; all rights reserved by ICGL-Maroc / FORMENS. Contact the IT department for usage terms.

**Acknowledgments:**

- Built on [Spring Boot](https://spring.io/projects/spring-boot), [Spring Security](https://spring.io/projects/spring-security), and [Spring Data JPA](https://spring.io/projects/spring-data-jpa).
- PostgreSQL full-text search features per the [official documentation](https://www.postgresql.org/docs/current/textsearch.html).
- Rate limiting via [Bucket4j](https://bucket4j.com/) with the Redis `ProxyManager`.
- Frontend UI primitives from [Radix UI](https://www.radix-ui.com/), charts from [Recharts](https://recharts.org/).
- Documentation in `docs/` — `PROJECT_STATUS.md` (feature/status matrix + 24-row reconciliation audit), `WORKFLOW.md` (role flows + API reference), `DEPLOYMENT.md` (VPS/Nginx runbook), `AGENT_SUMMARY.md` (media storage operations).
