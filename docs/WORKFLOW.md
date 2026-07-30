# ADMIN Interface — Implementation Workflow

## Section 1: Bug Fixes & Structural Unification

### 1.1 Stat Card Rename
- Top-level stat card renamed from `"En cours"` → **"En traitement"** to disambiguate from the donut chart segment `"En cours"` (which represents `IN_PROGRESS` alone).
- The top card represents `CLAIMED` + `IN_PROGRESS` combined.

### 1.2 Terminology Standardization
- All UI references standardized to **"Promotion Chef d'atelier"** (unified from mixed `"Activation"` / `"Promotion"` usage).
- Users page pending queue reflects this unified terminology.

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
