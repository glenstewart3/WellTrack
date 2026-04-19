"""
Pre-deployment comprehensive backend test for WellTrack MTSS platform.
Tests: auth, public-settings, backups, users, dashboard APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION = "test_session_predeployment_1773986449495"


@pytest.fixture(scope="module")
def auth_headers():
    return {"Cookie": f"session_token={SESSION}"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.cookies.set("session_token", SESSION)
    return s


# ── Auth endpoints ────────────────────────────────────────────────────────────

class TestAuthEndpoints:
    """Auth flow endpoints"""

    def test_google_oauth_redirect(self):
        """GET /api/auth/google must redirect (307) to Google"""
        r = requests.get(f"{BASE_URL}/api/auth/google", allow_redirects=False)
        assert r.status_code in (307, 302), f"Expected redirect, got {r.status_code}"
        assert "accounts.google.com" in r.headers.get("location", ""), "Redirect should be to Google"
        print("PASS: Google OAuth redirect works")

    def test_auth_me_with_session(self, client):
        """GET /api/auth/me with valid session returns user"""
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "user_id" in data
        assert data.get("role") == "admin"
        print(f"PASS: /api/auth/me returned user {data.get('email')}")

    def test_auth_me_without_session(self):
        """GET /api/auth/me without session returns 401"""
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: /api/auth/me without session returns 401")

    def test_login_email_disabled(self):
        """POST /api/auth/login-email returns 403 when email auth is disabled"""
        r = requests.post(f"{BASE_URL}/api/auth/login-email",
                          json={"email": "test@example.com", "password": "pass"})
        # May be 403 (disabled) or 401 (enabled but wrong creds)
        assert r.status_code in (401, 403), f"Expected 401 or 403, got {r.status_code}"
        print(f"PASS: login-email returned {r.status_code}")

    def test_change_password_requires_auth(self):
        """PUT /api/auth/change-password without auth returns 401"""
        r = requests.put(f"{BASE_URL}/api/auth/change-password",
                         json={"current_password": "old", "new_password": "newpass123"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: change-password requires auth")


# ── Public settings ───────────────────────────────────────────────────────────

class TestPublicSettings:
    """Public settings endpoint"""

    def test_public_settings_has_email_auth_field(self):
        """GET /api/public-settings returns email_auth_enabled field"""
        r = requests.get(f"{BASE_URL}/api/public-settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "email_auth_enabled" in data, f"Missing email_auth_enabled: {data}"
        assert isinstance(data["email_auth_enabled"], bool)
        print(f"PASS: public-settings has email_auth_enabled={data['email_auth_enabled']}")

    def test_public_settings_has_school_name(self):
        """GET /api/public-settings returns school_name"""
        r = requests.get(f"{BASE_URL}/api/public-settings")
        data = r.json()
        assert "school_name" in data
        print(f"PASS: public-settings school_name={data.get('school_name')}")


# ── Backups ───────────────────────────────────────────────────────────────────

class TestBackupsAPI:
    """Backup endpoints - require auth"""

    def test_backups_list_requires_auth(self):
        """GET /api/backups without auth returns 401"""
        r = requests.get(f"{BASE_URL}/api/backups")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: /api/backups requires auth")

    def test_backups_trigger_requires_auth(self):
        """POST /api/backups/trigger without auth returns 401"""
        r = requests.post(f"{BASE_URL}/api/backups/trigger")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: /api/backups/trigger requires auth")

    def test_backups_list_with_auth(self, client):
        """GET /api/backups with auth returns backup list"""
        r = client.get(f"{BASE_URL}/api/backups")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "backups" in data
        assert isinstance(data["backups"], list)
        print(f"PASS: /api/backups returned {len(data['backups'])} backups")

    def test_backups_trigger_with_auth(self, client):
        """POST /api/backups/trigger with auth creates a backup"""
        r = client.post(f"{BASE_URL}/api/backups/trigger")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "filename" in data
        assert data.get("message") == "Backup created successfully"
        print(f"PASS: Backup triggered: {data.get('filename')}")


# ── Users/User Management ─────────────────────────────────────────────────────

class TestUserManagement:
    """User management endpoints"""

    def test_get_users_requires_auth(self):
        """GET /api/users without auth returns 401"""
        r = requests.get(f"{BASE_URL}/api/users")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: /api/users requires auth")

    def test_get_users_with_auth(self, client):
        """GET /api/users with admin auth returns user list"""
        r = client.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: /api/users returned {len(data)} users")

    def test_set_password_requires_admin(self):
        """POST /api/users/{id}/set-password without auth returns 401"""
        r = requests.post(f"{BASE_URL}/api/users/fake_user/set-password",
                          json={"password": "TestPass123!"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("PASS: set-password requires auth (401 without session)")


# ── Dashboard & Analytics ─────────────────────────────────────────────────────

class TestDashboardAPIs:
    """Dashboard data endpoints"""

    def test_tier_distribution(self, client):
        """GET /api/analytics/tier-distribution returns tier data"""
        r = client.get(f"{BASE_URL}/api/analytics/tier-distribution")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print("PASS: tier-distribution returned 200")

    def test_alerts(self, client):
        """GET /api/alerts returns alert list"""
        r = client.get(f"{BASE_URL}/api/alerts")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: /api/alerts returned {len(data)} alerts")

    def test_students(self, client):
        """GET /api/students returns student list"""
        r = client.get(f"{BASE_URL}/api/students")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: /api/students returned {len(data)} students")

    def test_school_settings(self, client):
        """GET /api/settings returns school settings"""
        r = client.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "school_name" in data
        print(f"PASS: /api/settings returned school_name={data.get('school_name')}")
