"""Backend tests for POST /api/students/import endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_import_1773449753565"

HEADERS = {"Authorization": f"Bearer {SESSION_TOKEN}"}

VALID_STUDENTS = [
    {"first_name": "TEST_Alice", "last_name": "Brown", "year_level": "Year 3", "class_name": "3A", "teacher": "Ms Smith", "gender": "Female", "date_of_birth": "2015-01-01"},
    {"first_name": "TEST_Bob", "last_name": "White", "year_level": "Year 4", "class_name": "4B", "teacher": "Mr Jones"},
]

STUDENTS_WITH_MISSING = [
    {"first_name": "TEST_Good", "last_name": "Student", "year_level": "Year 5", "class_name": "5C", "teacher": "Ms Lee"},
    {"first_name": "", "last_name": "NoFirst", "year_level": "Year 3", "class_name": "3A", "teacher": "Ms X"},  # missing first_name
    {"first_name": "NoLast", "last_name": "", "year_level": "Year 3", "class_name": "3A", "teacher": "Ms X"},   # missing last_name
]


class TestImportStudents:
    """Tests for /api/students/import endpoint"""

    def test_import_without_auth_returns_401(self):
        res = requests.post(f"{BASE_URL}/api/students/import", json={"students": VALID_STUDENTS})
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("PASS: import without auth returns 401")

    def test_import_empty_body_returns_400(self):
        res = requests.post(f"{BASE_URL}/api/students/import", json={"students": []}, headers=HEADERS)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("PASS: import with empty students returns 400")

    def test_import_valid_students_returns_success(self):
        res = requests.post(f"{BASE_URL}/api/students/import", json={"students": VALID_STUDENTS}, headers=HEADERS)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "imported" in data
        assert "errors" in data
        assert "total" in data
        assert data["imported"] == 2
        assert data["errors"] == []
        assert data["total"] == 2
        print(f"PASS: imported {data['imported']} students with {len(data['errors'])} errors")

    def test_import_with_missing_required_fields_returns_error_rows(self):
        res = requests.post(f"{BASE_URL}/api/students/import", json={"students": STUDENTS_WITH_MISSING}, headers=HEADERS)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["imported"] == 1, f"Expected 1 imported, got {data['imported']}"
        assert len(data["errors"]) == 2, f"Expected 2 errors, got {data['errors']}"
        assert data["total"] == 3
        print(f"PASS: partial import - {data['imported']} imported, {len(data['errors'])} errors")

    def test_imported_students_appear_in_students_list(self):
        # Import a unique student
        unique_student = [{"first_name": "TEST_UniqueImport", "last_name": "Verify", "year_level": "Year 6", "class_name": "6A", "teacher": "Mr Test"}]
        import_res = requests.post(f"{BASE_URL}/api/students/import", json={"students": unique_student}, headers=HEADERS)
        assert import_res.status_code == 200
        assert import_res.json()["imported"] == 1

        # Verify student appears in list
        list_res = requests.get(f"{BASE_URL}/api/students", headers=HEADERS)
        assert list_res.status_code == 200
        students = list_res.json()
        found = any(s.get("first_name") == "TEST_UniqueImport" and s.get("last_name") == "Verify" for s in students)
        assert found, "Imported student not found in students list"
        print("PASS: imported student appears in students list")

    def test_import_no_body_returns_error(self):
        res = requests.post(f"{BASE_URL}/api/students/import", json={}, headers=HEADERS)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("PASS: import with no students key returns 400")
