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
- **Portal Detection**: `/sa/*` routes → Super Admin portal, `/*` routes → School portal

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
- [x] `api-superadmin.js` — SA API client with separate auth
- [x] `context/SuperAdminAuthContext.jsx` — SA auth state (sa_session_token cookie)
- [x] `components/SALayout.jsx` — SA sidebar layout (dark slate theme)
- [x] `pages/sa/SALoginPage.jsx` — Login with bootstrap detection
- [x] `pages/sa/SADashboardPage.jsx` — Platform stats, recent schools, warnings
- [x] `pages/sa/SASchoolsPage.jsx` — Schools table + search/filter + Add School modal with auto-slug
- [x] `pages/sa/SASchoolDetailPage.jsx` — School detail, user management, status control, password reset
- [x] `pages/sa/SASuperAdminsPage.jsx` — SA list with add/delete
- [x] `pages/sa/SAAuditPage.jsx` — Paginated audit log with action icons
- [x] `App.js` updated with portal detection (SA at /sa/*, school at /*)
- [x] 19/19 frontend tests passed (iteration_41.json)

### Pre-existing Features (from single-tenant)
- Student management, SAEBRS screening, MTSS tier calculation
- Attendance, Interventions, Appointments, Analytics, Reports
- Alerts, Settings, Audit, Backups, Google OAuth, Dark mode, Onboarding

## Prioritized Backlog

### P1 (Next)
- [ ] Phase 4: School Portal Adaptations — Feature flags per school, trial expiry banner, Google OAuth per tenant

### P2 (Future)
- [ ] Automated weekly backup via email
- [ ] Email notifications for alerts
- [ ] Student Wellbeing Check-in feature
- [ ] Dynamic MongoDB user creation for DB-level access control

## Key Files
### Backend
- `server.py` — Entry point, middleware, startup
- `tenant_middleware.py` — Tenant resolution (SUPER_ADMIN_PATH_PREFIX bypass)
- `control_db.py` — Control plane DB
- `deps.py`, `server_utils.py` — Shared utilities
- `routes/superadmin.py` — SA endpoints
- `routes/*.py` — 12 school route files

### Frontend
- `App.js` — Portal detection + routing
- `api-superadmin.js` — SA API client
- `context/SuperAdminAuthContext.jsx` — SA auth
- `components/SALayout.jsx` — SA layout
- `pages/sa/*.jsx` — 6 SA pages

## Test Credentials
- Super Admin: `superadmin@welltrack.com.au` / `superadmin123`
- Demo School: `admin@test.com` / `password123`
- Mooroopna School: `jane@mooroopna.edu.au` / `mooroopna123`
