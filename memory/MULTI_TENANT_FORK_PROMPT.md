# WellTrack Multi-Tenant SaaS — Implementation Prompt for Fork

---

## Your Mission

Convert the existing WellTrack single-tenant MTSS platform into a full **Multi-Tenant SaaS** product hosted under `welltrack.com.au`. Each customer school gets its own isolated subdomain (`mooroopna.welltrack.com.au`), its own MongoDB database, its own file storage folder, and is managed centrally by a **Super Admin** at the root domain `welltrack.com.au`.

**This is a large refactor. Read every section carefully before writing a single line of code.**

---

## Existing Codebase Summary

**Stack:** React (frontend) + FastAPI (backend) + MongoDB via Motor (async). Fully working single-tenant app.

**Key files:**
- `backend/server.py` — FastAPI entry point, all routers mounted under `/api`
- `backend/database.py` — Single global `db` and `client` (Motor). All routes currently import `from database import db`
- `backend/helpers.py` — `get_current_user(request)`, all batch attendance/SAEBRS helpers. Uses global `db`
- `backend/utils/audit.py` — `log_audit()` async function. Uses global `db`
- `backend/routes/auth.py` — Email/password + Google OAuth. Sessions in `db.user_sessions`. Onboarding in `db.school_settings`
- `backend/routes/*.py` — 11 routers: students, interventions, attendance, analytics, reports, screening, settings, alerts, appointments, backups, audit
- `frontend/src/App.js` — React Router, onboarding gate, ProtectedRoute
- `frontend/src/api.js` — Central Axios instance using `REACT_APP_BACKEND_URL`
- `frontend/src/context/AuthContext.jsx` — Auth state
- `frontend/src/pages/OnboardingPage.jsx` — 2-step onboarding: (1) admin account creation, (2) school setup

**What the existing onboarding does:**
1. Step 1: Creates the first admin user (name, email, password)
2. Step 2: School setup (name, type, current term/year)
Sets `onboarding_complete: true` in `school_settings` when done.

**Google OAuth:** Uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` env vars. Currently single redirect URI.

**File storage:** `/app/uploads/student_photos/{student_id}.jpg` served via FastAPI StaticFiles at `/api/student-photos/`.

---

## Architecture Decision

```
welltrack.com.au           →  Super Admin Portal (control plane)
mooroopna.welltrack.com.au →  Mooroopna School Portal
springvale.welltrack.com.au →  Springvale School Portal
```

- **Control-plane MongoDB DB:** `welltrack_control` — stores super admins, schools registry
- **Per-school MongoDB DB:** `welltrack_{slug}` — e.g., `welltrack_mooroopna` — all existing collections live here unchanged
- **Single MongoDB instance** for all schools (separate DBs on same instance). Connection pooling via a single Motor client.
- **File storage:** `/app/uploads/{slug}/student_photos/`, `/app/uploads/{slug}/backups/`

---

## Security Model (3 Layers — Do Not Compromise)

1. **Separate MongoDB database per school** — no shared collections, no shared data
2. **FastAPI middleware enforces tenant context** — every request is bound to one school's DB via `request.state.db`; there is no code path to cross-access another school's DB
3. **Session cookies are tenant-scoped** — sessions are stored in the school's own DB; a session from School A cannot authenticate to School B

---

## What You Need to Build

### A. Backend Infrastructure (Phase 1 — Do This First)

#### 1. `backend/control_db.py` (NEW)
```python
from motor.motor_asyncio import AsyncIOMotorClient
import os

_control_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
control_db = _control_client["welltrack_control"]
```

#### 2. `backend/tenant_middleware.py` (NEW)
FastAPI middleware that runs on every request:
- Reads `Host` header, extracts subdomain
- If no subdomain (root domain `welltrack.com.au` or `www.welltrack.com.au`): sets `request.state.is_super_admin = True`, `request.state.db = None`, `request.state.tenant_slug = None`
- If subdomain found: looks up school in `control_db.schools` by slug where `status != "archived"`. If found, sets `request.state.db = tenant_client["welltrack_{slug}"]`, `request.state.tenant_slug = slug`, `request.state.is_super_admin = False`. If not found or school is suspended, return `HTTP 503 {"detail": "School not found or access suspended"}`
- **Dev/testing fallback:** If env `APP_ENV=development`, also accept `X-Tenant-Slug` header to set tenant without subdomain
- Use a single global Motor client for all tenant DBs (reuse `client` from `database.py` — just access `client["welltrack_{slug}"]` for the correct DB)

```python
# backend/tenant_middleware.py

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from control_db import control_db
from database import client  # reuse existing Motor client
import os

SUPER_ADMIN_PATHS = {"/api/superadmin"}

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        host = request.headers.get("host", "").split(":")[0]  # strip port
        base_domain = os.environ.get("BASE_DOMAIN", "welltrack.com.au")
        dev_slug = request.headers.get("X-Tenant-Slug") if os.environ.get("APP_ENV") == "development" else None
        
        # Determine slug from host
        slug = dev_slug
        if not slug:
            if host == base_domain or host == f"www.{base_domain}" or host in ("localhost", "127.0.0.1"):
                slug = None  # root domain = super admin
            elif host.endswith(f".{base_domain}"):
                slug = host[: -(len(base_domain) + 1)]
        
        if slug:
            school = await control_db.schools.find_one(
                {"slug": slug}, {"_id": 0}
            )
            if not school:
                return JSONResponse({"detail": "School not found"}, status_code=404)
            if school.get("status") == "suspended":
                return JSONResponse({"detail": "School access suspended. Contact your WellTrack administrator."}, status_code=403)
            if school.get("status") == "archived":
                return JSONResponse({"detail": "This school has been archived."}, status_code=410)
            request.state.db = client[school["db_name"]]
            request.state.tenant_slug = slug
            request.state.school = school
            request.state.is_super_admin = False
        else:
            request.state.db = None
            request.state.tenant_slug = None
            request.state.school = None
            request.state.is_super_admin = True
        
        return await call_next(request)
```

#### 3. Refactor ALL backend routes to use `request.state.db` (CRITICAL)

Currently every route does `from database import db`. This must change. Create a FastAPI dependency:

```python
# backend/deps.py (NEW)
from fastapi import Request, HTTPException

async def get_tenant_db(request: Request):
    if request.state.db is None:
        raise HTTPException(status_code=400, detail="No tenant context for this request")
    return request.state.db
