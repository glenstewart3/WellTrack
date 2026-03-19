"""
test_welltrack_regression.py
Comprehensive regression suite for the WellTrack MTSS backend.

Run from /app/backend/tests:
    REACT_APP_BACKEND_URL=https://... pytest test_welltrack_regression.py -v

Or from /app/backend:
    pytest tests/test_welltrack_regression.py -v
"""
import pytest
import requests


# ─── AUTH ────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_me_authenticated(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert "email" in d
        assert "role" in d

    def test_me_unauthenticated(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/auth/me")
        assert r.status_code in (401, 403)


# ─── STUDENTS ────────────────────────────────────────────────────────────────

class TestStudents:
    def test_list_active(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "student_id" in data[0]

    def test_list_active_status_param(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students?status=active")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_archived_status_param(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students?status=archived")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_filter_by_year_level(self, auth_session, base_url):
        opts = auth_session.get(f"{base_url}/api/reports/filter-options").json()
        if opts.get("year_levels"):
            r = auth_session.get(f"{base_url}/api/students?year_level={opts['year_levels'][0]}")
            assert r.status_code == 200

    def test_summary_active(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students/summary")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Summary includes computed fields
        assert "mtss_tier" in data[0]

    def test_summary_archived(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students/summary?status=archived")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_individual_student(self, auth_session, base_url, first_student_id):
        r = auth_session.get(f"{base_url}/api/students/{first_student_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["student_id"] == first_student_id

    def test_student_profile(self, auth_session, base_url, first_student_id):
        r = auth_session.get(f"{base_url}/api/students/{first_student_id}/profile")
        assert r.status_code == 200
        d = r.json()
        assert "student" in d
        assert "mtss_tier" in d
        assert "interventions" in d
        assert "case_notes" in d

    def test_student_not_found(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/students/nonexistent_id_xyz")
        assert r.status_code == 404

    def test_unauthenticated_students(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/students")
        assert r.status_code in (401, 403)

    def test_archive_reactivate_cycle(self, auth_session, base_url):
        """Archive a student then reactivate — full round-trip."""
        r = auth_session.get(f"{base_url}/api/students?status=active")
        students = r.json()
        if not students:
            pytest.skip("No active students to test with")

        sid = students[0]["student_id"]

        # Archive
        r = auth_session.put(f"{base_url}/api/students/bulk-archive",
                             json={"student_ids": [sid]})
        assert r.status_code == 200
        assert r.json().get("archived") == 1

        # Confirm in archived list
        archived = auth_session.get(f"{base_url}/api/students?status=archived").json()
        assert any(s["student_id"] == sid for s in archived), "Student not in archived list"

        # Reactivate
        r = auth_session.put(f"{base_url}/api/students/bulk-reactivate",
                             json={"student_ids": [sid]})
        assert r.status_code == 200
        assert r.json().get("reactivated") == 1

        # Confirm back in active list
        active = auth_session.get(f"{base_url}/api/students?status=active").json()
        assert any(s["student_id"] == sid for s in active), "Student not back in active list"

    def test_bulk_archive_empty_ids(self, auth_session, base_url):
        r = auth_session.put(f"{base_url}/api/students/bulk-archive", json={"student_ids": []})
        assert r.status_code == 400

    def test_bulk_reactivate_empty_ids(self, auth_session, base_url):
        r = auth_session.put(f"{base_url}/api/students/bulk-reactivate", json={"student_ids": []})
        assert r.status_code == 400


# ─── CLASSES ─────────────────────────────────────────────────────────────────

class TestClasses:
    def test_classes_list(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/classes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ─── ANALYTICS ───────────────────────────────────────────────────────────────

class TestAnalytics:
    def test_tier_distribution(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/analytics/tier-distribution")
        assert r.status_code == 200
        d = r.json()
        assert "tier_distribution" in d
        td = d["tier_distribution"]
        assert "tier1" in td and "tier2" in td and "tier3" in td

    def test_school_wide(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/analytics/school-wide")
        assert r.status_code == 200
        d = r.json()
        assert "total_students" in d

    def test_school_wide_year_level_filter(self, auth_session, base_url):
        opts = auth_session.get(f"{base_url}/api/reports/filter-options").json()
        if opts.get("year_levels"):
            r = auth_session.get(
                f"{base_url}/api/analytics/school-wide?year_level={opts['year_levels'][0]}"
            )
            assert r.status_code == 200

    def test_school_wide_class_filter(self, auth_session, base_url):
        opts = auth_session.get(f"{base_url}/api/reports/filter-options").json()
        if opts.get("classes"):
            r = auth_session.get(
                f"{base_url}/api/analytics/school-wide?class_name={opts['classes'][0]}"
            )
            assert r.status_code == 200

    def test_attendance_trends(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/analytics/attendance-trends")
        assert r.status_code == 200

    def test_intervention_outcomes(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/analytics/intervention-outcomes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_cohort_comparison(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/analytics/cohort-comparison")
        assert r.status_code == 200

    def test_unauthenticated_analytics(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/analytics/school-wide")
        assert r.status_code in (401, 403)


# ─── REPORTS ─────────────────────────────────────────────────────────────────

class TestReports:
    def test_filter_options(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/filter-options")
        assert r.status_code == 200
        d = r.json()
        assert "year_levels" in d and "classes" in d

    def test_absence_types_school_wide(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/absence-types")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_absence_types_year_level_filter(self, auth_session, base_url):
        opts = auth_session.get(f"{base_url}/api/reports/filter-options").json()
        if opts.get("year_levels"):
            r = auth_session.get(
                f"{base_url}/api/reports/absence-types?year_level={opts['year_levels'][0]}"
            )
            assert r.status_code == 200

    def test_screening_coverage(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/screening-coverage")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "class" in data[0]
            assert "coverage_pct" in data[0]

    def test_support_gaps(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/support-gaps")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for g in data:
            assert "student" in g
            assert g["tier"] >= 2

    def test_staff_load(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/staff-load")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "staff" in data[0]
            assert "count" in data[0]

    def test_unauthenticated_reports(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/reports/filter-options")
        assert r.status_code in (401, 403)


# ─── CSV EXPORTS ─────────────────────────────────────────────────────────────

class TestCSVExports:
    def _assert_csv(self, r):
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        assert "text/csv" in r.headers.get("content-type", ""), \
            f"Bad content-type: {r.headers.get('content-type')}"
        assert len(r.text) > 10, "CSV response is empty"

    def test_students_csv(self, auth_session, base_url):
        self._assert_csv(auth_session.get(f"{base_url}/api/reports/students-csv"))

    def test_students_csv_has_header(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/reports/students-csv")
        lines = r.text.strip().splitlines()
        assert len(lines) >= 2, "CSV must have header + at least one data row"
        header = lines[0].lower()
        assert "student" in header or "name" in header or "id" in header

    def test_tier_summary_csv(self, auth_session, base_url):
        self._assert_csv(auth_session.get(f"{base_url}/api/reports/tier-summary-csv"))

    def test_screening_csv(self, auth_session, base_url):
        self._assert_csv(auth_session.get(f"{base_url}/api/reports/screening-csv"))

    def test_interventions_csv(self, auth_session, base_url):
        self._assert_csv(auth_session.get(f"{base_url}/api/reports/interventions-csv"))

    def test_csv_requires_auth(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/reports/students-csv")
        assert r.status_code in (401, 403)


# ─── ALERTS ──────────────────────────────────────────────────────────────────

class TestAlerts:
    def test_list_unresolved(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/alerts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_resolved(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/alerts?resolved=true")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unauthenticated_alerts(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/alerts")
        assert r.status_code in (401, 403)


# ─── INTERVENTIONS ───────────────────────────────────────────────────────────

class TestInterventions:
    def test_list(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/interventions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unauthenticated(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/interventions")
        assert r.status_code in (401, 403)


# ─── SETTINGS ────────────────────────────────────────────────────────────────

class TestSettings:
    def test_get_settings(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/settings")
        assert r.status_code == 200
        d = r.json()
        assert "school_name" in d

    def test_unauthenticated_settings(self, anon_session, base_url):
        r = anon_session.get(f"{base_url}/api/settings")
        assert r.status_code in (401, 403)


# ─── MEETING PREP ─────────────────────────────────────────────────────────────

class TestMeetingPrep:
    def test_meeting_prep(self, auth_session, base_url):
        r = auth_session.get(f"{base_url}/api/meeting-prep")
        assert r.status_code == 200
        d = r.json()
        # Response may be a list or a dict with a 'students' key
        students = d if isinstance(d, list) else d.get("students", [])
        assert isinstance(students, list)
        for s in students:
            assert s.get("mtss_tier", 1) >= 2, \
                f"Tier 1 student {s.get('student_id')} in meeting prep"


# ─── SCREENING ───────────────────────────────────────────────────────────────

class TestScreening:
    def test_student_screening_history(self, auth_session, base_url, first_student_id):
        r = auth_session.get(f"{base_url}/api/screening/{first_student_id}")
        assert r.status_code in (200, 404)  # 404 if no screenings yet

    def test_unauthenticated_screening(self, anon_session, base_url, first_student_id):
        r = anon_session.get(f"{base_url}/api/screening/{first_student_id}")
        # Endpoint may return 401/403 (auth enforced) or 404 (not found before auth check)
        assert r.status_code in (401, 403, 404)
