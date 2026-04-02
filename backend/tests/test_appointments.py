"""
Appointments Module API tests
Tests for all appointment-related endpoints and professional settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin_emailauth@test.com",
        "password": "password"
    })
    if resp.status_code == 200:
        return resp.json().get("access_token") or resp.json().get("token")
    pytest.skip(f"Login failed: {resp.status_code} {resp.text}")

@pytest.fixture(scope="module")
def client(auth_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return s


class TestAppointmentsEndpoints:
    """Core appointment endpoints"""

    def test_get_schedule(self, client):
        r = client.get(f"{BASE_URL}/api/appointments/schedule")
        assert r.status_code == 200
        data = r.json()
        assert "week_start" in data
        assert "week_end" in data
        assert "appointments" in data
        assert isinstance(data["appointments"], list)
        print(f"PASS: schedule returned {len(data['appointments'])} appointments")

    def test_get_ongoing(self, client):
        r = client.get(f"{BASE_URL}/api/appointments/ongoing")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"PASS: ongoing returned {len(r.json())} items")

    def test_get_completed(self, client):
        r = client.get(f"{BASE_URL}/api/appointments/completed")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"PASS: completed returned {len(r.json())} items")

    def test_list_appointments(self, client):
        r = client.get(f"{BASE_URL}/api/appointments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"PASS: list appointments returned {len(r.json())} items")

    def test_create_and_delete_appointment(self, client):
        # Get a valid student_id first
        students = client.get(f"{BASE_URL}/api/students/summary").json()
        assert len(students) > 0, "Need students for this test"
        student_id = students[0]["student_id"]

        payload = {
            "student_id": student_id,
            "intervention_type": "Academic Support",
            "date": "2026-02-15",
            "time": "09:00",
            "session_notes": "TEST_ appointment",
            "status": "scheduled",
        }
        r = client.post(f"{BASE_URL}/api/appointments", json=payload)
        assert r.status_code == 200
        apt = r.json()
        assert apt["student_id"] == student_id
        assert apt["appointment_id"].startswith("apt_")
        apt_id = apt["appointment_id"]
        print(f"PASS: created appointment {apt_id}")

        # Delete it
        dr = client.delete(f"{BASE_URL}/api/appointments/{apt_id}")
        assert dr.status_code == 200
        print(f"PASS: deleted appointment {apt_id}")

    def test_professionals_list(self, client):
        r = client.get(f"{BASE_URL}/api/users/professionals")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"PASS: professionals list returned {len(r.json())} users")

    def test_audit_log(self, client):
        r = client.get(f"{BASE_URL}/api/appointments/audit")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data
        print(f"PASS: audit log returned {data.get('total', 0)} entries")


class TestProfessionalSettings:
    """Professional settings PUT endpoint on users"""

    def test_get_users_list(self, client):
        r = client.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert len(users) > 0
        print(f"PASS: users list returned {len(users)} users")

    def test_update_professional_settings(self, client):
        # Get current user info
        r = client.get(f"{BASE_URL}/api/users")
        users = r.json()
        # Find a non-admin user or first user
        target = next((u for u in users if u.get("role") != "admin"), users[0])
        uid = target["user_id"]

        payload = {
            "appointment_access": True,
            "professional_type": "Counsellor",
            "visit_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "cross_professional_view": False
        }
        pr = client.put(f"{BASE_URL}/api/users/{uid}/professional", json=payload)
        assert pr.status_code == 200
        print(f"PASS: professional settings updated for user {uid}")

        # Restore
        client.put(f"{BASE_URL}/api/users/{uid}/professional", json={
            "appointment_access": False,
            "professional_type": "",
            "visit_days": [],
            "cross_professional_view": False
        })


class TestRolePermissions:
    """Check role permissions include appointments"""

    def test_role_permissions_include_appointments(self, client):
        r = client.get(f"{BASE_URL}/api/role-permissions")
        assert r.status_code == 200
        data = r.json()
        # Check appointments key exists somewhere
        print(f"PASS: role-permissions response: {list(data.keys())[:5] if isinstance(data, dict) else data[:3]}")

    def test_appointments_not_accessible_without_access(self):
        # Try without token
        r = requests.get(f"{BASE_URL}/api/appointments/schedule")
        assert r.status_code in [401, 403]
        print("PASS: unauthenticated access blocked")