```

Then in EVERY route file, replace `from database import db` with `from deps import get_tenant_db` and add `db=Depends(get_tenant_db)` to every route function that needs DB access. Pass `db` through to any helper functions that need it.

**Complete list of route files to refactor:**
- `routes/auth.py`
- `routes/students.py`
- `routes/interventions.py`
- `routes/attendance.py`
- `routes/analytics.py`
- `routes/reports.py`
- `routes/screening.py`
- `routes/settings.py`
- `routes/alerts.py`
- `routes/appointments.py`
- `routes/backups.py`
- `routes/audit.py`

**Also refactor `helpers.py`:** Functions like `get_current_user`, `get_school_settings_doc`, `get_bulk_attendance_stats`, etc., currently use global `db`. Update all helper functions to accept `db` as a parameter. Update callers accordingly.

**Also refactor `utils/audit.py`:** `log_audit()` uses global `db` — update signature to `log_audit(db, user, action, ...)`.

**`server.py` changes:**
- Import and add `TenantMiddleware` (add BEFORE CORSMiddleware — order matters; add it LAST so it runs FIRST)
- The startup index creation must now run against all tenant DBs OR be deferred to school provisioning
- Actually: remove the DB-specific startup code (index creation) from `server.py`; instead, call an `ensure_indexes(db)` function during school provisioning when the school is first created

#### 4. Update file storage to be tenant-scoped

In `routes/students.py` (photo upload/delete) and `routes/backups.py`, update all file path logic:

```python
# Instead of: /app/uploads/student_photos/{student_id}.jpg
# Use:        /app/uploads/{slug}/student_photos/{student_id}.jpg

def get_photos_dir(slug: str) -> Path:
    base = Path(os.environ.get("UPLOADS_DIR", "/app/uploads"))
    path = base / slug / "student_photos"
    path.mkdir(parents=True, exist_ok=True)
    return path
```

Static files: Instead of a single mounted StaticFiles, serve photos dynamically:
```python
@router.get("/student-photos/{slug}/{filename}")
async def serve_student_photo(slug: str, filename: str):
    path = get_photos_dir(slug) / filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)
```

Update `photo_url` stored in student documents to use `/api/student-photos/{slug}/{student_id}.jpg`.

---

### B. Super Admin Portal — Backend (Phase 2)

Create `backend/routes/superadmin.py` (NEW). This router handles all super-admin operations.

**Super Admin Auth — separate from school auth:**
Super admins authenticate against `control_db.super_admins` collection, not a school's `users` collection. Sessions stored in `control_db.super_admin_sessions`.

Super admin dependency:
```python
async def get_super_admin(request: Request):
    if not request.state.is_super_admin:
        raise HTTPException(403, "Super admin portal only")
    token = request.cookies.get("sa_session_token")
    # validate against control_db.super_admin_sessions
    ...
```

**Endpoints in `routes/superadmin.py`:**

```
POST   /superadmin/auth/login-email      — Super admin email/password login (control_db)
GET    /superadmin/auth/google           — Google OAuth (state encodes is_super_admin=true)
GET    /superadmin/auth/me               — Returns current super admin
POST   /superadmin/auth/logout

GET    /superadmin/schools               — List all schools with stats
POST   /superadmin/schools               — Create (provision) a new school
GET    /superadmin/schools/{school_id}   — School detail
PUT    /superadmin/schools/{school_id}   — Update school (name, status, notes, feature_flags)
DELETE /superadmin/schools/{school_id}   — Archive school (set status=archived, never delete DB)

GET    /superadmin/schools/{school_id}/admins     — List admin users for a school
POST   /superadmin/schools/{school_id}/admins     — Add admin user to a school
DELETE /superadmin/schools/{school_id}/admins/{user_id} — Remove admin from school
PUT    /superadmin/schools/{school_id}/admins/{user_id}/reset-password — Reset admin password

POST   /superadmin/schools/{school_id}/impersonate  — Generate a one-time impersonation token (30-min expiry) that grants admin access to that school's portal

GET    /superadmin/stats                 — Platform-wide stats (total schools, total students est., active schools)
GET    /superadmin/audit                 — Super admin audit log (from control_db.super_admin_audit)

GET    /superadmin/super-admins          — List super admins
POST   /superadmin/super-admins          — Add super admin
DELETE /superadmin/super-admins/{id}    — Remove super admin
```

**School Provisioning logic (`POST /superadmin/schools`):**

Input: `{ name, slug, contact_name, contact_email, admin_name, admin_email, admin_password, status: "active"|"trial", trial_days: 30, notes, feature_flags }`

Actions performed in order:
1. Validate slug is URL-safe lowercase alphanumeric+hyphens, unique in control_db.schools
2. Generate `db_name = f"welltrack_{slug.replace('-', '_')}"`
3. Create school record in `control_db.schools`:
   ```python
   {
     "school_id": f"sch_{uuid.uuid4().hex[:12]}",
     "name": name,
     "slug": slug,
     "db_name": db_name,
     "status": status,  # "active" or "trial"
     "trial_expires_at": (now + timedelta(days=trial_days)).isoformat() if status == "trial" else None,
     "contact_name": contact_name,
     "contact_email": contact_email,
     "created_at": now.isoformat(),
     "created_by": super_admin["super_admin_id"],
     "notes": notes,
     "feature_flags": feature_flags or {},
   }
   ```
4. Get the school's DB: `school_db = client[db_name]`
5. Create the first admin user in `school_db.users`:
   ```python
   {
     "user_id": f"user_{uuid.uuid4().hex[:12]}",
     "email": admin_email,
     "name": admin_name,
     "password_hash": pwd.hash(admin_password),
     "picture": "",
     "role": "admin",
     "created_at": now.isoformat(),
   }
   ```
6. Seed initial school settings in `school_db.school_settings`:
   ```python
   {
     "school_name": name,
     "platform_name": "WellTrack",
     "onboarding_complete": False,  # school admin will complete setup on first login
     "email_auth_enabled": True,
     "google_auth_enabled": True,
     # all SETTINGS_DEFAULTS applied
   }
   ```
7. Create uploads directory: `/app/uploads/{slug}/student_photos/`
8. Ensure MongoDB indexes on school_db (call `ensure_indexes(school_db)`)
9. Log to `control_db.super_admin_audit`
10. Return school record + credential summary

**`ensure_indexes(db)` function** (move from server.py startup):
```python
async def ensure_indexes(db):
    await db.attendance_records.create_index("student_id")
    await db.attendance_records.create_index("date")
    await db.saebrs_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.self_report_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.interventions.create_index([("student_id", 1), ("status", 1)])
    await db.user_sessions.create_index("session_token")
    await db.school_days.create_index("year")
