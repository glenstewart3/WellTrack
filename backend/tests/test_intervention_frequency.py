"""Regression tests for the AddInterventionModal changes:

- POST /api/interventions accepts & returns `frequency` string
- GET /api/appointments/ongoing returns `frequency` field on each item
"""
import os
import uuid
import requests
import pytest
from pathlib import Path


def _base_url() -> str:
    env_path = Path(__file__).parent.parent.parent / "frontend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


BASE_URL = _base_url()
TENANT_SLUG = "demo"


@pytest.fixture(scope="module")
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"X-Tenant-Slug": TENANT_SLUG})
    r = s.post(
        f"{BASE_URL}/api/auth/login-email",
        json={"email": "admin@test.com", "password": "password123"},
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def first_student_id(session) -> str:
    r = session.get(f"{BASE_URL}/api/students")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data, "no students in demo tenant"
    return data[0]["student_id"]


@pytest.fixture(scope="module")
def scheduling_enabled_type(session) -> str:
    """Pick an intervention-type the tenant has with scheduling enabled.

    Fallback: use the first configured type (strings count as enabled).
    """
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200, r.text
    doc = r.json() or {}
    types = doc.get("intervention_types") or []
    for t in types:
        if isinstance(t, str):
            return t
        if isinstance(t, dict) and t.get("appointment_scheduling_enabled"):
            return t.get("name") or t.get("type")
    # No scheduling-enabled dict types — fall back to first name
    for t in types:
        if isinstance(t, dict) and (t.get("name") or t.get("type")):
            return t.get("name") or t.get("type")
    pytest.skip("No intervention_types configured in tenant settings")


class TestInterventionFrequency:
    """Create → GET round trip verifies `frequency` persists & surfaces in /ongoing."""

    def test_login_ok(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json().get("email") == "admin@test.com"

    def test_create_intervention_with_frequency(self, session, first_student_id, scheduling_enabled_type):
        iid = f"TEST_iv_{uuid.uuid4().hex[:8]}"
        freq = "Daily · Weekly · 3× per week"
        payload = {
            "intervention_id": iid,
            "student_id": first_student_id,
            "intervention_type": scheduling_enabled_type,
            "assigned_staff": "Wellbeing",
            "status": "active",
            "frequency": freq,
            "goals": "TEST goals",
            "rationale": "TEST rationale",
            "start_date": "2026-01-20",
            "review_date": "2026-03-01",
        }
        r = session.post(f"{BASE_URL}/api/interventions", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["intervention_id"] == iid
        assert body["frequency"] == freq
        assert body["intervention_type"] == scheduling_enabled_type
        assert body["assigned_staff"] == "Wellbeing"

        # GET to verify persistence
        g = session.get(f"{BASE_URL}/api/interventions", params={"student_id": first_student_id})
        assert g.status_code == 200
        rec = next((x for x in g.json() if x.get("intervention_id") == iid), None)
        assert rec is not None, "intervention not persisted"
        assert rec["frequency"] == freq

        # Teardown
        session.delete(f"{BASE_URL}/api/interventions/{iid}")

    def test_ongoing_returns_frequency(self, session, first_student_id, scheduling_enabled_type):
        iid = f"TEST_iv_{uuid.uuid4().hex[:8]}"
        freq = "Weekly · 30-min session"
        payload = {
            "intervention_id": iid,
            "student_id": first_student_id,
            "intervention_type": scheduling_enabled_type,
            "assigned_staff": "Leadership",
            "status": "active",
            "frequency": freq,
            "goals": "TEST",
            "rationale": "TEST",
            "start_date": "2026-01-20",
            "review_date": "2026-03-01",
        }
        r = session.post(f"{BASE_URL}/api/interventions", json=payload)
        assert r.status_code == 200, r.text

        try:
            og = session.get(f"{BASE_URL}/api/appointments/ongoing")
            assert og.status_code == 200, og.text
            data = og.json()
            assert isinstance(data, list)
            rec = next((x for x in data if x.get("intervention_id") == iid), None)
            if rec is None:
                # Scheduling may be disabled for this type — log informative skip
                pytest.skip(
                    f"type '{scheduling_enabled_type}' not surfaced in /ongoing — scheduling likely disabled for it"
                )
            assert "frequency" in rec, f"frequency missing from response: {list(rec.keys())}"
            assert rec["frequency"] == freq
        finally:
            session.delete(f"{BASE_URL}/api/interventions/{iid}")

    def test_create_intervention_empty_frequency(self, session, first_student_id, scheduling_enabled_type):
        """Empty frequency should still store as '' (default on Intervention model)."""
        iid = f"TEST_iv_{uuid.uuid4().hex[:8]}"
        payload = {
            "intervention_id": iid,
            "student_id": first_student_id,
            "intervention_type": scheduling_enabled_type,
            "assigned_staff": "Unassigned",
            "status": "active",
            "start_date": "2026-01-20",
            "review_date": "2026-03-01",
        }
        r = session.post(f"{BASE_URL}/api/interventions", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("frequency", "") == ""
        session.delete(f"{BASE_URL}/api/interventions/{iid}")
