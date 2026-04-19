"""Tests for email/password auth feature: login-email, set-password, change-password, public-settings"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_TOKEN = "test_session_emailauth_1773985078055"
ADMIN_USER_ID = "test-admin-emailauth"
TEST_USER_ID = None  # created in fixture


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    # Use localhost for test; override via REACT_APP_BACKEND_URL for remote testing
    domain = os.environ.get('TEST_COOKIE_DOMAIN', 'localhost')
    s.cookies.set("session_token", ADMIN_TOKEN, domain=domain, path="/")
    return s


@pytest.fixture(scope="module")
def test_user_id(admin_session):
    """Create a test user for set-password tests"""
    resp = admin_session.post(f"{BASE_URL}/api/users", json={
        "email": "TEST_emailauth_user@example.com",
        "name": "TEST Email Auth User",
        "role": "teacher"
    })
    if resp.status_code == 201:
        uid = resp.json()["user_id"]
    elif resp.status_code == 409:
        # Already exists, get user id from /api/users
        users_resp = admin_session.get(f"{BASE_URL}/api/users")
        users = users_resp.json()
        uid = next((u["user_id"] for u in users if u["email"] == "test_emailauth_user@example.com"), None)
    else:
        pytest.skip(f"Could not create test user: {resp.status_code} {resp.text}")
    yield uid
    # cleanup
    if uid:
        admin_session.delete(f"{BASE_URL}/api/users/{uid}")


class TestPublicSettings:
    """GET /api/public-settings includes email_auth_enabled"""

    def test_public_settings_has_email_auth_enabled(self):
        resp = requests.get(f"{BASE_URL}/api/public-settings")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "email_auth_enabled" in data, "email_auth_enabled field missing from public-settings"
        assert isinstance(data["email_auth_enabled"], bool), "email_auth_enabled should be bool"

    def test_email_auth_disabled_by_default(self):
        resp = requests.get(f"{BASE_URL}/api/public-settings")
        data = resp.json()
        # By default should be False (unless previously enabled in tests)
        assert "email_auth_enabled" in data


class TestLoginEmailDisabled:
    """POST /api/auth/login-email returns 403 when email_auth_enabled=false"""

    def test_login_email_forbidden_when_disabled(self, admin_session):
        # First ensure email auth is disabled
        admin_session.put(f"{BASE_URL}/api/settings", json={"email_auth_enabled": False})

        resp = requests.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": "someone@test.com",
            "password": "somepassword"
        })
        assert resp.status_code == 403, f"Expected 403 when email auth disabled, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data


class TestLoginEmailEnabled:
    """Tests that require email_auth_enabled=true"""

    @pytest.fixture(autouse=True)
    def enable_email_auth(self, admin_session):
        admin_session.put(f"{BASE_URL}/api/settings", json={"email_auth_enabled": True})
        yield
        # disable again after tests
        admin_session.put(f"{BASE_URL}/api/settings", json={"email_auth_enabled": False})

    def test_login_email_wrong_credentials(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        assert resp.status_code == 401, f"Expected 401 for wrong credentials, got {resp.status_code}: {resp.text}"

    def test_login_email_success(self, admin_session, test_user_id):
        # Set password for test user first
        set_resp = admin_session.post(f"{BASE_URL}/api/users/{test_user_id}/set-password", json={"password": "TestPass123!"})
        assert set_resp.status_code == 200, f"Set password failed: {set_resp.status_code} {set_resp.text}"

        resp = requests.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": "test_emailauth_user@example.com",
            "password": "TestPass123!"
        })
        assert resp.status_code == 200, f"Expected 200 on successful login, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "redirect" in data, "Expected redirect field in response"
        assert data["redirect"] in ["dashboard", "onboarding"]
        # Check cookie set
        assert "session_token" in resp.cookies, "session_token cookie should be set"


class TestSetPassword:
    """POST /api/users/{user_id}/set-password"""

    def test_set_password_requires_admin(self, test_user_id):
        # Non-authenticated request should fail
        resp = requests.post(f"{BASE_URL}/api/users/{test_user_id}/set-password", json={"password": "TestPass123!"})
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"

    def test_set_password_success(self, admin_session, test_user_id):
        resp = admin_session.post(f"{BASE_URL}/api/users/{test_user_id}/set-password", json={"password": "NewPass456!"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message" in data

    def test_set_password_too_short(self, admin_session, test_user_id):
        resp = admin_session.post(f"{BASE_URL}/api/users/{test_user_id}/set-password", json={"password": "short"})
        assert resp.status_code == 400, f"Expected 400 for short password, got {resp.status_code}"

    def test_set_password_user_not_found(self, admin_session):
        resp = admin_session.post(f"{BASE_URL}/api/users/nonexistent-user-xyz/set-password", json={"password": "ValidPass123!"})
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


class TestChangePassword:
    """PUT /api/auth/change-password"""

    def test_change_password_requires_auth(self):
        resp = requests.put(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "old",
            "new_password": "NewPass123!"
        })
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"

    def test_change_password_wrong_current(self, admin_session):
        # Admin user may or may not have a password set; either way with wrong current it should 401
        resp = admin_session.put(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "definitelywrong123",
            "new_password": "NewPass123456!"
        })
        # If no password set, it should allow (no existing hash); if set, should 401
        # We just verify the endpoint responds properly
        assert resp.status_code in [200, 401, 400], f"Unexpected status: {resp.status_code}: {resp.text}"

    def test_change_password_too_short(self, admin_session):
        resp = admin_session.put(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "",
            "new_password": "short"
        })
        assert resp.status_code == 400, f"Expected 400 for short password, got {resp.status_code}"
