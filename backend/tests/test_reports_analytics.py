"""Tests for new Reports endpoints and Analytics filter params"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
COOKIES = {"session_token": "test_session_welltrack_1773836766689"}


class TestReportsFilterOptions:
    def test_filter_options_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES)
        assert r.status_code == 200
        data = r.json()
        assert "year_levels" in data
        assert "classes" in data
        assert isinstance(data["year_levels"], list)
        assert isinstance(data["classes"], list)


class TestReportsAbsenceTypes:
    def test_absence_types_school_wide(self):
        r = requests.get(f"{BASE_URL}/api/reports/absence-types", cookies=COOKIES)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_absence_types_with_year_level_filter(self):
        # Get year levels first
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["year_levels"]:
            r = requests.get(f"{BASE_URL}/api/reports/absence-types?year_level={opts['year_levels'][0]}", cookies=COOKIES)
            assert r.status_code == 200
            assert isinstance(r.json(), list)

    def test_absence_types_with_class_filter(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["classes"]:
            r = requests.get(f"{BASE_URL}/api/reports/absence-types?class_name={opts['classes'][0]}", cookies=COOKIES)
            assert r.status_code == 200
            assert isinstance(r.json(), list)


class TestReportsScreeningCoverage:
    def test_screening_coverage_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/reports/screening-coverage", cookies=COOKIES)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "class" in data[0]
            assert "coverage_pct" in data[0]

    def test_screening_coverage_with_year_level(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["year_levels"]:
            r = requests.get(f"{BASE_URL}/api/reports/screening-coverage?year_level={opts['year_levels'][0]}", cookies=COOKIES)
            assert r.status_code == 200


class TestReportsSupportGaps:
    def test_support_gaps_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/reports/support-gaps", cookies=COOKIES)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Each gap should have student, tier, saebrs_risk, attendance_pct
        for g in data:
            assert "student" in g
            assert "tier" in g
            assert g["tier"] >= 2

    def test_support_gaps_with_class_filter(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["classes"]:
            r = requests.get(f"{BASE_URL}/api/reports/support-gaps?class_name={opts['classes'][0]}", cookies=COOKIES)
            assert r.status_code == 200


class TestReportsStaffLoad:
    def test_staff_load_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/reports/staff-load", cookies=COOKIES)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for item in data:
            assert "staff" in item
            assert "count" in item


class TestAnalyticsFilterParams:
    def test_school_wide_with_year_level(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["year_levels"]:
            r = requests.get(f"{BASE_URL}/api/analytics/school-wide?year_level={opts['year_levels'][0]}", cookies=COOKIES)
            assert r.status_code == 200

    def test_attendance_trends_with_class(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["classes"]:
            r = requests.get(f"{BASE_URL}/api/analytics/attendance-trends?class_name={opts['classes'][0]}", cookies=COOKIES)
            assert r.status_code == 200

    def test_intervention_outcomes_with_year_level(self):
        opts = requests.get(f"{BASE_URL}/api/reports/filter-options", cookies=COOKIES).json()
        if opts["year_levels"]:
            r = requests.get(f"{BASE_URL}/api/analytics/intervention-outcomes?year_level={opts['year_levels'][0]}", cookies=COOKIES)
            assert r.status_code == 200


class TestCSVExports:
    def test_tier_summary_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/tier-summary-csv", cookies=COOKIES)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_students_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/students-csv", cookies=COOKIES)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_screening_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/screening-csv", cookies=COOKIES)
        assert r.status_code == 200

    def test_interventions_csv(self):
        r = requests.get(f"{BASE_URL}/api/reports/interventions-csv", cookies=COOKIES)
        assert r.status_code == 200
