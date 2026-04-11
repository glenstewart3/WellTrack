# WellTrack — MTSS Multi-Tenant SaaS Platform

## Original Problem Statement
Build a comprehensive MTSS (Multi-Tiered System of Supports) platform that transitions from single-tenant to a Multi-Tenant SaaS architecture. The platform will be hosted at `welltrack.com.au` with:
- **Root domain**: Super Admin portal for provisioning schools
- **Subdomains**: Each school gets a unique subdomain (e.g., `mooroopna.welltrack.com.au`) with its own isolated database

## Architecture
- **Frontend**: React (Create React App) with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Multi-Tenancy**: Subdomain-based tenant resolution → isolated MongoDB database per school
- **Control Plane**: `welltrack_control` database stores school registry

## Core Requirements
1. Subdomain-based multi-tenancy with strict database isolation per school
2. Super Admin portal at root domain for school provisioning
3. Dynamic MongoDB connection pooling
4. Tenant-scoped file storage
5. Per-school feature flags, trial expiry, and billing

## What's Been Implemented

### Phase 1: Multi-Tenant Backend Infrastructure (COMPLETED - 2026-04-11)
- [x] `control_db.py` — Control plane DB connection to `welltrack_control`
- [x] `tenant_middleware.py` — Subdomain detection, X-Tenant-Slug header (dev mode), DEFAULT_TENANT_SLUG fallback
- [x] `deps.py` — `get_tenant_db()` FastAPI dependency
- [x] `helpers.py` — All DB-using functions refactored to accept `db` parameter
- [x] `utils/audit.py` — `log_audit(db, ...)` signature
- [x] `seed.py` — `seed_database(db, ...)` signature
- [x] All 12 route files refactored to use `db = Depends(get_tenant_db)`
- [x] `server.py` — TenantMiddleware registered, startup creates demo school, ensure_indexes() reusable function
- [x] Demo school provisioned: slug=`demo`, db=`welltrack_demo`
- [x] All 21 backend+frontend tests passed (100%)

### Pre-existing Features (from single-tenant)
- Student management (CRUD, bulk import, photos)
- SAEBRS screening + SAEBRS+ wellbeing assessment
- MTSS tier calculation (3-tier model)
- Attendance management (upload, analysis, trends)
- Interventions + case notes
- Appointments system (recurring, professional roles)
- Analytics (tier distribution, cohort comparison, classroom radar, school-wide)
- Reports (CSV exports, screening coverage, support gaps, staff load)
- Alerts system (tier changes, attendance thresholds)
- Settings (school calendar, terms, absence types, branding)
- Audit logging
- Backups (scheduled + manual)
- Google OAuth + email/password auth
- Dark mode
- Onboarding wizard

## Prioritized Backlog

### P0 (Next)
- [ ] Phase 2: Super Admin Backend — `routes/superadmin.py` (auth, school CRUD, provisioning, impersonation, audit)
- [ ] Bootstrap endpoint for first super admin creation
- [ ] School provisioning logic (create DB, seed admin, ensure indexes)

### P1
- [ ] Phase 3: Super Admin Frontend — Portal detection in App.js, Super Admin pages
- [ ] Phase 4: School Portal Adaptations — Feature flags, trial expiry, Google OAuth per tenant

### P2 (Future)
- [ ] Automated weekly backup via email
- [ ] Email notifications for alerts
- [ ] Student Wellbeing Check-in feature
- [ ] Dynamic MongoDB user creation for strict DB-level access control

## Key Files
- `/app/backend/server.py` — Entry point, middleware registration
- `/app/backend/tenant_middleware.py` — Tenant resolution
- `/app/backend/control_db.py` — Control plane DB
- `/app/backend/deps.py` — FastAPI dependencies
- `/app/backend/helpers.py` — Shared helpers (all accept `db` param)
- `/app/backend/routes/*.py` — All route handlers (12 files)
- `/app/memory/MULTI_TENANT_FORK_PROMPT.md` — Full implementation blueprint

## Environment Variables (Backend)
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — Legacy (no longer used for routing)
- `APP_ENV` — `development` or `production`
- `BASE_DOMAIN` — `welltrack.com.au`
- `DEFAULT_TENANT_SLUG` — Fallback tenant in dev mode (e.g., `demo`)
- `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`

## Test Credentials
- Demo School admin: `admin@test.com` / `password123`
