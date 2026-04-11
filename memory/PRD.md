# WellTrack — MTSS Multi-Tenant SaaS Platform

## Original Problem Statement
Build a comprehensive MTSS (Multi-Tiered System of Supports) platform that transitions from single-tenant to a Multi-Tenant SaaS architecture. The platform will be hosted at `welltrack.com.au` with:
- **Root domain**: Super Admin portal for provisioning schools
- **Subdomains**: Each school gets a unique subdomain (e.g., `mooroopna.welltrack.com.au`) with its own isolated database

## Architecture
- **Frontend**: React (Create React App) with Shadcn/UI + Tailwind
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Multi-Tenancy**: Subdomain-based tenant resolution -> isolated MongoDB database per school
- **Control Plane**: `welltrack_control` database stores super admins, schools registry, audit log
- **Portal Detection**: `/sa/*` routes -> Super Admin portal, `/*` routes -> School portal
- **File Storage**: Tenant-scoped at `/app/uploads/{slug}/student_photos/` and `/app/uploads/{slug}/backups/`

## What's Been Implemented

### Phase 1: Multi-Tenant Backend Infrastructure (COMPLETED - 2026-04-11)
- [x] `control_db.py`, `tenant_middleware.py`, `deps.py`, `server_utils.py`
- [x] All 12 route files refactored to use `db = Depends(get_tenant_db)`
- [x] `helpers.py`, `utils/audit.py`, `seed.py` accept `db` parameter
- [x] Demo school provisioned in `welltrack_control`
- [x] 21/21 tests passed (iteration_39.json)

### Phase 2: Super Admin Backend (COMPLETED - 2026-04-11)
- [x] `routes/superadmin.py` — Complete SA backend (bootstrap, auth, school CRUD/provisioning, admin management, impersonation, audit, SA CRUD)
- [x] Tenant middleware bypasses `/api/superadmin` paths
- [x] 35/35 tests passed (iteration_40.json)

### Phase 3: Super Admin Frontend (COMPLETED - 2026-04-11)
- [x] SA portal pages: Login, Dashboard, Schools, School Detail, Super Admins, Audit Log
- [x] `App.js` portal detection (SA at /sa/*, school at /*)
- [x] 19/19 tests passed (iteration_41.json)

### Phase 4: School Portal Adaptations (COMPLETED - 2026-04-11)
- [x] Feature flags per school via `GET /api/public-settings`
- [x] Trial expiry banner in DashboardLayout
- [x] Google OAuth multi-tenant refactor (state in control_db, single callback URL)
- [x] Feature Flags management UI in SA School Detail page
- [x] 28/28 tests passed (iteration_42.json)

### Phase 5: Tenant-Scoped File Storage (COMPLETED - 2026-04-11)
- [x] Student photos stored at `/app/uploads/{slug}/student_photos/`
- [x] Backups stored at `/app/uploads/{slug}/backups/`
- [x] Dynamic photo serving at `/api/student-photos/{slug}/{filename}`
- [x] All photo upload/delete/bulk-upload use tenant-scoped paths
- [x] Daily backup scheduler passes slug to `run_backup()`

### Onboarding Update (COMPLETED - 2026-04-11)
- [x] `GET /api/onboarding/status` checks `onboarding_complete` flag only (not user count)
- [x] `POST /api/onboarding/school-setup` — auth-required endpoint for SA-provisioned schools
- [x] Frontend `OnboardingPage` skips Step 1 when user is logged in (SA-provisioned flow)
- [x] Legacy standalone flow preserved for backward compatibility

### Impersonation (COMPLETED - 2026-04-11)
- [x] `POST /api/superadmin/schools/{id}/impersonate` — generates 30-min one-time token
- [x] `GET /api/auth/impersonate?token=...` — school-side handler creates session + redirects
- [x] SA School Detail page has "Impersonate" button
- [x] Token validation: expired, used, invalid tokens rejected
- [x] 21/21 tests passed (iteration_43.json)

### Pre-existing Features (from single-tenant)
- Student management, SAEBRS screening, MTSS tier calculation
- Attendance, Interventions, Appointments, Analytics, Reports
- Alerts, Settings, Audit, Backups, Google OAuth, Dark mode

## Prioritized Backlog

### P2 (Future)
- [ ] Automated weekly backup via email
- [ ] Email notifications for alerts
- [ ] Student Wellbeing Check-in feature
- [ ] Dynamic MongoDB user creation for DB-level access control

## Key Files
### Backend
- `server.py` — Entry point, middleware, startup, photo serving
- `tenant_middleware.py` — Tenant resolution
- `control_db.py` — Control plane DB
- `deps.py` — `get_tenant_db`, `require_feature()` dependencies
- `routes/superadmin.py` — SA endpoints
- `routes/auth.py` — Auth + Google OAuth + onboarding + impersonation
- `routes/students.py` — Student CRUD + tenant-scoped photos
- `routes/backups.py` — Tenant-scoped backups
- `routes/settings.py` — Settings + public-settings with feature flags

### Frontend
- `App.js` — Portal detection + routing + onboarding flow
- `pages/OnboardingPage.jsx` — Adaptive onboarding (skips account step when logged in)
- `components/DashboardLayout.jsx` — Trial banner + feature flag nav
- `pages/sa/SASchoolDetailPage.jsx` — Feature flags + impersonation button

## Test Credentials
- Super Admin: `superadmin@welltrack.com.au` / `superadmin123`
- Demo School: `admin@test.com` / `password123`
- Mooroopna School: `jane@mooroopna.edu.au` / `mooroopna123`

## Test Reports
- iteration_39.json: Phase 1 Backend (21/21)
- iteration_40.json: Phase 2 SA Backend (35/35)
- iteration_41.json: Phase 3 SA Frontend (19/19)
- iteration_42.json: Phase 4 School Portal Adaptations (28/28)
- iteration_43.json: Phase 5 + Onboarding + Impersonation (21/21)
