# WellTrack — MTSS Platform PRD

## Original Problem Statement
Build a School MTSS (Multi-Tiered System of Supports) platform named **WellTrack** that integrates:
- A behavioral screener (SAEBRS) completed by teachers
- A student self-report wellbeing system (SAEBRS+)
- Attendance tracking with tiering
- Intervention management
- Analytics and reporting

---

## Core User Personas
- **Admin**: Full access — settings, imports, data management
- **Leadership**: Reports, meeting prep, alerts approval
- **Wellbeing Staff**: Interventions, case notes, AI suggestions
- **Screener/Teacher**: Complete screenings for their class

---

## Architecture
```
/app/
├── backend/server.py       # FastAPI entry point (61 lines) — mounts all routers, creates MongoDB indexes at startup
├── backend/database.py     # Motor client + constants
├── backend/helpers.py      # Auth, scoring, attendance calc, batch DB helpers
├── backend/models.py       # Pydantic models
├── backend/seed.py         # Demo data seeder
├── backend/routes/
│   ├── analytics.py        ✅ All N+1 queries eliminated (batch aggregation)
│   ├── attendance.py       ✅ Batch attendance summary + alert generation
│   ├── auth.py             ✅ Email/password + Google OAuth
│   ├── backups.py          ✅ Daily JSON backups via APScheduler
│   ├── interventions.py    ✅ CRUD + Ollama AI suggestions
│   ├── reports.py          ✅ Batch CSV export + analytics endpoints
│   ├── screening.py        ✅ SAEBRS + SAEBRS+ submission
│   ├── settings.py         ✅ Terms/calendar, demo seed, absence types
│   ├── students.py         ✅ Batch summary endpoint
│   └── alerts.py           ✅ Alert approval/rejection
├── frontend/src/
│   ├── App.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── SettingsContext.jsx
│   ├── pages/
│   │   ├── AlertsPage.jsx        ✅ Two tabs: Early Warning / Tier Change
│   │   ├── AnalyticsPage.jsx     ✅ 6 tabs + global filter + PDF export
│   │   ├── AttendancePage.jsx    ✅ Exception-based upload, AM/PM dedup, [LEFT] skip, preferred names
│   │   ├── InterventionsPage.jsx ✅ Row-click detail modal, AI suggestions (Ollama)
│   │   ├── LoginPage.jsx
│   │   ├── MeetingPrepPage.jsx   ✅ Students / Tier Changes tabs
│   │   ├── OnboardingPage.jsx    ✅ Email-first setup, demo student count
│   │   ├── ScreeningPage.jsx
│   │   ├── SettingsPage.jsx      ✅ Calendar tab (Terms), Imports, absence type toggles
│   │   ├── StudentProfilePage.jsx ✅ Screening history charts, PDF export
│   │   └── StudentsPage.jsx      ✅ Archive/reactivate, bulk actions
│   └── utils/
│       ├── tierUtils.js
│       └── pdfExport.js          ✅ Multi-tab analytics PDF
└── memory/PRD.md
```

---

## 3rd Party Integrations
- **Custom Google OAuth2** (authlib + SessionMiddleware)
- **openpyxl** — XLSX file parsing
- **httpx** — Ollama API calls (AI suggestions)
- **jsPDF + jspdf-autotable** — PDF generation
- **APScheduler** — Daily automated backups

---

## Key DB Collections
- `students` — {student_id, first_name, preferred_name, last_name, sussi_id, external_id, class_name, year_level, teacher, ...}
- `school_settings` — {accent_color, platform_name, tier_thresholds, excluded_absence_types, terms: [{name, start_date, end_date, non_school_days}], ...}
- `saebrs_results` — Teacher-led SAEBRS screening results
- `saebrs_plus_results` — Student self-report results
- `attendance_records` — Exception-based records (absent students only) indexed on student_id + date
- `school_days` — Set of term dates (from Settings → Calendar)
- `interventions` — {intervention_id, student_id, type, staff, status, goals, progress_notes, ...}
- `case_notes` — {case_id, student_id, note_type, notes, staff_member, date, ...}
- `alerts` — {alert_id, type: 'early_warning'|'tier_change', status: 'pending'|'approved'|'rejected', ...}
- `users` — {email, name, picture, role, password_hash}

