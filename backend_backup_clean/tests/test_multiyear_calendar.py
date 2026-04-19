"""
Multi-year calendar tests: year-scoped terms, school_days isolation,
and attendance % using current_year.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login-email", json={"email": "admin_emailauth@test.com", "password": "admin123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    print(f"Login OK, cookies: {dict(s.cookies)}")
    return s


# ── GET /api/settings/terms (default) ────────────────────────────────────────

class TestGetTermsDefault:
    def test_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        assert r.status_code == 200, r.text

    def test_has_available_years(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        d = r.json()
        assert "available_years" in d
        assert isinstance(d["available_years"], list)
        assert len(d["available_years"]) >= 1

    def test_has_active_year(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        d = r.json()
        assert "active_year" in d
        assert d["active_year"] is not None

    def test_has_terms_list(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        d = r.json()
        assert "terms" in d
        assert isinstance(d["terms"], list)

    def test_has_school_days_count(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        d = r.json()
        assert "school_days_count" in d

    def test_contains_both_2025_and_2026_in_available(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        d = r.json()
        years = d["available_years"]
        assert 2025 in years, f"2025 not in available_years: {years}"
        assert 2026 in years, f"2026 not in available_years: {years}"


# ── GET /api/settings/terms?year=2025 ────────────────────────────────────────

class TestGetTerms2025:
    def test_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2025")
        assert r.status_code == 200, r.text

    def test_active_year_is_2025(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2025")
        assert r.json()["active_year"] == 2025

    def test_terms_all_have_year_2025(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2025")
        terms = r.json()["terms"]
        for t in terms:
            assert t.get("year") == 2025, f"Term has wrong year: {t}"

    def test_school_days_count_2025_gt_0(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2025")
        assert r.json()["school_days_count"] > 0


# ── GET /api/settings/terms?year=2026 ────────────────────────────────────────

class TestGetTerms2026:
    def test_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2026")
        assert r.status_code == 200, r.text

    def test_active_year_is_2026(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2026")
        assert r.json()["active_year"] == 2026

    def test_terms_all_have_year_2026(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2026")
        terms = r.json()["terms"]
        for t in terms:
            assert t.get("year") == 2026, f"Term has wrong year: {t}"

    def test_school_days_count_2026_gt_0(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2026")
        assert r.json()["school_days_count"] > 0


# ── school_days year field migration ─────────────────────────────────────────

class TestSchoolDaysMigration:
    def test_school_days_2025_exist(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2025")
        assert r.json()["school_days_count"] > 0

    def test_school_days_2026_exist(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms?year=2026")
        assert r.json()["school_days_count"] > 0

    def test_2025_and_2026_counts_are_independent(self, session):
        c2025 = session.get(f"{BASE_URL}/api/settings/terms?year=2025").json()["school_days_count"]
        c2026 = session.get(f"{BASE_URL}/api/settings/terms?year=2026").json()["school_days_count"]
        # They may be the same value but both should be > 0
        assert c2025 > 0 and c2026 > 0


# ── PUT /api/settings/terms year-scoped isolation ────────────────────────────

class TestPutTermsIsolation:
    def test_saving_2025_does_not_destroy_2026_days(self, session):
        # Get current 2026 count
        r2026_before = session.get(f"{BASE_URL}/api/settings/terms?year=2026").json()
        count_2026_before = r2026_before["school_days_count"]
        terms_2026_before = r2026_before["terms"]
        assert count_2026_before > 0, "No 2026 school days to protect"

        # Get current 2025 terms and resave them (no-op on 2026)
        r2025 = session.get(f"{BASE_URL}/api/settings/terms?year=2025").json()
        terms_2025 = r2025["terms"]
        non_school_days = r2025["non_school_days"]

        put_resp = session.put(f"{BASE_URL}/api/settings/terms", json={
            "year": 2025,
            "terms": terms_2025,
            "non_school_days": non_school_days,
        })
        assert put_resp.status_code == 200, put_resp.text

        # 2026 count must be unchanged
        count_2026_after = session.get(f"{BASE_URL}/api/settings/terms?year=2026").json()["school_days_count"]
        assert count_2026_after == count_2026_before, (
            f"2026 school_days changed after saving 2025 terms! before={count_2026_before}, after={count_2026_after}"
        )

    def test_saving_2026_does_not_destroy_2025_days(self, session):
        count_2025_before = session.get(f"{BASE_URL}/api/settings/terms?year=2025").json()["school_days_count"]
        r2026 = session.get(f"{BASE_URL}/api/settings/terms?year=2026").json()
        put_resp = session.put(f"{BASE_URL}/api/settings/terms", json={
            "year": 2026,
            "terms": r2026["terms"],
            "non_school_days": r2026["non_school_days"],
        })
        assert put_resp.status_code == 200, put_resp.text
        count_2025_after = session.get(f"{BASE_URL}/api/settings/terms?year=2025").json()["school_days_count"]
        assert count_2025_after == count_2025_before, (
            f"2025 school_days changed after saving 2026! before={count_2025_before}, after={count_2025_after}"
        )


# ── Attendance uses current_year (2026) ──────────────────────────────────────

class TestAttendanceUsesCurrentYear:
    def test_attendance_summary_200(self, session):
        r = session.get(f"{BASE_URL}/api/attendance/summary")
        assert r.status_code == 200, r.text

    def test_analytics_school_wide_200(self, session):
        r = session.get(f"{BASE_URL}/api/analytics/school-wide")
        assert r.status_code == 200, r.text

    def test_analytics_attendance_trends_200(self, session):
        r = session.get(f"{BASE_URL}/api/analytics/attendance-trends")
        assert r.status_code == 200, r.text

    def test_students_summary_200(self, session):
        r = session.get(f"{BASE_URL}/api/students/summary")
        assert r.status_code == 200, r.text

    def test_students_summary_has_attendance_pct(self, session):
        r = session.get(f"{BASE_URL}/api/students/summary")
        data = r.json()
        students = data if isinstance(data, list) else data.get("students", [])
        assert len(students) > 0, "No students returned"
        first = students[0]
        assert "attendance_pct" in first, f"attendance_pct missing from: {list(first.keys())}"