```

**School stats enrichment (`GET /superadmin/schools`):**
For each school, query its DB to get:
- `student_count`: `await school_db.students.count_documents({"active": True})`
- `last_active`: latest session from `school_db.user_sessions`
- `admin_count`: `await school_db.users.count_documents({"role": "admin"})`

**Impersonation (`POST /superadmin/schools/{school_id}/impersonate`):**
1. Generate a short-lived token: `imp_{uuid4().hex}` with 30-min expiry
2. Store in school's DB: `school_db.impersonation_tokens` with `{token, super_admin_id, expires_at, used: False}`
3. Return `{token, school_slug}` — frontend opens `https://{slug}.welltrack.com.au/impersonate?token={token}`

In school portal, add route `GET /auth/impersonate?token=...`:
- Looks up token in `db.impersonation_tokens`, validates expiry, marks `used=True`
- Creates a regular admin session for that school
- Redirects to `/dashboard`

**Google OAuth for Super Admin:**
Reuse the same Google OAuth callback but include `portal: "super_admin"` in the state. After verifying the Google token, look up in `control_db.super_admins` (not school DB). Redirect to `welltrack.com.au/dashboard`.

---

### C. Super Admin Portal — Frontend (Phase 3)

The frontend needs to detect whether it's on the root domain or a school subdomain and render the appropriate UI.

**Detection logic in `App.js`:**
```javascript
const hostname = window.location.hostname;
const baseDomain = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const isSuperAdminPortal = 
  hostname === baseDomain || 
  hostname === `www.${baseDomain}` || 
  hostname === 'localhost'; // dev: use REACT_APP_PORTAL=superadmin env var as override

// In dev: REACT_APP_PORTAL=superadmin shows SA portal, otherwise shows school portal
const forcePortal = process.env.REACT_APP_PORTAL; // "superadmin" | "school"
```

**Render decision:**
```jsx
if (isSuperAdminPortal || forcePortal === 'superadmin') {
  return <SuperAdminApp />;
} else {
  return <SchoolApp />; // existing App content
}
```

**New files to create:**
- `frontend/src/SuperAdminApp.jsx` — top-level component for super admin portal
- `frontend/src/pages/superadmin/SALoginPage.jsx`
- `frontend/src/pages/superadmin/SADashboardPage.jsx` — stats overview
- `frontend/src/pages/superadmin/SASchoolsPage.jsx` — list + manage schools
- `frontend/src/pages/superadmin/SASchoolDetailPage.jsx` — school detail + admins
- `frontend/src/pages/superadmin/SAAddSchoolModal.jsx` — provisioning wizard
- `frontend/src/context/SuperAdminAuthContext.jsx` — super admin auth state
- `frontend/src/api-superadmin.js` — separate Axios instance for superadmin routes

**`SuperAdminApp.jsx` structure:**
- Login page if not authenticated
- After login: sidebar layout with: Dashboard, Schools, Super Admins, Audit Log, (Settings)
- Wrap with `SuperAdminAuthContext`

**Super Admin Login Page (`SALoginPage.jsx`):**
- Email/password form (POST `/api/superadmin/auth/login-email`)
- Google OAuth button (GET `/api/superadmin/auth/google`)
- WellTrack branding (no school-specific branding)
- "Super Admin Portal" label to distinguish from school login

**Schools Dashboard (`SASchoolsPage.jsx`):**
- Stats row: Total Schools, Active, Trial, Suspended
- Schools table columns: School Name, Slug, Status (colored badge), Students, Last Active, Actions
- Status badges: Active=green, Trial=amber (shows days remaining), Suspended=red, Archived=gray
- Actions per row: View/Edit, Manage Admins, Impersonate (open school portal), Suspend/Activate toggle
- "Add School" button → `SAAddSchoolModal`
- Search/filter by name, status

**Add School Modal / Provisioning Wizard (`SAAddSchoolModal.jsx`):**
Step 1 — School Info:
- School name (text)
- Subdomain slug (auto-generated from name, editable, validated: lowercase, alphanumeric + hyphens only, no reserved words)
- Contact name & email
- Status: Active or Trial (if Trial, show "Trial period (days)" input, default 30)
- Notes (textarea, internal only)

Step 2 — First Admin Account:
- Admin full name
- Admin email
- Admin password (auto-generate button available, show/hide toggle)
- Feature flags checkboxes: Enable Appointments, Enable AI Suggestions, Enable Google OAuth, etc.

Step 3 — Review & Confirm:
- Summary of what will be created
- Subdomain preview: `{slug}.welltrack.com.au`
- Confirm button → calls `POST /api/superadmin/schools`
- On success: show "School Created!" with copyable admin credentials + link to school portal

**School Detail Page (`SASchoolDetailPage.jsx`):**
- School info card (editable: name, contact, notes, status, feature flags)
- Admin Users table: name, email, role, last login, Actions (reset password, remove)
- "Add Admin" button → inline form (name, email, password)
- Usage stats: Student count, attendance records, last active date
- Danger zone: Suspend School, Archive School
- "Open School Portal" button → new tab to `https://{slug}.welltrack.com.au`
- "Impersonate as Admin" button → calls impersonation endpoint, opens school portal in new tab

**`SADashboardPage.jsx`:**
- 4 stat cards: Total Schools, Total Students (sum across all), Active Schools, Trial Schools
- Schools table sorted by last active (most recent first)
- Recent super admin audit log (last 20 entries)

---

### D. School Portal Adaptations (Phase 4)

#### 1. Onboarding — Remove User Creation Step

The existing `OnboardingPage.jsx` has 2 steps. **Remove Step 1** (admin account creation). The onboarding flow should start directly at Step 2 (school setup: name, type, current term, year). The first admin user already exists — created by Super Admin during provisioning.

Update `POST /onboarding/setup` → now only sets school settings, NOT creates a user. The endpoint should require an authenticated admin session (use `get_current_user` dependency). Rename it to `POST /onboarding/school-setup` for clarity.

Update `GET /onboarding/status`:
- Return `complete: false` if `school_settings.onboarding_complete` is falsy AND the user is already logged in
- The frontend should redirect a logged-in admin to `/onboarding` if `onboarding_complete` is false

#### 2. Google OAuth — Tenant-Context Callback

Update `GET /auth/google` to encode `tenant_slug` in the OAuth state:
```python
state_doc = {
    "state": state,
    "tenant_slug": request.state.tenant_slug,  # from middleware
    "created_at": ...,
    "expires_at": ...,
}
await control_db.oauth_states.insert_one(state_doc)  # store in CONTROL DB, not school DB
```

