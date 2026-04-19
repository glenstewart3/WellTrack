"""Tests for new features: Student Archive/Reactivate, CSV exports, PDF export"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION = "test_session_welltrack_1773836766689"

HEADERS = {"Authorization": f"Bearer {SESSION}"}


class TestStudentArchiveReactivate:
    """Student archive and reactivate endpoints"""

    def test_get_active_students_summary(self):
        r = requests.get(f"{BASE_URL}/api/students/summary?status=active", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Active students summary count: {len(data)}")

    def test_get_archived_students_summary(self):
        r = requests.get(f"{BASE_URL}/api/students/summary?status=archived", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Archived students count: {len(data)}")

    def test_get_students_with_status_filter(self):
        r = requests.get(f"{BASE_URL}/api/students?status=active", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Active students: {len(data)}")

    def test_bulk_archive_and_reactivate(self):
        # Get active students
        r = requests.get(f"{BASE_URL}/api/students?status=active", headers=HEADERS)
        assert r.status_code == 200
        students = r.json()
        if not students:
            pytest.skip("No active students to archive")
        
        # Archive first student
        student_id = students[0]["student_id"]
        r = requests.put(f"{BASE_URL}/api/students/bulk-archive",
                         json={"student_ids": [student_id]}, headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "archived" in data
        assert data["archived"] == 1
        print(f"Archived: {data['archived']}")

        # Verify it appears in archived list
        r = requests.get(f"{BASE_URL}/api/students?status=archived", headers=HEADERS)
        assert r.status_code == 200
        archived = r.json()
        archived_ids = [s["student_id"] for s in archived]
        assert student_id in archived_ids

        # Reactivate
        r = requests.put(f"{BASE_URL}/api/students/bulk-reactivate",
                         json={"student_ids": [student_id]}, headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "reactivated" in data
        assert data["reactivated"] == 1
        print(f"Reactivated: {data['reactivated']}")

        # Verify back in active
        r = requests.get(f"{BASE_URL}/api/students?status=active", headers=HEADERS)
        active_ids = [s["student_id"] for s in r.json()]
        assert student_id in active_ids

    def test_bulk_reactivate_empty_ids(self):
        r = requests.put(f"{BASE_URL}/api/students/bulk-reactivate",
                         json={"student_ids": []}, headers=HEADERS)
        assert r.status_code == 400


class TestCSVExports:
    """CSV export endpoints"""

    def test_students_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/students-csv", headers=HEADERS)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert len(r.text) > 0
        print(f"Students CSV size: {len(r.text)} bytes")

    def test_tier_summary_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/tier-summary-csv", headers=HEADERS)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        print(f"Tier CSV size: {len(r.text)} bytes")

    def test_screening_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/screening-csv", headers=HEADERS)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        print(f"Screening CSV size: {len(r.text)} bytes")

    def test_interventions_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/interventions-csv", headers=HEADERS)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        print(f"Interventions CSV size: {len(r.text)} bytes")

    def test_csv_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/students-csv")
        assert r.status_code in [401, 403]
