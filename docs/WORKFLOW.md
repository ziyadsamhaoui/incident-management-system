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

## Responsive Left Status Accent Border

Incident Cards across all roles now display a responsive left accent border on large screens (≥1024px) that visually distinguishes the incident's status.

### Behavior
- **LG+ (≥1024px):** A `4px` left border (`lg:border-l-4`) is visible on each incident card with a color matching the status.
- **SM/MD (<1024px):** The left border is suppressed to preserve horizontal card real estate on compact screens.

### Status-to-Color Mapping

| Incident Status | User-Facing Label | Tailwind Border Class | Visual Cue |
| :--- | :--- | :--- | :--- |
| `DECLARED` | Déclaré | `lg:border-l-slate-700` | Dark Gray |
| `CLAIMED` | Pris en charge | `lg:border-l-blue-500` | Blue |
| `IN_PROGRESS` | En cours | `lg:border-l-purple-500` | Purple |
| `RESOLVED` | Résolu | `lg:border-l-emerald-500` | Green |
| `NON_RESOLVED` | Non résolu | `lg:border-l-red-500` | Red |
| `CLOSED` | Clôturé | `lg:border-l-black dark:lg:border-l-slate-200` | Black / White (Dark Mode) |

### Implementation Details
- The `barClass` field in `INCIDENT_STATUS_MAP` (in `lib/constants/incidentStatus.tsx`) stores the responsive border class for each status.
- Card containers use `overflow-hidden lg:border-l-4` to clip the border to the card's border radius and limit it to large viewports.
- The `overflow-hidden` utility ensures the accent border respects the outer `rounded-*` corners without breaking layout bounds.

---

## SOUS_CHEF Landing Page — Corrective Refactoring

### 1. Sticky Mobile CTA ("Déclarer un incident")

The single primary action for this role must remain accessible at all times on the shop floor:

- **Mobile & Tablet (< 768px):**
  - The CTA is pinned as a **fixed bottom floating action bar** (`fixed bottom-4 inset-x-4 z-50`).
  - The main scroll container has `pb-28` bottom padding to ensure the lowest cards are never obscured behind the fixed bar.
  - The button is reachable with a single thumb or gloved hand regardless of list length.
- **Desktop (≥ 768px):**
  - The CTA transitions to a prominent static hero card anchored directly above the sectioned activity feed.
  - The desktop hero includes a large `PlusCircle` icon, bold title, sub-label, and trailing chevron.

### 2. Desktop Container Max-Width Cap

- **Viewport ≥ 1024px:**
  - The central page wrapper is capped at `max-w-5xl` (~1024px) and centered with `mx-auto`.
  - Card containers and headers cannot stretch full-bleed across ultra-wide monitors, eliminating dead horizontal white space.

### 3. Date-Based Recency Section Grouping

Incidents are programmatically grouped into chronological recency buckets:

| Bucket | Condition |
|--------|-----------|
| **Aujourd'hui** | Created within the current calendar day |
| **Cette semaine** | Created within the past 7 days (excluding today) |
| **Plus ancien** | Created over 7 days ago |

- **Sticky Section Headers:** Slim sticky labels (`text-xs font-bold uppercase tracking-wider`) above each bucket with `backdrop-blur-sm` and `bg-slate-50/90 dark:bg-slate-900/90`.
- Only non-empty buckets are rendered, preserving layout integrity.

### 4. Card Typography & Interaction Refinements

#### Reference ID — Neutral Bold (No Hyperlink Blue)
- **Before:** `text-blue-600 dark:text-blue-400` (falsely signals only the ID is clickable)
- **After:** `font-bold text-slate-900 dark:text-slate-100` (neutral dark bold — entire card is a uniform tap target)

#### High-Contrast Chevron
- **Before:** `text-slate-300` / `text-slate-400` — unreadable under sunlight/industrial lighting
- **After:** `text-slate-600 dark:text-slate-300 group-hover:text-slate-900` — high contrast for outdoor/harsh conditions