Update `GET /auth/callback` endpoint to:
1. Look up state in `control_db.oauth_states` (not school DB)
2. Extract `tenant_slug` from state doc
3. Get school's DB: `school_db = client[f"welltrack_{tenant_slug.replace('-', '_')}"]`
4. Look up or reject user in `school_db.users`
5. Create session in `school_db.user_sessions`
6. Set cookie and redirect to `https://{tenant_slug}.welltrack.com.au/{dashboard|onboarding}`

IMPORTANT: The Google OAuth `redirect_uri` must be `https://welltrack.com.au/api/auth/callback` (root domain). Google console only needs ONE authorized redirect URI. The state parameter carries the school slug for routing.

For Super Admin OAuth: same callback, but `tenant_slug: null` in state → look up in `control_db.super_admins`, create `control_db.super_admin_sessions`, redirect to root domain.

#### 3. Update `GOOGLE_REDIRECT_URI` env var
Set to `https://welltrack.com.au/api/auth/callback` and have the root domain's backend receive and handle it, then redirect to the appropriate school subdomain.

Alternatively, if the OAuth callback is served from the school subdomain middleware, the backend at root domain handles the callback, validates, creates school session, then redirects browser to school subdomain with a `?auth_complete=1` parameter. The school subdomain can then verify the session cookie (which was set with `Domain=.welltrack.com.au` to allow sharing across subdomains).

**Recommended cookie approach:** Set `Domain=.welltrack.com.au` (note the leading dot) on session cookies so they are valid across all subdomains. The session lookup in the school's DB ensures isolation regardless.

#### 4. Feature Flags

In school auth middleware, pass `request.state.school["feature_flags"]` so routes can check feature access:
```python
# Example in appointments.py
if not request.state.school.get("feature_flags", {}).get("appointments_enabled", True):
    raise HTTPException(403, "Appointments module is not enabled for this school")
```

In frontend, expose feature flags via `GET /api/public-settings` response (add `feature_flags` field). Use in `SettingsContext` to conditionally render nav items.

---

## Data Models

### `control_db.schools`
```json
{
  "school_id": "sch_abc123def456",
  "name": "Mooroopna Primary School",
  "slug": "mooroopna",
  "db_name": "welltrack_mooroopna",
  "status": "active",
  "trial_expires_at": null,
  "contact_name": "Jane Smith",
  "contact_email": "jane@mooroopna.vic.edu.au",
  "created_at": "2026-04-01T00:00:00Z",
  "created_by": "sa_xyz789",
  "notes": "Internal notes for super admin only",
  "feature_flags": {
    "appointments_enabled": true,
    "ai_suggestions_enabled": true,
    "google_auth_enabled": true,
    "saebrs_plus_enabled": true
  }
}
```

### `control_db.super_admins`
```json
{
  "super_admin_id": "sa_abc123",
  "email": "admin@welltrack.com.au",
  "name": "WellTrack Admin",
  "picture": "",
  "password_hash": "...",
  "created_at": "2026-04-01T00:00:00Z"
}
```

### `control_db.super_admin_sessions`
```json
{
  "super_admin_id": "sa_abc123",
  "session_token": "sa_sess_...",
  "expires_at": "2026-04-08T00:00:00Z",
  "created_at": "2026-04-01T00:00:00Z"
}
```

### `control_db.oauth_states`
```json
{
  "state": "hex_uuid",
  "tenant_slug": "mooroopna",
  "is_super_admin": false,
  "created_at": "...",
  "expires_at": "..."
}
```

### `control_db.super_admin_audit`
```json
{
  "timestamp": "...",
  "super_admin_id": "sa_abc123",
  "super_admin_email": "admin@welltrack.com.au",
  "action": "school_provisioned",
  "target_school_slug": "mooroopna",
  "details": {}
}
```

### Per-School DB (unchanged structure, all existing collections)
No changes to existing collections. The school DB has:
`users`, `user_sessions`, `school_settings`, `students`, `attendance_records`, `school_days`, `saebrs_results`, `self_report_results`, `interventions`, `case_notes`, `alerts`, `appointments`, `appointment_audit_log`, `audit_log`, `backups`, `impersonation_tokens`

---

## Environment Variables

Add to `backend/.env`:
```
BASE_DOMAIN=welltrack.com.au
APP_ENV=development
SUPER_ADMIN_SESSION_COOKIE=sa_session_token
UPLOADS_DIR=/app/uploads
```

Add to `frontend/.env`:
```
REACT_APP_BASE_DOMAIN=welltrack.com.au
REACT_APP_PORTAL=school   # or "superadmin" for testing SA portal in dev
```

---

## Implementation Phases (Do In This Order)

### Phase 1: Backend Tenant Infrastructure (No UI changes)
1. Create `control_db.py`
2. Create `tenant_middleware.py`
3. Create `deps.py` with `get_tenant_db` dependency
4. Refactor `helpers.py` — all DB-using functions accept `db` as parameter
5. Refactor `utils/audit.py` — `log_audit(db, user, ...)` signature
6. Refactor ALL 11 route files to use `db = Depends(get_tenant_db)` and pass `db` to helpers
7. Update `server.py` — add `TenantMiddleware`, update startup (run against control_db only)
8. Update file storage to tenant-scoped paths
9. Test: curl existing endpoints with `X-Tenant-Slug: test` header in development mode (first create a test school record manually in control_db)

### Phase 2: Super Admin Backend
1. Create `routes/superadmin.py` with all endpoints
2. Create `ensure_indexes()` utility called during provisioning
3. Add super admin router to `server.py` (NOT under tenant middleware — super admin routes only work from root domain)
4. Test: POST `/api/superadmin/schools` to provision a test school, verify school DB + user created

### Phase 3: Super Admin Frontend
1. Create `SuperAdminApp.jsx`, `SuperAdminAuthContext.jsx`, `api-superadmin.js`
2. Create all SA pages (Login, Dashboard, Schools, School Detail, Add School Modal)
3. Wire `App.js` to detect portal type and render correct app
4. Test: Login as super admin, create a school, verify provisioning

### Phase 4: School Portal Adaptations
1. Update `OnboardingPage.jsx` — remove Step 1 (user creation), start with school setup
2. Update Google OAuth flow for tenant context
3. Implement impersonation endpoint + school-side handler
4. Test: Log in to school portal, complete onboarding, verify data isolation

---

## Additional Ideas Already Incorporated

