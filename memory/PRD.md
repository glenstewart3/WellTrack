# WellTrack — MTSS Multi-Tenant SaaS Platform

## Original Problem Statement
Build a comprehensive MTSS (Multi-Tiered System of Supports) platform that transitions from single-tenant to a Multi-Tenant SaaS architecture. The platform will be hosted at `welltrack.com.au` with:
- **Root domain**: Landing page explaining the platform + school finder
- **admin.welltrack.com.au**: Super Admin portal for provisioning schools
- **Subdomains**: Each school gets a unique subdomain (e.g., `mooroopna.welltrack.com.au`) with its own isolated database

## Architecture
- **Frontend**: React (Create React App) with Shadcn/UI + Tailwind
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Multi-Tenancy**: Subdomain-based tenant resolution -> isolated MongoDB database per school
- **Control Plane**: `welltrack_control` database stores super admins, schools registry, audit log
- **Portal Detection**: Hostname-based in production (root→landing, admin.*→SA, {slug}.*→school). Path-based fallback in dev (/→landing, /sa/*→SA, /login etc.→school)
- **File Storage**: Tenant-scoped at `/app/uploads/{slug}/student_photos/` and `/app/uploads/{slug}/backups/`

## What's Been Implemented

### Phase 1-3: Multi-Tenant Infrastructure, SA Backend & Frontend (COMPLETED)
- Tenant middleware, control DB, all routes refactored, SA portal with school management

### Phase 4: School Portal Adaptations (COMPLETED)
- Feature flags per school, trial expiry banner, Google OAuth multi-tenant, feature flag management UI

### Phase 5: Tenant-Scoped File Storage (COMPLETED)
- Photos and backups stored in tenant-isolated directories

### Onboarding Update (COMPLETED)
- Step 1 (admin account creation) skipped when user is already logged in (SA-provisioned flow)

### Impersonation (COMPLETED)
- SA can impersonate school admins via one-time tokens

### Landing Page + SA Subdomain (COMPLETED - 2026-04-11)
- [x] Beautiful one-page landing site at root domain (dark slate-950 theme, emerald accents)
- [x] Hero section: "Every student seen. No one missed."
- [x] Features section: Universal Screening, Data Analytics, Intervention Tracking, Multi-Tenant SaaS
- [x] "How WellTrack works" section: Screen → Identify → Support
- [x] School Finder modal: validates slug via `GET /api/school-lookup`, shows school name, redirects to subdomain
- [x] `admin.welltrack.com.au` subdomain routes to SA portal in production
- [x] Reserved subdomains: admin, www, api, mail, smtp, ftp blocked from school tenant resolution
- [x] `/sa/*` path-based SA routing preserved as dev fallback
- [x] School login only appears on school subdomains (not root domain)
- [x] 12/12 backend + all frontend tests passed (iteration_44.json)

### Pre-existing Features (from single-tenant)
- Student management, SAEBRS screening, MTSS tier calculation
- Attendance, Interventions, Appointments, Analytics, Reports
- Alerts, Settings, Audit, Backups, Google OAuth, Dark mode

## Prioritized Backlog

### P2 (Future)
- [ ] Automated weekly backup via email
- [ ] Email notifications for alerts
- [ ] Student Wellbeing Check-in feature

## Key Files
### Backend
- `server.py` — Entry point, school-lookup endpoint, photo serving
- `tenant_middleware.py` — Tenant resolution with reserved subdomains
- `routes/superadmin.py` — SA endpoints
- `routes/auth.py` — Auth + OAuth + onboarding + impersonation

### Frontend
- `App.js` — detectPortal() hostname-based routing
- `pages/LandingPage.jsx` — Root domain one-pager with school finder
- `components/DashboardLayout.jsx` — School dashboard with trial banner + feature flags
- `pages/sa/SASchoolDetailPage.jsx` — Feature flags + impersonation

## Test Credentials
- Super Admin: `superadmin@welltrack.com.au` / `superadmin123`
- Demo School: `admin@test.com` / `password123`
- Mooroopna School: `jane@mooroopna.edu.au` / `mooroopna123`

## Test Reports
- iteration_39-41: Phases 1-3
- iteration_42: Phase 4 (28/28)
- iteration_43: Phase 5 + Onboarding + Impersonation (21/21)
- iteration_44: Landing Page + SA Subdomain (12/12)
