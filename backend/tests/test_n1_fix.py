"""
Tests for N+1 query fix: batch fetches, aggregation pipelines, and response timing.
All critical endpoints tested for correct data fields and sub-500ms performance.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

EMAIL = "admin_emailauth@test.com"
PASSWORD = "admin123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login-email", json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    # Cookie should be set automatically in session
    return s


def timed_get(session, url):
    start = time.time()
    resp = session.get(url)
    elapsed_ms = (time.time() - start) * 1000
    return resp, elapsed_ms


class TestStudentsSummary:
    """GET /api/students/summary"""

    def test_status_200(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/students/summary")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/students/summary: {ms:.0f}ms")

    def test_under_500ms(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/students/summary")
        assert ms < 500, f"Too slow: {ms:.0f}ms"

    def test_response_fields(self, session):
        resp, _ = timed_get(session, f"{BASE_URL}/api/students/summary")
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        if data:
            student = data[0]
            for field in ["mtss_tier", "saebrs_risk", "attendance_pct", "active_interventions"]:
                assert field in student, f"Missing field: {field}"


class TestAnalyticsSchoolWide:
    """GET /api/analytics/school-wide"""

    def test_status_200(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/school-wide")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/analytics/school-wide: {ms:.0f}ms")

    def test_under_500ms(self, session):
        _, ms = timed_get(session, f"{BASE_URL}/api/analytics/school-wide")
        assert ms < 500, f"Too slow: {ms:.0f}ms"

    def test_response_fields(self, session):
        resp, _ = timed_get(session, f"{BASE_URL}/api/analytics/school-wide")
        data = resp.json()
        for field in ["tier_distribution", "screened_students", "total_students"]:
            assert field in data, f"Missing field: {field}"


class TestAnalyticsAttendanceTrends:
    """GET /api/analytics/attendance-trends"""

    def test_status_200(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/attendance-trends")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/analytics/attendance-trends: {ms:.0f}ms")

    def test_under_500ms(self, session):
        _, ms = timed_get(session, f"{BASE_URL}/api/analytics/attendance-trends")
        assert ms < 500, f"Too slow: {ms:.0f}ms"

    def test_response_fields(self, session):
        resp, _ = timed_get(session, f"{BASE_URL}/api/analytics/attendance-trends")
        data = resp.json()
        for field in ["monthly_trend", "day_of_week", "chronic_absentees", "total_school_days"]:
            assert field in data, f"Missing field: {field}"


class TestMeetingPrep:
    """GET /api/meeting-prep"""

    def test_status_200(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/meeting-prep")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/meeting-prep: {ms:.0f}ms")

    def test_under_500ms(self, session):
        _, ms = timed_get(session, f"{BASE_URL}/api/meeting-prep")
        assert ms < 500, f"Too slow: {ms:.0f}ms"

    def test_response_fields(self, session):
        resp, _ = timed_get(session, f"{BASE_URL}/api/meeting-prep")
        data = resp.json()
        assert "students" in data, "Missing 'students' field"
        assert "tier_changes" in data, "Missing 'tier_changes' field"


class TestAttendanceSummary:
    """GET /api/attendance/summary"""

    def test_status_200(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/attendance/summary: {ms:.0f}ms")

    def test_under_500ms(self, session):
        _, ms = timed_get(session, f"{BASE_URL}/api/attendance/summary")
        assert ms < 500, f"Too slow: {ms:.0f}ms"

    def test_attendance_pct_field(self, session):
        resp, _ = timed_get(session, f"{BASE_URL}/api/attendance/summary")
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        if data:
            assert "attendance_pct" in data[0], "Missing 'attendance_pct' field"


class TestAnalyticsMisc:
    """Remaining analytics endpoints"""

    def test_tier_distribution(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/tier-distribution")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        data = resp.json()
        assert "tier_distribution" in data, f"Missing tier_distribution: {data}"
        print(f"  /api/analytics/tier-distribution: {ms:.0f}ms")

    def test_cohort_comparison(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/cohort-comparison")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        print(f"  /api/analytics/cohort-comparison: {ms:.0f}ms")

    def test_intervention_outcomes(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/intervention-outcomes")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        print(f"  /api/analytics/intervention-outcomes: {ms:.0f}ms")

    def test_classroom_radar(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/analytics/classroom-radar/8A")
        assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
        print(f"  /api/analytics/classroom-radar/8A: {ms:.0f}ms")


class TestReports:
    """Reports endpoints"""

    def test_support_gaps(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/reports/support-gaps")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        print(f"  /api/reports/support-gaps: {ms:.0f}ms")

    def test_screening_coverage(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/reports/screening-coverage")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected a list"
        print(f"  /api/reports/screening-coverage: {ms:.0f}ms")

    def test_tier_summary_csv(self, session):
        resp, ms = timed_get(session, f"{BASE_URL}/api/reports/tier-summary-csv")
        assert resp.status_code == 200, f"Status {resp.status_code}"
        ct = resp.headers.get("content-type", "")
        assert "text/csv" in ct or "application/octet-stream" in ct or "text/plain" in ct, \
            f"Expected CSV content-type, got: {ct}"
        assert len(resp.text) > 0, "CSV response is empty"
        print(f"  /api/reports/tier-summary-csv: {ms:.0f}ms content-type={ct}")