The following improvements are included in the design above — please implement them:

1. **School Status System** — Active / Trial (with expiry days) / Suspended / Archived. Trial schools see a countdown banner in their school portal (`X days remaining in your trial`). Archived schools get a friendly page instead of 410. Suspended schools see a "contact administrator" message.

2. **Super Admin Impersonation** — One-click "Log in as School Admin" from Super Admin portal. Uses a short-lived token (30 min) that grants admin access to school portal for troubleshooting.

3. **Feature Flags per School** — Enable/disable: Appointments module, AI Suggestions (Ollama), Google OAuth, SAEBRS+ self-report. Exposed via `/api/public-settings` and used in frontend nav.

4. **School Usage Stats** — Show student count, admin count, last active date per school in the Super Admin portal. Stats are fetched live from each school's DB.

5. **Auto-generated + editable slug** — When typing the school name in the Add School form, the slug is auto-generated (lowercase, hyphens) and shown in a preview URL. The slug is editable before saving but locked after school is created.

6. **Credential Sheet on Provisioning** — After creating a school, the super admin sees a modal with copyable first admin credentials (email + password) and the school portal URL. This is shown ONCE — super admin should share with the school admin immediately.

7. **Notes field** — Each school has an internal notes text field visible only to super admins. Useful for tracking contract info, special configurations, support history.

8. **Super Admin Audit Log** — Every super admin action (school created, suspended, admin added, impersonation started) is logged to `control_db.super_admin_audit` and displayed in the SA portal.

9. **Trial expiry banner** — In the school portal, if `school.status === "trial"` and trial expires within 14 days, show an amber dismissible banner: "Your WellTrack trial expires in X days. Contact us to upgrade."

---

## Key Constraints

- **Do NOT break existing school functionality.** Every existing feature (students, attendance, screening, interventions, analytics, appointments, audit log, etc.) must work identically after the refactor — just using `request.state.db` instead of the global `db` import.
- **Do NOT delete or wipe any existing database.** The refactored app uses `welltrack_control` as the new control plane. Existing school data can be migrated to a named school DB via a migration script if needed, but the existing DB can continue operating normally.
- **All URLs, ports, and credentials from .env only.** No hardcoded values.
- **Add `data-testid` to every interactive element** in the Super Admin portal for testing.
- **Session cookies:** Use `sa_session_token` for super admin sessions (separate cookie name), `session_token` for school sessions (unchanged). Set `Domain=.welltrack.com.au` on school session cookies so they work across subdomains.
- **In development mode** (no subdomains available): use `REACT_APP_PORTAL=superadmin` env to force SA portal, and `X-Tenant-Slug` request header for school portal testing.
- Use `testing_agent_v3_fork` after completing each phase.
- Use `integration_playbook_expert_v2` for any third-party integration needs (do not implement Google OAuth changes directly).

---

## Credentials for Testing

Current test admin (existing single-tenant school data):
- Email: `admin_emailauth@test.com`
- Password: `password`

This user and their school data should be migrated into a named school DB (e.g., `welltrack_demo`) during Phase 1 setup, OR left in the existing DB name and referenced from the control plane. The simplest approach: create a "demo" school entry in `control_db.schools` pointing to the existing `DB_NAME` so existing data continues to work during development.

---

## Definition of Done

- [ ] Visiting `welltrack.com.au` shows Super Admin login → dashboard with school management
- [ ] Super Admin can create a school with a slug → school DB + uploads folder auto-created
- [ ] Visiting `mooroopna.welltrack.com.au` shows WellTrack school login
- [ ] School admin logs in (using credentials created by Super Admin), completes school setup onboarding (school name/type/term — no user creation step)
- [ ] All school features work identically to before
- [ ] Data from School A is completely inaccessible when logged into School B
- [ ] Google OAuth works for both school portals and super admin portal
- [ ] Impersonation works: Super Admin clicks "Log in as Admin" → opens school portal as admin
- [ ] File uploads (student photos) are stored in `/app/uploads/{slug}/student_photos/`
- [ ] Trial school sees countdown banner; suspended school sees suspension page
- [ ] All endpoints tested via `testing_agent_v3_fork`

---

## Files Reference (Current Codebase)

All files in the codebase are relevant. Key files you will modify extensively:
- `backend/database.py` → add `client` export, keep `db` for backward compat during transition
- `backend/server.py` → add TenantMiddleware, update startup
- `backend/helpers.py` → refactor all functions to accept `db` param
- `backend/utils/audit.py` → update `log_audit` signature
- `backend/routes/auth.py` → refactor for tenant DB, update Google OAuth
- `backend/routes/*.py` (all 11 files) → add `db = Depends(get_tenant_db)` to all route functions
- `frontend/src/App.js` → add portal detection, render SuperAdminApp or SchoolApp
- `frontend/src/pages/OnboardingPage.jsx` → remove Step 1 (user creation)

New files to create:
- `backend/control_db.py`
- `backend/tenant_middleware.py`
- `backend/deps.py`
- `backend/routes/superadmin.py`
- `frontend/src/SuperAdminApp.jsx`
- `frontend/src/context/SuperAdminAuthContext.jsx`
- `frontend/src/api-superadmin.js`
- `frontend/src/pages/superadmin/SALoginPage.jsx`
- `frontend/src/pages/superadmin/SADashboardPage.jsx`
- `frontend/src/pages/superadmin/SASchoolsPage.jsx`
- `frontend/src/pages/superadmin/SASchoolDetailPage.jsx`
- `frontend/src/pages/superadmin/SAAddSchoolModal.jsx`

---

## Server Setup Guide — Self-Hosted External Deployment

This section covers everything needed to deploy WellTrack from scratch on a VPS running Ubuntu 22.04 LTS. Read the entire guide before starting.

---

### 1. VPS Requirements

| Scale | vCPU | RAM | SSD | Bandwidth |
|---|---|---|---|---|
| Up to 5 schools / ~1,000 students | 2 cores | 4 GB | 50 GB | 1 Gbps port |
| Up to 20 schools / ~5,000 students | 4 cores | 8 GB | 100 GB | 1 Gbps port |
| 20+ schools / 10,000+ students | 8 cores | 16 GB | 200 GB | 1 Gbps port |

**Recommended providers:** Hetzner (best value), DigitalOcean, Vultr, Linode.
**Operating System:** Ubuntu 22.04 LTS (64-bit). Do not use Ubuntu 24.04 — some Python packages have compatibility issues.

---

### 2. DNS Configuration (Do This First — Takes Up To 24 Hours to Propagate)

