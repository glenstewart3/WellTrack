"""
Tests for Student Photo Upload feature:
- POST /api/students/upload-photos endpoint
- Staff folder skipping
- Trailing space handling
- Static file serving at /api/student-photos/
"""
import pytest
import requests
import os
import io
import zipfile
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_photo_session_abc123"

def get_headers():
    return {"Authorization": f"Bearer {SESSION_TOKEN}"}

def make_simple_image_bytes():
    """Create a simple 50x50 JPEG image as bytes."""
    img = Image.new("RGB", (50, 50), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    buf.seek(0)
    return buf.read()

def make_zip(files: dict) -> bytes:
    """Create a ZIP in memory. files: {path_in_zip: image_bytes}"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    buf.seek(0)
    return buf.read()


class TestPhotoUploadEndpoint:
    """Tests for POST /api/students/upload-photos"""

    def test_endpoint_requires_auth(self):
        """Should return 401/403 without auth."""
        img = make_simple_image_bytes()
        zip_data = make_zip({"Davis, Emma.jpg": img})
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
        )
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}: {r.text}"
        print(f"PASS: Endpoint correctly requires auth (got {r.status_code})")

    def test_non_zip_rejected(self):
        """Should return 400 for non-ZIP uploads."""
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photo.jpg", make_simple_image_bytes(), "image/jpeg")},
            headers=get_headers(),
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        print(f"PASS: Non-ZIP file rejected with 400")

    def test_valid_zip_match(self):
        """Upload ZIP with known students (Davis Emma, Wilson Liam), one unmatched, one staff-skipped."""
        img = make_simple_image_bytes()
        files = {
            "ClassA/Davis, Emma.jpg": img,
            "ClassA/Wilson, Liam.jpg": img,
            "ClassA/Nonexistent, Student.jpg": img,
            "Staff/Smith, John.jpg": img,
        }
        zip_data = make_zip(files)
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
            headers=get_headers(),
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Upload result: {data}")
        assert data["matched"] >= 2, f"Expected at least 2 matched, got {data['matched']}"
        assert data["skipped_staff"] >= 1, f"Expected at least 1 staff skipped, got {data['skipped_staff']}"
        assert data["unmatched"] >= 1, f"Expected at least 1 unmatched, got {data['unmatched']}"
        assert "Nonexistent, Student" in data.get("unmatched_names", []), f"Unmatched names: {data.get('unmatched_names')}"
        print("PASS: Valid ZIP upload matched/unmatched/skipped correctly")

    def test_trailing_space_in_filename(self):
        """Trailing spaces in filename should still match (e.g. 'Davis, Emma .jpg')."""
        img = make_simple_image_bytes()
        zip_data = make_zip({"ClassA/Davis, Emma .jpg": img})  # trailing space
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
            headers=get_headers(),
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Trailing space result: {data}")
        assert data["matched"] >= 1, f"Expected 1 matched (trailing space), got {data['matched']}"
        print("PASS: Trailing space in filename handled correctly")

    def test_staff_folder_skipped(self):
        """Files in 'Staff' or 'staff' folder must be skipped entirely."""
        img = make_simple_image_bytes()
        files = {
            "staff/Davis, Emma.jpg": img,
            "Staff/Wilson, Liam.jpg": img,
            "STAFF FOLDER/Taylor, Olivia.jpg": img,
        }
        zip_data = make_zip(files)
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
            headers=get_headers(),
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Staff skip result: {data}")
        assert data["matched"] == 0, f"Staff photos should not match, got {data['matched']}"
        assert data["skipped_staff"] >= 2, f"Expected at least 2 staff skipped, got {data['skipped_staff']}"
        print("PASS: Staff folder skipped correctly")

    def test_photo_saved_to_disk(self):
        """After upload, the photo file should exist on disk."""
        import pathlib
        img = make_simple_image_bytes()
        zip_data = make_zip({"Davis, Emma.jpg": img})
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
            headers=get_headers(),
        )
        assert r.status_code == 200
        photos_dir = pathlib.Path("/app/uploads/student_photos")
        assert photos_dir.exists(), "Photos directory does not exist"
        # Check for stu_2eb15b7d.jpg (Emma Davis)
        expected = photos_dir / "stu_2eb15b7d.jpg"
        assert expected.exists(), f"Expected photo file {expected} not found"
        print("PASS: Photo file saved to disk")

    def test_db_updated_with_photo_url(self):
        """After matching, student DB record should have photo_url set."""
        r = requests.get(
            f"{BASE_URL}/api/students/stu_2eb15b7d",
            headers=get_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "photo_url" in data and data["photo_url"], f"photo_url not set: {data}"
        assert data["photo_url"].startswith("/api/student-photos/"), f"Unexpected photo_url: {data['photo_url']}"
        print(f"PASS: DB photo_url = {data['photo_url']}")

    def test_static_file_serving(self):
        """GET /api/student-photos/stu_2eb15b7d.jpg should return 200."""
        r = requests.get(f"{BASE_URL}/api/student-photos/stu_2eb15b7d.jpg")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/"), f"Expected image content-type, got {r.headers.get('content-type')}"
        print("PASS: Static file serving works")

    def test_case_insensitive_match(self):
        """Filename with different case should still match."""
        img = make_simple_image_bytes()
        zip_data = make_zip({"davis, emma.jpg": img})  # lowercase
        r = requests.post(
            f"{BASE_URL}/api/students/upload-photos",
            files={"file": ("photos.zip", zip_data, "application/zip")},
            headers=get_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        print(f"Case insensitive result: {data}")
        assert data["matched"] >= 1, f"Expected case-insensitive match, got {data['matched']}"
        print("PASS: Case-insensitive matching works")
