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

### Phase 4: School Portal Adaptations (COMPLETED - 2026-04-11)
- [x] **Feature Flags per School**: `GET /api/public-settings` returns `feature_flags`, `school_status`, `trial_expires_at` from control DB school record
- [x] **Feature Flag Nav Filtering**: DashboardLayout hides nav items when feature flags are explicitly set to `false` (e.g., `appointments: false` hides Appointments)
- [x] **Trial Expiry Banner**: Amber dismissible banner in DashboardLayout when school status is "trial" and expires within 14 days
- [x] **Google OAuth Multi-Tenant Refactor**: OAuth state stored in `control_db.oauth_states` with `tenant_slug`; callback resolves tenant from control_db independently of middleware; single callback URL on root domain works for all schools
- [x] **Cross-subdomain cookies**: Session cookies set with `Domain=.welltrack.com.au` in production for OAuth callback flows
- [x] **Feature Flags Management UI**: SA School Detail page has toggle switches for `appointments`, `ai_suggestions`, `google_auth`, `saebrs_plus`
- [x] **`require_feature()` dependency**: Reusable backend dependency factory for server-side feature flag enforcement
- [x] 28/28 tests passed (iteration_42.json)

### Pre-existing Features (from single-tenant)
- Student management, SAEBRS screening, MTSS tier calculation
- Attendance, Interventions, Appointments, Analytics, Reports
- Alerts, Settings, Audit, Backups, Google OAuth, Dark mode, Onboarding

## Prioritized Backlog

### P1 (Next)
- [ ] Phase 5: S3/Local file storage segregation per school folder
- [ ] Onboarding flow update — Remove Step 1 (user creation) since SA provisions first admin
- [ ] Impersonation endpoint + school-side handler

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
- `deps.py` — `get_tenant_db`, `require_feature()` dependencies
- `server_utils.py` — ensure_indexes
- `routes/superadmin.py` — SA endpoints
- `routes/auth.py` — Auth (email/password + Google OAuth multi-tenant)
- `routes/settings.py` — Settings + public-settings with feature flags
- `routes/*.py` — 12 school route files

### Frontend
- `App.js` — Portal detection + routing
- `api-superadmin.js` — SA API client
- `context/SuperAdminAuthContext.jsx` — SA auth
- `context/SettingsContext.jsx` — Settings + feature flags + school status
- `components/SALayout.jsx` — SA layout
- `components/DashboardLayout.jsx` — School dashboard layout with trial banner + feature flag nav
- `pages/sa/*.jsx` — 6 SA pages (including feature flags management in SASchoolDetailPage)

## Test Credentials
- Super Admin: `superadmin@welltrack.com.au` / `superadmin123`
- Demo School: `admin@test.com` / `password123`
- Mooroopna School: `jane@mooroopna.edu.au` / `mooroopna123`

## Test Reports
- iteration_39.json: Phase 1 Backend (21/21 passed)
- iteration_40.json: Phase 2 SA Backend (35/35 passed)
- iteration_41.json: Phase 3 SA Frontend (19/19 passed)
- iteration_42.json: Phase 4 School Portal Adaptations (28/28 passed)
