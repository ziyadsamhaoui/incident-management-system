# Implementation Workflow — API Integration & Data-Driven UI

## Section 0: Global API Integration & Mock Data Purge

### 0.1 Architectural Directive
- **No mock arrays, no hardcoded fallback objects, no fake delayed promises.**
- Every data-driven component fetches from a real backend REST endpoint via the central Axios client (`lib/api-client.ts`) + service modules (`services/*.ts`).
- If an API returns `[]` or `null`, the UI renders a dedicated, actionable **empty state**.

### 0.2 Data Fetching Pattern (`lib/use-async.ts`)
- Standardized hook: `useAsync(fetcher, deps)` → `{ data, loading, error, refetch, setData }`.
- Re-runs the fetcher when `deps` change or on `refetch()`; never returns mock fallbacks.
- `extractErrorMessage(err)` surfaces `response.data.message` (backend `ErrorResponse`) with a French fallback.

### 0.3 Standardized Component States
- **Loading:** skeleton loaders matching target dimensions — `components/ui/skeleton.tsx` + per-view skeletons (table rows, feed cards, chart blocks). No layout shift.
- **Error:** inline red banner `components/ui/error-state.tsx` with explicit `[Réessayer]` retry button (rendered on 500 / network drop / 404).
- **Empty:** `components/ui/empty-state.tsx` — muted Lucide icon circle + friendly copy + actionable CTA whenever the current role can create/configure the resource.

### 0.4 Standardized Empty-State Copy (per endpoint)
- **Departments:** `"Aucun département disponible."` + `[+ Créer un département]`
- **Categories:** `"Aucune catégorie configurée."` + `[+ Ajouter une catégorie]`
- **Stations / Sections / Lines:** `"Aucune station / section / ligne de production enregistrée."` + `[+ Ajouter]`
- **Incidents (operator/admin):** system zero `"Aucun incident en cours dans le système."` + `[Déclarer un incident]`; filtered zero `"Aucun résultat ne correspond à vos filtres actuels."` + `[Effacer les filtres]`
- **Users:** `"Aucun utilisateur enregistré."` + `[+ Nouvel utilisateur]`
- **Critical-Now widget:** `"Aucun incident critique en cours."`
- **Aging Incidents table:** `"Aucun incident en retard."`
- **Activity Log feed:** `"Aucune activité récente à afficher."`
- **Admin Heatmap:** `"Aucune évaluation enregistrée sur cette période."`

### 0.5 Service Layer (`frontend/services/`)
- `incidentService.ts` — `getIncidents` (extended params: comma-joined `statuses`, `search`, `departmentId`, `userId`, `startDate`/`endDate` + `dateField`, `sort`), `getIncidentById`, `getIncidentHistory`, `getIncidentDetail`, `getStaleIncidents`, `createIncident`, `claimIncident`, `progressIncident`, `evaluateIncident` (+ raw→DTO mapper).
- `dashboardService.ts` — `getDashboardStats`, `getActivityLog`, `getRecentActivities`, `getAdminActivity`.
- `userService.ts` — `getMe`, `getUsers`, `createUser`, `promoteUser`, `deactivateUser`, `setMyDepartment`.
- `referenceService.ts` — read `getCategories/Departments/Sections/ProductionLines/Stations` + admin writes.
- `notificationService.ts` — `getNotifications`, `getAllNotifications`, `markNotificationAsRead`.
- `subscriptionService.ts` — `getSubscribedDepartments`, `subscribeToDepartment`, `unsubscribeFromDepartment`.

