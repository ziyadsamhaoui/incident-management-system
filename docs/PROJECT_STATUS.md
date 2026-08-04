# Project Status

## ✅ COMPLETED: Global API Integration & Purge of Mock Data

### Phase 0: Real API Bindings Across All Features
- ✅ **Total mock data purge** — removed `MOCK_INCIDENTS`, `MOCK_USERS`, `MOCK_NOTIFICATIONS`, `MOCK_DEPARTMENTS`, `MOCK_INCIDENT`, `generateMockData()` heatmap, `REF_DATA` hardcoded lists, and all fake delayed-promise submits across the frontend.
- ✅ **Service layer added** (`frontend/services/`): `incidentService`, `dashboardService`, `userService`, `referenceService`, `notificationService`, `subscriptionService`.
- ✅ **Standardized data-fetching hook** `lib/use-async.ts` (loading / error / refetch, no mock fallbacks) + shared `EmptyState`, `ErrorState` (with `[Réessayer]`), and `Skeleton` components.
- ✅ **Incidents:** list/detail/history, declare (`POST /api/incidents`), claim, evaluate — all wired to real endpoints.
- ✅ **Admin Dashboard:** real stats (`/api/dashboard/statistics/*`), charts, critical widget, aging table (`/api/incidents/stale`), activity feed (`/api/dashboard/activity`), heatmap (`/api/dashboard/admin-activity`).
- ✅ **Users Management:** real table (`GET /api/users`), create modal (`POST /api/users`), direct admin row actions — promote SOUS_CHEF (`PUT /api/users/{id}/promote`) and deactivate (`PUT /api/users/{id}/deactivate`) — department picker from `/api/reference-data/departments`.
- ✅ **Reference Data:** all 5 tabs (categories/departments/sections/production-lines/stations) read `/api/reference-data/*`; Add + Delete wired to `/api/admin/*` (409 FK guard surfaced as friendly banner).
- ✅ **Subscriptions:** real `/api/me`, subscribed list, POST/DELETE subscription toggles.
- ✅ **Notifications:** real history (`/api/notifications/all`) + mark-as-read (`PUT /api/notifications/{id}/read`).
- ✅ **Operator flows:** sous-chef & chef-atelier feeds from real incidents; declare form uses real stations/categories and real submit; onboarding department picker from real API; sidebar attention badges from real counts (ADMIN only).
- ✅ **Zero-data empty states** implemented per the standardized copy (see `docs/WORKFLOW.md` §0.4) on every data-driven component.
- ✅ **New backend endpoints:** `GET /api/incidents/{id}/history`, `GET /api/incidents/stale`, `GET /api/dashboard/activity`, `GET /api/dashboard/admin-activity`, `GET /api/me`, `PATCH /api/users/me/department`, `GET /api/reference-data/*`, `GET /api/notifications/all`.

---

## ✅ COMPLETED: ADMIN Interface & Hybrid Dashboard Refactor

### Phase 1: Bug Fixes & Structural Unification
- ✅ **1.1 Stat Card Rename:** `"En cours"` → `"En traitement"` to disambiguate from donut segment
- ✅ **1.2 Terminology Standardization:** Unified to `"Promotion Chef d'atelier"` across all components
- ✅ **1.3 User Creation Button:** `"+ Nouvel Utilisateur"` entry point on `/users`
- ✅ **1.4 Category Icon Mapping:** Distinct Lucide icons per category (`ShieldAlert`, `Wrench`, `MessageSquare`, `Zap`, `Settings`)
- ✅ **1.5 Deletion Guard:** Protective warning on referenced data deletion
- ✅ **1.6 Locked Matricule:** Badge-style locked display in `/settings`
- ✅ **1.7 Route Consolidation:** Canonical `/admin/settings` for all settings links
- ✅ **1.8 Granular Permissions:** ADMIN-editable names; CHEF_ATELIER/SOUS_CHEF locked
- ✅ **1.9 i18n Audit:** All sidebar and header strings in French
- ✅ **1.10 Branding Consolidation:** Single top header bar
- ✅ **1.11 Activity Heatmap:** GitHub-style grid on admin dashboard

