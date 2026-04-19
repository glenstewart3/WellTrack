"""
Iteration 35: Professional role, Audit Log, Student Sessions, Professionals dropdown
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login-email", json={
        "email": "admin_emailauth@test.com",
        "password": "admin123"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return s


class TestProfessionalRole:
    """Backend: Professional role creation and role update"""

    def test_create_user_with_professional_role(self, session):
        resp = session.post(f"{BASE_URL}/api/users", json={
            "email": "TEST_professional@example.com",
            "name": "Test Professional",
            "role": "professional"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["role"] == "professional"
        assert "user_id" in data

    def test_update_user_role_to_professional(self, session):
        # Create a teacher first
        resp = session.post(f"{BASE_URL}/api/users", json={
            "email": "TEST_teacher_to_prof@example.com",
            "name": "Teacher to Prof",
            "role": "teacher"
        })
        assert resp.status_code == 200
        uid = resp.json()["user_id"]

        # Update to professional
        resp2 = session.put(f"{BASE_URL}/api/users/{uid}/role", json={"role": "professional"})
        assert resp2.status_code == 200, f"Role update failed: {resp2.text}"

    def test_create_user_invalid_role_fails(self, session):
        resp = session.post(f"{BASE_URL}/api/users", json={
            "email": "TEST_badrole@example.com",
            "name": "Bad Role",
            "role": "superuser"
        })
        assert resp.status_code == 400


class TestAuditLog:
    """Backend: GET /api/appointments/audit"""

    def test_audit_log_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/appointments/audit")
        assert resp.status_code == 200, f"Audit log failed: {resp.text}"
        data = resp.json()
        assert "total" in data
        assert "entries" in data
        assert isinstance(data["entries"], list)

    def test_audit_log_pagination(self, session):
        resp = session.get(f"{BASE_URL}/api/appointments/audit?page=1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["per_page"] == 50


class TestStudentAppointments:
    """Backend: GET /api/appointments/student/{student_id}"""

    def test_student_appointments_returns_200(self, session):
        # Get a student to test with
        students_resp = session.get(f"{BASE_URL}/api/students")
        assert students_resp.status_code == 200
        students = students_resp.json()
        if not students:
            pytest.skip("No students found")
        sid = students[0]["student_id"]
        resp = session.get(f"{BASE_URL}/api/appointments/student/{sid}")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        assert isinstance(resp.json(), list)

    def test_student_appointments_nonexistent_student(self, session):
        resp = session.get(f"{BASE_URL}/api/appointments/student/nonexistent_123")
        assert resp.status_code == 200  # Returns empty list
        assert resp.json() == []


class TestProfessionalsList:
    """Backend: GET /api/users/professionals"""

    def test_professionals_list_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/users/professionals")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Verify no password hash leakage
        for user in data:
            assert "hashed_password" not in user
            assert "password_hash" not in user


# Cleanup test data
class TestCleanup:
    def test_cleanup(self, session):
        users_resp = session.get(f"{BASE_URL}/api/users")
        if users_resp.status_code != 200:
            return
        users = users_resp.json()
        for u in users:
            if u.get("email", "").startswith("TEST_"):
                session.delete(f"{BASE_URL}/api/users/{u['user_id']}")
        print("Cleanup complete")
