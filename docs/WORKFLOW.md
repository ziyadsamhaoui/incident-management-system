# ICGLMA IMS — Workflow & Architecture

## Incident Status Badge Strategy

### Linear/Vercel-Inspired Dot + Text Indicator
All incident statuses across SOUS_CHEF, CHEF_ATELIER, and ADMIN views now use a **6px color dot + text label** instead of solid saturated pill badges.

| Status | Dot Color | Text Color |
|--------|-----------|------------|
| `DECLARED` / Déclaré | `bg-slate-400` | `text-slate-600 dark:text-slate-400` |
| `CLAIMED` / Pris en charge | `bg-blue-500` | `text-blue-700 dark:text-blue-400` |
| `IN_PROGRESS` / En cours | `bg-amber-500` | `text-amber-700 dark:text-amber-400` |
| `RESOLVED` / Résolu | `bg-emerald-500` | `text-emerald-700 dark:text-emerald-400` |
| `NON_RESOLVED` / Non résolu | `bg-rose-500` | `text-rose-700 dark:text-rose-400` |
| `CLOSED` / Clôturé | `bg-slate-800 dark:bg-slate-200` | `text-slate-900 dark:text-slate-100` |

The `StatusDotLabel` component in `lib/constants/incidentStatus.tsx` renders this pattern. The `INCIDENT_STATUS_MAP` constant is the single source of truth for all status labels, dot colors, and text classes.

### Type/Column Treatment
Incident types (e.g., Sécurité, Accident, Réclamation) render as **plain muted text** (`text-slate-500 dark:text-slate-400 font-normal text-sm`) — no pill shapes, borders, or background fills.

---

## Settings Route (`/settings`)

The settings page at `app/settings/page.tsx` is accessible by all roles (SOUS_CHEF, CHEF_ATELIER, ADMIN).

### Identity & Department Card
- **Read-only identity fields**: First Name, Last Name, Email, Matricule, Role
- **Department Selector**: `<Select />` dropdown populated from the Department table
  - **ADMIN**: Editable — can reassign department
  - **SOUS_CHEF / CHEF_ATELIER**: Read-only with informative badge ("Géré par l'administrateur")

### Preference Controls
- **Language Toggle**: Segmented interactive cards with `FR - Français` and `AR - العربية` options.
  - Switching to Arabic applies `dir="rtl"` context via the app's `useTranslation` hook in `lib/i18n.ts`.
  - Language preference is persisted to `localStorage` under key `app-lang`.
- **Theme Selector**: Segmented control powered by `next-themes` with 3 modes:
  - `Clair` (Light) — `light`
  - `Sombre` (Dark) — `dark`
  - `Système` (System) — `system`
  - Theme persisted under `app-theme` storage key.

---

## Top Navigation Bar

### Dark Mode Architecture
The header (`components/layout/header.tsx`) follows a dark theme independent of the page theme:
- **Background**: `bg-slate-900`
- **Border**: `border-slate-800`
- **Text**: `text-slate-100`

### Header Layout
- **Left**: `IC` logo badge (`bg-blue-600` square) + "ICGLMA" title + "Incidents" sub-label
- **Right**: 
  - Optional Cmd+K search trigger (ADMIN only)
  - Notification bell with red pulse dot indicator
  - User profile trigger button (initials avatar + name + chevron)

### User Profile Dropdown
Elevated dark card (`bg-slate-900 border-slate-800`) positioned beneath the user trigger:
- **Header**: Large initials avatar (h-12 w-12) + full name + role/matricule pill (e.g., `Opérateur · #1001`)
- **Metadata**: Department assignment in a subtle bordered section
- **Actions**:
  - `Profil / Paramètres` — links to `/settings`
  - `Se déconnecter` — logout with red accent styling

---

## Role-Based Routing

| Role | Route | Layout |
|------|-------|--------|
| `SOUS_CHEF` | `/sous-chef` | Kiosk TopNav (header only) |
| `CHEF_ATELIER` | `/chef-atelier` | Sidebar + Header |
| `ADMIN` | `/dashboard` | Sidebar + Header |

---

## State Machine (Incident Status Flow)

```
DECLARED → CLAIMED → IN_PROGRESS → RESOLVED
                                   → NON_RESOLVED → CLOSED
```

- Operators (`SOUS_CHEF`) declare incidents
- Admins claim and evaluate incidents
- Status transitions are enforced by the backend state machine
- The frontend `INCIDENT_STATUS_MAP` in `lib/constants/incidentStatus.ts` provides consistent labels