### Phase 2: ADMIN Incidents Workspace
- ✅ **2.1–2.6 Full Incidents Page:**
  - Page header with List/Board view toggle (`localStorage` persisted)
  - Multi-filter bar (Search, Status, Priority, Department, Category, Scope, Sort) + active filter chips
  - List View: desktop table with left-status-border + mobile cards with inline Claim/Evaluate actions
  - Board View: 4-column Kanban with HTML5 drag-and-drop state machine
  - Component states: loading skeletons, system zero, filtered empty, pagination
  - Incident Detail Page: audit timeline, triage controls
  - Shared Evaluation Modal (portal-based, responsive full-bleed)

### Next Milestones
- Connect dashboard stats to real backend API
- Implement actual user creation modal via `POST /api/users`
- Replace mock data with real API calls (`GET /api/incidents`, `GET /api/admin-activity`)
- Add real notification system for subscription alerts
- Implement `useTranslation()` hook integration for Arabic (`AR`) locale support

---

## ✅ COMPLETED: Authentication Hardening (Password-Reset Security)

### Phase 3: Supervisor-Mediated Reset-Code State Machine
- ✅ **Public endpoint hardened** (`POST /api/auth/password-reset/request-manual`): payload now strictly `{ matricule, firstName, lastName }`; exact case-insensitive identity bar against active claimed `CHEF_ATELIER` accounts; generic `400 "Identifiants invalides"` on any mismatch (no enumeration); dedicated rate limit **3 attempts / 15 min / IP**.
- ✅ **Admin-mediated code generation** (`POST /api/admin/users/{id}/generate-reset-code`, ADMIN-only): secure 6-char code, persisted **only as a SHA-256 hash** on `users.claim_code_hash` with a strict 15-min TTL (`claim_code_expires_at`); single active code per user; plaintext returned once for in-person handoff.
- ✅ **Audit trail**: new `audit_logs` table records `GENERATE_RESET_CODE` with `actor_user_id` (performed-by admin) and `target_user_id` (migration `V5__password_reset_hardening.sql`).
- ✅ **Unified confirmation**: `POST /api/auth/password-reset/confirm` now redeems supervisor-mediated claim codes (normalized, hash-matched, single-use, consumed on success) and keeps the legacy Track A/B token flow.
- ✅ **Admin UI**: "Générer un code de réinitialisation" CTA + modal on `/admin/users/[id]` (claimed + active `CHEF_ATELIER` only) with copyable code badge, expiry timestamp, loading/error states, and the mandatory warning "Ce code expire dans 15 minutes. Communiquez-le directement à l'agent."
- ✅ **Tests**: `AuthServiceTest` (identity bar, hash+TTL+audit persistence, claim-code redemption, legacy path), `RateLimitingServiceTest` (3/15-min rule), `AdminControllerWebTest` (ADMIN-only RBAC + endpoint).

### Deferred (downstream)
- Employee-facing redemption page where the agent enters matricule + 6-char code + new password (existing `confirm` endpoint already accepts the code).

---

## ✅ COMPLETED: Public Password-Reset Screens (Track A / B / C)