Log in to your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare) and add the following DNS records. Replace `YOUR_VPS_IP` with your server's public IPv4 address.

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `YOUR_VPS_IP` | 300 |
| A | `www` | `YOUR_VPS_IP` | 300 |
| A | `*` | `YOUR_VPS_IP` | 300 |

The wildcard `*` record is the critical one — it routes `mooroopna.welltrack.com.au`, `springvale.welltrack.com.au`, etc. all to your server. Nginx then handles which school is being accessed based on the `Host` header.

**If using Cloudflare:** Set the A records to "DNS only" (grey cloud, not orange). Cloudflare's orange-cloud proxy does not support wildcard SSL passthrough correctly with Let's Encrypt. You can re-enable proxying after SSL is set up, but it adds complexity.

Verify propagation before continuing:
```bash
dig welltrack.com.au +short
dig test.welltrack.com.au +short
# Both should return YOUR_VPS_IP
```

---

### 3. Initial Server Setup

SSH into your VPS as root (or a sudo user), then run:

```bash
# Update system
apt update && apt upgrade -y

# Set timezone to your local timezone (important for scheduled jobs)
timedatectl set-timezone Australia/Melbourne

# Create a dedicated non-root user to run the application
useradd -m -s /bin/bash welltrack
usermod -aG sudo welltrack

# Set a strong password for the welltrack user
passwd welltrack

# Switch to the welltrack user for the rest of the setup
su - welltrack
```

---

### 4. Install System Dependencies

Run all of the following as the `welltrack` user (with sudo where needed):

```bash
# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip build-essential

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
python3.11 --version   # should print Python 3.11.x
node --version         # should print v20.x.x
npm --version

# Install Yarn package manager
sudo npm install -g yarn

# Nginx
sudo apt install -y nginx

# Certbot for SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Git
sudo apt install -y git

# Useful tools
sudo apt install -y curl wget unzip htop ufw
```

---

### 5. Install MongoDB 7.0

MongoDB must be installed from the official MongoDB repository. Do NOT use the Ubuntu default package — it is an outdated version.

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt update
sudo apt install -y mongodb-org

# Enable and start MongoDB
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl start mongod

# Verify it is running
sudo systemctl status mongod
# Should show: Active: active (running)
```

**Secure MongoDB (critical — do not skip):**

By default, MongoDB listens on all interfaces with no authentication. We will restrict it to localhost only and enable authentication.

```bash
# Connect to MongoDB shell
mongosh

# Inside the mongo shell, create the admin user
use admin
db.createUser({
  user: "welltrack_admin",
  pwd: "REPLACE_WITH_STRONG_PASSWORD_HERE",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" }
  ]
})
# You should see: { ok: 1 }

exit
```

Now edit the MongoDB config to enable authentication and restrict binding:

```bash
sudo nano /etc/mongod.conf
```

Find and update these two sections:

```yaml
# Network interfaces — ONLY listen on localhost
net:
  port: 27017
  bindIp: 127.0.0.1

# Security — enable authentication
security:
  authorization: enabled
```

Restart MongoDB and verify auth works:

```bash
sudo systemctl restart mongod

# Test authentication (replace password)
mongosh --authenticationDatabase admin -u welltrack_admin -p "REPLACE_WITH_STRONG_PASSWORD_HERE" --eval "db.adminCommand('ping')"
# Should print: { ok: 1 }
```

Save your connection string — you will need it in `.env`:
```
MONGO_URL=mongodb://welltrack_admin:REPLACE_WITH_STRONG_PASSWORD_HERE@127.0.0.1:27017/admin?authSource=admin
```

---

### 6. Deploy the Application Code

```bash
# Create the application directory
sudo mkdir -p /var/www/welltrack
sudo chown welltrack:welltrack /var/www/welltrack

# Clone your repository (use your actual repository URL)
cd /var/www/welltrack
git clone https://github.com/YOUR_USERNAME/welltrack.git .

# Create the uploads directory structure
mkdir -p /var/www/welltrack/uploads
chmod 755 /var/www/welltrack/uploads
```

**Set up Python virtual environment and install backend dependencies:**

```bash
cd /var/www/welltrack

# Create virtual environment using Python 3.11
python3.11 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# Verify FastAPI and Motor are installed
python -c "import fastapi, motor; print('Backend dependencies OK')"
```

---

### 7. Configure Environment Variables

**Backend `.env` file:**

```bash
nano /var/www/welltrack/backend/.env
```

Paste and fill in every value:

```env
MONGO_URL=mongodb://welltrack_admin:STRONG_PASSWORD@127.0.0.1:27017/admin?authSource=admin
DB_NAME=welltrack_control
SESSION_SECRET=GENERATE_WITH_python3_-c_"import_secrets;print(secrets.token_hex(32))"
ALLOWED_ORIGINS=https://welltrack.com.au,https://www.welltrack.com.au
BASE_DOMAIN=welltrack.com.au
APP_ENV=production
UPLOADS_DIR=/var/www/welltrack/uploads
FRONTEND_URL=https://welltrack.com.au
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://welltrack.com.au/api/auth/callback
COOKIE_SECURE=true
PHOTOS_DIR=/var/www/welltrack/uploads
```

Generate the `SESSION_SECRET`:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
# Copy the output and paste it as the SESSION_SECRET value
```

**IMPORTANT:** Set strict permissions on the `.env` file so only the `welltrack` user can read it:
```bash
chmod 600 /var/www/welltrack/backend/.env
```

**Frontend `.env` file:**

```bash
nano /var/www/welltrack/frontend/.env
```

```env
REACT_APP_BACKEND_URL=https://welltrack.com.au
REACT_APP_BASE_DOMAIN=welltrack.com.au
REACT_APP_PORTAL=school
```

---

### 8. Build the Frontend

```bash
cd /var/www/welltrack/frontend

# Install Node.js dependencies
yarn install

# Build for production (this creates the /frontend/build directory)
yarn build

# Verify the build succeeded
ls -la build/
# Should show: index.html, static/, etc.
```

The build process takes 2–3 minutes. The resulting `build/` directory contains static files that Nginx will serve directly.

---

### 9. Configure Nginx

Remove the default Nginx site and create the WellTrack configuration:

```bash
sudo rm -f /etc/nginx/sites-enabled/default

sudo nano /etc/nginx/sites-available/welltrack
```

Paste the following configuration. Replace `welltrack.com.au` with your actual domain:

