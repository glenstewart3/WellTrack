"""
Tests for attendance calculation fix:
- No school_days in DB → use unique attendance_records dates as proxy
- Realistic percentages (80-100%) instead of 0%
- Keisley ADONIS should show ~81.6%, 38 days, 7 absent
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture(scope="module")
def session():
    """Session with cookie-based auth"""
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login-email", json={
        "email": "admin@test.local", "password": "Admin1234!"
    })
    assert resp.status_code == 200, f"Auth failed: {resp.text}"
    return s

@pytest.fixture(scope="module")
def headers():
    return {}


class TestAttendanceSummaryFix:
    """Attendance summary API - fix for empty school_days collection"""

    def test_summary_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text[:300]}"

    def test_summary_has_data_true_for_students_with_records(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No students returned"
        with_data = [s for s in data if s.get("has_data")]
        print(f"Students with has_data=True: {len(with_data)} / {len(data)}")
        assert len(with_data) > 100, f"Expected >100 students with has_data=True, got {len(with_data)}"

    def test_summary_realistic_percentages(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200
        data = resp.json()
        with_data = [s for s in data if s.get("has_data") and s.get("attendance_pct") is not None]
        assert len(with_data) > 0
        pcts = [s["attendance_pct"] for s in with_data]
        avg = sum(pcts) / len(pcts)
        print(f"Avg attendance pct: {avg:.1f}%, min: {min(pcts):.1f}%, max: {max(pcts):.1f}%")
        assert avg > 50, f"Average attendance {avg:.1f}% too low - fix may not be working"
        assert avg < 100, f"Average attendance {avg:.1f}% suspiciously 100%"
        zeros = [s for s in with_data if s["attendance_pct"] == 0]
        print(f"Students with 0% attendance: {len(zeros)}")
        assert len(zeros) < 5, f"Too many 0% attendance students: {len(zeros)} — fix may not be working"

    def test_summary_school_average_tile(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200
        data = resp.json()
        with_data = [s for s in data if s.get("has_data") and s.get("attendance_pct") is not None]
        if with_data:
            avg = sum(s["attendance_pct"] for s in with_data) / len(with_data)
            assert 50 < avg < 100, f"School average {avg:.1f}% not realistic"


class TestStudentDetailFix:
    """Student detail endpoint - fix for Keisley ADONIS case"""

    def _find_keisley(self, session):
        resp = session.get(f"{BASE_URL}/api/students", params={"limit": 500})
        assert resp.status_code == 200
        students = resp.json()
        if isinstance(students, dict):
            students = students.get("students", [])
        for s in students:
            name = f"{s.get('first_name','')} {s.get('last_name','')}".strip()
            if "ADONIS" in name.upper() or "Keisley" in s.get("first_name", ""):
                return s["student_id"]
        return None

    def test_keisley_adonis_detail(self, session):
        student_id = self._find_keisley(session)
        if not student_id:
            pytest.skip("Keisley ADONIS not found in students list")
        resp = session.get(f"{BASE_URL}/api/attendance/student/{student_id}")
        assert resp.status_code == 200
        data = resp.json()
        print(f"Keisley ADONIS: pct={data.get('attendance_pct')}, total_days={data.get('total_days')}, absent_days={data.get('absent_days')}")
        pct = data.get("attendance_pct", 0)
        total = data.get("total_days", 0)
        absent = data.get("absent_days", 0)
        assert pct > 70, f"Attendance pct {pct}% too low — expected ~81.6%"
        assert total >= 30, f"total_days={total} too low — expected ~38"
        assert absent >= 3, f"absent_days={absent} too low — expected ~7"

    def test_student_detail_not_zero_pct(self, session):
        """Random students should not show 0% attendance if they have records"""
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200
        students_with_data = [s for s in resp.json() if s.get("has_data")][:5]
        for s in students_with_data:
            sid = s["student_id"]
            detail = session.get(f"{BASE_URL}/api/attendance/student/{sid}")
            assert detail.status_code == 200
            d = detail.json()
            print(f"Student {sid}: pct={d.get('attendance_pct')}, days={d.get('total_days')}")
            assert d.get("attendance_pct", 0) > 30, f"Student {sid} has suspiciously low pct: {d.get('attendance_pct')}%"


class TestPeriodFilter:
    """Period filter still works with fix"""

    def test_ytd_filter(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary",
                            params={"from_date": "2026-01-01", "to_date": "2026-03-20"})
        assert resp.status_code == 200
        data = resp.json()
        with_data = [s for s in data if s.get("has_data")]
        print(f"YTD filter: {len(with_data)} students with data")
        assert len(with_data) > 50, "Expected >50 students with data for YTD filter"

    def test_month_filter(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary",
                            params={"from_date": "2026-02-01", "to_date": "2026-02-28"})
        assert resp.status_code == 200
        data = resp.json()
        with_data = [s for s in data if s.get("has_data")]
        print(f"Feb 2026 filter: {len(with_data)} students with data")
        assert len(with_data) > 0, "Expected students with data in Feb 2026"


class TestCohortFilter:
    """Cohort filter (year level, class) still works"""

    def test_summary_contains_year_level_field(self, session):
        resp = session.get(f"{BASE_URL}/api/attendance/summary")
        assert resp.status_code == 200
        data = resp.json()
        if data:
            s = data[0]
            assert "year_level" in s or "class_name" in s or "class_id" in s, \
                f"Missing cohort fields: {list(s.keys())}"
