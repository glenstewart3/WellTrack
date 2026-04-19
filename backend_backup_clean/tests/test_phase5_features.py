"""
Test Phase 5 Features: Tenant-scoped file storage, Onboarding update, Impersonation
"""
import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@welltrack.com.au"
SUPER_ADMIN_PASSWORD = "superadmin123"
DEMO_ADMIN_EMAIL = "admin@test.com"
DEMO_ADMIN_PASSWORD = "password123"
MOOROOPNA_ADMIN_EMAIL = "jane@mooroopna.edu.au"
MOOROOPNA_ADMIN_PASSWORD = "mooroopna123"


class TestSetup:
    """Setup and verify test environment"""
    
    @pytest.fixture(scope="class")
    def sa_session(self):
        """Get Super Admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        resp = session.post(f"{BASE_URL}/api/superadmin/auth/login-email", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"SA login failed: {resp.status_code} - {resp.text}")
        return session
    
    @pytest.fixture(scope="class")
    def demo_session(self):
        """Get Demo school admin session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Demo login failed: {resp.status_code} - {resp.text}")
        return session
    
    def test_sa_login(self, sa_session):
        """Verify SA login works"""
        resp = sa_session.get(f"{BASE_URL}/api/superadmin/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == SUPER_ADMIN_EMAIL
        print(f"✓ SA login verified: {data.get('name')}")
    
    def test_demo_login(self, demo_session):
        """Verify Demo school login works"""
        resp = demo_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == DEMO_ADMIN_EMAIL
        print(f"✓ Demo login verified: {data.get('name')}")


class TestTenantScopedPhotos:
    """Phase 5: Tenant-scoped student photo storage"""
    
    @pytest.fixture(scope="class")
    def demo_session(self):
        """Get Demo school admin session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Demo login failed: {resp.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def test_student_id(self, demo_session):
        """Get or create a test student"""
        # First try to get existing students
        resp = demo_session.get(f"{BASE_URL}/api/students")
        if resp.status_code == 200 and resp.json():
            return resp.json()[0]["student_id"]
        
        # Create a test student if none exist
        resp = demo_session.post(f"{BASE_URL}/api/students", json={
            "first_name": "TEST_Photo",
            "last_name": "Student",
            "year_level": "Year 5",
            "class_name": "5A"
        })
        if resp.status_code in (200, 201):
            return resp.json()["student_id"]
        pytest.skip("Could not get or create test student")
    
    def test_upload_student_photo(self, demo_session, test_student_id):
        """POST /api/students/{id}/photo stores file in tenant-scoped directory"""
        # Create a test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        # Remove Content-Type header for multipart upload
        headers = dict(demo_session.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        
        resp = requests.post(
            f"{BASE_URL}/api/students/{test_student_id}/photo",
            files={"file": ("test.jpg", img_bytes, "image/jpeg")},
            cookies=demo_session.cookies,
            headers={"X-Tenant-Slug": "demo"}
        )
        
        assert resp.status_code == 200, f"Photo upload failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "photo_url" in data
        # Verify URL format: /api/student-photos/{slug}/{filename}
        assert "/api/student-photos/demo/" in data["photo_url"], f"Unexpected URL format: {data['photo_url']}"
        print(f"✓ Photo uploaded: {data['photo_url']}")
        return data["photo_url"]
    
    def test_photo_url_format(self, demo_session, test_student_id):
        """Photo URL format: /api/student-photos/welltrack-preview/{filename}"""
        # Get student to check photo_url
        resp = demo_session.get(f"{BASE_URL}/api/students/{test_student_id}")
        assert resp.status_code == 200
        data = resp.json()
        
        if data.get("photo_url"):
            # URL should be /api/student-photos/{slug}/{filename}
            assert data["photo_url"].startswith("/api/student-photos/"), f"Invalid URL format: {data['photo_url']}"
            print(f"✓ Photo URL format correct: {data['photo_url']}")
        else:
            # Upload a photo first
            img = Image.new('RGB', (100, 100), color='blue')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
            
            resp = requests.post(
                f"{BASE_URL}/api/students/{test_student_id}/photo",
                files={"file": ("test.jpg", img_bytes, "image/jpeg")},
                cookies=demo_session.cookies,
                headers={"X-Tenant-Slug": "demo"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "/api/student-photos/demo/" in data["photo_url"]
            print(f"✓ Photo URL format correct: {data['photo_url']}")
    
    def test_serve_student_photo(self, demo_session, test_student_id):
        """GET /api/student-photos/{slug}/{filename} serves the photo"""
        # First ensure photo exists
        resp = demo_session.get(f"{BASE_URL}/api/students/{test_student_id}")
        assert resp.status_code == 200
        student = resp.json()
        
        photo_url = student.get("photo_url")
        if not photo_url:
            # Upload a photo first
            img = Image.new('RGB', (100, 100), color='green')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
            
            resp = requests.post(
                f"{BASE_URL}/api/students/{test_student_id}/photo",
                files={"file": ("test.jpg", img_bytes, "image/jpeg")},
                cookies=demo_session.cookies,
                headers={"X-Tenant-Slug": "demo"}
            )
            assert resp.status_code == 200
            photo_url = resp.json()["photo_url"]
        
        # Now fetch the photo
        resp = requests.get(f"{BASE_URL}{photo_url}")
        assert resp.status_code == 200, f"Photo fetch failed: {resp.status_code}"
        assert resp.headers.get("content-type", "").startswith("image/"), f"Not an image: {resp.headers.get('content-type')}"
        print(f"✓ Photo served successfully from {photo_url}")
    
    def test_delete_student_photo(self, demo_session, test_student_id):
        """DELETE /api/students/{id}/photo removes the photo file"""
        # First ensure photo exists
        img = Image.new('RGB', (100, 100), color='yellow')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        resp = requests.post(
            f"{BASE_URL}/api/students/{test_student_id}/photo",
            files={"file": ("test.jpg", img_bytes, "image/jpeg")},
            cookies=demo_session.cookies,
            headers={"X-Tenant-Slug": "demo"}
        )
        assert resp.status_code == 200
        photo_url = resp.json()["photo_url"]
        
        # Delete the photo
        resp = demo_session.delete(f"{BASE_URL}/api/students/{test_student_id}/photo")
        assert resp.status_code == 200, f"Photo delete failed: {resp.status_code} - {resp.text}"
        
        # Verify photo is gone
        resp = demo_session.get(f"{BASE_URL}/api/students/{test_student_id}")
        assert resp.status_code == 200
        student = resp.json()
        assert not student.get("photo_url"), f"Photo URL still present: {student.get('photo_url')}"
        
        # Verify file is gone (should return 404)
        resp = requests.get(f"{BASE_URL}{photo_url}")
        assert resp.status_code == 404, f"Photo file still exists: {resp.status_code}"
        print("✓ Photo deleted successfully")


class TestTenantScopedBackups:
    """Phase 5: Tenant-scoped backup storage"""
    
    @pytest.fixture(scope="class")
    def demo_session(self):
        """Get Demo school admin session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Demo login failed: {resp.status_code}")
        return session
    
    def test_list_backups(self, demo_session):
        """GET /api/backups lists tenant-scoped backups"""
        resp = demo_session.get(f"{BASE_URL}/api/backups")
        assert resp.status_code == 200, f"List backups failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "backups" in data
        print(f"✓ Backups listed: {len(data['backups'])} backups found")
    
    def test_trigger_backup(self, demo_session):
        """POST /api/backups/trigger creates backup in tenant-scoped dir"""
        resp = demo_session.post(f"{BASE_URL}/api/backups/trigger")
        assert resp.status_code == 200, f"Trigger backup failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "filename" in data
        assert "welltrack_backup_" in data["filename"]
        assert "size_kb" in data
        print(f"✓ Backup created: {data['filename']} ({data['size_kb']} KB)")
        return data["filename"]
    
    def test_backup_appears_in_list(self, demo_session):
        """Verify triggered backup appears in list"""
        # Trigger a backup
        resp = demo_session.post(f"{BASE_URL}/api/backups/trigger")
        assert resp.status_code == 200
        filename = resp.json()["filename"]
        
        # List backups
        resp = demo_session.get(f"{BASE_URL}/api/backups")
        assert resp.status_code == 200
        backups = resp.json()["backups"]
        
        filenames = [b["filename"] for b in backups]
        assert filename in filenames, f"Backup {filename} not in list: {filenames}"
        print(f"✓ Backup {filename} appears in list")


class TestOnboardingUpdate:
    """Onboarding flow updates: skip Step 1 when logged in"""
    
    @pytest.fixture(scope="class")
    def demo_session(self):
        """Get Demo school admin session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Demo login failed: {resp.status_code}")
        return session
    
    def test_onboarding_status_returns_complete_flag(self, demo_session):
        """GET /api/onboarding/status returns complete based on onboarding_complete flag"""
        resp = demo_session.get(f"{BASE_URL}/api/onboarding/status")
        assert resp.status_code == 200, f"Onboarding status failed: {resp.status_code}"
        data = resp.json()
        assert "complete" in data
        assert "has_users" in data
        assert "school_name" in data
        print(f"✓ Onboarding status: complete={data['complete']}, has_users={data['has_users']}")
    
    def test_school_setup_requires_auth(self):
        """POST /api/onboarding/school-setup requires auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/onboarding/school-setup", json={
            "school_name": "Test School",
            "school_type": "primary"
        })
        # Should fail without auth
        assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"
        print("✓ POST /api/onboarding/school-setup requires auth")
    
    def test_school_setup_with_auth(self, demo_session):
        """POST /api/onboarding/school-setup with auth (should fail if already complete)"""
        resp = demo_session.post(f"{BASE_URL}/api/onboarding/school-setup", json={
            "school_name": "Demo School Updated",
            "school_type": "both",
            "current_term": "Term 1"
        })
        # If onboarding already complete, should return 400
        # If not complete, should return 200
        assert resp.status_code in (200, 400), f"Unexpected status: {resp.status_code} - {resp.text}"
        if resp.status_code == 400:
            assert "already" in resp.json().get("detail", "").lower()
            print("✓ POST /api/onboarding/school-setup correctly rejects (already complete)")
        else:
            print("✓ POST /api/onboarding/school-setup succeeded")