```nginx
# Redirect all HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name welltrack.com.au www.welltrack.com.au *.welltrack.com.au;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Root domain — Super Admin Portal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name welltrack.com.au www.welltrack.com.au;

    ssl_certificate     /etc/letsencrypt/live/welltrack.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/welltrack.com.au/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    # Serve large file uploads (student photo ZIPs)
    client_max_body_size 100M;

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Frontend static files
    location / {
        root  /var/www/welltrack/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets aggressively
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}

# Wildcard subdomains — School Portals
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.welltrack.com.au;

    ssl_certificate     /etc/letsencrypt/live/welltrack.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/welltrack.com.au/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    client_max_body_size 100M;

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Same React build for all school subdomains
    location / {
        root  /var/www/welltrack/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

Enable the site and test the config:

```bash
sudo ln -s /etc/nginx/sites-available/welltrack /etc/nginx/sites-enabled/

sudo nginx -t
# Should print: configuration file /etc/nginx/nginx.conf test is successful
```

---

### 10. Obtain SSL Certificate (Wildcard — Required for Subdomains)

A wildcard SSL certificate covers `*.welltrack.com.au` so all school subdomains get HTTPS automatically. This **requires a DNS challenge** (not HTTP challenge) because the wildcard domain cannot be validated via a web server.

**Option A — Manual DNS challenge (works with any registrar):**

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d welltrack.com.au \
  -d *.welltrack.com.au \
  --agree-tos \
  --email your@email.com
```

Certbot will ask you to add a `_acme-challenge` TXT record to your DNS. Add the record in your registrar's DNS panel, wait 1–2 minutes for propagation, then press Enter.

**Downside:** Renewal every 90 days requires manual DNS changes. Use Option B for automatic renewal.

**Option B — Cloudflare DNS plugin (recommended for automatic renewal):**

If your DNS is managed via Cloudflare (free tier works):

```bash
sudo pip install certbot-dns-cloudflare

# Create Cloudflare credentials file
sudo mkdir -p /etc/cloudflare
sudo nano /etc/cloudflare/credentials.ini
```

```ini
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
```

Get your API token from Cloudflare Dashboard → My Profile → API Tokens → Create Token → use the "Edit zone DNS" template, restrict to your domain.

```bash
sudo chmod 600 /etc/cloudflare/credentials.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare/credentials.ini \
  -d welltrack.com.au \
  -d *.welltrack.com.au \
  --agree-tos \
  --email your@email.com
```

**Set up auto-renewal:**

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run
# Should say: Congratulations, all simulated renewals succeeded

# Certbot installs a systemd timer automatically. Verify:
sudo systemctl status certbot.timer

# After renewal, Nginx needs to reload to pick up the new cert:
echo "0 0 * * * root certbot renew --quiet && nginx -s reload" | sudo tee -a /etc/cron.d/certbot-renew
```

Now start Nginx (it will fail if SSL certs don't exist — run this after certbot):

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

---

### 11. Set Up the Backend as a systemd Service

This ensures the backend starts automatically on server boot and restarts on crash.

```bash
sudo nano /etc/systemd/system/welltrack-backend.service
```

```ini
[Unit]
Description=WellTrack FastAPI Backend
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=welltrack
Group=welltrack
WorkingDirectory=/var/www/welltrack/backend
EnvironmentFile=/var/www/welltrack/backend/.env
ExecStart=/var/www/welltrack/venv/bin/uvicorn server:app \
    --host 127.0.0.1 \
    --port 8001 \
    --workers 2 \
    --log-level info \
    --access-log
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=welltrack-backend

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable welltrack-backend
sudo systemctl start welltrack-backend

# Check it started successfully
sudo systemctl status welltrack-backend
# Should show: Active: active (running)

# View live logs
sudo journalctl -u welltrack-backend -f
```

**Choosing the number of workers:**
- Use `--workers 2` for up to 10 schools
- Use `--workers 4` for 10–30 schools
- Rule of thumb: `(2 × CPU cores) + 1`, max out at 8

---

### 12. Configure the Firewall

Only expose ports 22 (SSH), 80 (HTTP), and 443 (HTTPS). MongoDB must never be exposed to the internet.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable

# Verify
sudo ufw status verbose
# Port 27017 (MongoDB) should NOT appear — good
```

---

### 13. Google Cloud Console Setup (OAuth)

The Google OAuth flow requires credentials from Google Cloud Console. WellTrack uses a **single OAuth client** for all portals (root domain + all school subdomains) — the state parameter routes each login to the correct school.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select an existing one: e.g., **WellTrack Production**
3. Navigate to **APIs & Services → OAuth consent screen**:
   - User Type: **External** (unless you have a Google Workspace org)
   - App name: `WellTrack`
   - User support email: your admin email
   - Authorized domains: Add `welltrack.com.au`
   - Scopes: Add `email`, `profile`, `openid`
4. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: `WellTrack Web`
   - Authorized JavaScript origins:
     ```
     https://welltrack.com.au
     ```
   - Authorized redirect URIs:
     ```
     https://welltrack.com.au/api/auth/callback
     ```
     This single URI handles all school logins AND super admin login — the school slug is encoded in the `state` parameter.
5. Copy the **Client ID** and **Client Secret** into `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**Publishing the OAuth app:** Google will show a warning screen to users until the app is verified. For internal use across your schools you can leave it in "Testing" mode and add each school admin's Google account as a test user. For public release, submit for verification.

---

### 14. Bootstrap the First Super Admin Account

The Super Admin portal at `welltrack.com.au` needs a first super admin account to be created. Because there is no external way to create this account (and it would be a security risk to leave an open registration endpoint), the fork agent should implement a **bootstrap endpoint** that:

- Only works when `control_db.super_admins` is completely empty (i.e., the first run)
- After the first super admin is created, this endpoint permanently rejects all requests with HTTP 403

The bootstrap endpoint signature:
```
POST /api/superadmin/auth/bootstrap
Body: { "name": "...", "email": "...", "password": "..." }
```

To create the first super admin after deployment:

```bash
# Replace values with your details. Run this from the VPS or any machine with internet access.
curl -X POST https://welltrack.com.au/api/superadmin/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "you@youremail.com",
    "password": "StrongPassword123!"
  }'

# Expected response: { "message": "Super admin created successfully" }
# Running it a second time returns: HTTP 403 - Bootstrap already complete
```

After this, log in to `https://welltrack.com.au` with those credentials.

---

### 15. Verify Everything Is Working