---

## Key API Endpoints
- `GET /api/public-settings` — No auth, branding fields only
- `GET /api/settings` / `PUT /api/settings` — Full settings
- `POST /api/students/import` — Import from school system CSV (SussiId-based)
- `GET /api/students/summary` — Students list with tier/attendance/saebrs (batch-optimized)
- `POST /api/attendance/upload` — Exception-based attendance upload (robust CSV/XLSX parser)
- `GET /api/school-days` — List of uploaded school days
- `GET /api/analytics/school-wide` — Overview with tier_distribution, risk_distribution (batch-optimized)
- `GET /api/analytics/attendance-trends` — Monthly trend, day-of-week, chronic absentees (batch-optimized)
- `GET /api/analytics/tier-distribution` — Tier counts (batch-optimized)
- `GET /api/analytics/cohort-comparison` — Cohort breakdown (batch-optimized)
- `GET /api/meeting-prep` — Returns {students, tier_changes} (batch-optimized)
- `POST /api/interventions/ai-suggest/{student_id}` — Ollama AI suggestions
- `GET /api/reports/support-gaps` — Students needing intervention (batch-optimized)
- `GET /api/reports/screening-coverage` — Coverage by class (batch-optimized)
- `GET /api/reports/tier-summary-csv` — CSV export (batch-optimized)
- `POST /api/settings/seed` — Load demo data (accepts student_count)
- `GET /api/settings/terms` / `POST /api/settings/terms` — Manage calendar terms

---

## What's Been Implemented (see CHANGELOG.md for details)
- ✅ Google OAuth + Email/Password authentication
- ✅ Onboarding wizard
- ✅ Student management (add, import CSV, edit, archive/reactivate)
- ✅ SAEBRS screening workflow
- ✅ SAEBRS+ self-report
- ✅ Attendance tracking — robust XLSX/CSV parser, exception-based, AM/PM dedup
- ✅ Term-based calendar (Settings → Calendar) for accurate attendance %
- ✅ Automatic tiering from attendance + SAEBRS
- ✅ Alert system (tier changes + early warnings)
- ✅ Interventions with Ollama AI suggestions
- ✅ Analytics & Reports — 6 tabs, global filter, PDF export
- ✅ MTSS Meeting Prep page
- ✅ Student Profile with screening history charts
- ✅ Automated daily JSON backups (APScheduler, 30-day retention)
- ✅ Configurable demo data (specify student count)
- ✅ Absence type toggles (exclude from attendance calculation)
- ✅ **N+1 query elimination** — all multi-student endpoints use batch DB queries
- ✅ **MongoDB indexes** — on student_id, date, status for fast queries
- ✅ **Multi-year calendar support** — each school year's terms/school_days stored independently; editing 2026 terms cannot affect 2025 attendance data; attendance % always scoped to `current_year` from settings; Calendar tab shows year selector with "New Year" button
- ✅ **Preset Terms 1-4 UI** (Feb 2026) — Calendar tab simplified to 4 fixed rows (Term 1–4) with inline Start/End date inputs; removed dynamic Add/Delete Term UI
- ✅ **Attendance upload CSV-only** (Feb 2026) — Removed XLSX support from upload; frontend accept and backend parser CSV-only
- ✅ **Import Identifier priority** (Feb 2026) — Student import now uses Import Identifier (col A) as primary SussiId source
- ✅ **Tab nav redesign + delete buttons** (Feb 2026) — Settings tabs now use pill/segmented-control style with lucide icons; added Delete Student Data and Delete Attendance Data buttons with confirmation modals in Data tab
- ✅ **Attendance period filter + settings restructure** (Feb 2026) — Attendance page has year selector + YTD/Full Year/Term 1-4/Month/Week period pills; table AND student modal reflect the selected period. Absence Type Settings moved from Imports → MTSS & Screening tab.
- ✅ **Multi-year attendance + UI overhaul** (Feb 2026) — available_years includes years from attendance_records; period filter changed to dropdown; bi-weekly trend chart (70-100% Y-axis); TierBadge whitespace-nowrap; attendance table hides Class/Absent on mobile; UserManagement page has mobile card layout; student edit modal DOB field stacks on mobile.
- ✅ **Attendance calculation fallback fix** (Mar 2026) — No school_days in DB: now uses all unique attendance_record dates as proxy school days instead of broken per-student fallback. All 229 students show has_data=True with realistic percentages (avg 87.4%). `compute_att_stats` uses `is not None` guard. Excluded types applied correctly in all paths.
- ✅ **No calendar configured banner** (Mar 2026) — Amber banner on Attendance page when school_days_count = 0 with link to Settings → Calendar. Auto-hides once calendar is saved.
- ✅ **User-specific themes** (Mar 2026) — 6 themes: Slate (default), Ocean, Forest, Warm, Dark, Midnight. Stored per-user in DB via `PUT /api/auth/preferences`. Applied via `data-theme` on `<html>`. Theme picker: 6 colored swatches in sidebar footer. Dark/Midnight: full dark mode. Light themes (Ocean/Forest/Warm): colored sidebar + tinted page background. Active nav color per theme.
- ✅ **Screener user role** (Mar 2026) — New role restricted to Screening page only. Nav shows only Screening item. Route guard redirects any non-/screening URL to /screening. Lands on /screening on login. Indigo badge. Role selectable in User Management.

