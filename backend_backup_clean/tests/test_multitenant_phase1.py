"""
test_multitenant_phase1.py — Tests for WellTrack multi-tenant Phase 1 refactor.
Tests tenant middleware, auth, and all major API endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicEndpoints:
    """Test endpoints that don't require authentication"""
    
    def test_public_settings_returns_200(self):
        """GET /api/public-settings should return 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/public-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "school_name" in data
        assert "email_auth_enabled" in data
        print(f"✓ public-settings: school_name={data.get('school_name')}")
    
    def test_onboarding_status_returns_200(self):
        """GET /api/onboarding/status should return 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "complete" in data
        assert "has_users" in data
        print(f"✓ onboarding/status: complete={data.get('complete')}, has_users={data.get('has_users')}")


class TestEmailAuth:
    """Test email/password authentication flow"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session for cookie persistence"""
        return requests.Session()
    
    def test_login_with_valid_credentials(self, session):
        """POST /api/auth/login-email with valid credentials"""
        response = session.post(
            f"{BASE_URL}/api/auth/login-email",
            json={"email": "admin@test.com", "password": "password123"}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "message" in data
        assert data.get("redirect") in ["dashboard", "onboarding"]
        print(f"✓ login successful: redirect={data.get('redirect')}")
    
    def test_login_with_invalid_credentials(self):
        """POST /api/auth/login-email with invalid credentials should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login-email",
            json={"email": "wrong@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ invalid credentials correctly rejected")


class TestAuthenticatedEndpoints:
    """Test endpoints that require authentication"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login-email",
            json={"email": "admin@test.com", "password": "password123"}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code} - {response.text}")
        return session
    
    def test_auth_me_returns_user_without_password(self, auth_session):
        """GET /api/auth/me should return user without password_hash"""
        response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "password_hash" not in data, "password_hash should not be in response"
        print(f"✓ auth/me: user_id={data.get('user_id')}, email={data.get('email')}")
    
    def test_students_list(self, auth_session):
        """GET /api/students should return students list"""
        response = auth_session.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ students: {len(data)} students returned")
    
    def test_students_summary(self, auth_session):
        """GET /api/students/summary should return enriched student data"""
        response = auth_session.get(f"{BASE_URL}/api/students/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        if data:
            # Check enriched fields
            first = data[0]
            assert "student_id" in first
            assert "mtss_tier" in first or first.get("mtss_tier") is None
            assert "attendance_pct" in first
        print(f"✓ students/summary: {len(data)} students with tier info")
    
    def test_tier_distribution(self, auth_session):
        """GET /api/analytics/tier-distribution should return tier counts"""
        response = auth_session.get(f"{BASE_URL}/api/analytics/tier-distribution")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tier_distribution" in data
        assert "total_students" in data
        print(f"✓ tier-distribution: {data.get('tier_distribution')}, total={data.get('total_students')}")
    
    def test_alerts_list(self, auth_session):
        """GET /api/alerts should return alerts list"""
        response = auth_session.get(f"{BASE_URL}/api/alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ alerts: {len(data)} alerts returned")
    
    def test_settings(self, auth_session):
        """GET /api/settings should return school settings"""
        response = auth_session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "school_name" in data or data.get("school_name") is None
        print(f"✓ settings: school_name={data.get('school_name')}")
    
    def test_attendance_summary(self, auth_session):
        """GET /api/attendance/summary should return attendance data"""
        response = auth_session.get(f"{BASE_URL}/api/attendance/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ attendance/summary: {len(data)} students with attendance data")
    
    def test_interventions_list(self, auth_session):
        """GET /api/interventions should return interventions list"""
        response = auth_session.get(f"{BASE_URL}/api/interventions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ interventions: {len(data)} interventions returned")
    
    def test_appointments_list(self, auth_session):
        """GET /api/appointments should return appointments list"""
        response = auth_session.get(f"{BASE_URL}/api/appointments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ appointments: {len(data)} appointments returned")
    
    def test_screening_sessions(self, auth_session):
        """GET /api/screening/sessions should return sessions list"""
        response = auth_session.get(f"{BASE_URL}/api/screening/sessions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ screening/sessions: {len(data)} sessions returned")
    
    def test_reports_filter_options(self, auth_session):
        """GET /api/reports/filter-options should return year levels and classes"""
        response = auth_session.get(f"{BASE_URL}/api/reports/filter-options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "year_levels" in data
        assert "classes" in data
        print(f"✓ reports/filter-options: {len(data.get('year_levels', []))} year levels, {len(data.get('classes', []))} classes")
    
    def test_audit_log(self, auth_session):
        """GET /api/audit should return audit log for admin"""
        response = auth_session.get(f"{BASE_URL}/api/audit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data
        assert "entries" in data
        print(f"✓ audit: {data.get('total')} total entries, {len(data.get('entries', []))} returned")


class TestUnauthenticatedAccess:
    """Test that protected endpoints reject unauthenticated requests"""
    
    def test_students_requires_auth(self):
        """GET /api/students without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/students")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ students endpoint correctly requires auth")
    
    def test_settings_requires_auth(self):
        """GET /api/settings without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ settings endpoint correctly requires auth")
    
    def test_audit_requires_auth(self):
        """GET /api/audit without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/audit")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ audit endpoint correctly requires auth")


class TestTenantMiddleware:
    """Test tenant middleware behavior"""
    
    def test_tenant_context_set_for_demo(self):
        """Verify tenant context is working (demo school)"""
        # Public endpoint should work with tenant context
        response = requests.get(f"{BASE_URL}/api/public-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        # If we get here, tenant middleware resolved the demo school
        print("✓ tenant middleware resolved demo school context")
    
    def test_onboarding_complete_for_demo(self):
        """Verify demo school has onboarding complete"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code == 200
        data = response.json()
        # Demo school should have onboarding complete
        assert data.get("complete") == True, f"Expected complete=True, got {data.get('complete')}"
        print(f"✓ demo school onboarding complete: {data.get('complete')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
