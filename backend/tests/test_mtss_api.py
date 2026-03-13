"""
MTSS WellTrack Platform - Backend API Tests
Tests all critical API endpoints with auth token
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_admin_a73014c495be433d80bed4706726adb3"

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {SESSION_TOKEN}"})
    return s

# Auth
class TestAuth:
    def test_auth_me(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert "email" in d

# Students
class TestStudents:
    def test_students_summary(self, client):
        r = client.get(f"{BASE_URL}/api/students/summary")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) == 32, f"Expected 32 students, got {len(d)}"
        # Check mtss_tier field exists
        assert "mtss_tier" in d[0]

    def test_students_list(self, client):
        r = client.get(f"{BASE_URL}/api/students")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) >= 1

    def test_student_profile(self, client):
        r = client.get(f"{BASE_URL}/api/students/summary")
        students = r.json()
        student_id = students[0]["student_id"]
        r2 = client.get(f"{BASE_URL}/api/students/{student_id}")
        assert r2.status_code == 200
        profile = r2.json()
        assert "student_id" in profile

# Classes
class TestClasses:
    def test_classes_list(self, client):
        r = client.get(f"{BASE_URL}/api/classes")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) == 4, f"Expected 4 classes, got {len(d)}"

# Analytics
class TestAnalytics:
    def test_tier_distribution(self, client):
        r = client.get(f"{BASE_URL}/api/analytics/tier-distribution")
        assert r.status_code == 200
        d = r.json()
        assert "tier_distribution" in d
        assert "tier1" in d["tier_distribution"]

# Alerts
class TestAlerts:
    def test_alerts_list(self, client):
        r = client.get(f"{BASE_URL}/api/alerts")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)

# Interventions
class TestInterventions:
    def test_interventions_list(self, client):
        r = client.get(f"{BASE_URL}/api/interventions")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)

# Meeting Prep
class TestMeetingPrep:
    def test_meeting_prep(self, client):
        r = client.get(f"{BASE_URL}/api/meeting-prep")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        # Should contain Tier 2 and 3 students
        assert len(d) > 0

# Reports
class TestReports:
    def test_reports_students_csv(self, client):
        r = client.get(f"{BASE_URL}/api/reports/students-csv")
        assert r.status_code == 200

    def test_reports_tier_summary_csv(self, client):
        r = client.get(f"{BASE_URL}/api/reports/tier-summary-csv")
        assert r.status_code == 200

    def test_reports_screening_csv(self, client):
        r = client.get(f"{BASE_URL}/api/reports/screening-csv")
        assert r.status_code == 200

    def test_reports_interventions_csv(self, client):
        r = client.get(f"{BASE_URL}/api/reports/interventions-csv")
        assert r.status_code == 200
