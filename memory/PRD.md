# MTSS WellTrack Platform — PRD

## Project Overview
School MTSS (Multi-Tiered System of Supports) platform integrating SAEBRS behavioural screening and WellTrack wellbeing system. Supports screening, risk identification, intervention tracking, and wellbeing analytics.

**Last Updated:** 2026-02-01  
**Status:** MVP Complete

---

## Architecture

### Backend (FastAPI + MongoDB)
- **server.py** — Complete FastAPI backend with all routes
- **Database:** MongoDB (test_database)
- **Auth:** Emergent Google OAuth
- **AI:** Claude Sonnet (Anthropic) via emergentintegrations

### Frontend (React)
- **App.js** — Main routing with AuthProvider
- **context/AuthContext.jsx** — Auth state management
- **components/DashboardLayout.jsx** — Sidebar layout
- **utils/tierUtils.js** — Tier color/label utilities

---

## User Personas
1. **Teacher** — Completes SAEBRS screenings, views Class Risk Radar
2. **Wellbeing Staff** — Manages interventions, writes case notes, views all students
3. **Leadership** — Views school-wide analytics, meeting prep, reports
4. **Administrator** — Full access + settings management

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
**Modules:**
1. ✅ Universal Screening (SAEBRS + SAEBRS+) — Full 19-item SAEBRS form + 7-item self-report
2. ✅ Student Wellbeing Profiles — Charts, interventions, case notes in one page
3. ✅ Tier Classification Engine — Auto-computes tier from SAEBRS + wellbeing + attendance
4. ✅ Intervention Management — CRUD + AI suggestions (Claude Sonnet)
5. ✅ Case Management — Add/view case notes per student
6. ✅ Progress Monitoring — SAEBRS trend charts, wellbeing radar charts
7. ✅ School-Wide Analytics — Tier distribution, class heatmap, domain averages
8. ✅ Alerts & Early Warning System — Auto-generated for high risk/low attendance
9. ✅ Classroom Risk Radar — Colour-coded class view with risk indicators
10. ✅ MTSS Meeting Tools — Meeting prep page with export
11. ✅ Reports & CSV Export — 4 report types
12. ✅ Google OAuth Authentication
13. ✅ Demo Data Auto-Seed (32 students, 4 classes)
14. ✅ Settings — School context, data wipe, demo reload
15. ✅ Cohort Comparison — Class vs school average analytics

**User Choices:**
- Authentication: Google OAuth (Emergent)
- Demo data pre-populated + wipe button in settings
- AI-generated intervention suggestions (Claude Sonnet 4.5)
- CSV export only
- Selectable school context (Primary, Secondary, Both)
- Cohort comparison included

---

## Prioritized Backlog

### P0 (Critical for core workflow)
- [ ] Bulk CSV import for SAEBRS scores
- [ ] Notification system (email alerts for tier changes)

### P1 (High value features)
- [ ] Parent portal (read-only wellbeing view)
- [ ] Progress monitoring charts (attendance trend over time)
- [ ] Multi-teacher class assignment
- [ ] Intervention goal tracking with RAG status

### P2 (Nice to have)
- [ ] Mobile PWA for tablet screening
- [ ] AI case note summarisation
- [ ] NAPLAN/external data integration
- [ ] Custom alert thresholds per school

---

## Demo Data
- **School:** Riverside Community School
- **Classes:** Year 3A (Ms Thompson), Year 5B (Mr Rodriguez), Year 7C (Ms Chen), Year 9A (Mr Williams)
- **Students:** 32 students (8 per class) with mixed risk profiles
- **Screening periods:** Term 1 2025 + Term 2 2025
- **Interventions:** Active for Tier 2 + Tier 3 students
- **Alerts:** Pre-generated for high-risk students
