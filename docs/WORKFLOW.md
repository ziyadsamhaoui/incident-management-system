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
- `incidentService.ts` — `getIncidents`, `getIncidentById`, `getIncidentHistory`, `getIncidentDetail`, `getStaleIncidents`, `createIncident`, `claimIncident`, `progressIncident`, `evaluateIncident` (+ raw→DTO mapper).
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
- Mock data — replace with `GET /api/dashboard/admin-activity?adminId=X`.
- **NOT built** for SOUS_CHEF or CHEF_ATELIER dashboards (prevents gamification hazards).

## Section 2: ADMIN Incidents Workspace (`/admin/incidents/`)

### 2.1 Page Header & View Toggle
- Title: `"Incidents"` + subtitle: `"Vue globale, tous départements"`.
- Segmented control: **Liste** (`LayoutList`) / **Tableau** (`Columns3`). Persisted in `localStorage` key `admin_incidents_view_mode`.
- Secondary `"+ Déclarer"` button.

### 2.2 Multi-Filter Bar & Active Chips
**Controls (persistent, single-row toolbar):**
- **Search:** text input (reference code, description, reporter name/matricule).
- **Status:** multi-select dropdown (`Déclaré`, `Pris en charge`, `En cours`, `Résolu`, `Non résolu`, `Clôturé`).
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

### 2.4 Board View (Kanban)
- **Columns:** `Déclaré` → `Pris en charge` → `En cours` → `Résolu / Non résolu` → `Clôturé`.
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
- **Resolution Card:** Conditionally rendered for `RESOLVED`/`NON_RESOLVED`/`CLOSED`.
- **Full Timeline:** Reverse-chronological `IncidentHistory` audit entries with TimelineIcon, actor names, timestamps, and optional notes.
- **Triage Actions:** `"Prendre en charge"` button (DECLARED), `"Évaluer"` button (IN_PROGRESS).
- **Auto-Close Hint:** Badge for RESOLVED status: `"Clôture automatique ~10 min après résolution"`.

**Shared Evaluation Modal:** Reuses `components/incidents/evaluation-modal.tsx` (portal-based, centered on large, full-bleed on mobile).

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