|- ✅ **Student Photo Upload** (Mar 2026) — Bulk photo upload via ZIP. Filename format: `LastName, FirstName.jpg`. Staff folders auto-skipped. Strict case-insensitive exact name matching. Photos resized (max 400×400, JPEG q82) and saved to `/app/uploads/student_photos/{student_id}.jpg`. Served via FastAPI StaticFiles at `/api/student-photos/`. `photo_url` stored per student in DB. Avatars shown in Students list and Student Profile header; falls back to initials if no photo.
|- ✅ **Remove Photo from edit modal** (Mar 2026) — Student edit modal shows photo preview (or initials if none). "Remove photo" button calls `DELETE /api/students/{student_id}/photo`, deletes file from disk, clears `photo_url` from DB. Modal updates in-place immediately.
|- ✅ **Individual photo upload in edit modal** (Mar 2026) — Clicking the photo avatar in the edit modal opens a file picker (upload or replace). Camera icon overlay on hover. X button in corner to remove. `POST /api/students/{student_id}/photo` resizes and saves. Updates in-place instantly.
|- ✅ **Separate Light/Dark logo upload** (Mar 2026) — Settings → Branding has two uploaders (Light logo, Dark logo). `logo_dark_base64` added to `SETTINGS_DEFAULTS` and `public_settings` endpoint. `DashboardLayout` and `LoginPage` both conditionally render the dark logo when dark theme is active, falling back to the light logo if no dark logo is set.

---

## Prioritized Backlog

### P0 — None (all critical issues resolved)
- ✅ **Settings tabs reorganization** (Mar 2026) — Interventions tab added with intervention library. Absence Types config moved to Student Data tab. InterventionsTab wired into main render. `Target` icon import fixed.
- ✅ **XLSX attendance upload performance** (Mar 2026) — `read_only=True` + `values_only=True` for openpyxl; batch `delete_many` + single `insert_many` replace per-record `delete_one` loops. Upload time drastically reduced.
- ✅ **Preset Terms 1-4 UI** — Calendar tab now shows 4 fixed rows with inline date inputs; no Add/Delete Term buttons
- ✅ **Attendance calculation fallback fix** (Mar 2026) — When no school_days in DB, uses all unique attendance record dates as proxy denominator.

### P1 — Upcoming
- Email system (deferred by user): automated alert notifications — needs email provider choice (Resend or SendGrid)

### P2 — Medium Priority
- **Chronic absentee badge** on Students page (>10% absence within a term)
- **Wellbeing Check-in**: Simple daily wellbeing check-in for students (on hold by user)
- **Automated Weekly Backups**: Email a weekly data backup to the admin

### P3 — Nice to Have
- Email notifications for alerts
- Update self-hosted deployment guide for new auth system
- Export all student data as CSV filtered by cohort

---

## Known Issues / Notes
- Ollama AI suggestions require Ollama to be running locally (returns 503 if not available)
- PDF export uses browser-side jsPDF (no server dependency)
- The `school_days` collection is populated via Settings → Calendar terms, not from attendance uploads