### Phase 4: Self-Service & Email Reset UX + Password Policy
- ✅ **Route architecture** — `/auth/reset-password/chef-atelier` (Track A), `/auth/reset-password/admin` (Track B), `/auth/reset-password/confirm` (Track C); "Mot de passe oublié ?" links wired on the CHEF_ATELIER lane and the ADMIN login (hidden on the passwordless SOUS_CHEF lane).
- ✅ **Track A (CHEF_ATELIER):** identity bar (`matricule`/`firstName`/`lastName`), generic `"Identifiants invalides"` on any mismatch (no enumeration), 6-char code in large mono typography with a **live 15-minute countdown**, "Continuer" CTA pre-filling the confirm screen (`?code=&matricule=`), helper copy for admin handoff.
- ✅ **Track B (ADMIN email):** neutral-response protection — the backend always returns the same non-committal 200 notice and the UI renders it unconditionally (no email-existence leak, not even via error states); the 10-min UUID deep link is delivered by **real email** (`EmailService` → Spring Mail → Gmail SMTP, `MAIL_USERNAME` / `MAIL_PASSWORD` env vars, Gmail App Password), the token is never present in the HTTP response, and SMTP failures are swallowed with the link logged server-side for operator recovery.
- ✅ **Track C (confirm):** pre-filled editable token, **STRICT 8-char minimum** (`@Size(min=8)` on `PasswordResetConfirmRequest` + `ClaimAccountRequest`, mirrored in `resetPasswordSchema`/`claimSchema`), live length+match feedback with disabled submit, **NO auto-login** — redirect to the correct lane with the identifier pre-filled, expired-token copy with links back to both request screens, lockout state cleared on reset.
- ✅ **Admin-assisted flow:** "Générer un code de réinitialisation" moved under a **Zone de danger** heading on `/admin/users/[id]`; modal now shows a live 15-minute countdown + expired state + regenerate action; **Piste d'audit** card renders `GENERATE_RESET_CODE` entries as "Code de réinitialisation généré par [admin] le [date]" via the new `GET /api/users/{id}/audit-logs` endpoint.
- ✅ **Security rules:** request endpoints are reachable while locked (escape hatch — reset clears `failedLoginAttempts`/`lockoutEnd`); 5 req/min/IP on `/api/auth/**` with visual `Retry-After` countdowns; all reset screens fully i18n'd (FR/AR).
- ✅ **Tests:** `AuthServiceTest` (email neutrality + stub token, confirm returns role/login identifier, lockout cleared), `AuthControllerAuthTest` (neutral 200 + no-token-leak for unknown email, confirm payload), `UserServiceImplTest` (audit-log endpoint with actor resolution).

---

## ✅ COMPLETED: Removal of the CLOSED Status (Terminal RESOLVED / NON_RESOLVED)

### Phase 5: State-Machine Simplification
- ✅ **Enum & transitions:** `CLOSED` removed from `IncidentStatus` (Java + TypeScript). `VALID_TRANSITIONS` now treats `RESOLVED` and `NON_RESOLVED` as terminal states with empty transition sets; same-state transitions remain idempotent.
- ✅ **Auto-closure removed:** `IncidentAutoClosureJob` and its test deleted; `@EnableScheduling` removed from the application class (no scheduled tasks remain); `IncidentRepository.findByStatusAndResolvedAtBefore` (the 10-minute sweep query) deleted.
- ✅ **Notification matrix cleaned:** `IncidentRecipientResolver` no longer dispatches any `→ CLOSED` rule; the auto-close actor-null branch and the "system-driven" notification path are gone. `IN_PROGRESS` stays silent; `RESOLVED`/`NON_RESOLVED` notify the department CHEF_ATELIER.
- ✅ **Analytics merge:** `UserActivityResponse.closedCount` renamed to `terminalCount` and computed as `countByUserAndStatusIn(user, [RESOLVED, NON_RESOLVED])` (declared incidents that reached a terminal state); the `/admin/users/[id]` "Clôturés" mini-stat became "Terminés". `DashboardController.getIncidentsGroupedByStatus` now returns only the 5 live statuses.
- ✅ **UI:** status filter dropdowns, kanban columns, status badge/dot maps, the dashboard donut (CLOSED segment dropped), the "Clôturés" stat card (→ "Non résolus"), the incident stepper (CLOSED step removed) and the chef-atelier "Closed Incidents" card (→ "Terminés") all purged of `CLOSED`. The "Clôture automatique ~10 min" hints were removed from the incident detail stepper.
- ✅ **Migration `V6__migrate_closed_incidents.sql`:** idempotent, non-destructive backfill — restores each `CLOSED` incident's `status` from its last `incident_history` predecessor (`RESOLVED` or `NON_RESOLVED`, ordered by `changed_at`), with an explicit `RESOLVED` fallback for history-less rows; normalizes `incident_history` so no `CLOSED` survives in `previous_status`/`current_status` (audit comments preserved). No `UPDATE incidents SET status='RESOLVED' WHERE status='CLOSED'` blunt overwrite.
- ✅ **Tests:** `IncidentServiceImplTest` terminal-state matrix (RESOLVED/NON_RESOLVED reject all outbound transitions), `IncidentRepositoryTest` analytics buckets, `UserServiceImplTest` `terminalCount` assertions, `IncidentAutoClosureJobTest` deleted.

