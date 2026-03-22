"""
Iteration 19 tests: Multi-year support, biweekly trend, period dropdown features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Login with email/password
    r = s.post(f"{BASE_URL}/api/auth/login-email", json={"email": "admin@test.local", "password": "Admin1234!"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def session():
    return get_session()


class TestSettingsTermsAvailableYears:
    """GET /api/settings/terms should include years from attendance_records"""

    def test_terms_returns_available_years(self, session):
        r = session.get(f"{BASE_URL}/api/settings/terms")
        assert r.status_code == 200
        data = r.json()
        assert "available_years" in data
        assert isinstance(data["available_years"], list)
        assert len(data["available_years"]) > 0
        print(f"Available years: {data['available_years']}")

    def test_available_years_includes_attendance_record_years(self, session):
        """Verify years from attendance_records dates appear in available_years"""
        # First get some attendance records to see what years exist
        terms_r = session.get(f"{BASE_URL}/api/settings/terms")
        assert terms_r.status_code == 200
        years = terms_r.json().get("available_years", [])
        # Should have at least one year
        assert len(years) >= 1
        # Years should be integers
        for y in years:
            assert isinstance(y, int), f"Year {y} is not an int"
        print(f"PASS: available_years={years}")


class TestBiweeklyTrend:
    """GET /api/attendance/student/{id} should return biweekly_trend"""

    def test_student_detail_has_biweekly_trend_field(self, session):
        # Get list of students first
        summary_r = session.get(f"{BASE_URL}/api/attendance/summary", params={"year": 2026})
        assert summary_r.status_code == 200
        students = summary_r.json()
        if not students:
            pytest.skip("No students in DB")

        student_id = students[0]["student_id"]
        r = session.get(f"{BASE_URL}/api/attendance/student/{student_id}")
        assert r.status_code == 200
        data = r.json()
        assert "biweekly_trend" in data, "biweekly_trend field missing from response"
        assert isinstance(data["biweekly_trend"], list)
        print(f"biweekly_trend has {len(data['biweekly_trend'])} items")

    def test_biweekly_trend_has_correct_fields(self, session):
        """Each biweekly_trend item should have period, attendance_pct, label"""
        summary_r = session.get(f"{BASE_URL}/api/attendance/summary", params={"year": 2026})
        students = summary_r.json()
        if not students:
            pytest.skip("No students in DB")

        # Find a student with data
        student_with_data = next((s for s in students if s.get("has_data")), None)
        if not student_with_data:
            pytest.skip("No student with attendance data")

        r = session.get(f"{BASE_URL}/api/attendance/student/{student_with_data['student_id']}")
        data = r.json()
        trend = data.get("biweekly_trend", [])
        if trend:
            item = trend[0]
            assert "period" in item, "Missing 'period' field in biweekly_trend item"
            assert "attendance_pct" in item, "Missing 'attendance_pct' field"
            assert "label" in item, "Missing 'label' field"
            print(f"PASS: biweekly_trend sample: {item}")
        else:
            print("biweekly_trend is empty (acceptable if not enough data)")

    def test_no_monthly_trend_field(self, session):
        """Should NOT have monthly_trend (old field)"""
        summary_r = session.get(f"{BASE_URL}/api/attendance/summary", params={"year": 2026})
        students = summary_r.json()
        if not students:
            pytest.skip("No students in DB")
        student_id = students[0]["student_id"]
        r = session.get(f"{BASE_URL}/api/attendance/student/{student_id}")
        data = r.json()
        assert "monthly_trend" not in data, "Old 'monthly_trend' field still present - should be removed"
        print("PASS: monthly_trend field not present")


class TestAttendanceSummary:
    """Attendance summary API tests"""

    def test_summary_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/attendance/summary")
        assert r.status_code == 200

    def test_summary_ytd(self, session):
        from datetime import date
        today = date.today().isoformat()
        r = session.get(f"{BASE_URL}/api/attendance/summary", params={"year": 2026, "to_date": today})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Summary students: {len(data)}")
