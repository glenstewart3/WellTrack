"""
Test Landing Page and School Finder Features
- GET /api/school-lookup endpoint
- Reserved subdomain handling
- Middleware tenant resolution
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSchoolLookup:
    """Tests for GET /api/school-lookup endpoint"""
    
    def test_lookup_valid_slug_demo(self):
        """Test school lookup with valid 'demo' slug"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=demo")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        assert data["name"] == "Demo School"
        assert data["slug"] == "demo"
        print(f"✓ Demo school lookup: {data}")
    
    def test_lookup_valid_slug_mooroopna(self):
        """Test school lookup with valid 'mooroopna' slug"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=mooroopna")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        assert data["name"] == "Mooroopna Primary"
        assert data["slug"] == "mooroopna"
        print(f"✓ Mooroopna school lookup: {data}")
    
    def test_lookup_invalid_slug(self):
        """Test school lookup with non-existent slug"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=fakeschool")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        assert "name" not in data
        print(f"✓ Invalid slug returns exists=false: {data}")
    
    def test_lookup_empty_slug(self):
        """Test school lookup with empty slug"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        print(f"✓ Empty slug returns exists=false: {data}")
    
    def test_lookup_short_slug(self):
        """Test school lookup with slug less than 2 characters"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=a")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        print(f"✓ Short slug returns exists=false: {data}")
    
    def test_lookup_no_slug_param(self):
        """Test school lookup without slug parameter"""
        response = requests.get(f"{BASE_URL}/api/school-lookup")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        print(f"✓ No slug param returns exists=false: {data}")
    
    def test_lookup_case_insensitive(self):
        """Test school lookup is case insensitive"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=DEMO")
        assert response.status_code == 200
        data = response.json()
        # The endpoint lowercases the slug, so DEMO should find demo
        assert data["exists"] == True
        assert data["slug"] == "demo"
        print(f"✓ Case insensitive lookup works: {data}")
    
    def test_lookup_with_whitespace(self):
        """Test school lookup trims whitespace"""
        response = requests.get(f"{BASE_URL}/api/school-lookup?slug=%20demo%20")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        assert data["slug"] == "demo"
        print(f"✓ Whitespace trimmed: {data}")


class TestSchoolLookupNoAuth:
    """Verify school-lookup endpoint requires no authentication"""
    
    def test_no_auth_required(self):
        """Test that school-lookup works without any auth headers"""
        response = requests.get(
            f"{BASE_URL}/api/school-lookup?slug=demo",
            headers={}  # No auth headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        print("✓ School lookup works without authentication")
    
    def test_no_tenant_header_required(self):
        """Test that school-lookup works without X-Tenant-Slug header"""
        response = requests.get(
            f"{BASE_URL}/api/school-lookup?slug=demo",
            headers={"Content-Type": "application/json"}  # No tenant header
        )
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        print("✓ School lookup works without tenant header")


class TestExistingSchoolFeatures:
    """Verify existing school features still work"""
    
    def test_school_login_endpoint(self):
        """Test school login still works"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login-email",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Tenant-Slug": "demo"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Login successful"
        print(f"✓ School login works: {data}")
    
    def test_sa_login_endpoint(self):
        """Test SA login still works"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/superadmin/auth/login-email",
            json={"email": "superadmin@welltrack.com.au", "password": "superadmin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Login successful"
        print(f"✓ SA login works: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
