# WellTrack — MTSS Wellbeing Platform PRD

**Last Updated:** 2026-03-18
**Status:** Active Development — Large batch of features completed

---

## Problem Statement
A school MTSS platform for screening, risk identification, intervention tracking and analytics. Supports SAEBRS screening, Student Self-Report, attendance tracking, tiering logic, and wellbeing analytics.

---

## User Roles
| Role | Access |
|------|--------|
| Teacher | Screening (SAEBRS + Self-Report), own class data |
| Screener | SAEBRS + Self-Report screening only |
| Wellbeing Staff | Interventions, case notes, alerts, tier change approval |
| Leadership | Analytics, attendance upload, meeting prep, tier change approval |
| Administrator | Full access + user management, settings, attendance types |

---

## Core Modules / Pages
- **Dashboard** — overview with tier distribution
- **Screening** — SAEBRS and Student Self-Report (separate workflows)
- **Students** — list, search, filter, Add Student, Import Students
- **Student Profile** — SAEBRS trend (tier bands + domain toggle), Self-Report, interventions, case notes
- **Class Risk Radar** — class-level overview
- **Analytics** — school-wide analytics
- **Attendance** — XLSX/CSV upload, per-student % with tier bands, absence patterns (admin/leadership only)
- **Interventions** — active/completed interventions
- **Alerts** — early warning, tier change (with Approve/Reject), emotional distress
- **MTSS Meeting** — meeting prep
- **Reports** — downloadable reports
- **Settings** — branding, MTSS logic, users, intervention types
- **User Management** — admin only

---

## What's Been Implemented

### MVP (2026-03)
- Full auth with custom Google OAuth (Authlib → then replaced with manual httpx flow)
- MongoDB-backed OAuth state (fixes CSRF issue in K8s proxy)
- Onboarding wizard for first admin
- All core pages and navigation

### Auth P0 Fix (2026-03-16)
- Fixed `mismatching_state` CSRF error via MongoDB-backed state store
- Fixed `UnboundLocalError` in callback

### Large Feature Batch (2026-03-18)
- **Removed**: Made with Emergent badge, AI Intervention Suggestions, Your Role from Settings, attendance field from SAEBRS screener
- **Fixed**: Accent color not persisting (`PUT /api/settings` now accepts full dict, no longer strips branding fields), Settings tab scrollbar
- **New Screening Workflow**: Mode selection (SAEBRS vs Self-Report) → Class/Term → individual student form
  - SAEBRS: Teacher screens whole class sequentially (no attendance field)
  - Self-Report: Teacher picks individual student from class list
- **Student Profile**: SAEBRS Score Trend now has colour-coded Tier 1/2/3 background bands + Total/Domains toggle
- **Wellbeing Domain Profile**: Attendance domain removed (4 domains: Social, Academic, Emotional, Belonging)
- **Attendance Module**: New page (admin/leadership only), XLSX/CSV upload (parses ID, Date, AM, PM columns), per-student % with tier badges, monthly trend chart, absence pattern breakdown, auto-discovers new absence types from uploads
- **Tier Change Alerts**: Auto-generated when SAEBRS result changes student's tier; visible in Alerts page with Approve/Reject buttons for wellbeing/leadership/admin
- **Add Student**: Single student add modal alongside Import Students button
- **Screener Role**: New role for staff whose only job is screening
- **Reset to Defaults**: Button in Settings MTSS tab for tier thresholds
- **Intervention Types**: Add/remove from Settings (already existed, confirmed working)

---

## Architecture

```
/app/
├── backend/
│   ├── .env              # MONGO_URL, DB_NAME, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL, SESSION_SECRET
│   ├── requirements.txt  # includes openpyxl==3.1.5
│   └── server.py         # Monolithic FastAPI (~1400 lines)
├── frontend/
│   ├── .env              # REACT_APP_BACKEND_URL
│   └── src/
│       ├── App.js
│       ├── components/DashboardLayout.jsx
│       ├── context/AuthContext.jsx, SettingsContext.jsx
│       └── pages/
│           ├── AttendancePage.jsx  (NEW)
│           ├── ScreeningPage.jsx   (rewritten)
│           ├── StudentProfilePage.jsx
│           ├── StudentsPage.jsx
│           ├── AlertsPage.jsx
│           ├── SettingsPage.jsx
│           └── ...
└── memory/PRD.md
```

---

## Key DB Collections
- `users` — email, name, picture, role
- `school_settings` — platform_name, accent_color, logo_base64, tier_thresholds, modules_enabled, intervention_types, absence_types
- `students` — student_id, first_name, last_name, year_level, class_name, teacher, external_id (for attendance matching)
- `saebrs_results` — per-student screening results
- `saebrs_plus_results` — per-student self-report results
- `interventions` — active/completed interventions
- `case_notes` — case notes per student
- `alerts` — early warning + tier change alerts (pending_approval field)
- `attendance_records` — parsed from uploaded XLSX/CSV (student_id, date, am_status, pm_status)
- `oauth_states` — short-lived OAuth state for CSRF protection
- `user_sessions` — session tokens

---

## Key API Endpoints
- `GET/POST /api/auth/google` — OAuth login redirect
- `GET /api/auth/callback` — OAuth callback (no Starlette sessions; uses MongoDB state)
- `GET /api/onboarding/status`
- `POST /api/onboarding/complete`
- `GET /api/public-settings`
- `GET/PUT /api/settings` — full school settings (PUT now accepts raw dict)
- `GET /api/students` — list with filters
- `POST /api/students` — create single student
- `POST /api/students/import` — bulk CSV import
- `PUT /api/students/{id}/external-id` — link to attendance system ID
- `POST /api/attendance/upload` — XLSX/CSV upload
- `GET /api/attendance/summary` — per-student attendance % and tier
- `GET /api/attendance/student/{id}` — detailed attendance with monthly trend
- `GET/PUT /api/attendance/types` — manage absence type list
- `POST /api/screening/saebrs` — submit SAEBRS result
- `POST /api/screening/saebrs-plus` — submit Self-Report result
- `PUT /api/alerts/{id}/approve` — approve tier change
- `PUT /api/alerts/{id}/reject` — reject tier change

---

## P0/P1/P2 Backlog

### P0 — Resolved
- Auth CSRF fix ✅
- Accent color save bug ✅
- Screening page runtime error ✅

### P1 — In Progress / Remaining
- [ ] Progress monitoring graphs in Student Profile (not yet implemented)
- [ ] Cohort comparison in Analytics
- [ ] Classroom Risk Radar — advanced sorting/filtering

### P2 — Future
- [ ] PDF export for reports
- [ ] MTSS Meeting Support page with export
- [ ] Email notifications for non-whitelisted login attempts
- [ ] External ID bulk assignment (e.g., map CSV with name→external_id)
- [ ] NAPLAN / external data integration
