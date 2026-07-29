# ICGLMA IMS — Project Status

## ✅ COMPLETED

### UI System Overhaul (Current Sprint)
- **Calm Badge Styling**: Replaced solid color pills with Linear-style `Dot + Text` indicators for Status across all roles. Type columns now use plain muted text.
- **User Settings Page (`/settings`)**: Built settings screen supporting:
  - Identity & Department card (ADMIN-editable department reassignment)
  - Language toggle (FR/AR with RTL support)
  - Theme switching (Light/Dark/System) via `next-themes`
- **Dark Mode TopNav Header**: Dark slate header (`bg-slate-900`) with IC logo badge, ICGLMA branding, notification bell, and user profile trigger.
- **User Profile Dropdown**: Elevated dark popover with large avatar, name, role/matricule pill, dynamic department metadata, settings link, and red logout action.

### Incident List Overhaul (Previous Sprint)
- **SOUS_CHEF "Mes Incidents" redesign**: Kiosk-first, touch-optimized activity feed
  - Dead weight removal (search, filters, checkboxes, KPI grid, irrelevant columns)
  - Hero CTA banner ("+ Déclarer un incident")
  - Single-line activity summary
  - Touch-friendly desktop + mobile card layout
  - Status badges use centralized `INCIDENT_STATUS_MAP`

### Backend & Foundation
- JWT authentication with refresh token rotation
- Role-based access control (SOUS_CHEF / CHEF_ATELIER / ADMIN)
- Rate limiting with countdown UI
- Account lockout with lockout timer
- Multi-channel authentication (admin email, floor matricule)
- Account claim workflow for CHEF_ATELIER
- Roster-driven identity seeding
- Department onboarding flow
- Flyway migrations for schema management
- Incident auto-closure scheduler
- Incident state machine with audit history
- Notification system with admin subscriptions
- Reference data admin CRUD infrastructure

## 🚧 IN PROGRESS
- **Incident Declaration Form**: Wire up the hero CTA on sous-chef page to a full declaration flow.
- **Real API Integration**: Replace mock data with live backend endpoint calls.

## 📋 BACKLOG
- Admin notification subscriptions UI
- Profile page enhancements (avatar upload, password change)
- Offline mode / optimistic updates for floor operators
- Accessibility audit (WCAG 2.1 AA compliance)
- Unit test coverage for frontend components
