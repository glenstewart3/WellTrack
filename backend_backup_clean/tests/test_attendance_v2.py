"""
Backend tests for attendance rework (sessions→days), seed fix, absence type toggle.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
COOKIES_FILE = '/tmp/test_cookies.txt'

@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login-email", json={"email": "admin@test.local", "password": "Admin1234"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


class TestAttendanceTypes:
    def test_get_absence_types_structure(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/attendance/types")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "types" in data, "Missing 'types' field"
        assert "excluded_types" in data, "Missing 'excluded_types' field"
        assert isinstance(data["types"], list)
        assert isinstance(data["excluded_types"], list)
        print(f"PASS: /api/attendance/types returns types={data['types'][:3]} excluded={data['excluded_types']}")

    def test_update_excluded_types(self, auth_session):
        # Get current types
        r = auth_session.get(f"{BASE_URL}/api/attendance/types")
        data = r.json()
        all_types = data["types"]

        # Update excluded_absence_types via settings endpoint
        if all_types:
            new_excluded = [all_types[0]]
            r2 = auth_session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": new_excluded})
            assert r2.status_code == 200, f"Settings update failed: {r2.text}"

            # Verify it was saved
            r3 = auth_session.get(f"{BASE_URL}/api/attendance/types")
            data3 = r3.json()
            assert all_types[0] in data3["excluded_types"], f"Excluded type not saved: {data3['excluded_types']}"
            print(f"PASS: excluded_types updated and persisted: {data3['excluded_types']}")

            # Restore
            auth_session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": []})


class TestAttendanceSummary:
    def test_summary_has_day_fields(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/attendance/summary")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list), "Expected list"
        if data:
            student = data[0]
            assert "absent_days" in student, "Missing 'absent_days' field"
            assert "total_days" in student, "Missing 'total_days' field"
            assert "absent_sessions" not in student, "Old field 'absent_sessions' still present"
            assert "total_sessions" not in student, "Old field 'total_sessions' still present"
            print(f"PASS: attendance summary has absent_days={student['absent_days']}, total_days={student['total_days']}")

    def test_absent_days_is_numeric(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/attendance/summary")
        data = r.json()
        for s in data:
            if s.get("has_data"):
                assert isinstance(s["absent_days"], (int, float)), f"absent_days should be numeric: {s['absent_days']}"
                assert isinstance(s["total_days"], int), f"total_days should be int: {s['total_days']}"
                break
        print("PASS: absent_days and total_days are numeric")


class TestStudentAttendanceDetail:
    def test_student_detail_has_day_fields(self, auth_session):
        # Get a student id first
        r = auth_session.get(f"{BASE_URL}/api/students")
        assert r.status_code == 200
        students = r.json()
        assert students, "No students found"
        sid = students[0]["student_id"]

        r2 = auth_session.get(f"{BASE_URL}/api/attendance/student/{sid}")
        assert r2.status_code == 200, f"Got {r2.status_code}: {r2.text}"
        data = r2.json()
        assert "absent_days" in data, "Missing 'absent_days'"
        assert "total_days" in data, "Missing 'total_days'"
        assert "absent_sessions" not in data, "Old field 'absent_sessions' present"
        assert "total_sessions" not in data, "Old field 'total_sessions' present"
        print(f"PASS: student detail absent_days={data['absent_days']}, total_days={data['total_days']}")

    def test_deduplication_same_type(self, auth_session):
        """If AM==PM same absence type, count as 1, not 2 in absence_types dict."""
        r = auth_session.get(f"{BASE_URL}/api/students")
        students = r.json()
        sid = students[0]["student_id"]

        r2 = auth_session.get(f"{BASE_URL}/api/attendance/student/{sid}")
        data = r2.json()
        absence_types = data.get("absence_types", {})
        absent_days = data.get("absent_days", 0)
        # Sum of all absence type counts should not exceed absent_days
        total_type_count = sum(absence_types.values())
        # They should be roughly equal (dedup means same-type full day = 1 count)
        assert total_type_count <= absent_days + 0.1, \
            f"Dedup issue: sum of absence_types {total_type_count} > absent_days {absent_days}"
        print(f"PASS: deduplication ok. Sum of types={total_type_count}, absent_days={absent_days}")


class TestSeedBugFix:
    def test_seed_preserves_school_settings(self, auth_session):
        # Set specific values that seed should not overwrite
        auth_session.put(f"{BASE_URL}/api/settings", json={
            "school_name": "TEST_School_Preserved",
            "school_type": "primary",
            "current_term": "Term 3",
            "current_year": 2026
        })
        # Verify set
        r = auth_session.get(f"{BASE_URL}/api/settings")
        settings_before = r.json()
        assert settings_before.get("school_name") == "TEST_School_Preserved"

        # Run seed
        r2 = auth_session.post(f"{BASE_URL}/api/settings/seed")
        assert r2.status_code == 200, f"Seed failed: {r2.text}"

        # Check settings not overwritten
        r3 = auth_session.get(f"{BASE_URL}/api/settings")
        settings_after = r3.json()
        assert settings_after.get("school_name") == "TEST_School_Preserved", \
            f"Seed overwrote school_name! Got: {settings_after.get('school_name')}"
        assert settings_after.get("school_type") == "primary", \
            f"Seed overwrote school_type! Got: {settings_after.get('school_type')}"
        assert settings_after.get("current_term") == "Term 3", \
            f"Seed overwrote current_term! Got: {settings_after.get('current_term')}"
        assert settings_after.get("current_year") == 2026, \
            f"Seed overwrote current_year! Got: {settings_after.get('current_year')}"
        print(f"PASS: Seed did NOT overwrite onboarding school settings")
