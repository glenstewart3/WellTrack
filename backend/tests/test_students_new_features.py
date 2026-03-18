"""Tests for new student features: PUT /students/{id} and PUT /students/bulk-archive"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
TOKEN = "test_session_welltrack_1773836766689"

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


@pytest.fixture(scope="module")
def test_student_id(session):
    """Create a test student and return its ID"""
    payload = {
        "student_id": "stu_test_edit_001",
        "first_name": "TEST_EditFirst",
        "last_name": "TEST_EditLast",
        "year_level": "Year 7",
        "class_name": "7A",
        "teacher": "Mr Test",
        "gender": "M",
        "date_of_birth": "2011-01-01",
        "enrolment_status": "active",
        "sussi_id": "TEST_EDIT_001",
        "external_id": "TEST_EDIT_001",
    }
    r = session.post(f"{BASE_URL}/api/students", json=payload)
    assert r.status_code == 200, f"Student creation failed: {r.text}"
    return "stu_test_edit_001"


class TestUpdateStudent:
    """Tests for PUT /students/{student_id}"""

    def test_update_student_name(self, session, test_student_id):
        r = session.put(f"{BASE_URL}/api/students/{test_student_id}", json={"first_name": "TEST_UpdatedFirst"})
        assert r.status_code == 200, f"Update failed: {r.text}"
        data = r.json()
        assert data["first_name"] == "TEST_UpdatedFirst"

    def test_update_student_persists(self, session, test_student_id):
        r = session.get(f"{BASE_URL}/api/students/{test_student_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["first_name"] == "TEST_UpdatedFirst"

    def test_update_student_invalid_fields_ignored(self, session, test_student_id):
        r = session.put(f"{BASE_URL}/api/students/{test_student_id}", json={"hacked_field": "bad", "first_name": "SafeName"})
        assert r.status_code == 200
        data = r.json()
        assert "hacked_field" not in data

    def test_update_student_no_valid_fields_returns_400(self, session):
        r = session.put(f"{BASE_URL}/api/students/stu_test_edit_001", json={"hacked_field": "bad"})
        assert r.status_code == 400

    def test_update_nonexistent_student(self, session):
        r = session.put(f"{BASE_URL}/api/students/stu_nonexistent_xyz", json={"first_name": "Ghost"})
        # Should return 200 but with null or handle gracefully
        assert r.status_code in [200, 404]


class TestBulkArchive:
    """Tests for PUT /students/bulk-archive"""

    @pytest.fixture(scope="class")
    def archive_student_ids(self, session):
        """Create 2 students to archive"""
        ids = []
        for i in range(2):
            payload = {
                "student_id": f"stu_archive_test_{i}",
                "first_name": f"TEST_Archive{i}",
                "last_name": "TestArchive",
                "year_level": "Year 8",
                "class_name": "8B",
                "teacher": "Ms Archive",
                "gender": "F",
                "date_of_birth": "2010-01-01",
                "enrolment_status": "active",
                "sussi_id": f"TEST_ARCH_{i}",
                "external_id": f"TEST_ARCH_{i}",
            }
            r = session.post(f"{BASE_URL}/api/students", json=payload)
            if r.status_code == 200:
                ids.append(f"stu_archive_test_{i}")
        return ids

    def test_bulk_archive_valid(self, session, archive_student_ids):
        r = session.put(f"{BASE_URL}/api/students/bulk-archive", json={"student_ids": archive_student_ids})
        assert r.status_code == 200, f"Bulk archive failed: {r.text}"
        data = r.json()
        assert "archived" in data
        assert data["archived"] == len(archive_student_ids)

    def test_bulk_archive_removes_from_active(self, session, archive_student_ids):
        active = session.get(f"{BASE_URL}/api/students").json()
        active_ids = [s["student_id"] for s in active]
        for sid in archive_student_ids:
            assert sid not in active_ids, f"{sid} still in active list after archiving"

    def test_bulk_archive_empty_returns_400(self, session):
        r = session.put(f"{BASE_URL}/api/students/bulk-archive", json={"student_ids": []})
        assert r.status_code == 400

    def test_bulk_archive_missing_field_returns_400(self, session):
        r = session.put(f"{BASE_URL}/api/students/bulk-archive", json={})
        assert r.status_code == 400