```bash
# 1. Backend health check
curl https://welltrack.com.au/api/public-settings
# Should return JSON with platform_name, etc.

# 2. Test super admin bootstrap (if not done yet — see section 14)

# 3. Check service statuses
sudo systemctl status mongod
sudo systemctl status nginx
sudo systemctl status welltrack-backend

# 4. Check backend logs for any startup errors
sudo journalctl -u welltrack-backend -n 50 --no-pager

# 5. Test that a fake subdomain returns the right error
curl https://fakeschool.welltrack.com.au/api/public-settings
# Should return: { "detail": "School not found" } with HTTP 404
```

---

### 16. Deploying Updates (After Initial Setup)

Every time you push a code update, follow this process:

```bash
cd /var/www/welltrack

# 1. Pull latest code
git pull origin main

# 2. Install any new backend dependencies
source venv/bin/activate
pip install -r backend/requirements.txt

# 3. Rebuild the frontend (if any frontend changes)
cd frontend
yarn install   # only if package.json changed
yarn build
cd ..

# 4. Restart the backend service
sudo systemctl restart welltrack-backend

# 5. Verify it restarted cleanly
sudo systemctl status welltrack-backend
sudo journalctl -u welltrack-backend -n 20 --no-pager
```

Nginx does not need to restart for backend changes. It only needs restarting if you change the Nginx config file:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

### 17. Log Management & Monitoring

**View backend logs:**
```bash
# Live tail (Ctrl+C to stop)
sudo journalctl -u welltrack-backend -f

# Last 100 lines
sudo journalctl -u welltrack-backend -n 100 --no-pager

# Errors only in the last hour
sudo journalctl -u welltrack-backend --since "1 hour ago" -p err --no-pager
```

**View Nginx logs:**
```bash
# Access log (all requests)
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log
```

**Set up log rotation** (prevent logs from filling disk):
```bash
sudo nano /etc/logrotate.d/welltrack
```
```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 $(cat /var/run/nginx.pid)
        fi
    endscript
}
```

**Basic monitoring — check server health:**
```bash
# CPU and RAM usage
htop

# Disk usage (watch that uploads/ and MongoDB don't fill the disk)
df -h
du -sh /var/www/welltrack/uploads/
du -sh /var/lib/mongodb/

# MongoDB database sizes
mongosh --authenticationDatabase admin -u welltrack_admin -p "PASSWORD" --eval \
  "db.adminCommand('listDatabases').databases.map(d => d.name + ': ' + (d.sizeOnDisk/1024/1024).toFixed(1) + ' MB')"
```

---

### 18. Backup Strategy

The app includes an APScheduler-based daily backup per school that writes JSON files to the uploads directory. For disaster recovery, also set up server-level backups:

**MongoDB backups (nightly):**

```bash
sudo nano /etc/cron.d/welltrack-mongo-backup
```

```cron
0 2 * * * welltrack /var/www/welltrack/scripts/mongo-backup.sh >> /var/log/welltrack-backup.log 2>&1
```

Create the backup script:

```bash
mkdir -p /var/www/welltrack/scripts
nano /var/www/welltrack/scripts/mongo-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/www/welltrack/mongo-backups"
DATE=$(date +%Y-%m-%d)
MONGO_URI="mongodb://welltrack_admin:STRONG_PASSWORD@127.0.0.1:27017/admin?authSource=admin"

mkdir -p "$BACKUP_DIR/$DATE"

# Dump ALL databases (captures all school DBs automatically)
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/$DATE" --quiet

# Compress
tar -czf "$BACKUP_DIR/backup-$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +30 -delete

echo "$(date): Backup completed → $BACKUP_DIR/backup-$DATE.tar.gz"
```

```bash
chmod +x /var/www/welltrack/scripts/mongo-backup.sh
```

**Offsite backups:** Strongly recommended — copy nightly backups to an S3 bucket, Backblaze B2, or another server using `rclone` or `aws s3 cp`. Disk failure on a single VPS without offsite backup means total data loss.

---

### 19. Security Hardening Checklist

Before going live with real school data, verify:

- [ ] MongoDB is NOT accessible from the internet (`sudo ss -tlnp | grep 27017` — should only show `127.0.0.1:27017`)
- [ ] `backend/.env` has permissions `600` (`ls -la backend/.env`)
- [ ] `SESSION_SECRET` is a random 64-character hex string (not a word or phrase)
- [ ] `ALLOWED_ORIGINS` in `.env` lists only your exact domain(s), not `*`
- [ ] `COOKIE_SECURE=true` is set (ensures cookies only sent over HTTPS)
- [ ] Firewall only allows ports 22, 80, 443 (`sudo ufw status`)
- [ ] SSH is configured to use key-based auth (disable password auth in `/etc/ssh/sshd_config`: `PasswordAuthentication no`)
- [ ] Automatic security updates are enabled:
  ```bash
  sudo apt install -y unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```
- [ ] Nightly MongoDB backups are running (`sudo tail -5 /var/log/welltrack-backup.log`)
- [ ] SSL certificate covers both `welltrack.com.au` AND `*.welltrack.com.au` (`sudo certbot certificates`)

---

### 20. Troubleshooting Common Issues

**Backend won't start:**
```bash
sudo journalctl -u welltrack-backend -n 50 --no-pager
# Look for: ImportError, missing env var, port already in use
```

**502 Bad Gateway from Nginx:**
```bash
# Check if the backend is actually running
sudo systemctl status welltrack-backend
# If stopped: sudo systemctl start welltrack-backend
# Check it is listening on 8001:
sudo ss -tlnp | grep 8001
```

**SSL certificate error on subdomains:**
```bash
sudo certbot certificates
# Verify domains list includes *.welltrack.com.au
# If missing, re-run certbot with both -d welltrack.com.au -d *.welltrack.com.au
```

**School subdomain returns 404:**
- Check DNS wildcard A record is pointing to the server: `dig mooroopna.welltrack.com.au`
- Check the school exists in the control DB:
  ```bash
  mongosh --authenticationDatabase admin -u welltrack_admin -p "PASSWORD" --eval \
    'use welltrack_control; db.schools.find({slug: "mooroopna"}, {_id:0})'
  ```

**MongoDB connection refused:**
```bash
sudo systemctl status mongod
sudo journalctl -u mongod -n 30 --no-pager
# Common cause: /var/lib/mongodb ownership issue
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo systemctl start mongod
```

**Google OAuth "redirect_uri_mismatch" error:**
- Verify `GOOGLE_REDIRECT_URI` in `.env` exactly matches what is in Google Cloud Console (including `https://` and no trailing slash)
- Google OAuth consent screen must have `welltrack.com.au` in Authorized Domains