---

## ✅ COMPLETED: Logs Page & Terminal Incidents Architecture

### Phase 6: Actifs / Logs Tabs + Terminal Archive
- ✅ **Backend — extended `GET /api/incidents`** (no new parallel endpoints): JPA `Specification`-driven combined filtering — multi-status group (`status=DECLARED,CLAIMED,IN_PROGRESS` for Actifs or `status=RESOLVED,NON_RESOLVED` for Logs), case-insensitive `search` over `reference` + `description` + **`resolutionNote`** (Logs search), `departmentId`/`userId` scoping, and inclusive `startDate`/`endDate` bounds on a `dateField` column (`declaredAt` default / `resolvedAt` for Logs). Spring `page`/`size`/`sort` pass through; the dead `getAllIncidents`/`getIncidentsByUser`/`getIncidentsByDepartment` methods were removed.
- ✅ **Bounded Logs queries:** the Logs tab always sends a default 30-day `resolvedAt` window; users widen it explicitly via the date-range pickers. No unbounded historical scans.
- ✅ **Database indexes (`V7__terminal_incidents_indexes.sql`):** `idx_incidents_dept_status_resolved` on `(department_id, status, resolved_at DESC)` for the CHEF_ATELIER pattern and `idx_incidents_status_resolved` on `(status, resolved_at DESC)` for the ADMIN pattern (both `CREATE INDEX IF NOT EXISTS`, idempotent). The **media/attachment cleanup threshold** is documented as the terminal-status constant `status IN ('RESOLVED','NON_RESOLVED') AND resolved_at < NOW() - INTERVAL 'N days'` — implemented since Phase 8 by `MediaRetentionJob` using an `uploaded_at` cutoff of `app.media.retention-days` (default 90; see the `V7` header comment).
- ✅ **Frontend — sidebar navigation:** Logs moved out of tabs into the **sidebar** — `Logs` entry (`/admin/incidents/logs`) for ADMIN and a `Logs` header button (`/chef-atelier/logs`) for CHEF_ATELIER; the Actifs page (`/admin/incidents`, `/chef-atelier`) no longer hosts tabs and the `IncidentTabs` component was removed. The sidebar `Incidents` item uses exact pathname matching so the Logs child route highlights independently. SOUS_CHEF keeps its single unified "Mes Incidents" list.
- ✅ **Resolved only:** the Logs pages send `status=RESOLVED` (**only** resolved incidents — no `NON_RESOLVED`, no outcome control) with `dateField=resolvedAt` and `sort=resolvedAt,desc`.
- ✅ **No implicit date window (fix):** resolved incidents are no longer hidden behind a default 30-day `startDate` — date bounds are sent only when explicitly picked, so previously "missing" resolved incidents now show.
- ✅ **View-mode restriction:** the Liste/Tableau toggle and Kanban board are Actifs-only (terminal states are list-only); the Actifs kanban hosts the 3 active columns (`Déclaré`, `Pris en charge`, `En cours`).
- ✅ **Logs UI (`TerminalIncidentsView` + `LogsFilterBar`):** filter UX mirrors the Incidents page (search + filter-dialog button below `lg`, inline filter row on `lg+` — ADMIN-only Département select, Catégorie/Priorité multi-selects, resolvedAt date range), desktop table (Reference / **Catégorie** / Département / `Résolu` badge / Résolu par / relative Date / truncated Note), green-spine cards with the "Résolu par [nom]" accountability subtitle, **read-only rows** (row click → read-only detail view / drawer; no mutation controls on terminal states), and distinct empty states ("Aucun incident archivé" vs "Aucun résultat pour ces filtres" + "Réinitialiser les filtres").
- ✅ **Export dropdown (PDF / Excel / CSV):** "Exporter" menu on the Logs view downloads the filtered resolved set as `incidents-logs-<date>.csv` (`lib/csv.ts`, UTF-8 BOM + `;`), `.xlsx` (SheetJS) or `.pdf` (jsPDF + autotable) via the shared `lib/export.ts`.
- ✅ **Responsive:** on the incidents pages the desktop table + kanban now render at **`lg+`** only — small **and medium** displays (phones, iPad mini…) use the card layout.
- ✅ **i18n (FR/AR):** all Logs UI copy routed through `useTranslation()` (`lib/i18n.ts`); unused outcome/tab keys removed.
- ✅ **Tests:** `IncidentControllerWebTest` extended for the new `getFilteredIncidents` signature — multi-status parsing (Actifs group / Logs group), `search`, `startDate`/`endDate` + `dateField=resolvedAt` verification.

