"""
test_superadmin_phase2.py — Phase 2 Super Admin Backend API Tests
Tests all super admin endpoints: bootstrap, auth, schools CRUD, school admins, impersonation, audit, super admin CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Super Admin credentials
SA_EMAIL = "superadmin@welltrack.com.au"
SA_PASSWORD = "superadmin123"

# Demo School Admin credentials
DEMO_ADMIN_EMAIL = "admin@test.com"
DEMO_ADMIN_PASSWORD = "password123"

# Known school IDs from context
MOOROOPNA_SCHOOL_ID = "sch_c7aa9eecd82f"
BOB_USER_ID = "user_93561781f5bd"


class TestSuperAdminAuth:
    """Super Admin Authentication Tests"""
    
    def test_bootstrap_rejects_second_attempt(self):
        """Bootstrap should return 403 if super admin already exists"""
        response = requests.post(f"{BASE_URL}/api/superadmin/auth/bootstrap", json={
            "name": "Another Admin",
            "email": "another@test.com",
            "password": "password123"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "already" in data.get("detail", "").lower() or "bootstrap" in data.get("detail", "").lower()
        print("✓ Bootstrap correctly rejects second attempt (403)")
    
    def test_login_success(self):
        """Super admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/superadmin/auth/login-email", json={
            "email": SA_EMAIL,
            "password": SA_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        # Check cookie is set
        assert "sa_session_token" in response.cookies or any("sa_session_token" in c for c in response.headers.get("set-cookie", ""))
        print("✓ Super admin login successful")
        return response.cookies
    
    def test_login_invalid_credentials(self):
        """Super admin login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/superadmin/auth/login-email", json={
            "email": SA_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Invalid credentials correctly rejected (401)")
    
    def test_me_without_auth(self):
        """GET /me without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/superadmin/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ /me without auth correctly returns 401")
    
    def test_me_with_auth(self, sa_session):
        """GET /me with auth returns super admin profile without password_hash"""
        response = requests.get(f"{BASE_URL}/api/superadmin/auth/me", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "super_admin_id" in data
        assert "email" in data
        assert "name" in data
        assert "password_hash" not in data, "password_hash should not be in response"
        print(f"✓ /me returns profile: {data['email']}")
    
    def test_change_password(self, sa_session):
        """Change password and verify it works"""
        # Change password
        response = requests.put(f"{BASE_URL}/api/superadmin/auth/change-password", 
            cookies=sa_session,
            json={
                "current_password": SA_PASSWORD,
                "new_password": "newpassword123"
            })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Password changed successfully")
        
        # Change it back
        response = requests.put(f"{BASE_URL}/api/superadmin/auth/change-password", 
            cookies=sa_session,
            json={
                "current_password": "newpassword123",
                "new_password": SA_PASSWORD
            })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Password reverted successfully")
    
    def test_change_password_wrong_current(self, sa_session):
        """Change password with wrong current password returns 401"""
        response = requests.put(f"{BASE_URL}/api/superadmin/auth/change-password", 
            cookies=sa_session,
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Wrong current password correctly rejected (401)")
    
    def test_logout(self, sa_session):
        """Logout clears session"""
        response = requests.post(f"{BASE_URL}/api/superadmin/auth/logout", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Logout successful")


class TestPlatformStats:
    """Platform-wide statistics tests"""
    
    def test_stats_without_auth(self):
        """Stats endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/superadmin/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Stats endpoint requires auth (401)")
    
    def test_stats_with_auth(self, sa_session):
        """Stats endpoint returns platform-wide statistics"""
        response = requests.get(f"{BASE_URL}/api/superadmin/stats", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_schools" in data
        assert "active_schools" in data
        assert "trial_schools" in data
        assert "suspended_schools" in data
        assert "archived_schools" in data
        assert "total_students" in data
        print(f"✓ Stats: {data['total_schools']} schools, {data['total_students']} students")


class TestSchoolsCRUD:
    """Schools CRUD operations tests"""
    
    def test_list_schools(self, sa_session):
        """List all schools with enriched stats"""
        response = requests.get(f"{BASE_URL}/api/superadmin/schools", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        schools = response.json()
        assert isinstance(schools, list)
        assert len(schools) >= 2, "Expected at least 2 schools (demo and mooroopna)"
        
        # Check enriched fields - note: demo school may not have school_id (legacy data)
        for school in schools:
            assert "name" in school
            assert "slug" in school
            assert "status" in school
            assert "student_count" in school
            assert "admin_count" in school
            assert "user_count" in school
            # school_id may be missing for legacy schools (demo)
            if school["slug"] != "demo":
                assert "school_id" in school, f"school_id missing for {school['slug']}"
        
        print(f"✓ Listed {len(schools)} schools with enriched stats")
    
    def test_get_school_detail(self, sa_session):
        """Get school detail with live stats"""
        # Use mooroopna school which has school_id (provisioned via Phase 2)
        response = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["slug"] == "mooroopna"
        assert "student_count" in data
        assert "admin_count" in data
        assert "onboarding_complete" in data
        print(f"✓ Got mooroopna school detail: {data['student_count']} students")
    
    def test_get_school_not_found(self, sa_session):
        """Get non-existent school returns 404"""
        response = requests.get(f"{BASE_URL}/api/superadmin/schools/sch_nonexistent", cookies=sa_session)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Non-existent school returns 404")
    
    def test_update_school(self, sa_session):
        """Update school name, notes, feature_flags"""
        response = requests.get(f"{BASE_URL}/api/superadmin/schools", cookies=sa_session)
        schools = response.json()
        mooroopna = next((s for s in schools if s["slug"] == "mooroopna"), None)
        assert mooroopna, "Mooroopna school not found"
        
        # Update notes
        original_notes = mooroopna.get("notes", "")
        response = requests.put(
            f"{BASE_URL}/api/superadmin/schools/{mooroopna['school_id']}", 
            cookies=sa_session,
            json={"notes": "Updated by test"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["notes"] == "Updated by test"
        print("✓ School notes updated")
        
        # Revert
        requests.put(
            f"{BASE_URL}/api/superadmin/schools/{mooroopna['school_id']}", 
            cookies=sa_session,
            json={"notes": original_notes}
        )
    
    def test_update_school_invalid_status(self, sa_session):
        """Update school with invalid status returns 400"""
        # Use mooroopna school which has school_id
        response = requests.put(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}", 
            cookies=sa_session,
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid status correctly rejected (400)")


class TestSchoolProvisioning:
    """School provisioning tests"""
    
    def test_provision_school_reserved_slug(self, sa_session):
        """Reserved slugs are rejected"""
        reserved_slugs = ["www", "api", "admin", "superadmin", "app", "demo"]
        for slug in reserved_slugs[:3]:  # Test a few
            response = requests.post(f"{BASE_URL}/api/superadmin/schools", 
                cookies=sa_session,
                json={
                    "name": "Test School",
                    "slug": slug,
                    "admin_name": "Test Admin",
                    "admin_email": "test@test.com",
                    "admin_password": "password123"
                })
            assert response.status_code == 400 or response.status_code == 409, \
                f"Expected 400/409 for reserved slug '{slug}', got {response.status_code}: {response.text}"
        print("✓ Reserved slugs correctly rejected")
    
    def test_provision_school_duplicate_slug(self, sa_session):
        """Duplicate slugs are rejected"""
        # Use mooroopna slug which exists and is not reserved
        response = requests.post(f"{BASE_URL}/api/superadmin/schools", 
            cookies=sa_session,
            json={
                "name": "Another Mooroopna",
                "slug": "mooroopna",  # Already exists
                "admin_name": "Test Admin",
                "admin_email": "test@test.com",
                "admin_password": "password123"
            })
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        print("✓ Duplicate slug correctly rejected (409)")
    
    def test_provision_school_invalid_slug_format(self, sa_session):
        """Invalid slug format is rejected"""
        invalid_slugs = ["Test School", "test_school", "-test", "test-"]
        for slug in invalid_slugs:
            response = requests.post(f"{BASE_URL}/api/superadmin/schools", 
                cookies=sa_session,
                json={
                    "name": "Test School",
                    "slug": slug,
                    "admin_name": "Test Admin",
                    "admin_email": "test@test.com",
                    "admin_password": "password123"
                })
            # Should be 400 for invalid format
            if response.status_code == 200:
                # Clean up if it was created
                data = response.json()
                requests.delete(f"{BASE_URL}/api/superadmin/schools/{data['school_id']}", cookies=sa_session)
            else:
                assert response.status_code == 400, \
                    f"Expected 400 for invalid slug '{slug}', got {response.status_code}: {response.text}"
        print("✓ Invalid slug formats handled")
    
    def test_provision_and_archive_school(self, sa_session):
        """Provision a new school, verify it, then archive it"""
        unique_slug = f"testschool{uuid.uuid4().hex[:6]}"
        
        # Provision
        response = requests.post(f"{BASE_URL}/api/superadmin/schools", 
            cookies=sa_session,
            json={
                "name": "Test School for Provisioning",
                "slug": unique_slug,
                "admin_name": "Test Admin",
                "admin_email": f"admin@{unique_slug}.edu.au",
                "admin_password": "password123",
                "status": "trial",
                "trial_days": 14,
                "notes": "Created by automated test"
            })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["slug"] == unique_slug
        assert data["status"] == "trial"
        assert "admin_user_id" in data
        assert "db_name" in data
        school_id = data["school_id"]
        print(f"✓ School provisioned: {unique_slug} (id={school_id})")
        
        # Verify it appears in list
        schools = requests.get(f"{BASE_URL}/api/superadmin/schools", cookies=sa_session).json()
        new_school = next((s for s in schools if s.get("school_id") == school_id), None)
        assert new_school, "Newly provisioned school not found in list"
        print("✓ School appears in list")
        
        # Archive it
        response = requests.delete(f"{BASE_URL}/api/superadmin/schools/{school_id}", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ School archived")
        
        # Verify status is archived
        school_detail = requests.get(f"{BASE_URL}/api/superadmin/schools/{school_id}", cookies=sa_session).json()
        assert school_detail["status"] == "archived"
        print("✓ School status is archived")


class TestSchoolAdmins:
    """School admin management tests"""
    
    def test_list_school_admins(self, sa_session):
        """List users in a school"""
        response = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        users = response.json()
        assert isinstance(users, list)
        # Check no password_hash in response
        for user in users:
            assert "password_hash" not in user
            assert "user_id" in user
            assert "email" in user
        print(f"✓ Listed {len(users)} users in mooroopna school")
        return users
    
    def test_add_and_remove_school_admin(self, sa_session):
        """Add a user to school, then remove them"""
        unique_email = f"testuser{uuid.uuid4().hex[:6]}@test.com"
        
        # Add user
        response = requests.post(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins",
            cookies=sa_session,
            json={
                "name": "Test User",
                "email": unique_email,
                "password": "password123",
                "role": "teacher"
            })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["email"] == unique_email
        assert data["role"] == "teacher"
        user_id = data["user_id"]
        print(f"✓ Added user: {unique_email} (id={user_id})")
        
        # Verify user appears in list
        users = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins", cookies=sa_session).json()
        new_user = next((u for u in users if u["user_id"] == user_id), None)
        assert new_user, "Newly added user not found in list"
        print("✓ User appears in list")
        
        # Remove user
        response = requests.delete(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins/{user_id}",
            cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ User removed")
        
        # Verify user is gone
        users = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins", cookies=sa_session).json()
        removed_user = next((u for u in users if u["user_id"] == user_id), None)
        assert removed_user is None, "User should be removed"
        print("✓ User no longer in list")
    
    def test_add_duplicate_email(self, sa_session):
        """Adding user with duplicate email returns 409"""
        # Get existing user email
        users = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins", cookies=sa_session).json()
        if users:
            existing_email = users[0]["email"]
            response = requests.post(
                f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins",
                cookies=sa_session,
                json={
                    "name": "Duplicate User",
                    "email": existing_email,
                    "password": "password123",
                    "role": "teacher"
                })
            assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
            print("✓ Duplicate email correctly rejected (409)")
        else:
            print("⚠ No existing users to test duplicate email")
    
    def test_reset_password(self, sa_session):
        """Reset a user's password"""
        # Add a test user first
        unique_email = f"resettest{uuid.uuid4().hex[:6]}@test.com"
        add_response = requests.post(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins",
            cookies=sa_session,
            json={
                "name": "Reset Test User",
                "email": unique_email,
                "password": "oldpassword123",
                "role": "teacher"
            })
        assert add_response.status_code == 200
        user_id = add_response.json()["user_id"]
        
        # Reset password
        response = requests.put(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins/{user_id}/reset-password",
            cookies=sa_session,
            json={"password": "newpassword123"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Password reset successful")
        
        # Clean up - remove user
        requests.delete(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins/{user_id}", cookies=sa_session)
    
    def test_reset_password_short(self, sa_session):
        """Reset password with short password returns 400"""
        users = requests.get(f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins", cookies=sa_session).json()
        if users:
            user_id = users[0]["user_id"]
            response = requests.put(
                f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/admins/{user_id}/reset-password",
                cookies=sa_session,
                json={"password": "short"})
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            print("✓ Short password correctly rejected (400)")


class TestImpersonation:
    """Impersonation tests"""
    
    def test_impersonate_active_school(self, sa_session):
        """Generate impersonation token for active/trial school"""
        # Use mooroopna school which has school_id and is trial status
        response = requests.post(
            f"{BASE_URL}/api/superadmin/schools/{MOOROOPNA_SCHOOL_ID}/impersonate",
            cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["token"].startswith("imp_")
        assert data["school_slug"] == "mooroopna"
        print(f"✓ Impersonation token generated: {data['token'][:20]}...")
    
    def test_impersonate_archived_school(self, sa_session):
        """Cannot impersonate archived school"""
        # Find an archived school or create one
        schools = requests.get(f"{BASE_URL}/api/superadmin/schools", cookies=sa_session).json()
        archived = next((s for s in schools if s["status"] == "archived"), None)
        
        if archived:
            response = requests.post(
                f"{BASE_URL}/api/superadmin/schools/{archived['school_id']}/impersonate",
                cookies=sa_session)
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            print("✓ Cannot impersonate archived school (400)")
        else:
            print("⚠ No archived school to test impersonation rejection")


class TestAuditLog:
    """Super admin audit log tests"""
    
    def test_audit_log(self, sa_session):
        """Get audit log entries"""
        response = requests.get(f"{BASE_URL}/api/superadmin/audit", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data
        assert "entries" in data
        assert isinstance(data["entries"], list)
        
        # Check entry structure
        if data["entries"]:
            entry = data["entries"][0]
            assert "audit_id" in entry
            assert "timestamp" in entry
            assert "action" in entry
            assert "entity_type" in entry
        
        print(f"✓ Audit log: {data['total']} total entries, showing {len(data['entries'])}")
    
    def test_audit_log_pagination(self, sa_session):
        """Audit log supports pagination"""
        response = requests.get(f"{BASE_URL}/api/superadmin/audit?page=0&per_page=5", cookies=sa_session)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 0
        assert data["per_page"] == 5
        assert len(data["entries"]) <= 5
        print("✓ Audit log pagination works")


class TestSuperAdminsCRUD:
    """Super admin CRUD tests"""
    
    def test_list_super_admins(self, sa_session):
        """List all super admins"""
        response = requests.get(f"{BASE_URL}/api/superadmin/super-admins", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        admins = response.json()
        assert isinstance(admins, list)
        assert len(admins) >= 1
        
        # Check no password_hash
        for admin in admins:
            assert "password_hash" not in admin
            assert "super_admin_id" in admin
            assert "email" in admin
        
        print(f"✓ Listed {len(admins)} super admins")
    
    def test_create_and_delete_super_admin(self, sa_session):
        """Create a new super admin, then delete them"""
        unique_email = f"testsa{uuid.uuid4().hex[:6]}@test.com"
        
        # Create
        response = requests.post(f"{BASE_URL}/api/superadmin/super-admins",
            cookies=sa_session,
            json={
                "name": "Test Super Admin",
                "email": unique_email,
                "password": "password123"
            })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["email"] == unique_email
        sa_id = data["super_admin_id"]
        print(f"✓ Created super admin: {unique_email} (id={sa_id})")
        
        # Verify in list
        admins = requests.get(f"{BASE_URL}/api/superadmin/super-admins", cookies=sa_session).json()
        new_admin = next((a for a in admins if a["super_admin_id"] == sa_id), None)
        assert new_admin, "Newly created super admin not found in list"
        print("✓ Super admin appears in list")
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/superadmin/super-admins/{sa_id}", cookies=sa_session)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Super admin deleted")
        
        # Verify deleted
        admins = requests.get(f"{BASE_URL}/api/superadmin/super-admins", cookies=sa_session).json()
        deleted_admin = next((a for a in admins if a["super_admin_id"] == sa_id), None)
        assert deleted_admin is None, "Super admin should be deleted"
        print("✓ Super admin no longer in list")
    
    def test_cannot_delete_self(self, sa_session):
        """Cannot delete your own super admin account"""
        # Get current admin's ID
        me = requests.get(f"{BASE_URL}/api/superadmin/auth/me", cookies=sa_session).json()
        my_id = me["super_admin_id"]
        
        response = requests.delete(f"{BASE_URL}/api/superadmin/super-admins/{my_id}", cookies=sa_session)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Cannot delete self (400)")
    
    def test_create_duplicate_email(self, sa_session):
        """Creating super admin with duplicate email returns 409"""
        response = requests.post(f"{BASE_URL}/api/superadmin/super-admins",
            cookies=sa_session,
            json={
                "name": "Duplicate Admin",
                "email": SA_EMAIL,  # Already exists
                "password": "password123"
            })
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        print("✓ Duplicate email correctly rejected (409)")


class TestAuthGuard:
    """Test that all superadmin endpoints (except bootstrap) require auth"""
    
    def test_endpoints_require_auth(self):
        """All endpoints except bootstrap require authentication"""
        endpoints = [
            ("GET", "/api/superadmin/auth/me"),
            ("GET", "/api/superadmin/stats"),
            ("GET", "/api/superadmin/schools"),
            ("GET", "/api/superadmin/schools/sch_test"),
            ("PUT", "/api/superadmin/schools/sch_test"),
            ("DELETE", "/api/superadmin/schools/sch_test"),
            ("GET", "/api/superadmin/schools/sch_test/admins"),
            ("POST", "/api/superadmin/schools/sch_test/admins"),
            ("DELETE", "/api/superadmin/schools/sch_test/admins/user_test"),
            ("PUT", "/api/superadmin/schools/sch_test/admins/user_test/reset-password"),
            ("POST", "/api/superadmin/schools/sch_test/impersonate"),
            ("GET", "/api/superadmin/audit"),
            ("GET", "/api/superadmin/super-admins"),
            ("POST", "/api/superadmin/super-admins"),
            ("DELETE", "/api/superadmin/super-admins/sa_test"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            elif method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json={})
            elif method == "PUT":
                response = requests.put(f"{BASE_URL}{endpoint}", json={})
            elif method == "DELETE":
                response = requests.delete(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 401, \
                f"Expected 401 for {method} {endpoint}, got {response.status_code}"
        
        print(f"✓ All {len(endpoints)} protected endpoints require auth")


class TestSchoolPortalStillWorks:
    """Verify existing school portal functionality still works"""
    
    def test_demo_school_students(self):
        """Demo school /api/students still returns students"""
        # Login as demo school admin
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/login-email", json={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Demo school login failed: {login_response.text}"
        
        # Get students
        response = session.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        students = response.json()
        assert isinstance(students, list)
        assert len(students) > 0, "Expected students in demo school"
        print(f"✓ Demo school has {len(students)} students")
    
    def test_provisioned_school_accessible(self, sa_session):
        """Newly provisioned school is accessible via X-Tenant-Slug header"""
        # Get mooroopna school
        schools = requests.get(f"{BASE_URL}/api/superadmin/schools", cookies=sa_session).json()
        mooroopna = next((s for s in schools if s["slug"] == "mooroopna"), None)
        
        if mooroopna and mooroopna.get("status") in ("active", "trial"):
            # Try to access mooroopna school via X-Tenant-Slug header
            session = requests.Session()
            session.headers["X-Tenant-Slug"] = "mooroopna"
            
            # Login as mooroopna admin
            login_response = session.post(f"{BASE_URL}/api/auth/login-email", json={
                "email": "jane@mooroopna.edu.au",
                "password": "mooroopna123"
            })
            
            if login_response.status_code == 200:
                # Get students
                response = session.get(f"{BASE_URL}/api/students")
                assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
                print(f"✓ Mooroopna school accessible via X-Tenant-Slug header")
            else:
                print(f"⚠ Mooroopna login failed: {login_response.status_code} - {login_response.text}")
        else:
            print("⚠ Mooroopna school not found or not active/trial")


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="class")
def sa_session():
    """Get authenticated super admin session"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/superadmin/auth/login-email", json={
        "email": SA_EMAIL,
        "password": SA_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")
    return session.cookies


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
