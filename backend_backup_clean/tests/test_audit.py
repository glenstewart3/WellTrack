"""
Backend tests for platform-wide audit log feature.
Tests: GET /api/audit (admin-only), filters, and audit entry creation on write operations.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin_emailauth@test.com"
ADMIN_PASSWORD = "password"


@pytest.fixture(scope="module")
def admin_session():
    """Returns a requests.Session with admin cookie set."""
    session = requests.Session()
    res = session.post(f"{BASE_URL}/api/auth/login-email", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return session


@pytest.fixture(scope="module")
def admin_headers(admin_session):
    return {}  # Headers not needed; session cookies handle auth


# ---- Non-admin 403 ----
def test_non_admin_gets_403():
    """Non-admin (unauthenticated) should get 401 or 403"""
    res = requests.get(f"{BASE_URL}/api/audit")
    assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
    print("PASS: unauthenticated gets 401/403")


# ---- Basic admin access ----
def test_audit_returns_200_admin(admin_session):
    res = admin_session.get(f"{BASE_URL}/api/audit")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "total" in data
    assert "page" in data
    assert "per_page" in data
    assert "entries" in data
    assert isinstance(data["entries"], list)
    print(f"PASS: audit returns 200, total={data['total']}")


# ---- Filter by entity_type ----
def test_audit_filter_entity_type_student(admin_session):
    res = admin_session.get(f"{BASE_URL}/api/audit?entity_type=student")
    assert res.status_code == 200
    data = res.json()
    for entry in data["entries"]:
        assert entry["entity_type"] == "student", f"Expected student, got {entry['entity_type']}"
    print(f"PASS: entity_type=student filter works, count={len(data['entries'])}")


# ---- Filter by action ----
def test_audit_filter_action_created(admin_session):
    res = admin_session.get(f"{BASE_URL}/api/audit?action=created")
    assert res.status_code == 200
    data = res.json()
    for entry in data["entries"]:
        assert entry["action"] == "created", f"Expected created, got {entry['action']}"
    print(f"PASS: action=created filter works, count={len(data['entries'])}")


# ---- Create student triggers audit entry ----
def test_create_student_creates_audit_entry(admin_session):
    # Create a student
    student_payload = {
        "first_name": "TEST_AuditFirst",
        "last_name": "TEST_AuditLast",
        "grade": "5",
        "school": "Test School",
        "date_of_birth": "2015-01-01",
        "year_level": "5",
        "class_name": "5A"
    }
    create_res = admin_session.post(f"{BASE_URL}/api/students", json=student_payload)
    assert create_res.status_code in [200, 201], f"Student creation failed: {create_res.text}"
    student_data = create_res.json()
    student_id = student_data.get("student_id") or student_data.get("id") or student_data.get("_id")
    print(f"Created student: {student_id}")

    # Check audit log for this student
    res = admin_session.get(f"{BASE_URL}/api/audit?entity_type=student&action=created")
    assert res.status_code == 200
    entries = res.json()["entries"]
    # Find entry matching the student
    found = any(
        e.get("entity_id") == str(student_id) or "TEST_AuditFirst" in e.get("entity_name", "")
        for e in entries
    )
    assert found, f"No audit entry found for created student. Entries: {entries[:3]}"
    print("PASS: Creating student creates audit entry with entity_type=student, action=created")


# ---- Pagination ----
def test_audit_pagination(admin_session):
    res = admin_session.get(f"{BASE_URL}/api/audit?page=0&per_page=5")
    assert res.status_code == 200
    data = res.json()
    assert data["per_page"] == 5
    assert len(data["entries"]) <= 5
    print(f"PASS: Pagination works, returned {len(data['entries'])} entries with per_page=5")
