# Project Status

## ✅ COMPLETED: Global API Integration & Purge of Mock Data

### Phase 0: Real API Bindings Across All Features
- ✅ **Total mock data purge** — removed `MOCK_INCIDENTS`, `MOCK_USERS`, `MOCK_NOTIFICATIONS`, `MOCK_DEPARTMENTS`, `MOCK_INCIDENT`, `generateMockData()` heatmap, `REF_DATA` hardcoded lists, and all fake delayed-promise submits across the frontend.
- ✅ **Service layer added** (`frontend/services/`): `incidentService`, `dashboardService`, `userService`, `referenceService`, `notificationService`, `subscriptionService`.
- ✅ **Standardized data-fetching hook** `lib/use-async.ts` (loading / error / refetch, no mock fallbacks) + shared `EmptyState`, `ErrorState` (with `[Réessayer]`), and `Skeleton` components.
- ✅ **Incidents:** list/detail/history, declare (`POST /api/incidents`), claim, evaluate — all wired to real endpoints.
- ✅ **Admin Dashboard:** real stats (`/api/dashboard/statistics/*`), charts, critical widget, aging table (`/api/incidents/stale`), activity feed (`/api/dashboard/activity`), heatmap (`/api/dashboard/admin-activity`).
- ✅ **Users Management:** real table (`GET /api/users`), create modal (`POST /api/users`), pending promotion queue with approve (`PUT /api/users/{id}/promote`) / reject (`deactivateUser`), department picker from `/api/reference-data/departments`.
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
  - Board View: 5-column Kanban with HTML5 drag-and-drop state machine
  - Component states: loading skeletons, system zero, filtered empty, pagination
  - Incident Detail Page: audit timeline, triage controls, auto-close scheduler hint
  - Shared Evaluation Modal (portal-based, responsive full-bleed)

### Next Milestones
- Connect dashboard stats to real backend API
- Implement actual user creation modal via `POST /api/users`
- Replace mock data with real API calls (`GET /api/incidents`, `GET /api/admin-activity`)
- Add real notification system for subscription alerts
- Implement `useTranslation()` hook integration for Arabic (`AR`) locale support