#### Touch Press Feedback
- Every card has explicit active state: `active:scale-[0.98] active:bg-slate-100 dark:active:bg-slate-800`
- Wired with `cursor-pointer select-none` for unambiguous tap targeting

### 5. First-Time Operator Empty State

When an operator has 0 incidents:
- **Centered layout:** `flex flex-col items-center justify-center py-16 px-4 text-center`
- **Icon:** `ShieldCheck` from `lucide-react` in `text-slate-300 dark:text-slate-700 w-16 h-16 mb-4`
- **Copy:** `"Vous n'avez aucun incident en cours."`
- **Primary Action:** Full `"Déclarer un incident"` button rendered centered below the copy as the hero element.

---

## SOUS_CHEF Incident Card Richness & Scroll Padding

### Scroll Padding Fix
- Mobile list container uses `pb-32 sm:pb-36` to ensure the bottom-most card clears the fixed floating CTA button.
- The padding equals the floating CTA height (~64px) + bottom margin (24px) + safe-area spacing.

### Tinted Category Badges
- Incident type badges are rendered as pale tinted pills with dark matching text:
  - `Sécurité`: Amber tint (`bg-amber-50 text-amber-700`)
  - `Accident`: Red tint (`bg-red-50 text-red-700`)
  - `Réclamation`: Blue tint (`bg-blue-50 text-blue-700`)
- Compact sizing: `rounded-md px-1.5 py-0.5 text-[11px]` with inline category icon.

### Description Excerpt
- Each incident card includes a 1-line truncated description excerpt between the reference row and the status row.
- Styled as `text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed`.

---

## Incident Declaration Form (`/sous-chef/incidents/declare`)

### Architecture
Single-screen form targeting a **<15-second execution budget** with 3 deliberate taps + optional voice dictation. No wizard navigation.

### Form Fields

#### A. Read-Only Department Chip
- Auto-filled from `useAuthStore().departmentName`.
- Rendered as `bg-slate-100 dark:bg-slate-800 text-xs font-medium chip` with `Factory` icon.

#### B. Station Selector (1-Tap Chip Grid)
- 2-column grid of large touchable chips (`StationChip`).
- Active state: `border-2 border-blue-600 bg-blue-50 text-blue-700 font-bold`.
- Not a `<select>` dropdown (requires 3 taps vs 1 tap).

#### C. Category Selector (1-Tap Icon Tile Grid)
- 2-column grid of glove-friendly `CategoryTile` buttons with `h-8 w-8` icons + bold label.
- Categories: `Sécurité`, `Accident`, `Panne technique`, `Réclamation`.
- Active state: Full background tint + 2px solid blue border (not reliant on a checkmark).

#### D. Priority (Auto-Selected Default + Segmented Override)
- Category → Priority mapping:
  - `Sécurité` / `Accident` → `CRITICAL` / `HIGH`
  - `Panne` / `Réclamation` → `MEDIUM` / `LOW`
- Rendered as a 4-way segmented control (`Faible | Moyenne | Élevée | Critique`).
- Zero taps required in ~90% of declarations.

#### E. Voice Dictation + Category Presets
- **Microphone button** adjacent to the textarea initiates browser Speech-to-Text (`Web Speech API`).
- **Quick-preset chips** scoped to the selected category (e.g., `Sécurité`: `["Sol glissant", "Équipement défectueux", "Zone non sécurisée"]`).
- Tapping a chip appends the phrase to the textarea.

#### F. Sticky Action Bar
- `fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between z-50`
- **Cancel**: Left-aligned, clears draft and goes back.
- **Submit**: Right-aligned, disabled until Station + Category are selected.

### Success Flow
- On submit → Clears draft → Pushes to `/sous-chef` → Displays toast `"Incident INC-20260729-00X créé avec succès"`.
- No blocking confirmation dialog.

### Local Draft Persistence
- Auto-saves form state to `localStorage` key `sous_chef_incident_draft` on every change.
- Restores state on mount; clears on successful submission.

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
