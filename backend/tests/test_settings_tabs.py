"""Tests for Settings tabs reorganization: Interventions tab, Student Data tab, attendance types API"""
import pytest
import requests
import os
import subprocess

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tier-track-1.preview.emergentagent.com').rstrip('/')

def create_test_session():
    """Create a test admin session via MongoDB"""
    import time
    token = f"test_session_settings_{int(time.time())}"
    result = subprocess.run(['mongosh', '--eval', f"""
    use('test_database');
    var userId = 'test-settings-{int(time.time())}';
    db.users.insertOne({{user_id: userId, email: 'settings_test@example.com', name: 'Settings Tester', role: 'admin', created_at: new Date()}});
    db.user_sessions.insertOne({{user_id: userId, session_token: '{token}', expires_at: new Date(Date.now() + 86400000), created_at: new Date()}});
    print('OK');
    """], capture_output=True, text=True)
    return token

@pytest.fixture(scope="module")
def session():
    token = create_test_session()
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s

def test_get_attendance_types(session):
    """GET /api/attendance/types returns types and excluded_types fields"""
    r = session.get(f"{BASE_URL}/api/attendance/types")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert "types" in data, "Response missing 'types'"
    assert "excluded_types" in data, "Response missing 'excluded_types'"
    assert isinstance(data["types"], list)
    assert isinstance(data["excluded_types"], list)
    print(f"PASS: types={len(data['types'])}, excluded={len(data['excluded_types'])}")

def test_get_settings(session):
    """GET /api/settings returns valid settings"""
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert isinstance(data, dict)
    print(f"PASS: settings keys={list(data.keys())[:8]}")

def test_put_settings_excluded_absence_types(session):
    """PUT /api/settings with excluded_absence_types persists correctly"""
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    original = r.json()

    test_types = ["TEST_Late", "TEST_Unexplained"]
    r = session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": test_types})
    assert r.status_code == 200, f"PUT failed: {r.text}"

    r2 = session.get(f"{BASE_URL}/api/settings")
    data2 = r2.json()
    assert "excluded_absence_types" in data2, f"Missing excluded_absence_types in: {list(data2.keys())}"
    assert set(data2["excluded_absence_types"]) == set(test_types), \
        f"Expected {test_types}, got {data2.get('excluded_absence_types')}"
    print(f"PASS: excluded_absence_types persisted: {data2['excluded_absence_types']}")

    # Restore
    session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": original.get("excluded_absence_types", [])})

def test_put_settings_intervention_types(session):
    """PUT /api/settings with intervention_types persists correctly"""
    r = session.get(f"{BASE_URL}/api/settings")
    original = r.json()

    test_ints = ["TEST_Mentoring", "TEST_Counselling"]
    r = session.put(f"{BASE_URL}/api/settings", json={"intervention_types": test_ints})
    assert r.status_code == 200, f"PUT failed: {r.text}"

    r2 = session.get(f"{BASE_URL}/api/settings")
    data2 = r2.json()
    assert "intervention_types" in data2, f"Missing intervention_types"
    assert set(data2["intervention_types"]) == set(test_ints), \
        f"Expected {test_ints}, got {data2.get('intervention_types')}"
    print(f"PASS: intervention_types persisted: {data2['intervention_types']}")

    # Restore
    session.put(f"{BASE_URL}/api/settings", json={"intervention_types": original.get("intervention_types", [])})


def test_get_attendance_types(session):
    """GET /api/attendance/types returns types and excluded_types fields"""
    r = session.get(f"{BASE_URL}/api/attendance/types")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert "types" in data, "Response missing 'types'"
    assert "excluded_types" in data, "Response missing 'excluded_types'"
    assert isinstance(data["types"], list), "'types' should be a list"
    assert isinstance(data["excluded_types"], list), "'excluded_types' should be a list"
    print(f"PASS: /api/attendance/types returned {len(data['types'])} types, {len(data['excluded_types'])} excluded")

def test_get_settings(session):
    """GET /api/settings returns settings"""
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert isinstance(data, dict)
    print(f"PASS: /api/settings returned keys: {list(data.keys())[:10]}")

def test_put_settings_excluded_absence_types(session):
    """PUT /api/settings with excluded_absence_types persists correctly"""
    # First get current settings
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    original = r.json()

    # Update with excluded_absence_types
    test_types = ["Late", "Unexplained"]
    r = session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": test_types})
    assert r.status_code == 200, f"PUT failed: {r.text}"

    # Verify persisted
    r2 = session.get(f"{BASE_URL}/api/settings")
    assert r2.status_code == 200
    data2 = r2.json()
    assert "excluded_absence_types" in data2, "Settings missing excluded_absence_types after save"
    assert set(data2["excluded_absence_types"]) == set(test_types), \
        f"Expected {test_types}, got {data2.get('excluded_absence_types')}"
    print(f"PASS: excluded_absence_types persisted correctly: {data2['excluded_absence_types']}")

    # Restore original
    session.put(f"{BASE_URL}/api/settings", json={"excluded_absence_types": original.get("excluded_absence_types", [])})

def test_put_settings_intervention_types(session):
    """PUT /api/settings with intervention_types persists correctly"""
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    original = r.json()

    test_ints = ["TEST_Mentoring", "TEST_Counselling"]
    r = session.put(f"{BASE_URL}/api/settings", json={"intervention_types": test_ints})
    assert r.status_code == 200, f"PUT failed: {r.text}"

    r2 = session.get(f"{BASE_URL}/api/settings")
    data2 = r2.json()
    assert "intervention_types" in data2, "Settings missing intervention_types"
    assert set(data2["intervention_types"]) == set(test_ints), \
        f"Expected {test_ints}, got {data2.get('intervention_types')}"
    print(f"PASS: intervention_types persisted: {data2['intervention_types']}")

    # Restore
    session.put(f"{BASE_URL}/api/settings", json={"intervention_types": original.get("intervention_types", [])})