class TestImpersonation:
    """Impersonation feature: SA creates token, school validates"""
    
    @pytest.fixture(scope="class")
    def sa_session(self):
        """Get Super Admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        resp = session.post(f"{BASE_URL}/api/superadmin/auth/login-email", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"SA login failed: {resp.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def demo_school_id(self, sa_session):
        """Get demo school ID"""
        resp = sa_session.get(f"{BASE_URL}/api/superadmin/schools")
        assert resp.status_code == 200
        schools = resp.json()
        demo = next((s for s in schools if s.get("slug") == "demo"), None)
        if not demo:
            pytest.skip("Demo school not found")
        return demo["school_id"]
    
    def test_create_impersonation_token(self, sa_session, demo_school_id):
        """POST /api/superadmin/schools/{school_id}/impersonate returns a token"""
        resp = sa_session.post(f"{BASE_URL}/api/superadmin/schools/{demo_school_id}/impersonate")
        assert resp.status_code == 200, f"Impersonate failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "token" in data
        assert data["token"].startswith("imp_")
        assert "school_slug" in data
        assert data["school_slug"] == "demo"
        print(f"✓ Impersonation token created: {data['token'][:20]}...")
        return data["token"]
    
    def test_impersonate_endpoint_redirects(self, sa_session, demo_school_id):
        """GET /api/auth/impersonate?token=... creates session and redirects"""
        # Create token
        resp = sa_session.post(f"{BASE_URL}/api/superadmin/schools/{demo_school_id}/impersonate")
        assert resp.status_code == 200
        token = resp.json()["token"]
        
        # Use token (don't follow redirects to check response)
        session = requests.Session()
        session.headers.update({"X-Tenant-Slug": "demo"})
        resp = session.get(f"{BASE_URL}/api/auth/impersonate?token={token}", allow_redirects=False)
        
        # Should redirect to dashboard
        assert resp.status_code in (302, 307), f"Expected redirect, got {resp.status_code}"
        location = resp.headers.get("Location", "")
        assert "dashboard" in location, f"Expected redirect to dashboard, got: {location}"
        print(f"✓ Impersonate redirects to: {location}")
    
    def test_invalid_token_rejected(self):
        """Invalid/expired/used tokens are rejected"""
        session = requests.Session()
        session.headers.update({"X-Tenant-Slug": "demo"})
        
        # Test with invalid token
        resp = session.get(f"{BASE_URL}/api/auth/impersonate?token=invalid_token_123", allow_redirects=False)
        assert resp.status_code in (302, 307)
        location = resp.headers.get("Location", "")
        assert "error" in location, f"Expected error redirect, got: {location}"
        print(f"✓ Invalid token rejected: {location}")
    
    def test_used_token_rejected(self, sa_session, demo_school_id):
        """Used tokens are rejected on second use"""
        # Create token
        resp = sa_session.post(f"{BASE_URL}/api/superadmin/schools/{demo_school_id}/impersonate")
        assert resp.status_code == 200
        token = resp.json()["token"]
        
        # Use token first time
        session1 = requests.Session()
        session1.headers.update({"X-Tenant-Slug": "demo"})
        resp1 = session1.get(f"{BASE_URL}/api/auth/impersonate?token={token}", allow_redirects=False)
        assert resp1.status_code in (302, 307)
        
        # Try to use same token again
        session2 = requests.Session()
        session2.headers.update({"X-Tenant-Slug": "demo"})
        resp2 = session2.get(f"{BASE_URL}/api/auth/impersonate?token={token}", allow_redirects=False)
        assert resp2.status_code in (302, 307)
        location = resp2.headers.get("Location", "")
        assert "error" in location or "token_used" in location, f"Expected error for used token, got: {location}"
        print("✓ Used token rejected on second use")
    
    def test_cannot_impersonate_inactive_school(self, sa_session):
        """Cannot impersonate suspended/archived schools"""
        # Get schools and find one that's not active (or skip)
        resp = sa_session.get(f"{BASE_URL}/api/superadmin/schools")
        assert resp.status_code == 200
        schools = resp.json()
        
        inactive = next((s for s in schools if s.get("status") in ("suspended", "archived")), None)
        if not inactive:
            pytest.skip("No inactive schools to test")
        
        resp = sa_session.post(f"{BASE_URL}/api/superadmin/schools/{inactive['school_id']}/impersonate")
        assert resp.status_code == 400, f"Expected 400 for inactive school, got {resp.status_code}"
        print("✓ Cannot impersonate inactive school")


class TestExistingFeatures:
    """Verify existing features still work"""
    
    @pytest.fixture(scope="class")
    def demo_session(self):
        """Get Demo school admin session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "X-Tenant-Slug": "demo"
        })
        resp = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Demo login failed: {resp.status_code}")
        return session
    
    def test_analytics_data(self, demo_session):
        """Analytics endpoints work"""
        resp = demo_session.get(f"{BASE_URL}/api/analytics/tier-distribution")
        assert resp.status_code == 200, f"Analytics failed: {resp.status_code}"
        print("✓ Analytics data loads")
    
    def test_students_list(self, demo_session):
        """Students list works"""
        resp = demo_session.get(f"{BASE_URL}/api/students")
        assert resp.status_code == 200, f"Students list failed: {resp.status_code}"
        print(f"✓ Students list: {len(resp.json())} students")
    
    def test_settings(self, demo_session):
        """Settings endpoint works"""
        resp = demo_session.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200, f"Settings failed: {resp.status_code}"
        print("✓ Settings loads")
    
    def test_users_list(self, demo_session):
        """Users list works"""
        resp = demo_session.get(f"{BASE_URL}/api/users")
        assert resp.status_code == 200, f"Users list failed: {resp.status_code}"
        print(f"✓ Users list: {len(resp.json())} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
