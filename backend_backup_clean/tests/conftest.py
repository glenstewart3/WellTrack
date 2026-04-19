"""conftest.py — Shared fixtures for WellTrack pytest suite."""
import pytest
import requests
import os
from pathlib import Path


def _load_base_url() -> str:
    env_path = Path(__file__).parent.parent.parent / "frontend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


BASE_URL = _load_base_url()
# Session token created by previous test runs — remains valid in dev
SESSION_COOKIE = "test_session_welltrack_1773836766689"


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def auth_session() -> requests.Session:
    """Pre-authenticated session (admin role)."""
    s = requests.Session()
    s.cookies.set("session_token", SESSION_COOKIE)
    return s


@pytest.fixture(scope="session")
def anon_session() -> requests.Session:
    """Unauthenticated session — should get 401/403 on protected routes."""
    return requests.Session()


@pytest.fixture(scope="session")
def first_student_id(auth_session, base_url) -> str:
    """Return the student_id of the first active student."""
    r = auth_session.get(f"{base_url}/api/students")
    assert r.status_code == 200, f"Cannot fetch students: {r.text}"
    students = r.json()
    assert students, "No students found — run 'Load Demo Data' first"
    return students[0]["student_id"]
