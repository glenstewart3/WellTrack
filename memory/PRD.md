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
├── backend/server.py       # Monolithic FastAPI + MongoDB (Motor async)
├── frontend/src/
│   ├── App.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── SettingsContext.jsx
│   ├── pages/
│   │   ├── AlertsPage.jsx        ✅ Two tabs: Early Warning / Tier Change
│   │   ├── AnalyticsPage.jsx     ✅ Three tabs: Overview / Attendance / Interventions
│   │   ├── AttendancePage.jsx    ✅ Per-day counting: full day=1, half day=0.5 (absent_days/total_days). [LEFT] skip, [Name] preferred name parsing
│   │   ├── InterventionsPage.jsx ✅ Row-click detail modal, AI suggestions (Ollama)
│   │   ├── LoginPage.jsx
│   │   ├── MeetingPrepPage.jsx   ✅ Two tabs: Students / Tier Changes
│   │   ├── OnboardingPage.jsx    ✅ Email-first setup (school name/term preserved after demo seed)
│   │   ├── ScreeningPage.jsx
│   │   ├── SettingsPage.jsx      ✅ Imports tab: auto-discovered absence type toggles
│   │   ├── StudentProfilePage.jsx ✅ Editable interventions/notes, attendance radar, PDF export
│   │   └── StudentsPage.jsx
│   └── utils/
│       ├── tierUtils.js
│       └── pdfExport.js          ✅ jsPDF-based exports
└── memory/PRD.md
```

---

## 3rd Party Integrations
- **Custom Google OAuth2** (authlib + SessionMiddleware)
- **openpyxl** — XLSX file parsing
- **httpx** — Ollama API calls (AI suggestions)
- **jsPDF + jspdf-autotable** — PDF generation

---

## Key DB Collections
- `students` — {student_id, first_name, preferred_name, last_name, sussi_id, external_id, class_name, year_level, teacher, ...}
- `school_settings` — {accent_color, platform_name, tier_thresholds, ollama_url, ollama_model, ai_suggestions_enabled, excluded_absence_types, ...}
- `saebrs_results` — Teacher-led SAEBRS screening results
- `saebrs_plus_results` — Student self-report results
- `attendance_records` — Exception-based records (absence/exception students only)
- `school_days` — Set of dates that were uploaded as school days
- `interventions` — {intervention_id, student_id, type, staff, status, goals, progress_notes, ...}
- `case_notes` — {case_id, student_id, note_type, notes, staff_member, date, ...}
- `alerts` — {alert_id, type: 'early_warning'|'tier_change', status: 'pending'|'approved'|'rejected', ...}
- `users` — {email, name, picture, role}

---

## Key API Endpoints
- `GET /api/public-settings` — No auth, branding fields only
- `GET /api/settings` / `PUT /api/settings` — Full settings
- `POST /api/students/import` — Import from school system CSV (SussiId-based)
- `POST /api/attendance/upload` — Exception-based attendance upload
- `GET /api/school-days` — List of uploaded school days
- `GET /api/analytics/school-wide` — Overview with tier_distribution, risk_distribution, class_breakdown
- `GET /api/analytics/attendance-trends` — Monthly trend, day-of-week, chronic absentees
- `POST /api/interventions/ai-suggest/{student_id}` — Ollama AI suggestions
- `PUT /api/case-notes/{id}` — Edit a case note
- `GET /api/meeting-prep` — Returns {students, tier_changes}
- `POST /api/settings/seed` — Load demo data

---

## What's Been Implemented (Chronological)

### Session 12 (Automatic Daily Backups)
- **APScheduler** integrated into FastAPI startup — runs `run_backup()` at midnight UTC every day
- Backup files saved to `/app/backend/backups/` as timestamped JSON snapshots of all collections
- 30-day retention: files older than 30 days auto-deleted on each backup run
- New endpoints: `GET /api/backups`, `POST /api/backups/trigger`, `GET /api/backups/download/{filename}`, `DELETE /api/backups/{filename}`
- **Settings → Data tab**: new "Automatic Daily Backups" panel — lists all backups with size/date, "Run Now" button, per-file download + admin delete
- Confirmed scheduler starts and backup creates correctly (187 KB JSON with all collections)
- **Screening History tab** (`StudentProfilePage.jsx`): Transformed from plain score cards into a full comparison view — SAEBRS Score Trend chart (with tier reference bands), Domain Comparison grouped bar chart (appears when 2+ screenings), Wellbeing Trend chart, and individual screening cards with "+N pts / -N pts" change indicators vs. previous screening
- **pytest regression suite** (`/app/backend/tests/test_welltrack_regression.py` + `conftest.py`): 47 tests covering all major routes — auth, students (CRUD + archive/reactivate cycle + status filters), analytics (all endpoints with filter params), reports (filter options, absence types, screening coverage, support gaps, staff load), CSV exports (with content-type assertion + unauthenticated access), alerts, interventions, settings, meeting prep, screening. Run with: `pytest tests/test_welltrack_regression.py -v`
- **PDF chart export** (`AnalyticsPage.jsx` + `pdfExport.js`): Export PDF now cycles through all 5 analytics tabs (Overview, Attendance, Wellbeing, Interventions, Support & Gaps), captures each chart section as a JPEG via `html2canvas`, and embeds the images in the PDF alongside data tables — fully visual and interpretable
- **Student Reactivation** (`StudentsPage.jsx` + `students.py`): Status filter pills (Active / Archived) on Students page. Selecting "Archived" loads archived students; bulk action bar switches from "Archive" to "Reactivate". New endpoint `PUT /api/students/bulk-reactivate` sets `enrolment_status: "active"` for selected IDs
- **CSV Exports in Settings** (`SettingsPage.jsx`): New "Export CSV Data" section in Settings → Data tab with 4 download buttons: Student List, Tier Summary, Screening Results, Interventions — calling existing `/api/reports/*-csv` endpoints
- **Reports page merged into Analytics**: Analytics is now "Analytics & Reports" with 6 tabs: Overview, Attendance (+ absence types), Wellbeing & SEL, Interventions, Support & Gaps, Cohort
- **Global filter bar** (Whole School / Year Level / Class) on Analytics page — all tabs re-fetch with filter applied
- **Export PDF button** in Analytics header — generates comprehensive multi-section PDF using jsPDF/autoTable
- **Nav updated**: "Analytics" → "Analytics & Reports", "Reports" nav item removed
- **`/reports` redirects to `/analytics`** — no broken links
- **`exportAnalyticsReport`** added to `/app/frontend/src/utils/pdfExport.js`

### Session 8 (Reports & Insights Overhaul + Analytics Fixes)
- **Analytics chart color fix**: "Average Domain Scores" bar chart now uses per-domain colors (purple, green, amber, blue, pink) via Recharts `Cell` components instead of all-black bars
- **Analytics scrollbar fix**: Removed negative margins on tab container that caused slight vertical overflow
- **Reports page complete overhaul** (`ReportsPage.jsx`): Transformed from simple CSV export list into a full data visualization dashboard
  - **Global filter bar**: Whole School / Year Level / Class — applies to ALL tabs
  - **Attendance tab**: Day-of-week pattern (color-coded by tier), monthly trend line, absence type breakdown, chronic absentees list
  - **Wellbeing & SEL tab**: Domain scores (colored), SAEBRS risk donut, at-risk students by domain, screening coverage by class
  - **Support & Gaps tab**: Tier 2/3 students with no intervention (actionable gap list), intervention types, staff workload bars
  - **Data Exports tab**: Existing 4 CSV download cards preserved
- **5 new backend endpoints** (all filterable by year_level/class_name):
  - `GET /api/reports/filter-options`, `GET /api/reports/absence-types`, `GET /api/reports/screening-coverage`, `GET /api/reports/support-gaps`, `GET /api/reports/staff-load`
- **Updated analytics endpoints**: `attendance-trends`, `school-wide` (+ `domain_risk` field), `intervention-outcomes` all now accept `year_level` + `class_name` filter params

### Session 7 (Mobile Responsiveness + Student Management)
- **Fixed critical compilation error**: Orphaned JSX in `MeetingPrepPage.jsx` (caused app to crash on load)
- **AlertsPage mobile fixes**:
  - Tab bar now scrollable (`overflow-x-auto`) with short labels on mobile
  - Active/Resolved toggle moved below tabs (separate row)
  - Action buttons (Approve/Reject/Mark Read) moved inside flex-1 div, below content — no more squishing
  - Same fix applied to both `AlertCard` and the inline Tier Changes card
- **MeetingPrepPage Tier Changes tab**: Tier badges + Improved/Declined + Profile link now wrap below student name using `flex-wrap`, preventing horizontal overflow
- **Edit Student modal**: Pencil icon on each row opens pre-filled edit modal. `PUT /api/students/{student_id}` backend endpoint added.
- **Bulk Archive**: Checkbox column on student table + floating action bar. `PUT /api/students/bulk-archive` backend endpoint added.
- **Global mobile overflow audit**: All main pages verified at 390px — no horizontal scroll

### Session 6 (server.py Refactor)
- Split 2115-line monolithic `server.py` into 10 focused modules under `/app/backend/routes/` plus `database.py`, `helpers.py`, `models.py`, `seed.py`
- New `server.py` is 61 lines — pure entry point, no business logic
- No endpoint changes; all 11 core endpoints verified passing after refactor
- **Root cause fixed**: Old stale `/api/attendance/{student_id}` route (using obsolete `db.attendance` collection) was shadowing all new attendance endpoints (`/attendance/summary`, `/attendance/student/{student_id}`, `/attendance/types`). Removed the two dead routes.
- **Enhanced summary**: Added `absent_sessions` and `total_sessions` to the attendance summary response (was missing, showed `—` in UI). Refactored `get_student_attendance_pct` into `get_student_attendance_stats` returning all three metrics in one pass.
- **Alert count in UI**: Attendance upload result panel now shows "N alerts auto-generated" when attendance alerts are created.
- **Cohort Comparison Analytics**: New "Cohort Comparison" tab on Analytics page with year_level/class dropdown; shows tier distribution, avg attendance, and SAEBRS risk charts per cohort. Backend `/api/analytics/cohort-comparison?group_by=year_level|class_name`.
- **Automated Attendance Alerts**: Attendance upload now auto-generates early_warning alerts for students below 80% (high severity) or 90% (medium severity). Resolves existing alerts if attendance recovers.
- **Seed Data Overhaul**: Removed 200+ lines of dead code; seed now generates 55 school days (Feb–May 2025), Camp/Excursion excluded absences, half-day records, completed interventions, and tier-change alerts.
- **Analytics Overview Fix**: Re-seeded DB ensures tier_distribution shows real data (Tier1:11, Tier2:9, Tier3:12).
- **server.py cleanup**: Reduced from 2244 → 2115 lines by removing dead unreachable code block.

### Session 1–2 (Initial Build)
- Google OAuth authentication
- Onboarding wizard
- Student management (add, import basic CSV)
- SAEBRS screening workflow (class-based → student-by-student)
- SAEBRS+ self-report
- Settings page (branding, MTSS thresholds, intervention types)
- Screener role with limited permissions

### Session 3 (Attendance + Alerts)
- Attendance upload module (XLSX/CSV)
- Automatic tiering based on attendance %
- Alert system: tier changes + early warnings
- Alert approval/rejection flow
- Renamed SAEBRS+ to "Student Self-Report"

### Session 4 (Large Feature Batch)
- **P0 Fix**: Accent color stale-init bug in BrandingTab (useEffect sync)
- **Student Import Rework**: New CSV format with SussiId, PreferredName, Surname, FormGroup
  - Display: `FirstName (PreferredName) LastName` throughout the app
  - Moved to Settings > Imports tab
- **Attendance Rework**:
  - Exception-based upload (unlisted students = present)
  - `school_days` collection tracks uploaded dates
  - "Present" status = half-day attendance
  - Excluded absence types (configurable in Settings > Imports)
  - Attendance domain restored to student radar chart
  - Moved to Settings > Imports tab
- **Ollama AI Suggestions**:
  - `POST /api/interventions/ai-suggest/{student_id}` via Ollama
  - Settings > Integrations tab: URL, model, enable/disable toggle
- **Interventions Page**:
  - Row-click → detail modal (view + update progress/status)
  - Removed "Pause" button
  - AI suggestions panel with Ollama note
  - PDF export button
- **Alerts Page**: Two tabs — Early Warnings / Tier Changes
- **MTSS Meeting Page**: Added Tier Changes tab (students who moved tiers)
- **Analytics**: Three tabs — Overview (with tier_distribution, risk_distribution, class_breakdown), Attendance (monthly trend, day-of-week, chronic absentees), Interventions (by type, completion rates)
- **Student Profile**:
  - Inline editable interventions (click Edit button)
  - Inline editable case notes (click Edit button)
  - Preferred name display
  - PDF export button
- **PDF Exports**: `pdfExport.js` with exportStudentProfile, exportInterventionsReport, exportMeetingReport using jsPDF
- **Demo Data**: Updated seed with sussi_id, preferred_name, exception-based attendance, tier_change alerts

---

## Prioritized Backlog

### P0 — None

### P1 — Upcoming
- Email system (deferred by user): automated alert notifications — needs email provider choice (Resend or SendGrid)

### P2 — Medium Priority
- **Wellbeing Check-in**: Simple daily wellbeing check-in for students (on hold by user)
- **Automated Weekly Backups**: Email a weekly data backup to the admin
- **pytest test suite**: Full backend test coverage (partial coverage added in iteration 8)

### P3 — Nice to Have
- Email notifications for alerts
- Screening history comparison charts on student profile
- Export all student data as CSV filtered by cohort

---

## Known Issues / Notes
- Ollama AI suggestions require Ollama to be running locally (returns 503 if not available)
- PDF export uses browser-side jsPDF (no server dependency)
- The `school_days` collection is separate from `attendance_records` - both must be seeded correctly for the new attendance % calculation to work
