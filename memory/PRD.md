# WellTrack — MTSS Multi-Tenant SaaS Platform

## Original Problem Statement
Build a comprehensive MTSS (Multi-Tiered System of Supports) platform that transitions from single-tenant to a Multi-Tenant SaaS architecture. The platform will be hosted at `welltrack.com.au` with:
- **Root domain**: Super Admin portal for provisioning schools
- **Subdomains**: Each school gets a unique subdomain (e.g., `mooroopna.welltrack.com.au`) with its own isolated database

## Architecture
- **Frontend**: React (Create React App) with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Multi-Tenancy**: Subdomain-based tenant resolution -> isolated MongoDB database per school
- **Control Plane**: `welltrack_control` database stores super admins, schools registry, audit log

## What's Been Implemented

### Phase 1: Multi-Tenant Backend Infrastructure (COMPLETED - 2026-04-11)
- [x] `control_db.py` — Control plane DB connection to `welltrack_control`
- [x] `tenant_middleware.py` — Subdomain detection, X-Tenant-Slug header (dev mode), DEFAULT_TENANT_SLUG fallback, SUPER_ADMIN_PATH_PREFIX bypass
- [x] `deps.py` — `get_tenant_db()` FastAPI dependency
- [x] `helpers.py` — All DB-using functions refactored to accept `db` parameter
- [x] `utils/audit.py` — `log_audit(db, ...)` signature
- [x] `seed.py` — `seed_database(db, ...)` signature
- [x] All 12 route files refactored to use `db = Depends(get_tenant_db)`
- [x] `server.py` — TenantMiddleware registered, startup creates demo school, ensure_indexes() reusable function
- [x] Demo school provisioned: slug=`demo`, db=`welltrack_demo`
- [x] 21/21 tests passed (iteration_39.json)

### Phase 2: Super Admin Backend (COMPLETED - 2026-04-11)
- [x] `routes/superadmin.py` — Complete super admin portal backend
- [x] Bootstrap endpoint (`POST /api/superadmin/auth/bootstrap`) — one-time first super admin creation
- [x] Super admin auth (login, logout, me, change-password) — separate from school auth
- [x] School CRUD (list, create/provision, get detail, update, archive)
- [x] School provisioning creates: DB, first admin user, initial settings, uploads dir, indexes
- [x] School admin management (list, add, remove, reset-password)
- [x] Impersonation token generation (30-min expiry)
- [x] Platform stats (total schools, students, active/trial/suspended)
- [x] Super admin audit log
- [x] Super admins CRUD (list, create, delete with self-protection)
- [x] Slug validation (reserved words, duplicates, format)
- [x] `server_utils.py` — `ensure_indexes()` shared module
- [x] Demo school backfilled with school_id
- [x] Tenant middleware updated to bypass `/api/superadmin` paths
- [x] 35/35 tests passed (iteration_40.json)

### Pre-existing Features (from single-tenant)
- Student management, SAEBRS screening, MTSS tier calculation
- Attendance management, Interventions + case notes, Appointments
- Analytics, Reports, Alerts, Settings, Audit logging, Backups
- Google OAuth + email/password auth, Dark mode, Onboarding wizard

## Prioritized Backlog

### P1 (Next)
- [ ] Phase 3: Super Admin Frontend — Portal detection in App.js, SA login/dashboard/schools/detail pages
- [ ] Phase 4: School Portal Adaptations — Feature flags, trial expiry, Google OAuth per tenant

### P2 (Future)
- [ ] Automated weekly backup via email
- [ ] Email notifications for alerts
- [ ] Student Wellbeing Check-in feature
- [ ] Dynamic MongoDB user creation for DB-level access control

## Key Files
- `/app/backend/server.py` — Entry point, middleware, startup
- `/app/backend/tenant_middleware.py` — Tenant resolution (SUPER_ADMIN_PATH_PREFIX bypass)
- `/app/backend/control_db.py` — Control plane DB
- `/app/backend/deps.py` — FastAPI dependencies
- `/app/backend/server_utils.py` — Shared utils (ensure_indexes)
- `/app/backend/helpers.py` — Shared helpers (all accept `db` param)
- `/app/backend/routes/superadmin.py` — Super admin endpoints (auth, schools, admins, audit)
- `/app/backend/routes/*.py` — School route handlers (12 files)
- `/app/memory/MULTI_TENANT_FORK_PROMPT.md` — Full implementation blueprint

## Environment Variables (Backend)
- `MONGO_URL`, `DB_NAME`, `APP_ENV`, `BASE_DOMAIN`, `DEFAULT_TENANT_SLUG`
- `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`

## Test Credentials
- Super Admin: `superadmin@welltrack.com.au` / `superadmin123`
- Demo School: `admin@test.com` / `password123`
- Mooroopna School: `jane@mooroopna.edu.au` / `mooroopna123`
