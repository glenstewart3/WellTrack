"""Tests for single photo upload endpoint (POST /api/students/{student_id}/photo) and DELETE regression"""
import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

STUDENT_WITH_PHOTO = "stu_ac501dd5"   # Liam Wilson
STUDENT_NO_PHOTO = "stu_15965c26"     # Olivia Taylor

def create_test_jpeg(w=100, h=100):
    """Create a minimal JPEG in memory"""
    buf = io.BytesIO()
    img = Image.new("RGB", (w, h), color=(100, 150, 200))
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login-email",
                  json={"email": "admin@test.local", "password": "testpass123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return s


class TestPhotoUpload:
    """POST /api/students/{student_id}/photo tests"""

    def test_upload_photo_returns_200_and_photo_url(self, session):
        jpeg = create_test_jpeg()
        resp = session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("test.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "photo_url" in data, "Response missing photo_url"
        assert data["photo_url"].startswith("/api/student-photos/")
        print(f"PASS: upload photo returned photo_url={data['photo_url']}")

    def test_upload_photo_updates_db(self, session):
        jpeg = create_test_jpeg()
        resp = session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("test2.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 200
        photo_url = resp.json()["photo_url"]

        # Verify DB updated via GET
        get_resp = session.get(f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}")
        assert get_resp.status_code == 200
        student = get_resp.json()
        assert student.get("photo_url") == photo_url, f"DB not updated. Got {student.get('photo_url')}, expected {photo_url}"
        print(f"PASS: DB updated with photo_url={photo_url}")

    def test_upload_saves_file_to_disk(self, session):
        jpeg = create_test_jpeg(200, 200)
        resp = session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("disk_test.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 200
        photo_path = f"/app/uploads/student_photos/{STUDENT_WITH_PHOTO}.jpg"
        assert os.path.exists(photo_path), f"File not saved to disk at {photo_path}"
        print(f"PASS: File exists at {photo_path}")

    def test_upload_resizes_large_image(self, session):
        """Upload large image, verify it's resized to max 400x400"""
        jpeg = create_test_jpeg(800, 600)
        resp = session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("large.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 200
        photo_path = f"/app/uploads/student_photos/{STUDENT_WITH_PHOTO}.jpg"
        with Image.open(photo_path) as img:
            w, h = img.size
            assert w <= 400 and h <= 400, f"Image not resized: {w}x{h}"
        print(f"PASS: Image resized to {w}x{h}")

    def test_upload_nonexistent_student_returns_404(self, session):
        jpeg = create_test_jpeg()
        resp = session.post(
            f"{BASE_URL}/api/students/stu_doesnotexist/photo",
            files={"file": ("x.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: 404 for nonexistent student")

    def test_upload_photo_for_student_without_photo(self, session):
        """Upload to student with no photo (stu_15965c26)"""
        # First clear any existing photo
        session.delete(f"{BASE_URL}/api/students/{STUDENT_NO_PHOTO}/photo")
        jpeg = create_test_jpeg()
        resp = session.post(
            f"{BASE_URL}/api/students/{STUDENT_NO_PHOTO}/photo",
            files={"file": ("new.jpg", jpeg, "image/jpeg")}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "photo_url" in data
        print(f"PASS: Upload for student with no prior photo: {data['photo_url']}")


class TestPhotoDeleteRegression:
    """DELETE /api/students/{student_id}/photo regression tests"""

    def test_delete_photo_returns_200(self, session):
        # Ensure photo exists first
        jpeg = create_test_jpeg()
        session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("setup.jpg", jpeg, "image/jpeg")}
        )
        resp = session.delete(f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: DELETE photo returns 200")

    def test_delete_photo_clears_db(self, session):
        # Upload then delete
        jpeg = create_test_jpeg()
        session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("before_delete.jpg", jpeg, "image/jpeg")}
        )
        session.delete(f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo")
        get_resp = session.get(f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}")
        student = get_resp.json()
        assert not student.get("photo_url"), f"photo_url not cleared in DB: {student.get('photo_url')}"
        print("PASS: photo_url cleared in DB after DELETE")

    def test_delete_photo_removes_file(self, session):
        jpeg = create_test_jpeg()
        session.post(
            f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo",
            files={"file": ("for_delete.jpg", jpeg, "image/jpeg")}
        )
        session.delete(f"{BASE_URL}/api/students/{STUDENT_WITH_PHOTO}/photo")
        photo_path = f"/app/uploads/student_photos/{STUDENT_WITH_PHOTO}.jpg"
        assert not os.path.exists(photo_path), f"File still on disk after DELETE"
        print("PASS: File removed from disk after DELETE")

    def test_delete_nonexistent_student_returns_404(self, session):
        resp = session.delete(f"{BASE_URL}/api/students/stu_doesnotexist/photo")
        assert resp.status_code == 404
        print("PASS: 404 for DELETE on nonexistent student")
