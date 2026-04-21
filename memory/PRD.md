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

### Dashboard + App-wide UI Refresh (COMPLETED - 2026-04-19)
- [x] Backend: `/api/analytics/tier-movement?limit=N` — one data point per unique screening date over past 365 days
- [x] CSS palette: bright green/amber/red tier colors matching Analytics donut (`#22c55e` / `#f59e0b` / `#ef4444`); neutral slate-50 page bg, slate-200 borders, cool-neutral surfaces
- [x] CSS vars + `.wt-tier{1,2,3}-{bg,text,border,badge,dot}` utility classes drive tier styling app-wide
- [x] `tierUtils.js`: `getTierColors()` + `getRiskColors()` now return `wt-tier*-badge` classes — one palette change propagates to every tier/risk pill across Students, Alerts, Profile, Radar, etc.
- [x] `DashboardPage.jsx`: hero + KPI cards ("Tier 1/2/3" labels showing counts, delta vs last screening) + Tier movement area chart + donut + Recent alerts + Lovable Watchlist
- [x] `StudentsPage.jsx`: ROSTER micro-label, tier-soft avatar backgrounds, new pill TierBadge in table
- [x] Removed `max-w-*xl mx-auto` from all 12 inner pages (full-width responsive)
- [x] Sidebar + top-bar match page background in light mode
- [x] H1s globally weight-800 (Manrope extrabold)
- [x] No functional changes — all hooks, APIs, modals, filters, data-testids preserved

### Time-Based Attendance + Class/Teacher Assignment (COMPLETED - 2026-04-20)
- [x] **New attendance CSV schema**: `/api/attendance/upload` parses `[STKEY, FIRST_NAME, PREF_NAME, SURNAME, ABSENCE_DATE, ABSENCE_COMMENT, AM_ATTENDED, AM_LATE_ARRIVAL, AM_EARLY_LEFT, PM_ATTENDED, PM_LATE_ARRIVAL, PM_EARLY_LEFT]`. Legacy schema (ID/DATE/AM/PM) still auto-detected.
- [x] **Minute-level attendance math**: School day 8:50–15:20 (390 min), AM/PM split at 12:05. `AM_LATE_ARRIVAL=933` (9:33 AM) → 43 min lost. Records store `present_pct` 0.0–1.0.
- [x] **Entry-date aware %**: `compute_att_stats` and `get_bulk_attendance_stats` accept `entry_date`; days before a student's enrolment aren't counted in the denominator. Applied app-wide (student summary, attendance summary, analytics).
- [x] **New /api/classes endpoint** (`routes/classes.py`): lists classes with student_count + teacher assignment. `PUT /api/classes/{class_name:path}/teacher` assigns one teacher per class; denormalises `teacher` name onto student docs. Passing null clears the assignment.
- [x] **Administration → Classes tab**: admin UI for mapping each HOME_GROUP to a teacher user account. 4 demo classes render with dropdown selectors.
- [x] **Settings → Imports**: Attendance upload card now documents the new CSV schema and explains HHMM time format + present_pct calculation.
- [x] 22/22 tests passed (12 unit tests for present_pct math + entry_date; 10 integration tests for upload + classes endpoints) — iteration_45.json.

### Audit Log Architecture — Tenant vs Super Admin (COMPLETED - 2026-04-21)
- [x] **`utils/audit.py`** accepts optional `request` arg that auto-extracts `tenant_slug` + `school_name` from `request.state` when `mirror_to_sa=True`.
- [x] **Mirrored to SA log** (settings/administration scope): `PUT /settings`, `PUT /settings/terms`, `DELETE /settings/terms`, `DELETE /settings/data*` (3 wipe endpoints), `POST /settings/seed`, `POST /settings/restore`, `POST /users`, `POST /users/bulk`, `PUT /users/{id}/role`, `DELETE /users/{id}`, `PUT /users/{id}/professional`, `PUT /classes/{name}/teacher`, `PUT /attendance/types`.
- [x] **Local tenant log only** (school data): student CRUD, student bulk archive/reactivate/import, student photo upload/delete (single + ZIP), attendance CSV upload, interventions/case-notes, appointments.
- [x] **Bulk actions emit exactly 1 audit entry** with `bulk_count`: attendance upload, bulk user import, student bulk import, photo ZIP upload, student-details CSV import, bulk archive/reactivate.
- [x] Verified end-to-end via curl: settings update → both logs; student edit → tenant log only; bulk user import + delete × 3 → all mirrored with `tenant_slug="demo"`, `school_name="Demo School"`.

### SA Audit Enhancements — Tenant Filter + Trend Chart (COMPLETED - 2026-04-21)
- [x] **Backend**: `GET /api/superadmin/audit?tenant_slug=<slug>` — filters entries to one school.
- [x] **Backend**: `GET /api/superadmin/audit/trend?days=30&tenant_slug=<slug>` — returns one bucket per UTC day counting `tenant_*` (settings/admin) actions only; logins excluded so the series reflects actual config drift.
- [x] **Frontend (`SAAuditPage.jsx`)**: Added "All schools" ↔ per-school dropdown (`data-testid="sa-audit-tenant-filter"`), a top-panel area-chart trend (`data-testid="sa-audit-trend"`) showing "Last 30 days · N tenant-configuration changes", and a little school-badge pill on every entry row so SAs can see at a glance which tenant each change came from.
- [x] Filter resets pagination to page 0; trend reloads on filter change.

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
- iteration_45: Time-based Attendance + Class/Teacher assignment (22/22)
