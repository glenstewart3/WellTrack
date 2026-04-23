"""Iteration 48 — Preview endpoints + gender/year normalisation + staff import
without STAFF_STATUS column."""
import io
import os
import pytest
import requests

_BACKEND = os.environ.get("REACT_APP_BACKEND_URL")
if not _BACKEND:
    # Fallback to read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _BACKEND = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (_BACKEND or "").rstrip("/")
HEADERS_TENANT = {"X-Tenant-Slug": "demo"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(HEADERS_TENANT)
    r = s.post(
        f"{BASE_URL}/api/auth/login-email",
        json={"email": "admin@test.com", "password": "password123"},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


# ── Staff preview ────────────────────────────────────────────────────────────
STAFF_CSV = (
    "SFKEY,FIRST_NAME,SURNAME,E_MAIL,PAYROLL_CLASS\n"
    "T001,Jane,Doe,TEST_jane_it48@example.com,TEACH\n"
    "T002,John,Roe,TEST_john_it48@example.com,ADMIN\n"
).encode("utf-8")

# Deliberately missing STAFF_STATUS column
STAFF_CSV_NO_STATUS = (
    "SFKEY,FIRST_NAME,SURNAME,E_MAIL,PAYROLL_CLASS\n"
    "T050,Alice,NoStatus,TEST_alice_it48@example.com,TEACH\n"
).encode("utf-8")

# A student file accidentally uploaded to the staff endpoint
STUDENT_CSV = (
    "STKEY,FIRST_NAME,SURNAME,SCHOOL_YEAR,HOME_GROUP,GENDER,BIRTHDATE,PREF_NAME\n"
    "S001,Emma,Smith,05,5A,F,2015-03-01,Em\n"
    "S002,Liam,Jones,00,F1,M,2019-08-15,\n"
).encode("utf-8")


class TestStaffPreview:
    def test_staff_preview_correct_file(self, session):
        r = session.post(
            f"{BASE_URL}/api/users/import-staff-preview",
            files={"file": ("staff.csv", STAFF_CSV, "text/csv")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["file_kind"]["looks_like"] == "staff"
        assert data["total_rows"] == 2
        # Both emails new → add count should be 2
        assert data["counts"]["add"] >= 2 or (
            data["counts"]["add"] + data["counts"]["update"] == 2
        )
        assert data["counts"]["errors"] == 0

    def test_staff_preview_student_file_mismatch(self, session):
        r = session.post(
            f"{BASE_URL}/api/users/import-staff-preview",
            files={"file": ("students.csv", STUDENT_CSV, "text/csv")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["file_kind"]["looks_like"] == "student"
        # No E_MAIL column → all rows errored (cannot be added as staff)
        assert data["counts"]["add"] == 0
        assert data["counts"]["errors"] == 2

    def test_staff_preview_no_db_write(self, session):
        # Before count
        ulist = session.get(f"{BASE_URL}/api/users").json()
        emails_before = {u.get("email") for u in ulist}
        assert "TEST_jane_it48@example.com" not in emails_before

        session.post(
            f"{BASE_URL}/api/users/import-staff-preview",
            files={"file": ("staff.csv", STAFF_CSV, "text/csv")},
        )
        ulist2 = session.get(f"{BASE_URL}/api/users").json()
        emails_after = {u.get("email") for u in ulist2}
        assert "TEST_jane_it48@example.com" not in emails_after


# ── Student preview (gender / year-level normalisation) ─────────────────────
class TestStudentPreview:
    def test_student_preview_normalises_gender_and_year(self, session):
        r = session.post(
            f"{BASE_URL}/api/students/import-file-preview",
            files={"file": ("students.csv", STUDENT_CSV, "text/csv")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["file_kind"]["looks_like"] == "student"
        entries = (data.get("add") or []) + (data.get("update") or [])
        assert entries, "Expected at least one entry in add/update"
        genders = {e.get("gender") for e in entries}
        years = {e.get("year_level") for e in entries}
        assert "Female" in genders, f"Expected F→Female, got {genders}"
        assert "Male" in genders, f"Expected M→Male, got {genders}"
        assert "Foundation" in years, f"Expected 00→Foundation, got {years}"
        assert "Year 5" in years or "Year 05" in years, (
            f"Expected 05→Year 05 or Year 5, got {years}"
        )


# ── Actual staff import without STAFF_STATUS column ────────────────────────
class TestStaffImportNoStatus:
    def test_staff_import_without_staff_status_column(self, session):
        r = session.post(
            f"{BASE_URL}/api/users/import-staff",
            files={"file": ("staff_no_status.csv", STAFF_CSV_NO_STATUS, "text/csv")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Should succeed and report at least 1 imported/created
        assert (
            data.get("created", 0) + data.get("updated", 0) + data.get("imported", 0)
            >= 1
        ), f"Expected at least one row imported, got {data}"

        # Verify user actually persisted as active
        ul = session.get(f"{BASE_URL}/api/users").json()
        match = [u for u in ul if (u.get("email") or "").lower() == "test_alice_it48@example.com"]
        assert match, "Imported user not found in /api/users"
        u = match[0]
        # Active flag: either status=active or no status at all (treated active)
        assert u.get("status", "active").lower() != "inactive"

    def teardown_method(self, method):
        # Best-effort cleanup
        s = requests.Session()
        s.headers.update(HEADERS_TENANT)
        r = s.post(
            f"{BASE_URL}/api/auth/login-email",
            json={"email": "admin@test.com", "password": "password123"},
        )
        if r.status_code != 200:
            return
        ul = s.get(f"{BASE_URL}/api/users").json()
        for u in ul:
            email = u.get("email", "")
            if email.lower().startswith("test_") and "_it48" in email.lower():
                uid = u.get("user_id") or u.get("id")
                if uid:
                    s.delete(f"{BASE_URL}/api/users/{uid}")


# ── Student import actually persists gender as Male/Female ─────────────────
class TestStudentGenderPersistence:
    def test_student_import_stores_gender_full(self, session):
        # Use unique stkeys to avoid collisions
        csv_bytes = (
            "STKEY,FIRST_NAME,SURNAME,SCHOOL_YEAR,HOME_GROUP,GENDER\n"
            "TESTIT48A,TESTEmma,Iter48,05,5A,F\n"
            "TESTIT48B,TESTLiam,Iter48,00,F1,M\n"
        ).encode("utf-8")
        r = session.post(
            f"{BASE_URL}/api/students/import-file",
            files={"file": ("s.csv", csv_bytes, "text/csv")},
        )
        assert r.status_code == 200, r.text

        # Fetch & verify
        sl = session.get(f"{BASE_URL}/api/students").json()
        students = sl if isinstance(sl, list) else sl.get("students", [])
        found_emma = next(
            (s for s in students if s.get("sussi_id") == "TESTIT48A"), None
        )
        found_liam = next(
            (s for s in students if s.get("sussi_id") == "TESTIT48B"), None
        )
        assert found_emma, "TESTIT48A not found"
        assert found_liam, "TESTIT48B not found"
        assert found_emma.get("gender") == "Female", (
            f"Expected Female, got {found_emma.get('gender')}"
        )
        assert found_liam.get("gender") == "Male", (
            f"Expected Male, got {found_liam.get('gender')}"
        )

        # Cleanup
        for s_ in (found_emma, found_liam):
            sid = s_.get("student_id") or s_.get("id")
            if sid:
                session.delete(f"{BASE_URL}/api/students/{sid}")
