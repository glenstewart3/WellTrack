# WellTrack — MTSS Wellbeing Platform PRD

## Project Overview
School MTSS (Multi-Tiered System of Supports) platform integrating SAEBRS behavioural screening and WellTrack wellbeing system. Supports screening, risk identification, intervention tracking, and wellbeing analytics.

**Last Updated:** 2026-03-14  
**Status:** Feature Complete (MVP + P0 fixes + P1 features)

---

## Architecture

### Backend (FastAPI + MongoDB)
- **server.py** — Monolithic FastAPI backend with all routes
- **Database:** MongoDB
- **Auth:** Emergent-managed Google OAuth (whitelist-only login)
- **Key fix:** All `insert_one()` calls use `{**d}` spread pattern to avoid ObjectId serialization bug

### Frontend (React + TailwindCSS)
- **App.js** — Main routing with AuthProvider
- **context/AuthContext.jsx** — Auth state management
- **components/DashboardLayout.jsx** — Sidebar layout (admin-only User Management link)
- **utils/tierUtils.js** — Tier color/label utilities, school year constants

---

## User Personas
1. **Teacher** — Completes SAEBRS screenings, views Class Risk Radar
2. **Wellbeing Staff** — Manages interventions, writes case notes, views all students
3. **Leadership** — Views school-wide analytics, meeting prep, reports
4. **Administrator** — Full access + user management + data backup/restore

---

## Core Requirements (Static)

### Tier Classification
- **Tier 1 (Low Risk):** SAEBRS total 37-57 AND wellbeing 50-66 AND attendance ≥90%
- **Tier 2 (Emerging):** SAEBRS some risk OR wellbeing 35-49 OR attendance <90%
- **Tier 3 (High Risk):** SAEBRS high risk OR wellbeing 0-34 OR attendance <80%

### SAEBRS Score Ranges
- Social: 0-18 | Academic: 0-18 | Emotional: 0-21 | Total: 0-57

### SAEBRS+ Wellbeing Score (max ~66)
- Social domain: 0-18 (from SAEBRS)
- Academic domain: 0-18 (from SAEBRS)
- Emotional domain: 0-9 (3 self-report items)
- Belonging domain: 0-12 (4 self-report items)
- Attendance domain: 0-9 (attendance % scaled)

---

## What's Been Implemented

### 2026-02-01 — MVP Launch
1. ✅ Universal Screening (SAEBRS + SAEBRS+) — Full 19-item form + 7-item self-report
2. ✅ Student Wellbeing Profiles — Charts, interventions, case notes
3. ✅ Tier Classification Engine — Auto-computes tier from SAEBRS + wellbeing + attendance
4. ✅ Intervention Management — CRUD + AI suggestions (Claude Sonnet fallback)
5. ✅ Case Management — Add/view case notes per student
6. ✅ Progress Monitoring — SAEBRS trend charts, wellbeing radar charts
7. ✅ School-Wide Analytics — Tier distribution, class heatmap, domain averages
8. ✅ Alerts & Early Warning System — Auto-generated for high risk/low attendance
9. ✅ Classroom Risk Radar — Colour-coded class view with risk indicators
10. ✅ MTSS Meeting Tools — Meeting prep page
11. ✅ Reports & CSV Export — 4 report types
12. ✅ Google OAuth Authentication (whitelist-only)
13. ✅ Demo Data Auto-Seed (32 students, 4 classes, 2 screening periods)
14. ✅ Settings — School context, data wipe, demo reload
15. ✅ Cohort Comparison — Class vs school average analytics

### 2026-03-14 — P0 Fixes + P1 Features

**P0 - Critical Fixes:**
- ✅ Fixed Start Screening bug — Added error feedback (startError state) in ScreeningPage
- ✅ App title changed to "WellTrack — MTSS Wellbeing Platform"
- ✅ Settings Export All Data button (GET /api/settings/export-all → JSON download)
- ✅ Settings Restore Data button (POST /api/settings/restore → admin only, file upload)
- ✅ Settings role section: admin users get role-switching buttons; non-admins get read-only view
- ✅ User Management page fully integrated (route, nav link admin-only, CRUD)

### 2026-03-16 (2) — Onboarding Wizard + Custom Google Auth

**Onboarding flow (first-time setup):**
- ✅ No more auto-seeded demo data on startup — clean slate
- ✅ First Google login auto-registers as school administrator (no whitelist needed for first user)
- ✅ Multi-step wizard: Welcome → School Details → Data Setup → Complete
- ✅ School Details: school name, type (Primary/Secondary/K-12), current term
- ✅ Data Setup: Load Demo Data / Restore from Backup / Start from Scratch
- ✅ After completion: `onboarding_complete: true` in school_settings → normal app loads
- ✅ `/api/onboarding/status` (public) + `/api/onboarding/complete` (admin) endpoints
- ✅ App.js gates all routes behind onboarding check

**Auth Migration:**
- ✅ Replaced Emergent-managed auth with standard Google OAuth 2.0 (authlib + Starlette SessionMiddleware)
- ✅ New flow: `/api/auth/google` → Google consent screen → `/api/auth/callback` → session cookie → dashboard
- ✅ Backend reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL, SESSION_SECRET from env
- ✅ Error redirects: `?error=access_denied`, `?error=auth_failed` → login page shows friendly message
- ✅ Whitelist check preserved: only users in DB can log in
- ✅ Session cookie pattern unchanged (MongoDB user_sessions collection)

**Screening:**
- ✅ 4 terms per year (Term 1–4) in screening period selector
- ✅ Analytics page — School Context filter badge (Primary K-6 / Secondary 7-12 / K-12)
- ✅ Progress Monitoring — SAEBRS trend chart now shows risk threshold reference lines (y=37 Low Risk, y=24 High Risk)

---

## Key API Endpoints
- `GET /api/auth/me` — Current user info
- `POST /api/auth/session` — Process OAuth session (whitelist check)
- `GET /api/users` — (Admin) List all users
- `POST /api/users` — (Admin) Add user to whitelist
- `PUT /api/users/{user_id}/role` — (Admin) Change user role
- `DELETE /api/users/{user_id}` — (Admin) Remove user
- `GET /api/settings/export-all` — Export all data as JSON backup
- `POST /api/settings/restore` — (Admin) Restore data from JSON backup
- `POST /api/screening/sessions` — Create screening session
- `POST /api/screening/saebrs` — Submit SAEBRS results
- `POST /api/screening/saebrs-plus` — Submit wellbeing self-report
- `GET /api/analytics/cohort-comparison` — Cohort vs school comparison

---

## Demo Data
- **School:** Riverside Community School
- **Classes:** Year 3A (Ms Thompson), Year 5B (Mr Rodriguez), Year 7C (Ms Chen), Year 9A (Mr Williams)
- **Students:** 32 students (8 per class) with mixed risk profiles
- **Screening periods:** Term 1 2025 + Term 2 2025
- **Default admin:** admin@school.edu.au (must be whitelisted in DB)

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Bulk CSV import for SAEBRS scores

### P1 (High value)
- [ ] Intervention goal tracking with RAG (Red/Amber/Green) status
- [ ] Progress monitoring — attendance trend over time chart
- [ ] Multi-teacher class assignment

### P2 (Nice to have)
- [ ] PDF export for reports
- [ ] MTSS Meeting Support page with export
- [ ] Mobile PWA for tablet screening
- [ ] AI case note summarisation
- [ ] Parent portal (read-only wellbeing view)
- [ ] Custom alert thresholds per school
- [ ] NAPLAN/external data integration