---

## ✅ COMPLETED: Dashboard Fixes & Non-Large-Display Polish

### Phase 7: Heatmap Fix, Critical Counter & `lg` Shell Alignment
- ✅ **Heatmap 500 fixed (root cause):** `IncidentHistory` now maps `previous_status`/`current_status` with `@Enumerated(EnumType.STRING)` (columns are `VARCHAR(20)`); `V8__normalize_incident_history_status_values.sql` backfills legacy ordinal-as-string values (`'0'`–`'4'`) to enum names — the derived query `findByCurrentStatusInAndChangedAtAfter` no longer compares integers against a string column (`GET /api/dashboard/admin-activity` returns 200). `FlywayMigrationTest` updated to the 8-migration baseline.
- ✅ **Critiques stat card** excludes terminal incidents: it counts `CRITICAL` incidents still `DECLARED`/`CLAIMED`/`IN_PROGRESS` (resolved/non-resolved criticals no longer inflate the counter).
- ✅ **Logs data completeness:** legacy resolved rows in the dev DB that were missing `resolved_at` / `resolution_note` were backfilled (the evaluate flow already persisted both).
- ✅ **Logs page filters** now match the Incidents page exactly (search + filter dialog below `lg`, inline row on `lg+`); the export became a **PDF / Excel / CSV dropdown**; the "Type / Catégorie" column became **"Catégorie"** (icons dropped).
- ✅ **Header actions on the very left below `lg`:** users page "Nouvel Utilisateur" and incidents page view-mode + "Déclarer" buttons render top-left on non-large displays and move right at `lg+`.
- ✅ **Notifications on non-large displays:** the header bell is hidden below `lg`; a **Notifs** tab on the mobile bottom bar opens a notifications bottom sheet (shared panel with the header dropdown). The bottom tab bar now shows below `lg` (previously `md`), and the sidebar/header breakpoints were aligned to the same `lg` split so tablets get the small-display shell.
- ✅ **Tests:** frontend `tsc --noEmit` + `next lint` clean; backend suite incl. `FlywayMigrationTest` (8 migrations) green.

---

## ✅ COMPLETED: Self-Hosted Local Media Pipeline (Replaces S3/R2)

