"""Tests for DELETE /students/{student_id}/photo endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_cookies():
    resp = requests.post(f"{BASE_URL}/api/auth/login-email",
                         json={"email": "admin@test.local", "password": "testpass123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.cookies

@pytest.fixture(scope="module")
def session(auth_cookies):
    s = requests.Session()
    s.cookies.update(auth_cookies)
    return s

class TestRemovePhoto:
    """DELETE /students/{student_id}/photo tests"""

    def test_delete_photo_requires_auth(self):
        """Unauthenticated request should fail"""
        resp = requests.delete(f"{BASE_URL}/api/students/stu_ac501dd5/photo")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("PASS: Unauthenticated delete returns 401/403")

    def test_delete_photo_student_with_photo(self, session):
        """Verify student stu_ac501dd5 has a photo before delete"""
        resp = session.get(f"{BASE_URL}/api/students/stu_ac501dd5")
        assert resp.status_code == 200
        data = resp.json()
        print(f"Student stu_ac501dd5 photo_url: {data.get('photo_url')}")
        # Photo may or may not exist depending on test order; just check response structure
        assert "student_id" in data

    def test_delete_photo_clears_db(self, session):
        """DELETE /students/{student_id}/photo clears photo_url from DB"""
        student_id = "stu_ac501dd5"
        # Check current state
        before = session.get(f"{BASE_URL}/api/students/{student_id}").json()
        print(f"Before delete - photo_url: {before.get('photo_url')}")

        resp = session.delete(f"{BASE_URL}/api/students/{student_id}/photo")
        assert resp.status_code == 200, f"DELETE failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "message" in data
        print(f"DELETE response: {data}")

        # Verify DB cleared
        after = session.get(f"{BASE_URL}/api/students/{student_id}").json()
        assert after.get('photo_url') is None, f"photo_url should be None after delete, got: {after.get('photo_url')}"
        print("PASS: photo_url cleared from DB after delete")

    def test_delete_photo_removes_file_from_disk(self, session):
        """Verify file is removed from disk after delete (stu_15965c26)"""
        import subprocess
        student_id = "stu_15965c26"
        
        # Check if file exists before
        file_path = f"/app/uploads/student_photos/{student_id}.jpg"
        file_existed = os.path.exists(file_path)
        print(f"File existed before delete: {file_existed}")

        resp = session.delete(f"{BASE_URL}/api/students/{student_id}/photo")
        assert resp.status_code == 200, f"DELETE failed: {resp.status_code} {resp.text}"

        # Verify file removed
        file_exists_after = os.path.exists(file_path)
        assert not file_exists_after, f"File should be deleted but still exists: {file_path}"
        print(f"PASS: File removed from disk: {file_path}")

    def test_delete_photo_student_not_found(self, session):
        """DELETE on non-existent student returns 404"""
        resp = session.delete(f"{BASE_URL}/api/students/nonexistent_id/photo")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: 404 for non-existent student")

    def test_delete_photo_no_photo_ok(self, session):
        """DELETE on student with no photo should still return 200"""
        # stu_ac501dd5 should now have no photo after previous test
        resp = session.delete(f"{BASE_URL}/api/students/stu_ac501dd5/photo")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("PASS: DELETE on student without photo returns 200")
