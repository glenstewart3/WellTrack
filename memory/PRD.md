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
│   │   ├── AttendancePage.jsx    ✅ View only (upload moved to Settings > Imports)
│   │   ├── InterventionsPage.jsx ✅ Row-click detail modal, AI suggestions (Ollama)
│   │   ├── LoginPage.jsx
│   │   ├── MeetingPrepPage.jsx   ✅ Two tabs: Students / Tier Changes
│   │   ├── OnboardingPage.jsx
│   │   ├── ScreeningPage.jsx
│   │   ├── SettingsPage.jsx      ✅ Tabs: General/Branding/MTSS/Student Data/Imports/Integrations/Data
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

### P1 — High Priority
- None outstanding

### P2 — Medium Priority
- **Wellbeing Check-in**: Simple daily wellbeing check-in for students (on hold by user)
- **server.py Refactoring**: Split into APIRouter modules (auth, students, settings, interventions, analytics, attendance) - now 1800+ lines
- **Cohort Comparison**: Analytics page > expand cohort comparison section (endpoint exists at /api/analytics/cohort-comparison)

### P3 — Nice to Have
- Edit student modal (currently can only edit via add)
- Bulk archive/deactivate students
- Email notifications for alerts
- Screening history comparison charts on student profile
- Export all student data as CSV

---

## Known Issues / Notes
- Ollama AI suggestions require Ollama to be running locally (returns 503 if not available)
- PDF export uses browser-side jsPDF (no server dependency)
- The `school_days` collection is separate from `attendance_records` - both must be seeded correctly for the new attendance % calculation to work