### Phase 8 (RESUMED + FINALIZED after session crash): Photos / Video / Voice Clips on Local Disk
- ⚠️ **Recovery note:** the previous session crashed mid-pivot from the R2 presigned pipeline to self-hosted local storage. The backend already contained both an S3 layer (`StorageConfig`, `S3StorageService`, `StorageService`, `StorageProperties`, presigned DTOs) and a half-wired local layer, while the frontend still spoke the old presigned protocol and the attachment unit test still mocked the deleted `StorageService`. All seams were reconciled in this pass.
- ✅ **S3/R2 fully removed:** AWS SDK v2 deps (`software.amazon.awssdk:s3`, `url-connection-client`) stripped from `pom.xml`; `StorageConfig`/`S3StorageService`/`StorageService`/`StorageProperties`/`StorageNotConfiguredException` + the presigned DTOs (`AttachmentUploadRequest/Response`, `AttachmentConfirmRequest`) deleted; `storage.*` properties replaced by `app.media.*`.
- ✅ **Backend:** `LocalFileStorageService` — streams multipart to disk via **`MultipartFile.transferTo(Path)`** (never `getBytes()`), server-generated `{incidentId}/{uuid}.{ext}` layout, normalized path-traversal guards, `Files.getFileStore().getUsableSpace()` headroom metrics. `IncidentAttachmentService` + `IncidentAttachmentController`: single `POST /api/incidents/{id}/attachments` (multipart, 201), gallery listing, `GET /api/incidents/attachments/storage-status` (DB `SUM(file_size_bytes)` + host disk — URL prefix bug fixed), terminal-state lock, 5/incident + per-type size/MIME limits, role scoping, 16-byte magic-byte sniff with delete-on-mismatch. `MediaRetentionJob` (`@Scheduled` 03:15) purges terminal-incident media older than `app.media.retention-days` (90) via `Files.deleteIfExists()`.
- ✅ **Authenticated serving & Range:** `GET /api/incidents/{id}/attachments/{attId}` via `ResourceHttpRequestHandler` + `MediaFileResourceResolver` — `Accept-Ranges: bytes` / 206 for video seeking; authorization inside the resolver (HMAC signed read token for `<img>/<video>` tags, or JWT session with department/ownership scoping). `SecurityConfig` permits only that GET path at the security layer (unreachable without a valid token/session).
- ✅ **Config:** `app.media.storage-path=/data/incident-media` (outside deploy dir — `MEDIA_STORAGE_PATH` env), `retention-days`, `signing-secret`, `read-token-ttl-minutes`; `spring.servlet.multipart.max-file-size=30MB` / `max-request-size=35MB` / dedicated `location` temp dir. `compose.yaml` declares the `media-data` named volume for `/data/incident-media`.
- ✅ **Client:** single multipart `uploadAttachment` (axios `onUploadProgress`) replaces the presigned `upload-url`→PUT→`confirm` steps; `browser-image-compression` (≤ 1280 px, JPEG ~75 %), MediaRecorder caps (video ≤ 30 s @ 720p, audio ≤ 60 s), gallery + progress UI unchanged.
- ✅ **Tests:** `IncidentAttachmentServiceTest` rewritten for the local pipeline (terminal lock, count/size/MIME limits, magic-byte mismatch + file deletion, storage-unavailable 503, role access matrix, signed read URLs, retention purge, storage-status metrics); new `IncidentAttachmentControllerWebTest` (multipart 201, type inference, terminal 409, list, storage-status). Frontend `tsc --noEmit` + `next lint`; backend compile + targeted tests green.
- ✅ **Docs:** `README.md` + `docs/WORKFLOW.md` §5 rewritten for local storage — host mount requirements (Docker named volume / native systemd `chown`), the `X-Accel-Redirect` Nginx sample for zero-copy production serving, and the explicit **disk-redundancy acknowledgment** (no multi-region replication; host-level nightly snapshots / `rsync` required).