### 0.6 New Backend Endpoints (added for this integration)
- `GET /api/incidents/{id}/history` — chronological audit trail (`IncidentHistoryResponse`).
- `GET /api/incidents/stale` — aging incidents (CLAIMED/IN_PROGRESS > 2h).
- `GET /api/dashboard/activity` — audit activity log.
- `GET /api/dashboard/admin-activity` — evaluation heatmap counts.
- `GET /api/me` + `PATCH /api/users/me/department` — current user session context + one-shot onboarding.
- `GET /api/reference-data/{categories|departments|sections|production-lines|stations}` — any authenticated role.
- `GET /api/notifications/all` — full notification history (read + unread).
- `GET /api/incidents` — extended query params: comma-joined multi-`status` group (Actifs: `DECLARED,CLAIMED,IN_PROGRESS` / Logs: `RESOLVED,NON_RESOLVED`), `search` (case-insensitive over `reference`/`description`/**`resolutionNote`**), `departmentId`, `userId`, inclusive `startDate`/`endDate` bounds on a `dateField` column (`declaredAt` default, `resolvedAt` for Logs), plus Spring `page`/`size`/`sort`.

### 0.7 Mutation Conventions
- Mutations call the real API then `refetch()` the affected query (no optimistic-in-place hacks).
- Reference-data deletion guards: backend returns 409 `DataIntegrityViolationException` handler → friendly French banner.

---

# ADMIN Interface — Implementation Workflow

## Section 1: Bug Fixes & Structural Unification

### 1.1 Stat Card Rename
- Top-level stat card renamed from `"En cours"` → **"En traitement"** to disambiguate from the donut chart segment `"En cours"` (which represents `IN_PROGRESS` alone).
- The top card represents `CLAIMED` + `IN_PROGRESS` combined.

### 1.2 Terminology Standardization
- All UI references standardized to **"Promotion Chef d'atelier"** (unified from mixed `"Activation"` / `"Promotion"` usage).
- Promotion is a **direct admin action** on the `/users` table (no request/approval workflow — SOUS_CHEF has no promotion-request mechanism).

### 1.3 User Creation Entry Point
- `/users` page: primary button `"+ Nouvel Utilisateur"` with `UserPlus` icon in the header.
- Opens a future modal/drawer for creating `ADMIN`, `CHEF_ATELIER`, or `SOUS_CHEF` accounts.

### 1.4 Category Icon Mapping
- **Catégories** in Reference Data (`/admin/reference`) auto-mapped to distinct Lucide icons:
  - `Sécurité` → `ShieldAlert`
  - `Accident` → `Wrench`
  - `Réclamation` → `MessageSquare`
  - `Mécanique` → `Zap`
  - `Électrique` → `Settings`
- Powered by `CATEGORY_ICONS` map + `getCategoryIcon()` resolver in `reference/page.tsx`.

### 1.5 CRUD Deletion Safety Guard
- Delete button (`Trash2`) on Reference Data rows triggers protection check.
- If the category/department has linked incidents, an `AlertTriangle` warning displays: `"Impossible de supprimer : « X » est lié à Y incident(s). Supprimez d'abord les incidents associés."`
- Warning auto-dismisses after 4 seconds.

### 1.6 Locked Matricule Field
- Settings page renders `Matricule` as a locked badge (`border-slate-300 bg-slate-100 font-mono` with `Shield` icon).
- Visual parity with `Rôle` pill styling — never editable.

### 1.7 Route Consolidation
- Dropdown `"Profil / Paramètres"` in Header links to `/admin/settings` (canonical route).
- Sidebar `"Paramètres"` also links to `/admin/settings`. No duplicate shells.

### 1.8 Granular Name Permissions
- **ADMIN role:** `firstName`/`lastName` fields render as editable `<input>` elements in Settings.
- **CHEF_ATELIER & SOUS_CHEF roles:** Same fields render as locked `<div>` elements with `bg-muted/30`.

### 1.9 i18n Audit
- Hardcoded English strings replaced with French in `Sidebar.tsx` and `Header.tsx`.
- Breadcrumbs, sidebar labels, search placeholders all use French.

### 1.10 Branding Consolidation
- Sidebar brand text: `"ICGLMA"` only (removed "IMS").
- Header brand: `IC` logo badge + `ICGLMA` wordmark + breadcrumb. Single top header anchor.

### 1.11 Activity Contribution Heatmap (Admin Dashboard)
- **Component:** `components/dashboard/activity-heatmap.tsx`
- GitHub-style contribution grid tracking `evaluateIncident()` actions over 12 months.
- 52-week grid with 5 intensity levels (`bg-green-200` through `bg-green-800`).
- Legend, total action count, month/day labels.
- **Real data:** feeds from `GET /api/dashboard/admin-activity` (evaluations per calendar day over the last 12 months).
- **NOT built** for SOUS_CHEF or CHEF_ATELIER dashboards (prevents gamification hazards).

### 1.12 Critical Counter & Heatmap Fixes (Dashboard)
- **Critiques stat card** counts **open** critical incidents only — `RESOLVED` / `NON_RESOLVED` (terminal) criticals are excluded from the counter (falls back to the by-priority stat while the incidents list loads). The "critical-now" hero widget already used the same predicate.
- **Heatmap 500 fix (`V8__normalize_incident_history_status_values.sql`):** `incident_history.previous_status/current_status` are `VARCHAR(20)` columns but the entity lacked `@Enumerated(EnumType.STRING)`, so JPA's default ORDINAL strategy wrote numbers (`'0'-'4'`) into them. The derived query `findByCurrentStatusInAndChangedAtAfter` then bound *integers* against the string column → Postgres `operator does not exist: character varying = integer` → HTTP 500 on the heatmap. Fix: the entity now maps both columns as `@Enumerated(EnumType.STRING)` and the migration backfills legacy ordinal values to their enum names (`'RESOLVED'`, `'NON_RESOLVED'`, …); the audit activity feed (`/api/dashboard/activity`) also benefits (proper status names).

## Section 2: ADMIN Incidents Workspace (`/admin/incidents/`)

### 2.1 Page Header & View Toggle
- Title: `"Incidents"` + subtitle: `"Vue globale, tous départements"`.
- **Actifs page only** — resolved (terminal) incidents live on the dedicated **Logs page**, reachable from the sidebar `Logs` entry (`/admin/incidents/logs`). The Actifs page sends the `status=DECLARED,CLAIMED,IN_PROGRESS` group to the API.
- **Liste / Tableau view toggle** (`LayoutList` / `Columns3`, persisted in `localStorage` key `admin_incidents_view_mode`). The kanban board hosts the 3 active columns only — Kanban is strictly forbidden for terminal states (see §2.7).
- Secondary `"+ Déclarer"` button.

### 2.2 Multi-Filter Bar & Active Chips
**Controls (persistent, single-row toolbar):**
- **Search:** text input (reference code, description, reporter name/matricule).
- **Status:** multi-select dropdown restricted to the Actifs group (`Déclaré`, `Pris en charge`, `En cours`) — terminal statuses are managed via the Logs outcome segmented control (§2.7).
- **Priority:** multi-select dropdown (`Faible`, `Moyenne`, `Élevée`, `Critique`).
- **Department:** multi-select dropdown (unscoped across all departments).
- **Category:** multi-select dropdown.
- **Scope Toggle:** `"Mes incidents"` / `"Tous"` with `UserCheck` icon.
- **Sort:** dropdown (`Plus récents`, `Plus anciens`, `Priorité`, `Temps en statut`).

**Active Filter Chips:**
- Rendered below filter bar with `"×"` individual remove buttons.
- `"Effacer tout"` link to reset all filters.

### 2.3 List View
**Desktop Table:**
- Columns: `Référence` | `Catégorie` (icon+text) | `Département` | `Priorité` | `Statut` | `Déclaré par` | `Temps` | `Actions`.
- Left-edge status border (`boxShadow: inset 3px 0 0 0 ${barColor}`).

**Mobile Cards:**
- Left-border status color, category icon, priority badge, status dot+label, reporter matricule.
- Inline actions for `DECLARED` (Claim) and `IN_PROGRESS` (Evaluate).

**Inline Row Actions:**
- **Claim** (`status === DECLARED`): 1-click inline trigger — no detour to detail page.
- **Evaluate** (`status === IN_PROGRESS`): Opens Evaluate modal with outcome radio + mandatory note.
- **View:** Direct link to `/admin/incidents/[id]`.

### 2.4 Board View (Kanban — Actifs only)
- **Columns:** `Déclaré` → `Pris en charge` → `En cours` (3 active columns — terminal states never appear on the board; they are archived in the Logs tab).
- **Breakpoint:** Available on desktop/tablet (≥768px). Hidden on mobile.

**Drag-and-Drop State Machine:**
- `Déclaré` → `Pris en charge`: Drop executes immediate **Claim** action.
- `Pris en charge` → `En cours`: Drop is **BLOCKED** (this transition is system-driven via `progressIncident()`).
- `En cours` → `Résolu / Non résolu`: Drop opens the **Evaluate Modal** pre-filled with the target column outcome.
- Other transitions: no specific action (neutral drop).

### 2.5 Component States
- **Filtered Empty:** `"Aucun résultat pour ces filtres"` with `"Effacer les filtres"` button.
- **System Zero:** `"Aucun incident dans le système"` with friendly copy.
- **Loading:** 5-row skeleton animation with pulsing `bg-muted` bars.
- **Pagination:** 10 items per page, Previous/Next buttons, page counter, item count display.

### 2.6 Incident Detail Page (`/admin/incidents/[id]`)
- **Header & Meta:** Reference ID, Priority badge, Category, Department/Station, Status.
- **Description Card:** Full incident description.
- **Reporter & Assignee Cards:** Name, matricule, timestamp with formatting.
- **Resolution Card:** Conditionally rendered for the terminal states `RESOLVED`/`NON_RESOLVED`.
- **Full Timeline:** Reverse-chronological `IncidentHistory` audit entries with TimelineIcon, actor names, timestamps, and optional notes.
- **Triage Actions:** `"Prendre en charge"` button (DECLARED), `"Évaluer"` button (IN_PROGRESS).
- **Terminal States:** `RESOLVED` and `NON_RESOLVED` are the terminal states of the incident state machine. There is **no auto-close** — the `CLOSED` status and its 10-minute scheduler were removed (see `V6__migrate_closed_incidents.sql` for the historical backfill).

**Shared Evaluation Modal:** Reuses `components/incidents/evaluation-modal.tsx` (portal-based, centered on large, full-bleed on mobile).

### 2.7 Logs Page — Resolved Incidents Archive (Sidebar)
- **Navigation:** the Logs archive is a dedicated page reached from the sidebar — `Logs` (`/admin/incidents/logs`, ADMIN) and a `Logs` header button on the chef-atelier page (`/chef-atelier/logs`, CHEF_ATELIER). The Actifs page no longer hosts tabs. The sidebar `Incidents` entry uses exact pathname matching so the `Logs` child route highlights independently.
- **Resolved only:** the Logs pages send `status=RESOLVED` (resolved incidents **only** — no `NON_RESOLVED`, no outcome filter) plus `dateField=resolvedAt` and `sort=resolvedAt,desc` on the same `GET /api/incidents` endpoint (no parallel route).
- **No implicit date window:** resolved incidents are **not** hidden behind a default window — `startDate`/`endDate` are sent only when the user explicitly picks them (this fixes resolved incidents silently disappearing). `page`/`size` are honored by the API for scale-out.
- **Logs filter row (`components/incidents/logs-filter-bar.tsx`):** mirrors the Incidents page filter UX — on small & medium displays (`< lg`) a search input plus a filter-dialog button (badge with active count) opens a chip-based dialog (Département ADMIN-only, Catégorie, Priorité, resolvedAt date range); on `lg+` the full inline row renders (Département select ADMIN-only — sent as `departmentId`; CHEF_ATELIER stays server-side department-scoped — Catégorie + Priorité multi-selects, resolvedAt date range, `Réinitialiser` ghost button).
- **Desktop table (lg+):** Reference | Catégorie | Département (ADMIN only) | Outcome badge (green `Résolu`) | Résolu par | Date de résolution (relative) | Note de résolution (single-line truncated).
- **Mobile/medium cards (below lg):** green left spine, line 1 = reference + category badge + relative resolved time, line 2 = `Résolu` badge + "Résolu par [nom]" accountability subtitle, line 3 = truncated resolution-note excerpt.
- **Read-only rows:** no Claim/Evaluate/Reopen actions anywhere — the entire row deep-links to the read-only detail view (`/admin/incidents/[id]`, or the drawer for CHEF_ATELIER), which renders no mutation controls for terminal states.
- **Export dropdown (PDF / Excel / CSV):** "Exporter" opens a menu — CSV (`lib/csv.ts`, UTF-8 BOM + `;` separator), Excel `.xlsx` (SheetJS `xlsx`) and PDF (jsPDF + `jspdf-autotable`) all download the filtered resolved set as `incidents-logs-<date>.<ext>`, respecting the active department/category/date filters (shared `lib/export.ts`).
- **Empty states:** system zero → "Aucun incident archivé"; filter mismatch → "Aucun résultat pour ces filtres" + "Réinitialiser les filtres" CTA.
- **i18n:** every string in the Logs UI goes through `useTranslation()` (FR/AR in `lib/i18n.ts`) — no hardcoded copy.
- **Pagination:** client-side within the bounded fetch (10/page), "Affichage de X à Y sur Z" + Précédent/Suivant.
- **Responsive breakpoints (`lg` shell):** on the incidents pages the desktop table + kanban render at **`lg+`** only; small **and medium** displays (phones, iPad mini…) use the card layout. The whole navigation shell follows the same `lg` split: the sidebar collapses and the bottom tab bar (Dashboard / Incidents / Users / Notifs / Plus) appears below `lg`; the header hides the notification bell below `lg` (the bottom-bar **Notifs** tab opens a notifications bottom sheet), and page-header actions (users "Nouvel Utilisateur", incidents view-mode + "Déclarer") sit on the very left below `lg` and move right on `lg+`.

## Routes Covered
- `/admin/incidents/` — Unscoped incident management
- `/admin/incidents/[id]` — Incident detail with timeline
- All routes maintain shared card visual language across admin screens.

---

# Authentication Hardening — Password-Reset Security

## Section 3: Supervisor-Mediated Reset-Code State Machine

### 3.1 Security Context
- **Remediated flaw:** `POST /api/auth/password-reset/request-manual` previously issued a 6-character reset code from a public `{ matricule }` payload only. Since matricules are printed on employee badges and `SOUS_CHEF` accounts are passwordless, an attacker could trivially target `CHEF_ATELIER` accounts.
- **Principle:** a password-reset code is NEVER issued from a single public field, NEVER stored/returned without an explicit 15-minute TTL, and NEVER generated by an unauthenticated admin endpoint.

### 3.2 Public Self-Service Endpoint — Identity Bar (`POST /api/auth/password-reset/request-manual`)
- **Payload:** strictly `{ matricule, firstName, lastName }` (`PasswordResetRequest` validates all three with `@NotBlank` / `@Min`).
- **Validation:** exact, case-insensitive, trimmed match of all three fields against an **active, claimed `CHEF_ATELIER`** record. Any mismatch (unknown matricule, wrong names, wrong role, unclaimed or inactive account) returns the generic `400 "Identifiants invalides"` — no identity enumeration.
- **Rate limiting:** dedicated rule `PASSWORD_RESET_MANUAL` — **3 attempts per IP per 15-minute window** (checked before the catch-all `AUTH` rule in `RateLimitingService.resolveRule`).

### 3.3 Supervisor-Mediated Path (`POST /api/admin/users/{id}/generate-reset-code`)
- **Authorization:** `ADMIN` only — class-level `@PreAuthorize("hasRole('ADMIN')")` on `AdminController` + explicit method-level guard.
- **Eligibility:** target must be `CHEF_ATELIER` or `SOUS_CHEF` and active; `ADMIN` targets are rejected.
- **Issuance:** secure 6-character alphanumeric code (unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `SecureRandom`).
- **Persistence:** only the **SHA-256 hash** of the code is stored on `users.claim_code_hash` with a strict TTL on `users.claim_code_expires_at` (15 minutes). The plaintext is returned exactly once in the response body for in-person handoff.
- **Single active code:** generating a new code invalidates any previously issued one for that user.
- **Audit:** every issuance writes a `GENERATE_RESET_CODE` row to the new `audit_logs` table (`actor_user_id` = the acting admin, `target_user_id` = the employee).
- **Security trade-off (documented):** the persisted hash is unsalted SHA-256 of a 6-character code (~30 bits of entropy). This is acceptable because generation is ADMIN-only, the code is shown exactly once, and the 15-minute TTL bounds any offline brute-force window; the deterministic hash is required so the confirm endpoint can match it with an indexed lookup (BCrypt would force a full scan).
- **Redemption:** the employee enters the code at the existing `POST /api/auth/password-reset/confirm`; `AuthService.confirmPasswordReset` first matches the hashed claim code (case-normalized) and consumes it, then falls back to legacy Track A/B tokens. The claim code is single-use.

### 3.4 Admin UI (`/admin/users/[id]`)
- The **"Générer un code de réinitialisation"** CTA renders in the actions section **only for claimed + active `CHEF_ATELIER`** accounts (unclaimed pending-promotion accounts use the claim flow instead).
- The modal calls the endpoint and displays the 6-character code in a prominent, copy-to-clipboard badge with the expiry timestamp.
- Mandatory warning copy: **"Ce code expire dans 15 minutes. Communiquez-le directement à l'agent."**
- Loading / error states are rendered explicitly (no silent failures).

### 3.5 Anti-Patterns (enforced)
1. No single-field issuance — the manual endpoint requires the full identity bar.
2. No permanent tokens — both the manual token and the admin code carry a 15-minute TTL.
3. No unauthenticated admin endpoints — `generate-reset-code` is ADMIN-only end to end.
4. No silent failures — backend DTO validation + generic error + UI loading/error states.

---

# Self-Service & Email Reset Screens (Frontend)

## Section 4: Public Reset Routes — Track A / Track B / Track C

### 4.1 Routing Architecture
- `/auth/reset-password/chef-atelier` — **Track A** self-service request screen. Reached from the "Mot de passe oublié ?" link on the **CHEF_ATELIER** login lane only (the link is strictly hidden for the passwordless `SOUS_CHEF` lane).
- `/auth/reset-password/admin` — **Track B** email request screen. Reached from the "Mot de passe oublié ?" link on the **ADMIN** login page.
- `/auth/reset-password/confirm` — **Track C** unified confirmation screen. Accepts `?token=` (Track B email deep link) or `?code=&matricule=` (Track A handoff / admin verbal handoff, editable).
- Admin-assisted entry point: "Générer un code de réinitialisation" lives in the **Zone de danger** of `/admin/users/[id]` for claimed + active `CHEF_ATELIER` accounts (ADMIN only).

### 4.2 Track A — Self-Service Identity Bar (CHEF_ATELIER)
- Fields: `matricule`, `firstName`, `lastName` → `POST /api/auth/password-reset/request-manual`.
- **On success:** the 6-character code renders in large monospace typography with a **live 15-minute countdown** (`CountdownTimer`) and a primary **"Continuer"** CTA that navigates to Track C pre-filling `?code=…&matricule=…` (the token input stays editable).
- **On failure:** a single generic `"Identifiants invalides"` message — the UI never discloses which field failed (backend returns the identical 400 for every mismatch).
- Secondary copy: *"Toujours bloqué ? Demandez à un administrateur de générer un code pour vous."*

### 4.3 Track B — Email Request (ADMIN)
- Field: `email` → `POST /api/auth/password-reset/request-email`.
- **Neutral-response protection:** the backend always answers `200` with the same non-committal notice `"Si cette adresse est enregistrée, un lien de réinitialisation a été envoyé."` — the frontend renders this success state unconditionally, so **no code path distinguishes an unknown address** (not even a network/4xx/5xx failure; only 429 surfaces the rate-limit countdown).
- **Real email dispatch (Spring Mail → Gmail SMTP):** `EmailService` sends the 10-minute UUID deep link via `JavaMailSender` (branded HTML + plain-text fallback). SMTP credentials come from the `MAIL_USERNAME` / `MAIL_PASSWORD` environment variables (Gmail requires an **App Password** — Google Account → Security → App passwords — when 2-Step Verification is enabled); the deep-link origin comes from `app.frontend-url` (default `http://localhost:3000`, override per environment). The token travels by email only — **never** in the HTTP response. On SMTP failure the link is logged server-side so an operator can still recover it, but the neutral 200 is preserved (an SMTP failure must not leak address existence).

### 4.4 Track C — Unified Confirmation
- Fields: token/code (pre-filled, editable) + new password + confirmation.
- **STRICT minimum 8 characters** (backend `@Size(min=8)` on `PasswordResetConfirmRequest` AND `ClaimAccountRequest`; frontend `resetPasswordSchema` + `claimSchema` mirror it). Real-time inline strength feedback (length met / passwords match); submission stays disabled until both pass.
- **NO auto-login.** On success the API returns `role` + `loginIdentifier`; the UI shows "Mot de passe mis à jour, connectez-vous." then redirects to the correct lane with the identifier pre-filled (`/login?lane=CHEF_ATELIER&matricule=…` or `/admin/login?email=…`).
- **Expired/invalid token:** explicit copy *"Ce code a expiré, veuillez en demander un nouveau."* with direct links back to both request screens (§4.2 / §4.3).
- **Lockout clearance:** completing a reset calls `user.resetFailedAttempts()` — `failedLoginAttempts` is zeroed and `lockoutEnd` cleared, so the post-reset login lane shows no residual lockout timer.

## Section 5: Self-Hosted Local Media Pipeline (Photos / Video / Voice Clips)

### 5.1 Architecture Directive
- **Cloud object storage was REMOVED.** Media bytes live on the application host's **local filesystem**; PostgreSQL stores **metadata only** (`incident_attachments`). There is no S3/R2 dependency (AWS SDK v2 deps, `StorageConfig`, `S3StorageService`, `StorageProperties`, the presigned DTOs and the `upload-url`/`confirm` endpoints were all deleted in the session-resume cleanup).
- **Layout & traversal safety:** `{app.media.storage-path}/{incidentId}/{uuid}.{ext}`. Physical file names are **server-generated UUIDs**; the user's original filename is stored in the DB for display only and is NEVER used to build a filesystem path. Every resolved path is normalized and verified to stay under the storage root (`LocalFileStorageService`).
- **Memory safety:** `POST /api/incidents/{id}/attachments` (multipart) streams bytes straight to disk via `MultipartFile.transferTo(Path)` — **`file.getBytes()` is FORBIDDEN** (JVM heap exhaustion). `spring.servlet.multipart.max-file-size=30MB` / `max-request-size=35MB` plus a dedicated `location` temp dir.
- **Authenticated serving & video seeking:** `GET /api/incidents/{id}/attachments/{attId}` is served by `ResourceHttpRequestHandler` (via `SimpleUrlHandlerMapping`) with native `Accept-Ranges: bytes` / 206 partial content, so video players scrub without full downloads. Authorization is enforced **inside** `MediaFileResourceResolver`: either a short-lived HMAC signed read token (for `<img>`/`<video>`/`<audio>` tags, which cannot send `Authorization` headers) or the normal JWT session with full department/ownership scoping (shared `MediaAccessPolicy` — ADMIN / CHEF_ATELIER department / SOUS_CHEF own; deactivated accounts rejected). The path is `permitAll()` at the security layer but is unreachable without a valid token or session.
- **Known trade-off:** the signed read token travels in the URL query string (`?token=…`) because media tags cannot send headers — it is short-lived (15 min) and bound to one incident + attachment, but it will appear in proxy/access logs. Not a credential; treat logs accordingly.
- **Retention:** daily `@Scheduled` job (`MediaRetentionJob`, 03:15) deletes local files via `Files.deleteIfExists()` and their rows for terminal incidents (`RESOLVED`/`NON_RESOLVED`) older than `app.media.retention-days` (default 90).

### 5.2 Endpoint Surface (single multipart request, no presigning)
1. **`POST /api/incidents/{id}/attachments`** — `multipart/form-data` with `file` (+ optional `fileType`). Backend: access check → terminal-state lock (`409`) → count/size/MIME guardrails → `LocalFileStorageService.store()` (streams via `transferTo`) → **16-byte magic-byte sniff** (delete + `400` on mismatch) → persist metadata row → `201`.
2. **`GET /api/incidents/{id}/attachments`** — gallery with fresh signed read URLs.
3. **`GET /api/incidents/{id}/attachments/{attId}?token=…`** — streamed file bytes with Range support (HMAC token or JWT session).
4. **`GET /api/incidents/attachments/storage-status`** — Admin metrics: `SELECT SUM(file_size_bytes)` from the DB + real host headroom via `Files.getFileStore().getUsableSpace()`.

### 5.3 Server-Side Guardrails (`IncidentAttachmentService`)
- **Terminal-state lock:** uploads rejected with `409` when the parent incident is `RESOLVED` or `NON_RESOLVED` (attachments become read-only).
- **Hard limits:** max **5 attachments/incident** (`409`); image ≤ **5 Mo**, video ≤ **25 Mo**, audio ≤ **5 Mo** (`400`); per-type MIME allow-list (`400`).
- **Access scoping** mirrors incident list rules: ADMIN everything, CHEF_ATELIER own department, SOUS_CHEF own declared incidents (`403` otherwise).
- **Magic-byte validation (`MagicByteValidator`):** MIME-aware — JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `GIF8`, WebP `RIFF…WEBP`, HEIC/HEIF/AVIF `ftyp`, MP4/MOV `ftyp`, WebM EBML, MP3 frame header, WAV `RIFF…WAVE`, etc.

### 5.4 Client-Side Capture & Optimization
- **Photos:** `browser-image-compression` — long edge ≤ **1280 px**, JPEG re-encode at **70–80 %** quality before the upload request.
- **Video:** HTML5/MediaRecorder capture capped at **30 s / 720p** in-browser.
- **Voice clips:** integrated MediaRecorder component, max **60 s**, `audio/webm` (Opus) or `audio/mp4` (AAC); treated as `fileType = AUDIO`.
- **UI (`components/incidents/attachment-section.tsx`):** gallery (image lightbox, native `<video>`/`<audio>` players, uploader + per-file progress bars), Photo/Vidéo/Note vocale capture buttons, slot counter (`x / 5`), read-only mode on terminal incidents. The upload is now a **single multipart POST** (`services/attachmentService.ts → uploadAttachment`) with `onUploadProgress` — the presigned `upload-url`/`confirm` steps were removed. Integrated into `IncidentDetailContent` (chef drawer, sous-chef detail, chef logs drawer) and the admin `/admin/incidents/[id]` page.

### 5.5 Configuration, Host Mount & Degradation
- **`application.properties` (env-overridable):**
  - `app.media.storage-path` (`MEDIA_STORAGE_PATH`, default `/data/incident-media`) — **MUST be outside the deployment directory** so redeploys never wipe media.
  - `app.media.retention-days` (`MEDIA_RETENTION_DAYS`, default 90).
  - `app.media.signing-secret` (`MEDIA_SIGNING_SECRET`) — HMAC secret for signed read URLs; falls back to a dev default with a loud warning (always set in production).
  - `app.media.read-token-ttl-minutes` (`MEDIA_READ_TOKEN_TTL_MINUTES`, default 15).
  - `spring.servlet.multipart.max-file-size=30MB`, `max-request-size=35MB`, `location=${java.io.tmpdir}/icglma-media-uploads` (dedicated temp dir).
- **Docker:** `compose.yaml` declares a `media-data` named volume to mount `/data/incident-media` (comment block shows the backend service attachment). Never let media live in a container-local path.
- **Native systemd:** create `/data/incident-media` on the host and grant read/write to the application process user (`chown appuser:appuser`).
- **Nginx production option (X-Accel-Redirect — zero-copy `sendfile` + Range):** the Spring resolver performs the authorization check only; on success it may answer with `X-Accel-Redirect: /protected-media/{incidentId}/{uuid}.{ext}` and Nginx streams the file from disk. Sample block (the storage dir must NEVER be exposed as a public static location):
  ```nginx
  # /etc/nginx/conf.d/media.conf
  location /protected-media/ {
      alias /data/incident-media/;   # same root as app.media.storage-path
      internal;                      # 404 for any direct external access
      add_header Accept-Ranges bytes;
  }
  ```
  The built-in Spring `ResourceHttpRequestHandler` path (Option A) is active by default and already supports byte ranges; Option B is an Nginx-level optimization for production.
- **Disk redundancy acknowledgment:** local disk has **no cloud multi-region replication** — durability depends on host-level backup routines (nightly host snapshots or `rsync` to an off-box target). This trade-off is accepted in exchange for zero egress costs and full data locality.

### 5.6 Anti-Patterns (enforced)
1. No `file.getBytes()` / heap buffering — multipart streams via `transferTo`.
2. No user-controlled filenames on disk — server-generated UUIDs only (originals are display-only DB columns).
3. No unauthenticated public static serving of the storage directory.
4. No hardcoded paths — injected via `@ConfigurationProperties(prefix = "app.media")` (env-driven).
5. No unbounded scans — retention is bounded by terminal status + cutoff; list reads are paginated.

---

# Media Administration & Quota Management Surface (`/admin/media`)

## Section 6: Media Management & Quota Surface

### 6.1 Scope & Content Exclusion Rules
- **Included types:** `IMAGE` (Photos) and `VIDEO` only.
- **Explicit exclusion:** `AUDIO` / voice clips are strictly **EXCLUDED** from this administrative surface — they remain accessible only on their respective Incident Detail pages. Every backend query on this surface hard-codes `file_type IN ('IMAGE', 'VIDEO')` in the `AdminMediaService` filter specification, and the controller rejects `fileType=AUDIO` with a 400.
- **Route & guard:** `frontend/app/(admin)/admin/media/page.tsx` under the ADMIN layout; backend `AdminMediaController` carries class-level `@PreAuthorize("hasRole('ADMIN')")`.

### 6.2 Backend Endpoint Surface (`/api/admin/media`)
1. **`GET /api/admin/media`** — paginated inventory. Filters: `search` (case-insensitive on incident reference), `departmentId`, `fileType` (`IMAGE`|`VIDEO` only), inclusive `startDate`/`endDate` on `uploadedAt`, and `sort` tokens `newest` (default) / `oldest` / `largest` (`fileSizeBytes,desc` — critical for finding storage hogs). Every item carries a fresh signed read URL plus `retentionDaysRemaining` (days until the daily retention job would purge it — only computed for terminal `RESOLVED`/`NON_RESOLVED` incidents; `null` otherwise).
2. **`GET /api/admin/media/stats`** — storage summary strip payload: `SELECT SUM(file_size_bytes)` over **non-deleted** rows (total + per-type), photo/video counts, and real host disk headroom via `Files.getFileStore().getUsableSpace()`.
3. **`DELETE /api/admin/media/{id}`** — single deletion.
4. **`POST /api/admin/media/bulk-delete`** — body `{ "ids": [Long…] }` (the codebase uses BIGSERIAL attachment ids, not UUIDs). Returns `{ deletedCount, freedBytes, skippedIds }`; `skippedIds` reports unknown/already-deleted ids without failing the batch.

### 6.3 Deletion Strategy — Physical Removal + DB Audit Stub (ANTI-PATTERN: NO hard DB deletes)
- **Ordering:** the DB audit stub is persisted FIRST, then the physical file is removed. If the persist fails, the transaction rolls back cleanly and the file is untouched — a live row can never be left pointing at a deleted file.
- **DB:** the metadata row is **soft-deleted** — `object_key = NULL` (the `file_url` equivalent: the row can no longer be served), `is_deleted = TRUE`, `deleted_at` set, and an immutable audit string: `"Photo supprimée par [First Last] le dd/MM/yyyy HH:mm"` (Vidéo for videos).
- **Disk:** the physical file is hard-deleted via `LocalFileStorageService.deleteIfExistsReported(...)` — returns whether the file actually existed, so the bulk summary reports **exact** freed bytes (a file already purged by retention counts as 0).
- **Type guard on delete paths too:** `AUDIO` ids are rejected on `DELETE /api/admin/media/{id}` (400) and skipped in `POST /api/admin/media/bulk-delete` — voice clips can never be removed through this surface.
- The unique constraint on `object_key` stays — Postgres allows multiple NULLs, so audit stubs accumulate freely.
- **Audit-stub isolation:** soft-deleted rows are excluded everywhere else — `MediaFileResourceResolver` answers 404 (never serves a stub), `GET /api/incidents/{id}/attachments` filters them out, the retention job's `findExpiredTerminal` skips them, and `SUM(file_size_bytes)` metrics exclude them.
- The retention job (`MediaRetentionJob`, terminal incidents > `app.media.retention-days`) still **hard-deletes** rows — that is the scheduled lifecycle purge, distinct from admin-initiated deletions.

### 6.4 Frontend (`/admin/media`)
- **Storage Summary Strip** (`components/media/storage-summary-strip.tsx`): total stored bytes, Photos vs Vidéos segmented bar + legend, disk headroom (usable/total) and a usage badge that turns amber ≥ 80 % and red ≥ 90 % — answers *"Are we running out of disk?"* at a glance. Amber banner when storage is not configured.
- **View toggle:** Grid (thumbnail-forward, default) vs List/table (metadata-rich), persisted in `localStorage` key `admin_media_view_mode`.
- **Filters:** search (reference), department dropdown (ADMIN scope), `Du`/`Au` date range, type segmented control (`Tous` | `Photos` | `Vidéos`), sort dropdown incl. **`Taille de fichier (Décroissant)`**, active-filter reset. Search is debounced (350 ms); server-side pagination (24/page).
- **Item data points:** thumbnail / file-type icon, hyperlinked incident reference → `/admin/incidents/[id]`, department & category, type badge, formatted size, upload timestamp + uploader full name.
- **Inspector modal** (`components/media/media-preview-modal.tsx`, remounted via `key` per item): full image preview with zoom toggle OR inline HTML5 video player with controls; live technical spec read from the element (image dimensions WxH / video duration); metadata panel (incident link, uploader, department, category, size, upload date); **retention countdown badge** ("Suppression automatique dans X jours", red ≤ 7 j / amber ≤ 30 j / green otherwise; muted "Conservé — incident en cours" for open incidents); `[Supprimer le fichier]` CTA with inline confirmation.
- **Bulk management:** checkbox per item + header checkbox (page scope, indeterminate state) + **"Tout sélectionner selon les filtres"** (fetches the full filtered set, capped at 500 ids). Contextual action bar shows count + cumulative size. `[Supprimer les fichiers sélectionnés]` opens the **calculated confirmation modal** (`components/media/bulk-delete-modal.tsx`): "Voulez-vous supprimer X fichiers ? Espace libéré : Y" — explicit admin validation is mandatory before anything is removed. Success banner reports freed space; skipped/already-deleted ids are surfaced.
- **Service:** `services/mediaService.ts` — `getAdminMedia` (absolutizes signed media URLs against `API_BASE_URL`), `getAdminMediaStats`, `deleteMediaItem`, `bulkDeleteMedia`, `formatFileSize` / `formatMediaDate`. Types in `types/media.ts`.
- **Navigation:** sidebar entry **`Médias`** (`/admin/media`) under the ADMIN nav.

### 6.5 i18n
- The app's i18n lives in `lib/i18n.ts` (no `fr.json`/`ar.json` files — the project has no `public/locales` directory). French + Arabic keys for this surface are registered under the `mediaAdmin*` namespace in both dictionaries.

### 6.6 Anti-Patterns (enforced)
1. No AUDIO / voice-clip items anywhere on this surface — list queries hard-code `IN ('IMAGE','VIDEO')`, `fileType=AUDIO` is rejected with 400, and the delete paths refuse/skip AUDIO ids.
2. No silent hard DB deletions — every admin deletion leaves an audit stub (`is_deleted = TRUE` + `deletion_audit`).
3. No unconfirmed bulk deletes — the bulk endpoint returns exact freed bytes and the UI always shows the calculated confirmation modal first.

---

# Analytics & Quality Engineering Page (`/analytics`)

## Section 7: Historical Analytics Surface

### 7.1 Philosophy & Access
- **ADMIN-only page** (inside the `(admin)` route group → `AuthGuard allowedRoles=['ADMIN']` + ADMIN sidebar item `Analytique & Qualité` between *Tableau de bord* and *Incidents*). The workload widget is trivially admin-scoped; its backend endpoint is additionally guarded with `@PreAuthorize("hasRole('ADMIN')")`.
- **Every widget carries a time-series / trend dimension** — the page answers *"what are the historical patterns over time"*, never a real-time snapshot (no static dashboard duplication).
- **No client-side aggregation:** all time-bucketing, Pareto math and recurrence detection run in PostgreSQL; the browser only renders and merges already-bucketed series.

### 7.2 Backend — `GET /api/analytics/*` (`AnalyticsController` + `AnalyticsService`)
- **Shared parameters:** `startDate`/`endDate` (ISO dates, inclusive; defaults = rolling last-30-days), optional `departmentId`. **No hardcoded year/month boundaries anywhere.** Invalid ranges (`end < start`) → 400.
- **`GET /api/analytics/volume-speed`** — the main payload:
  - `buckets[]` — dense, gap-free `DATE_TRUNC` series. Granularity adapts to the window: **day** ≤ 32 days, **week** ≤ 120 days, **month** beyond. Each bucket: `reported` + cohort split `resolved`/`nonResolved` (by `declared_at`), `mttrHours` (by `resolved_at`) and `timeToClaimHours` (by `claimed_at`). Zero buckets are filled server-side so the client never invents points.
  - `totals` — exact window aggregates (reported/resolved/nonResolved, `resolutionRatePct` = RESOLVED share of evaluations, avg MTTR, avg time-to-claim).
  - `deltas` — **period-over-period percentages vs. the previous window of identical length** (only when `compare=true`). Every delta carries a `goodWhenUp` polarity flag so the client colors badges correctly (resolution-rate up = green; volume/MTTR/time-to-claim down = green). Null when the previous period has no comparable data.
  - `departments[]` — ranked department volume (descending).
- **`GET /api/analytics/pareto`** — category counts sorted strictly descending + **server-side cumulative percentages** + `insight` (`categoriesTo80`, `totalCategories`, `pctCovered`) powering the 80/20 banner.
- **`GET /api/analytics/heatmap`** — sparse `[dayOfWeek, hour, count]` cells (dayOfWeek **0 = Monday … 6 = Sunday** ISO — the service normalizes PostgreSQL's `EXTRACT(DOW)` 0=Sunday).
- **`GET /api/analytics/repeat-signals`** — **SQL windowing** recurrence detector: `LAG(2)` per `(station_id, category_id)` flags a pair when ≥ 3 incidents fall within any 14-day window; group stats (count, first/last occurrence, latest reference for deep-linking) are computed over the *whole* cluster. Query lives in `IncidentRepository.analyticsRepeatSignals` (validated against a real PostgreSQL 15 instance — CTEs + window functions).
- **`GET /api/analytics/workload`** — **ADMIN-only** aggregate team workload per evaluator: claims, RESOLVED/NON_RESOLVED counts, mean resolution hours. Ordered by last name (neutral, non-competitive). No ranking, no scores.
- All analytics SQL lives in `IncidentRepository` (native `@Query`), keeping the existing per-user analytics convention.

### 7.3 Frontend (`/analytics` + `components/analytics/*`)
- **Global control bar** (`analytics-controls.tsx`): presets **7 j / 30 j (default) / 90 j / Depuis le 1er janvier / Personnalisé** (custom = two date inputs), department filter, and the **`vs. période précédente`** comparison toggle that re-fetches volume-speed with `compare=true` and reveals delta badges on the summary strip.
- **Summary strip** (`summary-strip.tsx`): 4 metric tiles (Incidents déclarés, Taux de résolution, MTTR, Prise en charge) with polarity-aware green/red delta badges when comparison is on.
- **Volume & Resolution trends** (`volume-charts.tsx`): gradient area chart of reported volume + stacked area of RESOLVED vs NON_RESOLVED outcome proportion.
- **Speed trends** (`speed-charts.tsx`): MTTR and time-to-claim line charts (hours, gaps where a bucket has no data).
- **Industrial Pareto 80/20** (`pareto-chart.tsx`): composed bar (count) + cumulative-% line on a right axis, dashed **80 % reference line**, bars past the threshold muted, and an automatic insight banner ("3 / 12 catégories concentrent 78.2 % des incidents").
- **Shift heatmap** (`shift-heatmap.tsx`): 24h × 7d grid, cell intensity ∝ density, hover tooltip, legend.
- **Repeat-incident signals** (`repeat-signals-list.tsx`): amber alert callout cards (station code, category, count, first occurrence) each deep-linking to `/admin/incidents/{id}` of the cluster's latest incident (the signal carries `latestIncidentId` — the detail view works for active AND terminal incidents, unlike a `?ref=` search which only covers the active list).
- **Department comparison** (`department-chart.tsx`): ranked horizontal bar chart.
- **Team workload** (`workload-table.tsx`, ADMIN): neutral aggregate table — **no leaderboards, no rank badges, no gamified callouts** (anti-pattern §7.4.3).
- **Export engine** (`lib/report.ts` + `export-dropdown.tsx`): `[Exporter le rapport]` dropdown → **CSV** (sectioned, UTF-8 BOM + `;`, reuses `lib/csv.ts`) and **PDF** (jsPDF + autotable, multi-section "Rapport mensuel — Sécurité & Exploitation": indicators, volume buckets, Pareto, departments, signals, workload). Filenames embed the active range.
- **Service/types:** `services/analyticsService.ts` + `types/analytics.ts` (mirror the backend records exactly).
- **i18n:** every string on the page goes through `useTranslation()` — keys under the `analytics*` namespace in both FR and AR dictionaries of `lib/i18n.ts` (the project keeps dictionaries in `lib/i18n.ts`, not `fr.json`/`ar.json` — see §6.5).
- **Navigation:** ADMIN sidebar entry + header breadcrumb `Analytique & Qualité` + mobile bottom-nav "Plus" sheet entry.

### 7.4 Anti-Patterns (enforced)
1. No static dashboard snapshot cards — every tile/chart is trend- or delta-anchored.
2. No client-side aggregations — buckets, cumulative % and 14-day windows are computed by SQL; the client merges dense server series only.
3. No competitive gamification — the workload table is plain aggregate data (ADMIN only).
4. No hardcoded date boundaries — every query is parameterised from the active window; defaults are rolling relative dates.

---

---

# Redis Infrastructure & Distributed State

## Section 8: Redis-Powered Resilience (JWT Revocation, Rate Limiting, Caching, Idempotency)

### 8.1 Architectural Directive
- **Every piece of cross-instance state lives in Redis** — never in JVM heap. The legacy in-memory `ConcurrentHashMap` token blacklist and Bucket4j bucket map were **fully removed** (no side-by-side in-memory fallbacks are kept in production).
- **Every Redis key carries an explicit TTL** — no key is ever inserted without an expiration policy.
- **No native Java serialization** — keys use `StringRedisSerializer`, values use the **Jackson 3** JSON serializer (`GenericJacksonJsonRedisSerializer`, the `tools.jackson` variant matching this Spring Boot 4 application).
- **Dependency additions (`backend/pom.xml`):** `spring-boot-starter-data-redis` (Lettuce driver), `commons-pool2` (pooling), `spring-boot-starter-aspectj` (AOP for `@Idempotent` — Boot 4 renamed `spring-boot-starter-aop`), `bucket4j-redis` 8.7.0 (Lettuce `ProxyManager`).

### 8.2 Configuration Keys (`application.properties`, env-overridable)
| Property | Env var | Default | Purpose |
|---|---|---|---|
| `spring.data.redis.host` | `SPRING_REDIS_HOST` | `localhost` | Redis host |
| `spring.data.redis.port` | `SPRING_REDIS_PORT` | `6379` | Redis port |
| `spring.data.redis.password` | `SPRING_REDIS_PASSWORD` | *(empty)* | Redis password (blank = no auth) |
| `spring.data.redis.database` | `SPRING_REDIS_DATABASE` | `0` | Logical DB index |
| `spring.data.redis.lettuce.pool.*` | `REDIS_POOL_*` | 16/8/2 | Lettuce connection pool (max-active/max-idle/min-idle) |
| `app.cache.default-ttl-seconds` | `CACHE_DEFAULT_TTL_SECONDS` | `90` | Default cache TTL |
| `app.cache.dashboard-ttl-seconds` | `CACHE_DASHBOARD_TTL_SECONDS` | `90` | `dashboard_stats` TTL |
| `app.cache.analytics-ttl-seconds` | `CACHE_ANALYTICS_TTL_SECONDS` | `120` | `analytics_metrics` TTL |
| `app.idempotency.ttl-seconds` | `IDEMPOTENCY_TTL_SECONDS` | `30` | Idempotency lock window |

**Local dev:** `compose.yaml` now declares a `redis:7-alpine` service (named volume `redis-data`, healthcheck via `redis-cli ping`); the backend `depends_on` it and receives `SPRING_REDIS_HOST=redis`. **CI/Prod (Railway):** provision a Redis instance and set `SPRING_REDIS_HOST` / `SPRING_REDIS_PORT` / `SPRING_REDIS_PASSWORD`.

### 8.3 Connection & Serialization Standard (`config/RedisConfig.java`)
- `LettuceConnectionFactory` built from `RedisStandaloneConfiguration` + `LettucePoolingClientConfiguration` (commons-pool2).
- `RedisTemplate<String,Object>`: string keys, JSON values.
- `RedisCacheManager`: default TTL + per-cache overrides via `withInitialCacheConfigurations`.
- A **dedicated Lettuce `RedisClient` + `StatefulRedisConnection<byte[],byte[]>`** feeds the bucket4j `ProxyManager`, isolating rate-limit traffic from template/cache traffic. The connection and proxy manager beans are **`@Lazy`** — Lettuce's `connect()` throws synchronously when Redis is down, so deferring the connect keeps the application bootable during a Redis outage (fail-closed at request time, never an in-memory fallback).

### 8.4 Distributed JWT Revocation (`security/TokenBlacklistService.java`)
- **Key scheme:** `blacklist:jwt:{jti}` — every token now carries a UUID `jti` claim (`JwtService`). Legacy tokens without a `jti` fall back to the SHA-256 digest of the token, keeping the lookup deterministic.
- **TTL:** set to the token's remaining validity (`expiration − now`, floored at 1s); a 15-minute fallback when the expiry cannot be extracted. Redis evicts entries itself — the old scheduled cleaner is gone.
- **Enforcement:** `JwtAuthenticationFilter` performs an **O(1) `hasKey`** check before authenticating (the existing `isBlacklisted(token)` call now hits Redis). Malformed tokens are treated as not-blacklisted and left to signature/expiry validation.

### 8.5 Distributed Rate Limiting (`service/RateLimitingService.java` + `RedisRateLimitBucketProvider`)
- Bucket4j buckets are now **distributed**: `ProxyManager` → Lettuce → Redis under `rate_limit:api:{rule}:{clientKey}` (authenticated users on incident creation are keyed by matricule, everyone else by IP). Limits survive restarts and are enforced consistently across every instance.
- **TTL discipline:** the proxy manager uses `ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(15min)` — bucket state expires once it could have refilled (bounded by the longest window, the 15-minute password-reset rule). No key outlives its usefulness.
- `RateLimitBucketProvider` is a thin seam isolating bucket4j; production is `RedisRateLimitBucketProvider`, unit tests use an in-memory fake (test-only). Rules (`AUTH` 5/min, `INCIDENT_CREATE` 10/min, `PASSWORD_RESET_MANUAL` 3/15min) and `resolveRule` are unchanged.

### 8.6 High-Performance Query Caching (`DashboardService` + `AnalyticsServiceImpl`)
- **`dashboard_stats` (TTL 90s):** all six dashboard aggregations are now `@Cacheable` in a dedicated `DashboardService` (the controller is a thin delegate). Keys are explicit literals (`'by-status'`, `'by-priority'`, …) so no-arg methods don't collide on `SimpleKey.EMPTY`.
- **`analytics_metrics` (TTL 120s):** the five analytics queries (`getVolumeSpeed`, `getPareto`, `getHeatmap`, `getRepeatSignals`, `getWorkload`) are `@Cacheable` with keys composed of method name + `start` + `end` + `departmentId` (+ `compare` for volume-speed). The heavier `DATE_TRUNC`/window-function SQL is absorbed by the 2-minute freshness budget.
- **Invalidation:** `@EvictDashboardCaches` (a composed `@Caching` annotation) evicts **both** caches wholesale on every incident mutation in `IncidentServiceImpl` (`createIncident`, `claimIncident`, `progressIncident`, `evaluateIncident`, `deleteIncident`) — the aggregation keys are window/department-scoped, so `allEntries = true` is required.

### 8.7 Idempotency Pipeline (`idempotency/` + `@Idempotent`)
- **Problem:** operators on flaky factory Wi-Fi re-tap "Déclarer" after a client-side timeout, creating duplicate incidents.
- **Client:** `frontend/services/incidentService.ts` generates a fresh UUID per attempt (`crypto.randomUUID()` with a legacy fallback) and sends `X-Idempotency-Key` on `createIncident` (required), and on `claimIncident` / `progressIncident` / `evaluateIncident` (defense-in-depth).
- **Aspect (`IdempotencyAspect`):**
  1. missing/blank header on a `required` endpoint → `400`;
  2. atomic `SETNX idempotency:{key}` with a 30s TTL;
  3. lock held → replay the cached response under `idempotency:{key}:response`, or `409 Conflict` while the first attempt is still in flight;
  4. success → cache the JSON response (same TTL); failure → release the lock so the operator can retry.
- **Endpoints:** `POST /api/incidents` is `@Idempotent` (required); the three PUT transitions are `@Idempotent(required = false)` — the state machine already makes repeat transitions no-ops.
- **GlobalExceptionHandler:** `IdempotencyConflictException` → `409`, `MissingIdempotencyKeyException` → `400`.

### 8.8 Failure Mode & Testing
- **Redis down:** the app still boots (lazy Lettuce connects). Authenticated traffic fails closed — revocation checks and rate limiting cannot be verified, so requests error instead of silently relaxing security. Restore Redis to recover; the cache simply misses and recomputes.
- **Unit tests** (no infra): `TokenBlacklistServiceTest`, `RateLimitingServiceTest`, `IdempotencyAspectTest` (mocked/in-memory fakes).
- **Integration test** `RedisDistributedStateIntegrationTest` (Testcontainers `redis:7-alpine` + full Spring context): proves revocation keys land in Redis with bounded TTL, rate-limit buckets are shared across two service instances, `SETNX` idempotency locks are atomic, and `dashboard_stats` entries are persisted.

### 8.9 Anti-Patterns (enforced)
1. No unlimited-TTL Redis keys — blacklist TTL = remaining token validity, bucket state expires via write strategy, cache entries expire per-cache, idempotency locks expire after 30s.
2. No in-memory state in production — `ConcurrentHashMap` blacklist and bucket map are deleted; the only in-memory `RateLimitBucketProvider` fake is test-scoped.
3. No unchecked duplicate submissions — incident creation refuses requests without `X-Idempotency-Key`.
4. No JDK serialization — String + Jackson 3 JSON serializers only.

### 4.5 Cross-Cutting Rules
- **Lockout escape hatch:** the public request endpoints are NOT gated behind `isLocked()` — a locked account can still request a reset (then reset clears the lock via §4.4).
- **Rate limiting:** `POST /api/auth/**` is limited to **5 req/min/IP** (`RateLimitRule.AUTH`); `request-manual` gets a stricter dedicated **3 req/15 min/IP** (`PASSWORD_RESET_MANUAL`). All three screens render the `Retry-After` seconds as a visual countdown on 429.
- **i18n:** every string on these screens goes through `useTranslation()` (FR/AR dictionaries in `lib/i18n.ts`) — no hardcoded copy.
- **Audit strip:** `GET /api/users/{id}/audit-logs` (ADMIN) feeds the "Piste d'audit" card on `/admin/users/[id]`, rendering `GENERATE_RESET_CODE` entries as "Code de réinitialisation généré par [admin] le [date]".
